# Build MyStremio shell (requires MSVC Build Tools).
param(
    [string]$Target = "x86_64-pc-windows-msvc",
    [switch]$SkipShortcut
)

$ErrorActionPreference = "Stop"
$ProjectRoot = $PSScriptRoot
$ReleaseDir = Join-Path $ProjectRoot "target\$Target\release"
$RepoRoot = [System.IO.Path]::GetFullPath((Join-Path $ProjectRoot "..\.."))
$AppsRoot = [System.IO.Path]::GetFullPath((Join-Path $ProjectRoot "..\..\.."))
$PortableRoot = Join-Path $AppsRoot "MyStremio"
$PortableBuildRoot = Join-Path $PortableRoot "_build"
$RuntimeSource = Join-Path $PortableBuildRoot "stremio-runtime-source"
$DefaultAssetSource = Join-Path $RepoRoot "assets-bundle"
if (-not $env:MYSTREMIO_ASSET_SOURCE_ROOT) {
    $env:MYSTREMIO_ASSET_SOURCE_ROOT = $DefaultAssetSource
}

function Get-VsInstallPath {
    $VsWhere = Join-Path ${env:ProgramFiles(x86)} "Microsoft Visual Studio\Installer\vswhere.exe"
    if (-not (Test-Path $VsWhere)) {
        throw "vswhere.exe not found. Install Visual Studio Build Tools with the C++ workload."
    }
    $VsPath = & $VsWhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
    if (-not $VsPath) {
        throw "MSVC toolchain not found. Install Visual Studio Build Tools with the C++ workload."
    }
    return $VsPath
}

function Get-LatestMsvcBinPath {
    $VsPath = Get-VsInstallPath
    $ToolsRoot = Join-Path $VsPath "VC\Tools\MSVC"
    if (-not (Test-Path $ToolsRoot)) {
        throw "MSVC tools folder not found: $ToolsRoot"
    }
    $Latest = Get-ChildItem -Path $ToolsRoot -Directory | Sort-Object Name -Descending | Select-Object -First 1
    if (-not $Latest) {
        throw "No MSVC toolset versions found in: $ToolsRoot"
    }
    $Bin = Join-Path $Latest.FullName "bin\HostX64\x64"
    if (-not (Test-Path $Bin)) {
        throw "MSVC binary path not found: $Bin"
    }
    return $Bin
}

function Ensure-MpvImportLib {
    param([string]$Arch)

    if ($Arch -ne "x86_64-pc-windows-msvc") { return }

    $ImportDir = Join-Path $ProjectRoot "mpv-x64"
    $ImportLib = Join-Path $ImportDir "mpv.lib"
    if (Test-Path $ImportLib) { return }

    $DllCandidates = @(
        $env:OMNIPHONY_LIBMPV,
        (Join-Path $AppsRoot "omniphony-libmpv-bundle\libmpv-2.dll"),
        (Join-Path $ProjectRoot "libmpv-2.dll"),
        (Join-Path $RuntimeSource "libmpv-2.dll"),
        (Join-Path $env:LOCALAPPDATA "Programs\Stremio\libmpv-2.dll")
    ) | Where-Object { $_ }
    $MpvDll = $DllCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
    if (-not $MpvDll) {
        throw "libmpv-2.dll not found. Install Stremio Desktop or place libmpv-2.dll in project root."
    }

    New-Item -ItemType Directory -Path $ImportDir -Force | Out-Null
    Copy-Item -Path $MpvDll -Destination (Join-Path $ImportDir "libmpv-2.dll") -Force

    $MsvcBin = Get-LatestMsvcBinPath
    $DumpBin = Join-Path $MsvcBin "dumpbin.exe"
    $LibExe = Join-Path $MsvcBin "lib.exe"
    if (-not (Test-Path $DumpBin) -or -not (Test-Path $LibExe)) {
        throw "MSVC tools dumpbin.exe/lib.exe not found in: $MsvcBin"
    }

    $DumpOut = & $DumpBin /EXPORTS $MpvDll
    if ($LASTEXITCODE -ne 0) {
        throw "Could not read exports from $MpvDll"
    }

    $Exports = New-Object System.Collections.Generic.List[string]
    foreach ($line in $DumpOut) {
        if ($line -match '^\s+\d+\s+[0-9A-F]+\s+[0-9A-F]+\s+(\S+)$') {
            $name = $matches[1].Trim()
            if ($name -and -not $name.StartsWith("[")) {
                $Exports.Add($name)
            }
        }
    }
    if ($Exports.Count -eq 0) {
        throw "No exports found in $MpvDll (cannot generate mpv.lib)."
    }

    $DefFile = Join-Path $ImportDir "mpv.def"
    $DefLines = @("LIBRARY libmpv-2.dll", "EXPORTS")
    $DefLines += $Exports | Sort-Object -Unique | ForEach-Object { "    $_" }
    Set-Content -Path $DefFile -Value $DefLines -Encoding ASCII

    & $LibExe "/def:$DefFile" "/machine:x64" "/name:libmpv-2.dll" "/out:$ImportLib" | Out-Null
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path $ImportLib)) {
        throw "Failed to generate import library: $ImportLib"
    }

    # Keep only import artifacts in mpv-x64; runtime DLL is copied to release output later.
    $ImportDll = Join-Path $ImportDir "libmpv-2.dll"
    if (Test-Path $ImportDll) {
        Remove-Item -Path $ImportDll -Force -ErrorAction SilentlyContinue
    }
}

