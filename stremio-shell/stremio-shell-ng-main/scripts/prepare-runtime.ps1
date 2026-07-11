# Copies Stremio streaming-server runtime files next to the built shell executable.
param(
    [string]$OutputDir = (Join-Path $PSScriptRoot "..\target\x86_64-pc-windows-msvc\release"),
    [string]$SourceDir = ""
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$AppsRoot = [System.IO.Path]::GetFullPath((Join-Path $ProjectRoot "..\..\.."))
$DefaultOmniphonyBundle = Join-Path $AppsRoot "omniphony-libmpv-bundle"
$OutputDir = [System.IO.Path]::GetFullPath($OutputDir)

$RuntimeFiles = @(
    "stremio-runtime.exe",
    "ffmpeg.exe",
    "ffprobe.exe",
    "avcodec-58.dll",
    "avdevice-58.dll",
    "avfilter-7.dll",
    "avformat-58.dll",
    "avutil-56.dll",
    "postproc-55.dll",
    "swresample-3.dll",
    "swscale-5.dll",
    "vcruntime140.dll",
    "vcruntime140_1.dll"
)

function Resolve-RuntimeSource {
    param([string]$Preferred)

    $Candidates = @()
    if ($Preferred) {
        $Candidates += $Preferred
    }

    $Candidates += @(
        (Join-Path $env:LOCALAPPDATA "Programs\Stremio")
    )

    foreach ($Candidate in $Candidates) {
        if (-not $Candidate) { continue }
        $RuntimeExe = Join-Path $Candidate "stremio-runtime.exe"
        if (Test-Path $RuntimeExe) {
            return (Resolve-Path $Candidate).Path
        }
    }

    throw @"
Runtime source not found.

Install Stremio Desktop once, or pass -SourceDir to a folder containing:
  stremio-runtime.exe, ffmpeg.exe, ffprobe.exe, and the ffmpeg DLLs.

Default search path:
  $env:LOCALAPPDATA\Programs\Stremio
"@
}

if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
}

$Source = Resolve-RuntimeSource -Preferred $SourceDir
Write-Host "Runtime source: $Source"
Write-Host "Output dir:     $OutputDir"

foreach ($File in $RuntimeFiles) {
    $From = Join-Path $Source $File
    if (-not (Test-Path $From)) {
        throw "Missing runtime file in source: $From"
    }
    Copy-Item -Path $From -Destination (Join-Path $OutputDir $File) -Force
}

# Patched server.js from this repo (localhost baseUrl fix).
$ServerJs = Join-Path $ProjectRoot "server.js"
if (-not (Test-Path $ServerJs)) {
    throw "Missing patched server.js in project root: $ServerJs"
}
Copy-Item -Path $ServerJs -Destination (Join-Path $OutputDir "server.js") -Force

$WebUiServerJs = Join-Path $ProjectRoot "webui-server.js"
if (Test-Path $WebUiServerJs) {
    Copy-Item -Path $WebUiServerJs -Destination (Join-Path $OutputDir "webui-server.js") -Force
}

$WebUiDir = Join-Path $ProjectRoot "webui"
if (Test-Path $WebUiDir) {
    $WebUiOut = Join-Path $OutputDir "webui"
    if (Test-Path $WebUiOut) {
        Remove-Item $WebUiOut -Recurse -Force
    }
    New-Item -ItemType Directory -Path $WebUiOut -Force | Out-Null
    Copy-Item -Path (Join-Path $WebUiDir "*") -Destination $WebUiOut -Recurse -Force
    Write-Host "Copied local web UI to $WebUiOut"
}

