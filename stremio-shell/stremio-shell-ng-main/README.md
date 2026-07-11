## Stremio shell: new gen

A Windows-only shell using WebView2 and MPV

Goals:
* Performance
* Reliability
* Easy to ship

In all three, this architecture excels the [Qt-based shell](https://github.com/Stremio/stremio-shell): it is about 2-5x more efficient depending on the use case, as it allows MPV to render directly in the window through it's optimal video output rather than using libmpv to integrate with Qt.

This is due to Qt having a complex rendering pipeline involving ANGLE and multiple levels of composing and drawing to textures, which inhibits full HW acceleration.

Meanwhile in this setup MPV uses whichever pipeline it considers to be optimal (like the mpv desktop app), which is normally d3d11, allowing full HW acceleration.

For web rendering, we use the native WebView2, which is Chromium based but shipped as a part of Windows 10: therefore we do not need to ship our own "distribution" of Chromium.

Finally, this should be a lot more reliable as it uses a much simpler and more native overall architecture.

## Optional TIDAL integration

This fork can expose a local TIDAL tab backed by a user-run API on
`127.0.0.1:8000`. It includes search, albums, artists, playlists, My TIDAL,
liked items, queueing, shuffle/repeat, Auto DJ, lyrics, quality selection, and
mpv playback controls. Authentication is deliberately external to the shell:
tokens and provider credentials stay in the local API folder and are never
stored in this repository or release archives.

See [docs/TIDAL-PORTABLE-SETUP.md](docs/TIDAL-PORTABLE-SETUP.md) for the
portable setup and release-safety rules.
