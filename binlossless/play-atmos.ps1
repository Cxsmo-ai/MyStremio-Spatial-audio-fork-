param(
    [string]$InputUrl
)

if ([string]::IsNullOrWhiteSpace($InputUrl)) {
    $InputUrl = Read-Host "Enter Tidal Track URL, Playlist URL, or Track ID"
}

if ([string]::IsNullOrWhiteSpace($InputUrl)) {
    Write-Host "No input provided. Exiting."
    Start-Sleep -Seconds 2
    exit
}

if (-not (Get-Process "hifi-api-server" -ErrorAction SilentlyContinue)) {
    Write-Host "Starting hifi-api-server..."
    Start-Process "hifi-api-server.exe" -WindowStyle Hidden
    Start-Sleep -Seconds 2
}

$TrackIds = @()

if ($InputUrl -match "playlist/([a-zA-Z0-9\-]+)") {
    $PlaylistId = $Matches[1]
    Write-Host "Detected Playlist: $PlaylistId"
    Write-Host "Fetching tracks from Tidal API..."
    try {
        $headers = @{ "x-tidal-token" = "lw3vR6GE1vtNBsjv" }
        $resp = Invoke-RestMethod -Uri "https://api.tidal.com/v1/playlists/$PlaylistId/items?countryCode=US&limit=100" -Headers $headers
        foreach ($item in $resp.items) {
            $TrackIds += $item.item.id
        }
        Write-Host "Found $($TrackIds.Count) tracks in playlist."
    } catch {
        Write-Host "Failed to fetch playlist data from Tidal."
        Start-Sleep -Seconds 3
        exit
    }
} elseif (Test-Path $InputUrl) {
    Write-Host "Reading playlist file..."
    $lines = Get-Content $InputUrl
    foreach ($line in $lines) {
        if ($line -match "track/(\d+)") {
            $TrackIds += $Matches[1]
        } elseif ($line -match "^(\d+)+$") {
            $TrackIds += $line
        }
    }
} else {
    if ($InputUrl -match "track/(\d+)") {
        $TrackIds += $Matches[1]
    } elseif ($InputUrl -match "^(\d+)+$") {
        $TrackIds += $InputUrl
    } else {
        Write-Host "Could not extract a valid track or playlist ID from input."
        Start-Sleep -Seconds 3
        exit
    }
}

$M3uPath = Join-Path $PSScriptRoot "atmos_playlist.m3u"
Set-Content -Path $M3uPath -Value "#EXTM3U"

Write-Host "Processing $($TrackIds.Count) tracks..."
foreach ($TrackId in $TrackIds) {
    Write-Host "Fetching Atmos manifest for track ID: $TrackId"
    try {
        $response = Invoke-RestMethod -Uri "http://127.0.0.1:8000/trackManifests/?id=$TrackId"
        $uri = $response.data.data.attributes.uri
        
        if (-not [string]::IsNullOrWhiteSpace($uri)) {
            Add-Content -Path $M3uPath -Value "#EXTINF:-1,Tidal Track $TrackId"
            Add-Content -Path $M3uPath -Value $uri
        }
    } catch {
        Write-Host "Failed to fetch track $TrackId from hifi-api-server"
    }
}

Write-Host "Launching mpv-omniphony..."
$mpvPath = "d:\Apps\omniphony-libmpv-bundle\mpv.exe"
if (-not (Test-Path $mpvPath)) {
    Write-Host "Error: Cannot find $mpvPath"
    Start-Sleep -Seconds 4
    exit
}

Start-Process -FilePath $mpvPath -ArgumentList "--playlist=`"$M3uPath`"", "--ad=orender", "--audio-exclusive=yes", "--ao=wasapi"
Write-Host "Done!"
Start-Sleep -Seconds 2
