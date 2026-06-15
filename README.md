# MyStremio

**MyStremio** is a customized Windows desktop client based on the Stremio shell. It bundles enhanced playback, interface tweaks, library collections, Discord Rich Presence, and many plugins — all in one installer.

> **Disclaimer:** MyStremio is an independent community project. It is not affiliated with or endorsed by Stremio AG.

---

## Installation

You only need **one file** — just like the official Stremio installer.

1. Open the [GitHub Releases](https://github.com/YOUR_USERNAME/MyStremio/releases) page.
2. Download **`MyStremioSetup-v2.1.2_x64.exe`** (or the latest version).
3. Run the installer. It installs everything automatically:
   - Application binaries (`mystremio-shell.exe`, streaming server, FFmpeg, libmpv)
   - Bundled plugins and themes
   - WebView2 runtime (installed automatically if missing)
   - Protocol handlers (`stremio://`, `magnet:`, optional `.torrent`)
4. Launch **MyStremio** from the Start menu or desktop shortcut.

### Install location

| What | Path |
|------|------|
| Application | `%LOCALAPPDATA%\Programs\MyStremio\` |
| User settings & addons | `%APPDATA%\MyStremio\` |

No portable ZIP or extra downloads are required. The installer is fully self-contained.

### Requirements

- Windows 10/11 (64-bit)
- Internet connection (for Stremio web UI and addons)
- Optional: API keys for enrichment plugins (TMDB, TheIntroDB, etc.) — configure after install in **Settings → MyStremio**

### Uninstall

Use **Settings → Apps → MyStremio** or the uninstaller from the Start menu. You can optionally delete `%APPDATA%\MyStremio\` to remove all personal data.

---

## Custom features

### Player & playback

| Feature | Description |
|---------|-------------|
| **Autoskip** | Skip intros, outros, and credits (AniSkip + TheIntroDB integration) |
| **Seek buffer** | Improved seeking and buffer handling with hover timestamp preview |
| **Stream cache** | Caches stream metadata for faster re-selection |
| **Player glass UI** | Frosted-glass styling on the player overlay |
| **Player loading** | Enhanced loading states during playback start |
| **Favorite languages** | Prefer audio/subtitle languages; dedicated settings page |
| **Playback API** | Extended playback control hooks for plugins |
| **Enhanced player** | Subtitle styling, ASS cleanup, RTL fixes, title display |
| **Enhanced external player** | Launch VLC, MPC-HC, and other external players |
| **Stream UI** | Unified stream list with ratings, accordions, AfterCredits, WatchHub |
| **Stream quality picker** | Groups streams by resolution with smart ranking and “Best Pick” |
| **AniSkip** | Anime opening/ending skip (Kitsu metadata) |
| **TheIntroDB** | Skip intros, recaps, credits, and previews |

### Library & navigation

| Feature | Description |
|---------|-------------|
| **Library collections** | Create custom folders (Watchlist, Favorites, etc.) via **+** in the library filter bar |
| **Add to collection** | Right-click or **Shift+click** library items to add/remove from active collection |
| **Liquid Glass navigation** | Built-in top navigation styling integrated with the Liquid Glass theme |
| **Scroll restore** | Remembers scroll position when navigating back |
| **Slash to search** | Press `/` to focus the search bar from the main menu |

### Interface & themes

| Feature | Description |
|---------|-------------|
| **Liquid Glass theme** | Modern glassmorphism UI (default) |
| **Dynamic Hero** | Netflix-style rotating hero banner on the home screen |
| **Enhanced covers** | Wider Continue Watching posters with logo overlay |
| **Enhanced title bar** | Extra info in the window title bar |
| **Context menu fix** | Context menus render above all UI layers |
| **Custom settings UI** | Dedicated **MyStremio** section in Stremio settings |

### Metadata & discovery

| Feature | Description |
|---------|-------------|
| **Data enrichment** | TMDB-powered cast, similar titles, collections, ratings (requires TMDB API key) |
| **Meta hover panel** | Rich info panel when hovering posters |

### Integrations & utilities

| Feature | Description |
|---------|-------------|
| **Discord Rich Presence** | Shows what you are watching in Discord |
| **Cinebye addons** | Built-in Cinebye addon helper integration |
| **DOM inspector** | Developer tool for inspecting Stremio’s DOM |
| **Plugin initializer** | Loads and validates bundled plugins |

### Settings location

Open **Settings** (`#/settings`) → **MyStremio** for app-specific options (Discord, autoskip, themes, plugin configs).

---

## First-time setup

1. Install and launch MyStremio.
2. Log in with your Stremio account (or continue as guest).
3. Install your preferred addons via the addon catalog.
4. Open **Settings → MyStremio** to configure optional API keys:
   - **TMDB** — for Data Enrichment (free key at [themoviedb.org](https://www.themoviedb.org/settings/api))
   - **TheIntroDB** — for intro/credits skip
5. Create library collections with the **+** button in the library filter bar.

---

## Building from source (developers)

Requires: Rust (MSVC), Visual Studio Build Tools, Inno Setup 6, and Stremio Desktop installed once (for runtime binaries).

```powershell
cd stremio-shell\stremio-shell-ng-main
.\package-release.ps1
```

Output: `release\MyStremioSetup-v2.1.2_x64.exe`

To assemble a clean GitHub folder from the parent repository:

```powershell
.\publish-github.ps1
```

---

## Privacy & data

- **No API keys or personal settings are bundled** in the installer. Plugin config files ship with empty keys.
- Your library collections, addon settings, and preferences are stored locally in `%APPDATA%\MyStremio\`.
- Discord Rich Presence only sends activity when enabled and connected.

---

## License & third-party

MyStremio builds on the Stremio shell and includes third-party plugins and themes. See `mystremio/build/THIRD-PARTY-NOTICES.txt` for attributions.

Stremio® is a trademark of Smart Code OOD. This project is a community modification and is not officially supported by Stremio.

---

## Patch Notes

### 2.1.2

- Reduced background maintenance frequency to lower idle CPU and RAM usage.
- Fixed custom library selection persistence so clicked items no longer stay pinned across Board/Player transitions.
- Fixed custom library collection persistence across reload/update paths (folders and assigned titles are now retained reliably).
- Improved start-to-player transition: avoids white flash and keeps dark/poster-first loading visuals.
- Quick Select language state (favorite and active audio/subtitle choices) now persists across app sessions.
- Discord Rich Presence settings now persist reliably across session reloads and app updates/reinstalls.
- Preload setting persistence was hardened for update/reinstall scenarios.
- Enabled these plugins by default on first launch: Context Menu Fix, Enhanced Covers, Enhanced Titlebar, Dynamic Hero, Data Enrichment, Meta Hover.
- Added first-run top-right notice (English) prompting users to add a TMDB API key for Data Enrichment.
- Fixed Stream UI settings schema loading so Stream UI options are editable again from the MyStremio settings panel.
- Stream detail accordions now default to closed and remember user open/closed choices for the current session.
- Added clickable API key helper links in settings for TMDB (Data Enrichment) and TheIntroDB.
- Plugin category dropdown panels now stay open while scrolling until manually closed.
- Added short global transition loading mask to hide brief unstyled/plugin-loading UI during app start and page switches.
- Removed deprecated plugins and themes from app bundle and docs: PiP, Filter Streams, Enhancements Tweaks, Horizontal Navigation, Card Hover Info, Playback Preview, Trending Anime, AMOLED, Hide Titlebar Buttons.
- Removed remaining Community Market integration code paths and references.
- Fixed Data Enrichment mount targeting to avoid UI bleed into the bottom player bar when launching playback from board cards.
- Added RPDB helper link in Data Enrichment settings (next to TMDB/TheIntroDB helper links).
- Added seek-bar hover timestamp preview with Liquid Glass styling and tuned closer placement/legibility.
- Updated release metadata and app version to `2.1.2`.