function Ensure-Cargo {
    $ToolchainBin = Join-Path $PortableBuildRoot "rust-toolchain\bin"
    $CargoBin = Join-Path $ToolchainBin "cargo.exe"
    $RustcBin = Join-Path $ToolchainBin "rustc.exe"
    if ((Test-Path $CargoBin) -and (Test-Path $RustcBin)) {
        return @{
            Cargo = $CargoBin
            Rustc = $RustcBin
        }
    }
    if (Get-Command cargo -ErrorAction SilentlyContinue) {
        return @{
            Cargo = (Get-Command cargo).Source
            Rustc = ""
        }
    }
    $CargoBin = Join-Path $env:USERPROFILE ".cargo\bin\cargo.exe"
    if (Test-Path $CargoBin) {
        $env:Path = "$(Split-Path $CargoBin);$env:Path"
        return @{
            Cargo = $CargoBin
            Rustc = ""
        }
    }
    throw "Rust/Cargo not found. Install from https://rustup.rs/"
}

function Get-VcVarsBat {
    $VsPath = Get-VsInstallPath
    return (Join-Path $VsPath "VC\Auxiliary\Build\vcvars64.bat")
}

$RustTools = Ensure-Cargo
Ensure-MpvImportLib -Arch $Target
$VcVars = Get-VcVarsBat
$TargetDir = Join-Path $ProjectRoot "target"

& (Join-Path $ProjectRoot "scripts\build-webui.ps1")

$BuildCmd = @(
    "call `"$VcVars`"",
    "set `"CARGO_HOME=$PortableBuildRoot\cargo-home`"",
    $(if ($RustTools.Rustc) { "set `"RUSTC=$($RustTools.Rustc)`"" } else { $null }),
    "set `"CARGO_TARGET_DIR=$TargetDir`"",
    "cd /d `"$ProjectRoot`"",
    "`"$($RustTools.Cargo)`" build --release --target $Target"
) | Where-Object { $_ }
$BuildCmd = $BuildCmd -join " && "

Write-Host "Building mystremio-shell ($Target)..."
cmd /c $BuildCmd
if ($LASTEXITCODE -ne 0) {
    throw "cargo build failed with exit code $LASTEXITCODE"
}

& (Join-Path $ProjectRoot "scripts\prepare-runtime.ps1") -OutputDir $ReleaseDir -SourceDir $RuntimeSource

if (-not $SkipShortcut) {
    & (Join-Path $ProjectRoot "scripts\create-desktop-shortcut.ps1") -ReleaseDir $ReleaseDir
}

Write-Host "Build complete: $(Join-Path $ReleaseDir 'mystremio-shell.exe')"
