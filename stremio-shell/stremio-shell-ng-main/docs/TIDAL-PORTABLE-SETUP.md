# TIDAL portable setup

The TIDAL tab is an optional local integration. It does not embed a TIDAL
account token in the MyStremio source or executable. The tab talks to a local
TIDAL-compatible API at `http://127.0.0.1:8000` by default.

## First run

1. Start the local API from the portable `binlossless` folder.
2. Copy `.env.example` to `.env` and fill in the provider values locally.
3. Run the local authentication helper and complete the browser login.
4. Start MyStremio and open the TIDAL tab.

The authentication flow stores account/session data in the local API folder.
Those files are intentionally ignored by Git and are intentionally omitted
from release archives:

- `.env`
- `token.json` and its backups
- `tidalapi-session.json`
- API, mpv, and playback diagnostic logs

The public repository contains only code, placeholders, and documentation.
Never paste a token, client secret, signed manifest URL, or browser cookie into
an issue, pull request, log, screenshot, or release asset.

## API endpoint override

The tab endpoint can be changed locally with the browser storage key
`mystremio-tidal-api`. For example:

```text
http://127.0.0.1:8000
```

The TIDAL feature includes search, tracks, albums, artists, playlists, My
TIDAL collections, liked items, queueing, shuffle, repeat, Auto DJ, lyrics,
quality selection, and mpv playback controls. Atmos selection is requested
when the API reports an Atmos-capable manifest; otherwise the selected
lossless/hi-res format is used.

## Release safety

Portable releases are assembled from a clean staging directory. Runtime
credentials and test automation stay on the developer machine and are not
included in the ZIP.