function Ensure-WebUiScript {
    param(
        [string]$WebUiOut,
        [string]$ScriptSource,
        [string]$ScriptName
    )

    if (-not (Test-Path $WebUiOut) -or -not (Test-Path $ScriptSource)) { return }
    Copy-Item -Path $ScriptSource -Destination (Join-Path $WebUiOut $ScriptName) -Force
    $IndexPath = Join-Path $WebUiOut "index.html"
    if (-not (Test-Path $IndexPath)) { return }
    $Tag = "<script src=`"$ScriptName`"></script>"
    $Html = Get-Content $IndexPath -Raw
    if ($Html -like "*$Tag*") { return }
    $WorkerMarker = '<script src="eb5752673c6ac87e7137a6c3cca21a6980028cf9/scripts/worker.js">'
    if ($Html -like "*$WorkerMarker*") {
        $Html = $Html.Replace($WorkerMarker, "$Tag$WorkerMarker")
    } else {
        $Html = $Html.Replace("</body>", "$Tag</body>")
    }
    Set-Content -Path $IndexPath -Value $Html -Encoding UTF8
    Write-Host "Injected $ScriptName into $IndexPath"
}

$SmartVibranceScript = Join-Path $ProjectRoot "assets\custom_smart_vibrance.js"
Ensure-WebUiScript -WebUiOut (Join-Path $OutputDir "webui") -ScriptSource $SmartVibranceScript -ScriptName "mystremio-smart-vibrance.js"
$TidalTabScript = Join-Path $ProjectRoot "assets\custom_tidal_tab.js"
Ensure-WebUiScript -WebUiOut (Join-Path $OutputDir "webui") -ScriptSource $TidalTabScript -ScriptName "mystremio-tidal-tab.js"

# libmpv DLL: build.rs extracts/copies it to project root during cargo build.
$LibMpvCandidates = @(
    (Join-Path $ProjectRoot "libmpv-2.dll"),
    (Join-Path $Source "libmpv-2.dll")
)
$LibMpvCopied = $false
foreach ($LibMpv in $LibMpvCandidates) {
    if (Test-Path $LibMpv) {
        Copy-Item -Path $LibMpv -Destination (Join-Path $OutputDir "libmpv-2.dll") -Force
        Write-Host "Copied libmpv-2.dll from $LibMpv"
        $LibMpvCopied = $true
        break
    }
}
if (-not $LibMpvCopied) {
    Write-Warning "libmpv-2.dll not found yet. Run 'cargo build --release' first, or copy it manually."
}

function Copy-DirectoryContents {
    param(
        [string]$From,
        [string]$To
    )

    if (-not (Test-Path $From)) { return $false }
    if (Test-Path $To) {
        Remove-Item $To -Recurse -Force
    }
    New-Item -ItemType Directory -Path $To -Force | Out-Null
    Copy-Item -Path (Join-Path $From "*") -Destination $To -Recurse -Force
    return $true
}

function Sync-OmniphonyRuntime {
    $Bundle = $env:OMNIPHONY_LIBMPV_BUNDLE
    if (-not $Bundle) {
        $Bundle = $DefaultOmniphonyBundle
    }
    if (-not (Test-Path $Bundle)) {
        Write-Warning "Omniphony libmpv bundle not found: $Bundle"
        return
    }

    Write-Host "Omniphony bundle: $Bundle"

    Get-ChildItem -Path $Bundle -File -ErrorAction SilentlyContinue |
        Where-Object { $_.Extension -in @(".dll", ".exe", ".com", ".txt") -or $_.Name -eq "orender.h" } |
        ForEach-Object {
            Copy-Item -Path $_.FullName -Destination (Join-Path $OutputDir $_.Name) -Force
        }

    foreach ($DirName in @("configs", "layouts")) {
        $From = Join-Path $Bundle $DirName
        $To = Join-Path $OutputDir $DirName
        if (Copy-DirectoryContents -From $From -To $To) {
            Write-Host "Copied Omniphony $DirName to $To"
        }
    }

    $PortableConfig = Join-Path $OutputDir "portable_config"
    if (-not (Test-Path $PortableConfig)) {
        New-Item -ItemType Directory -Path $PortableConfig -Force | Out-Null
    }

    $ShaderDir = Join-Path $PortableConfig "shaders"
    New-Item -ItemType Directory -Path $ShaderDir -Force | Out-Null
    $ShaderSource = Join-Path $ProjectRoot "assets\Smart_Vibrance_Plus.glsl"
    $OriginalShaderSource = Join-Path $ProjectRoot "assets\Smart_Vibrance_Plus.PotPlayer.txt"
    if (Test-Path $ShaderSource) {
        Copy-Item -Path $ShaderSource -Destination (Join-Path $ShaderDir "Smart_Vibrance_Plus.glsl") -Force
    }
    if (Test-Path $OriginalShaderSource) {
        Copy-Item -Path $OriginalShaderSource -Destination (Join-Path $ShaderDir "Smart_Vibrance_Plus.PotPlayer.txt") -Force
    }

    $PortableMpvConf = Join-Path $PortableConfig "mpv.conf"
    $OmniphonyConfig = @(
        "config=yes",
        "vo=gpu-next,",
        "gpu-api=vulkan",
        "hwdec=auto",
        "ad=orender,lavc,",
        "ad-orender-library=orender.dll",
        "ad-orender-bridge-path=harletty_bridge.dll",
        "ad-orender-config=configs/binaural-headphones.yaml",
        "ad-orender-osc=yes",
        "ad-orender-osc-rx-port=9000",
        "ad-orender-osc-port=9000",
        "ad-orender-osc-bind=127.0.0.1",
        "ad-orender-osc-monitor-target=127.0.0.1"
    )
    if (Test-Path $PortableMpvConf) {
        $Existing = Get-Content $PortableMpvConf -Raw
        if ($Existing -notmatch "ad-orender-library") {
            Add-Content -Path $PortableMpvConf -Value ""
            Add-Content -Path $PortableMpvConf -Value "# Omniphony libmpv runtime"
            Add-Content -Path $PortableMpvConf -Value $OmniphonyConfig
        } else {
            $ExistingConfig = (Get-Content $PortableMpvConf -Raw) `
                -replace 'ad-orender-osc-port=\d+', 'ad-orender-osc-port=9000' `
                -replace 'ad-orender-osc-rx-port=\d+', 'ad-orender-osc-rx-port=9000' `
                -replace '(?m)^ad-orender-config=.*$', 'ad-orender-config=configs/binaural-headphones.yaml'
            $ExistingConfig = $ExistingConfig -replace '(?m)^ad-orender-channel-render-mode=.*\r?\n?', ''
            if ($ExistingConfig -notmatch '(?m)^gpu-api=') {
                $ExistingConfig = $ExistingConfig -replace '(?m)^(vo=gpu-next,?\r?\n)', "`$1gpu-api=vulkan`r`n"
            } else {
                $ExistingConfig = $ExistingConfig -replace '(?m)^gpu-api=.*$', 'gpu-api=vulkan'
            }
            $ExistingConfig | Set-Content -Path $PortableMpvConf -Encoding UTF8
        }
    } else {
        Set-Content -Path $PortableMpvConf -Value $OmniphonyConfig -Encoding UTF8
    }

    $PortableInputConf = Join-Path $PortableConfig "input.conf"
    $OverlayBindings = @(
        "# Omniphony spatial overlay",
        "Ctrl+o script-binding omniphony_overlay/toggle",
        "Ctrl+l script-binding omniphony_overlay/labels",
        "Ctrl+Shift+o script-binding omniphony_overlay/objects",
        "Ctrl+t script-binding omniphony_overlay/trails",
        "Ctrl+h script-binding omniphony_overlay/heatmap",
        "Ctrl+c script-binding omniphony_overlay/heatmap-colormap",
        "Ctrl+= script-binding omniphony_overlay/heatmap-bands-inc",
        "Ctrl+- script-binding omniphony_overlay/heatmap-bands-dec"
    )
    if (Test-Path $PortableInputConf) {
        $ExistingInput = Get-Content $PortableInputConf -Raw
        if ($ExistingInput -notmatch "omniphony_overlay/toggle") {
            Add-Content -Path $PortableInputConf -Value ""
            Add-Content -Path $PortableInputConf -Value $OverlayBindings
        }
    } else {
        Set-Content -Path $PortableInputConf -Value $OverlayBindings -Encoding UTF8
    }

    $PortableYaml = Join-Path $OutputDir "configs\omniphony-portable.yaml"
    $BinauralYaml = Join-Path $OutputDir "configs\binaural-headphones.yaml"
    $FullYaml = @(
        "render:",
        "  bridge_path: harletty_bridge.dll",
        "  speaker_layout: layouts/7.1.4.yaml",
        "  enable_vbap: true",
        "  channel_render_mode: spatial",
        "  output_channel_mapping: by_index",
        "  ramp_mode: frame",
        "  binaural:",
        "    output_mode: binaural",
        "    unit_scale_m: 1.0",
        "    head_radius_m: 0.0875",
        "    hrir_source: saf",
        "    reflections:",
        "      enabled: true",
        "      room_width_m: 4.0",
        "      room_depth_m: 5.0",
        "      room_height_m: 2.7",
        "      level: 0.35",
        "    reverb:",
        "      enabled: false",
        "      level: 0.12",
        "      rt60_s: 0.35",
        "      predelay_ms: 20",
        "    air_absorption: true",
        "  osc: true",
        "  osc_metering: true",
        "  osc_rx_port: 9000",
        "  osc_host: 127.0.0.1",
        "  osc_port: 9000",
        "  meter_rate: 30.0",
        "  diag_rate: 10.0",
        "  use_loudness: true",
        "  auto_gain: true",
        "  auto_gain_ceiling_db: -1.0"
    )
    Set-Content -Path $PortableYaml -Value $FullYaml -Encoding UTF8
    $BinauralFullYaml = @(
        "render:",
        "  bridge_path: harletty_bridge.dll",
        "  speaker_layout: layouts/7.1.4.yaml",
        "  enable_vbap: true",
        "  channel_render_mode: spatial",
        "  output_channel_mapping: by_index",
        "  ramp_mode: frame",
        "  binaural:",
        "    output_mode: binaural",
        "    unit_scale_m: 1.0",
        "    head_radius_m: 0.0875",
        "    hrir_source: saf",
        "    reflections:",
        "      enabled: true",
        "      room_width_m: 4.0",
        "      room_depth_m: 5.0",
        "      room_height_m: 2.7",
        "      level: 0.35",
        "    reverb:",
        "      enabled: false",
        "      level: 0.12",
        "      rt60_s: 0.35",
        "      predelay_ms: 20",
        "    air_absorption: true",
        "  osc: true",
        "  osc_metering: true",
        "  osc_rx_port: 9000",
        "  osc_host: 127.0.0.1",
        "  osc_port: 9000",
        "  meter_rate: 30.0",
        "  diag_rate: 10.0",
        "  use_loudness: true",
        "  auto_gain: true",
        "  auto_gain_ceiling_db: -1.0"
    )
    Set-Content -Path $BinauralYaml -Value $BinauralFullYaml -Encoding UTF8

    Write-Host "Omniphony libmpv runtime synced to $OutputDir"
}

Sync-OmniphonyRuntime

Write-Host "Runtime files prepared in $OutputDir"

if (-not $env:MYSTREMIO_ASSET_SOURCE_ROOT) {
    throw "MYSTREMIO_ASSET_SOURCE_ROOT is not set. Build now requires an explicit project asset source."
}
& (Join-Path $PSScriptRoot "sync-custom-assets.ps1") -ReleaseDir $OutputDir -SourceRoot $env:MYSTREMIO_ASSET_SOURCE_ROOT
