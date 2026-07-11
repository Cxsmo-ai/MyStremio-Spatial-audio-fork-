MyStremio Spatial Audio Fork

""Version" (https://img.shields.io/badge/version-2.3.0-green.svg)" (https://github.com/Cxsmo-ai/MyStremio-Spatial-audio-fork-/releases)
"Platform" (https://img.shields.io/badge/platform-Windows-blue.svg)
"License" (https://img.shields.io/badge/license-MIT-blue.svg)

"Visit the official repository: Cxsmo-ai/MyStremio-Spatial-audio-fork-" (https://github.com/Cxsmo-ai/MyStremio-Spatial-audio-fork-)

«Note: This project is a fork of the original "MyStremio by AlphiiJr" (https://github.com/AlphiiJr/MyStremio). Huge thanks to the original creator for providing the foundation.»

MyStremio Spatial Audio Fork is a personalized Windows desktop client built on the Stremio shell stack.

It combines interface upgrades, native MPV playback, themes, plugins, library tools, Discord Rich Presence, TIDAL integration, and advanced spatial-audio playback in one installer or portable release.

The spatial-audio edition includes an Omniphony MPV Atmos bridge that can intercept compatible TIDAL playback, retrieve Dolby Atmos manifests through a local Binlossless API service, and route them into the custom Omniphony MPV player.

Current release: 2.3.0

«Disclaimer: MyStremio is an independent community project. It is not affiliated with, sponsored by, or endorsed by official Stremio, TIDAL, Dolby, or Omniphony.»

---

📌 Table of Contents

- "How MyStremio differs from official Stremio" (#-how-mystremio-differs-from-official-stremio)
- "Support" (#️-support)
- "Architecture" (#️-architecture)
- "Features" (#-features)
  - "Board hero home view" (#-board-hero-home-view)
  - "Hover metadata" (#️-hover-metadata-in-catalogs)
  - "Detail view and StreamUI" (#️-detail-view-with-metadata-and-stream-sidebar)
  - "Cinebye Addon Manager" (#️-cinebye-addon-manager)
  - "Favorite languages" (#-favorite-subtitle-and-audio-languages)
  - "Quick Select" (#-quick-select-language-shortcuts)
  - "Themes and plugins" (#️-settings-themes-and-plugins)
  - "Preload, library backup, and Discord" (#️-settings-preload-library-backup-and-discord)
  - "TheIntroDB submission" (#️-theintrodb-timestamp-submission)
  - "Seek buttons" (#️-seek-buttons)
  - "TIDAL Atmos spatial audio" (#-tidal-atmos-spatial-audio)
- "How the TIDAL Atmos bridge works" (#️-how-the-tidal-atmos-bridge-works)
- "Planned features" (#-planned-features)
- "Patch notes" (#️-patch-notes)
- "Known issues" (#-known-issues)
- "Installation" (#-installation)
  - "Requirements" (#-requirements)
  - "Portable installation" (#-portable-installation)
  - "Installer installation" (#-installer-installation)
  - "Omniphony Studio setup" (#-omniphony-studio-setup)
  - "TIDAL authentication" (#-tidal-authentication)
  - "Install paths" (#-install-paths)
  - "Uninstall" (#️-uninstall)
- "First-time setup" (#-first-time-setup)
- "Using TIDAL Atmos playback" (#-using-tidal-atmos-playback)
- "TIDAL Atmos configuration" (#️-tidal-atmos-configuration)
- "Themes and plugins" (#-themes-and-plugins-manual-files)
- "Build from source" (#️-build-from-source-developers)
- "Privacy and local data" (#-privacy-and-local-data)
- "Contributing" (#-contributing)
- "Credits" (#-credits)
- "License" (#-license)
- "Feedback" (#-feedback)

---

❓ How MyStremio differs from official Stremio

MyStremio includes several changes and additions beyond the official Stremio desktop client:

- Native playback through a custom MPV build.
- Omniphony spatial-audio rendering and binaural headphone output.
- TIDAL Atmos manifest routing through the included local integration.
- Improved player tools, including hover timestamps, seek buttons, brightness control, configurable preload behavior, and skip-segment support.
- Better stream organization and metadata presentation.
- Integrated Cinebye addon management.
- Custom library groups with JSON import and export.
- Theme and plugin controls.
- Discord Rich Presence.
- Portable and installer-based distributions.
- Isolated settings and user data that do not interfere with a standard Stremio installation.

---

❤️ Support

To support the original MyStremio developer, you can leave a tip through "Ko-fi" (https://ko-fi.com/xalphiijr).

---

🏗️ Architecture

MyStremio is a heavily modified Windows Stremio client that uses a Rust and WebView2 shell instead of Electron.

Rust-based WebView2 shell

The "stremio-shell-ng-main" component acts as the main application orchestrator.

It manages:

- The application window.
- The local Stremio server.
- WebView2 integration.
- Native player communication.
- Local settings.
- Discord Rich Presence.
- Application startup and update handling.

Bundled local Stremio Web UI

MyStremio includes a patched local Stremio Web bundle instead of depending exclusively on the public Stremio website.

This allows features such as the board hero banner and MyStremio settings to be integrated directly into the React interface.

Runtime JavaScript injections

Additional features are provided through scripts such as:

assets/custom_*.js

These scripts extend or modify the Web UI at runtime to provide features such as:

- Liquid Glass visual styling.
- Smart Vibrance.
- Seek controls.
- Player overlays.
- Plugin integration.
- Metadata panels.
- Language shortcuts.

MPV Omniphony player

Media decoding is delegated to a custom MPV build with Omniphony spatial-audio support.

The player can route compatible audio into the "orender" engine for:

- Multichannel spatial playback.
- Binaural headphone rendering.
- Head-tracked listening where configured.
- Room and listener positioning.
- Master normalization.
- High-channel-count content handling.

Omniphony Studio

Omniphony Studio is the companion control application for the renderer.

It provides access to settings such as:

- Binaural or speaker-rendering mode.
- Room dimensions.
- Listener position.
- Unit scale.
- Master normalization.
- OSC and renderer controls.

Binlossless API and TIDAL bridge

The Atmos edition includes a local Binlossless-compatible API service and a TIDAL integration plugin.

Together they can:

1. Identify the selected TIDAL track.
2. Request a compatible Atmos manifest.
3. Pass the returned stream URI to the custom MPV bundle.
4. Synchronize playback controls between TIDAL and MPV.
5. Fall back to normal TIDAL playback when no Atmos stream is available.

Custom API and isolated storage

MyStremio stores its settings separately from vanilla Stremio.

The primary user-data location is:

%APPDATA%\MyStremio\

This prevents most MyStremio settings, plugins, and library data from conflicting with a normal Stremio installation.

---

🚀 Features

🏠 Board hero home view

The board includes a rotating hero section for featured titles.

The theme is based on "Fxy6969/Stremio-Glass-Theme" (https://github.com/Fxy6969/Stremio-Glass-Theme) with additional MyStremio optimizations.

<p align="center">
  <img src="./images/01-board-hero.png" alt="Board Hero Home" width="1000"/>
</p>🖱️ Hover metadata in catalogs

While browsing catalogs, hover cards can display information such as:

- Plot summary.
- Genres.
- Cast.
- Year.
- Additional metadata.

This provides more information without requiring a full page change.

<p align="center">
  <img src="./images/02-catalog-hover.png" alt="Catalog Hover Metadata" width="1000"/>
</p>📖 Detail view with metadata and stream sidebar

The Data Enrichment plugin by MrBlu03 can enhance detail pages with cast information and similar titles when a TMDB API key is configured.

The StreamUI plugin provides a cleaner sidebar with categorized stream folders.

StreamUI supports many commonly used addons, including:

- Most torrent addons.
- "WatchHub" (https://stremio-addons.net/addons/watchhub)
- "Ratings Aggregator" (https://stremio-addons.net/addons/ratings-aggregator)
- "IMDb Ratings" (https://stremio-addons.net/addons/imdb-ratings)
- "AfterCredits" (https://aftercredits.almosteffective.com/configure.html)

<p align="center">
  <img src="./images/03-detail-metadata-stream-sidebar.png" alt="Metadata and Stream UI" width="1000"/>
</p>🎞️ Cinebye Addon Manager

"Cinebye" (https://cinebye.elfhosted.com/) is integrated into MyStremio.

It can be used to manage Stremio addons and optionally disable individual metadata sources such as Cinemeta.

<p align="center">
  <img src="./images/04-cinebye-addon-manager.png" alt="Cinebye Addon Manager" width="1000"/>
</p>🌐 Favorite subtitle and audio languages

Player settings allow you to define a preferred pool of subtitle and audio languages.

These preferences are used by the Quick Select controls during playback.

<p align="center">
  <img src="./images/05-favorite-languages-subtitles.png" alt="Favorite Languages for Subtitles and Audio"/>
</p>⚡ Quick Select language shortcuts

Quick Select converts your favorite language list into one-click audio and subtitle controls.

Favorites determine which languages are shown, while Quick Select applies the selected language immediately during playback.

<p align="center">
  <img src="./images/06-quick-settings.png" alt="Quick Select Language Shortcuts"/>
</p>⚙️ Settings: themes and plugins

Themes and plugins can be enabled or disabled from the MyStremio settings page.

The interface also provides shortcuts for opening the local themes and plugins folders.

<p align="center">
  <img src="./images/07-01-settings-themes-plugins.png" alt="Themes and Plugins Settings"/>
</p>⚙️ Settings: preload, library backup, and Discord

Under Settings → MyStremio, you can configure:

- Stream preload and buffering behavior.
- Library JSON import and export.
- Discord Rich Presence.
- Plugin API keys.
- Favorite languages.
- Automatic skip behavior.
- Plugin toggles.

<p align="center">
  <img src="./images/08-01-settings-preload-library-discord.png" alt="Preload Library and Discord Settings"/>
</p>⏱️ TheIntroDB timestamp submission

MyStremio can contribute segment timestamps to "TheIntroDB" (https://theintrodb.org/) while a video is playing.

The contribution panel lets you:

1. Mark the segment start.
2. Mark the segment end.
3. Choose the segment type.
4. Submit the timestamp with your API key.

Supported segment types include:

- Intro.
- Outro.
- Recap.
- Preview.

<p align="center">
  <img src="./images/10-tidb-timestamp.png" alt="TheIntroDB Timestamp Panel"/>
</p>⏩ Seek buttons

Configurable skip-back and skip-forward buttons are available in the player control bar.

The seek interval can be changed under:

Settings → MyStremio → Plugins

<p align="center">
  <img src="./images/09-01-seek-buttons-controls.png" alt="Seek Button Controls" width="61%"/>
  <img src="./images/09-seek-buttons.png" alt="Seek Buttons in Player" width="60%"/>
</p>🎵 TIDAL Atmos spatial audio

MyStremio includes an integrated version of the Omniphony MPV Atmos bridge.

The integration is designed to intercept compatible playback from the TIDAL desktop interface and route the Atmos stream to the external Omniphony MPV player.

Key capabilities include:

- TIDAL interface integration.
- Dolby Atmos manifest retrieval through the local Binlossless API.
- External MPV launching through the "omniphony://" protocol or configured launcher.
- Omniphony "orender" spatial rendering.
- Binaural headphone output.
- Multichannel spatial output.
- Pause synchronization.
- Seek synchronization.
- Volume synchronization.
- Automatic fallback to regular TIDAL playback when an Atmos manifest is unavailable.
- Local authentication and local API communication.

«Atmos availability depends on the selected TIDAL track, account access, regional availability, API compatibility, and the currently installed TIDAL client version.»

---

⚙️ How the TIDAL Atmos bridge works

The bridge connects the TIDAL user interface to an external custom MPV instance.

1. Playback detection

The TIDAL plugin monitors the application’s playback state and media elements.

When a new track begins, it attempts to determine the current TIDAL track ID through available application state or page metadata.

2. Native playback suppression

When a compatible Atmos stream is found, the plugin suppresses or mutes native TIDAL playback to prevent both the TIDAL client and MPV from producing audio simultaneously.

3. Manifest request

The plugin sends the track ID to the local API endpoint.

A typical endpoint looks like:

http://127.0.0.1:8000/trackManifests/?id=TRACK_ID

The local service requests the available playback manifest and returns a usable stream URI when an Atmos version is available.

4. External MPV launch

The returned stream is passed to the Omniphony-enabled MPV bundle.

Depending on the configured release, this may be done through:

- The registered "omniphony://" Windows protocol.
- A local launcher.
- The included portable startup scripts.
- Direct process creation from the MyStremio shell.

5. Spatial rendering

MPV decodes the incoming stream and routes its audio into the Omniphony "orender" engine.

Omniphony Studio can then control the final rendering mode and spatial configuration.

6. Playback synchronization

The plugin forwards supported controls from the TIDAL interface to MPV through local IPC.

This includes:

- Play.
- Pause.
- Seek.
- Volume changes.
- Track changes.

7. Stereo fallback

When no compatible Atmos manifest is returned, MyStremio allows the TIDAL client to continue with its standard playback path.

This prevents non-Atmos tracks from becoming unplayable.

---

💡 Planned Features

- Combined TheIntroDB and IntroDB integration for greater segment coverage.
- Picture-in-picture video mode.
- Seek-bar thumbnail previews.
- Additional TIDAL and MPV synchronization improvements.
- Improved automatic recovery if the external player closes unexpectedly.
- More portable path detection for the MPV bundle.
- Expanded renderer configuration from inside MyStremio.

---

🛠️ Patch Notes

2.3.0

- TIDAL Atmos integration — Added the local Binlossless API daemon and TIDAL playback bridge for retrieving compatible Atmos manifests and routing them into the Omniphony MPV player.
- Omniphony player integration — Added an external custom MPV playback path using the Omniphony "orender" spatial-audio engine.
- Playback synchronization — Added local synchronization for play, pause, seek, volume, and track changes between the TIDAL interface and MPV.
- Stereo fallback — TIDAL continues through its standard playback path when an Atmos manifest is unavailable.
- Portable authentication tool — Added "auth-tidal.bat" for local TIDAL authentication without including personal tokens in the repository or release archive.
- Local API packaging — Packaged the Binlossless-compatible API service as a local executable for the portable release.
- Portable distribution cleanup — Removed personal application data, credentials, tokens, and cached files from the public portable archive.
- Spatial-audio portable release — Added the "v2.3.0-atmos-portable" distribution.

2.2.9

- Board hero banner — Featured titles are rendered directly in the board route.
- Bundled Web UI — Added a bundled local Web UI instead of relying only on the public Stremio website.
- Native MyStremio settings — Moved MyStremio settings into the React interface for improved stability.
- Hero loading — Added a banner-area loading state and removed remaining fallback flashes.
- Startup stability — Added protection against stale player routes and repeated-launch black screens.
- Dynamic hero crash fix — Added null guards for missing hero metadata.
- WebView2 cache handling — Refreshes relevant browsing cache after version or Web UI changes without wiping the entire profile.
- Service worker handling — Blocks service-worker registration in the desktop shell to reduce stale-bundle problems.
- Settings persistence — Restores login, plugins, volume, autoskip, Discord, preload, language, library, and onboarding settings before the Web UI loads.
- Stream buffering — Reworked configurable preload and playback startup behavior.
- TheIntroDB submission — Added timestamp submission for intros, outros, recaps, and previews.
- Seek buttons — Added configurable backward and forward seek controls.
- In-app updater — Added GitHub release checks and SHA-256 verification for installer updates.
- Player brightness — Added an MPV-backed brightness control.
- Board scrolling — Fixed first-scroll rubber-banding and improved position restoration.
- Plugin and player adjustments — Updated StreamUI, skip logic, continue-watching covers, metadata panels, and enrichment mounting.
- Player shell assets — Updated loading overlays, controls, playback API integration, and buffer handling.
- Custom board scrollbar — Added an always-visible scrollbar to catalog views.
- Panel scrolling — Fixed scrolling in plugin menus, metadata panels, and library context menus.
- Navigation stability — Prevented the navigation bar from jumping or disappearing during route changes.
- Meta Hover Panel — Removed duplicated year information.
- Plugin live updates — Added partial support for applying plugin toggle changes without restarting.
- Visual fixes — Removed artifacts from subtitle settings and shortcut controls.
- StreamUI — Added experimental Usenet grouping and corrected interface language.

---

⚠️ Known Issues

- First stream playback: The first stream started after launching MyStremio may remain frozen on its first frame. Clicking once on the seek bar usually resumes normal playback.
- Windows display scaling: Interface scaling problems may occur when Windows display scaling is not set to 100%.
- Cast Search Addon: Cast Search is not currently compatible with StreamUI because cast entries are exposed similarly to video streams, interfering with grouping.
- Formatter flags: Some language or formatter flags may not display correctly.
- TIDAL client updates: Changes to the TIDAL desktop interface or internal application state may temporarily break track detection or playback interception.
- Playback synchronization: Very rapid seeking or repeated track changes may briefly desynchronize TIDAL and the external MPV player.
- External MPV window: Closing MPV manually may not immediately restore native TIDAL audio in every case.
- Path handling: Older builds may expect the Omniphony MPV bundle at a fixed location unless its path is changed in the plugin configuration.
- Atmos availability: Not every TIDAL track or release has an Atmos manifest.
- Omniphony dependency: Spatial and binaural controls require Omniphony Studio to be installed and running correctly.

---

💾 Installation

Download the latest release from:

"MyStremio Spatial Audio Fork releases" (https://github.com/Cxsmo-ai/MyStremio-Spatial-audio-fork-/releases)

The repository may provide:

- A portable Atmos ZIP.
- A Windows installer.
- Checksums or release metadata.
- Separate development builds.

📋 Requirements

- Windows 10 or Windows 11, 64-bit.
- Microsoft WebView2 Runtime.
- Internet access for addons, metadata, streaming, authentication, and API requests.
- Omniphony Studio for spatial and binaural renderer control.
- A TIDAL desktop installation and compatible account when using TIDAL integration.
- Optional plugin API keys, such as TMDB or TheIntroDB.
- A compatible audio output device.
- Headphones for binaural playback or a suitable multichannel device for speaker rendering.

📦 Portable installation

1. Download the latest portable Atmos archive:
   
   MyStremio-portable-atmos-release.zip

2. Extract it to a permanent folder.
   
   Avoid placing the application inside a temporary directory.

3. Install Omniphony Studio using the instructions below.

4. Run:
   
   auth-tidal.bat
   
   This is only required for TIDAL integration.

5. Launch MyStremio using either:
   
   mystremio-shell.exe
   
   or:
   
   start-mystremio-portable.bat

🪟 Installer installation

1. Download the latest x64 installer from the Releases page.
2. Run the installer.
3. Complete the normal Windows setup process.
4. Install Omniphony Studio separately.
5. Launch MyStremio from the Start menu or desktop shortcut.
6. Run the TIDAL authentication tool if you intend to use the Atmos integration.

🎧 Omniphony Studio setup

Omniphony Studio is required to control the custom spatial-audio renderer.

Download the latest stable Windows installer from:

"mgth/Omniphony releases" (https://github.com/mgth/Omniphony/releases/latest)

Use the latest stable release rather than a beta unless the MyStremio release notes specifically request a beta version.

Omniphony Studio is needed because the custom MPV player sends audio into the "orender" engine. The Studio interface controls how that audio is rendered.

Without Omniphony Studio, you may be unable to:

- Change between binaural and spatial speaker output.
- Select or configure the output device.
- Adjust room dimensions.
- Change the listener position.
- Configure unit scale.
- Control master normalization.
- Configure tracking or OSC options.
- Diagnose renderer connection problems.

After installation:

1. Launch Omniphony Studio.
2. Confirm that the renderer starts successfully.
3. Select the required output mode.
4. For headphones, enable the appropriate binaural rendering mode.
5. Start MyStremio and play compatible content.
6. Verify that the renderer receives audio.

🔐 TIDAL authentication

The portable Atmos release includes:

auth-tidal.bat

Run this tool before attempting TIDAL Atmos playback.

The authentication process is intended to:

- Authenticate locally.
- Create the required local session or token data.
- Avoid storing personal credentials in the public repository.
- Avoid including a developer’s personal cache in the portable archive.

Do not upload or publicly share generated authentication files, cookies, session data, or tokens.

📂 Install paths

Default installer application directory:

%LOCALAPPDATA%\Programs\MyStremio\

Primary MyStremio user-data directory:

%APPDATA%\MyStremio\

TIDAL desktop application commonly installs to:

%LOCALAPPDATA%\TIDAL\TIDAL.exe

The exact portable application and MPV paths depend on where the archive is extracted.

🗑️ Uninstall

For the installer edition:

1. Open Windows Apps & Features.
2. Locate MyStremio.
3. Select Uninstall.

You can optionally delete the following folder to remove local settings, addon data, and library configuration:

%APPDATA%\MyStremio\

For the portable edition:

1. Close MyStremio, MPV, the local API server, and related scripts.
2. Delete the extracted portable folder.
3. Delete "%APPDATA%\MyStremio\" only when you also want to remove your settings.
4. Remove the custom "omniphony://" protocol registration if it was installed separately and is no longer needed.

---

🎬 First-time setup

1. Install or extract MyStremio.

2. Install and launch Omniphony Studio.

3. Launch MyStremio.

4. Sign in with your Stremio account.

5. Open:
   
   Settings → MyStremio

6. Configure the desired options:
   
   - Preload and buffering.
   - Themes and plugins.
   - Favorite audio languages.
   - Favorite subtitle languages.
   - Discord Rich Presence.
   - TheIntroDB API key.
   - Automatic skip behavior.
   - Library groups.
   - Plugin-specific API keys.

7. Create or import custom library folders if required.

8. Test normal video playback.

9. Select the required output mode in Omniphony Studio.

10. Run "auth-tidal.bat" before using the TIDAL Atmos bridge.

---

🎵 Using TIDAL Atmos playback

Depending on the release layout, the TIDAL integration may be started from MyStremio or through an included launcher script.

A typical standalone plugin layout looks like:

omniphony-tidal-luna-plugin/
├── api/
│   └── hifi-api-server.exe
├── Start-Tidal-Atmos.bat
├── auth-tidal.bat
├── omniphony.json
├── omniphony.mjs
└── store.json

The packaged MyStremio edition may place these files in a different internal directory.

Startup procedure

1. Launch Omniphony Studio.

2. Run "auth-tidal.bat" if authentication has not been completed.

3. Start MyStremio or run:
   
   Start-Tidal-Atmos.bat

4. The startup process checks whether the local API server is running.

5. If necessary, it starts the server silently.

6. It then launches or connects to the TIDAL desktop client.

7. Play a Dolby Atmos track in TIDAL.

8. When a compatible manifest is found, the external Omniphony MPV player opens and handles playback.

9. Use the TIDAL interface for supported play, pause, volume, and seek controls.

10. Use Omniphony Studio to control the spatial or binaural rendering mode.

Normal fallback behavior

When a track does not have a usable Atmos manifest:

- External MPV should not take over playback.
- Native TIDAL playback should remain available.
- The track may play in stereo or another format provided by the normal TIDAL client.

---

🛠️ TIDAL Atmos configuration

The main integration settings are located near the top of "omniphony.mjs" or in the packaged configuration file.

A typical configuration is:

const CONFIG = {
    BINLOSSLESS_API: 'http://127.0.0.1:8000/trackManifests/?id=',
    MPV_EXECUTABLE: 'd:\\Apps\\omniphony-libmpv-bundle\\mpv.exe'
};

API address

The default local endpoint is:

http://127.0.0.1:8000/

If the local service uses a different port, update "BINLOSSLESS_API".

Keep the service bound to the loopback interface unless remote access is intentionally required.

Recommended:

127.0.0.1

Not recommended for normal local use:

0.0.0.0

MPV executable path

Set "MPV_EXECUTABLE" to the actual location of the Omniphony-enabled "mpv.exe".

Example:

MPV_EXECUTABLE: 'd:\\Apps\\omniphony-libmpv-bundle\\mpv.exe'

JavaScript strings require escaped backslashes.

Correct:

'd:\\Apps\\omniphony-libmpv-bundle\\mpv.exe'

Incorrect:

'd:\Apps\omniphony-libmpv-bundle\mpv.exe'

Custom protocol

Some distributions use:

omniphony://

The Windows registry protocol handler must point to the included launcher or Omniphony MPV executable.

The protocol lets the TIDAL plugin trigger external playback without requiring the application sandbox to launch arbitrary executables directly.

IPC

Playback synchronization relies on a local IPC connection between the integration and MPV.

The exact IPC transport may vary between releases, but it can be used to send commands such as:

{"command":["set_property","pause",true]}

{"command":["set_property","time-pos",120]}

{"command":["set_property","volume",75]}

Do not expose the IPC socket or pipe to untrusted remote systems.

---

🎨 Themes and plugins: manual files

1. Open MyStremio.

2. Navigate to:
   
   Settings → MyStremio

3. Select Open themes/plugins folder.

4. Place the theme or plugin files in the appropriate directory.

5. Enable the corresponding toggle.

6. Press:
   
   Ctrl+R
   
   to reload the interface when necessary.

Only install scripts and plugins from sources you trust. Runtime plugins may be able to access application state or alter playback behavior.

---

🧑‍💻 Build from source: developers

Requirements

- Rust using the MSVC toolchain.
- Visual Studio Build Tools.
- Inno Setup 6.
- Node.js.
- pnpm when rebuilding the Web UI.
- Microsoft WebView2 Runtime.
- A compatible MPV or libmpv runtime.
- Any required Omniphony development components.
- Git.
- PowerShell.

Build the release

cd stremio-shell\stremio-shell-ng-main
.\package-release.ps1

Expected output for the current release should follow the format:

release\MyStremioSetup-v2.3.0_x64.exe

Rebuild the Web UI

The repository contains a prebuilt Web UI bundle at:

stremio-shell\stremio-shell-ng-main\webui\

To rebuild it:

1. Clone "stremio-web" (https://github.com/Stremio/stremio-web) into:
   
   .tmp\stremio-web

2. Apply the MyStremio patches.

3. Install dependencies using pnpm.

4. Build the Web UI.

5. Run the MyStremio packaging script again.

TIDAL plugin development

The integration plugin may be loaded through Tidal-Luna or another compatible Neptune plugin loader.

The plugin is responsible for:

- Detecting playback.
- Obtaining the track ID.
- Querying the local manifest API.
- Muting or restoring native TIDAL playback.
- Launching the external MPV player.
- Synchronizing control state.
- Falling back safely when Atmos is unavailable.

Changes to TIDAL’s Web UI or internal state may require the detection logic to be updated.

---

🔒 Privacy and local data

- No personal API keys should be included in public installers or portable archives.
- No personal TIDAL authentication tokens should be committed to the repository.
- MyStremio settings are stored locally under "%APPDATA%\MyStremio\".
- Addon data and custom library configuration are stored locally.
- TIDAL authentication data is generated locally.
- The Binlossless API service normally communicates over the local loopback interface.
- Cinebye uses the active Stremio session at runtime.
- Discord Rich Presence only sends playback activity when the feature is enabled and Discord is connected.
- Deleting "%APPDATA%\MyStremio\" removes local MyStremio configuration but may also remove settings you intended to preserve.
- Users should review third-party plugins before installing them.

---

🤝 Contributing

Contributions, bug reports, fixes, and feature requests are welcome.

Useful contributions include:

- Reproducible bug reports.
- TIDAL compatibility fixes.
- MPV or IPC synchronization improvements.
- Portable path detection.
- Installer improvements.
- Renderer integration fixes.
- Plugin compatibility updates.
- Interface refinements.
- Documentation corrections.

When reporting a problem, include:

- MyStremio version.
- Windows version.
- TIDAL client version when relevant.
- Omniphony version.
- Whether the portable or installer edition is being used.
- Relevant logs.
- Reproduction steps.
- Whether normal MPV playback works.
- Whether native TIDAL fallback works.
- Whether Omniphony Studio receives audio.

Do not include passwords, cookies, access tokens, session files, or private API credentials in an issue.

---

🙏 Credits

This project is based on the original "MyStremio by AlphiiJr" (https://github.com/AlphiiJr/MyStremio).

MyStremio also builds on or takes inspiration from the following independent community projects:

- "REVENGE977/stremio-enhanced" (https://github.com/REVENGE977/stremio-enhanced)
- "Fxy6969/Stremio-Glass-Theme" (https://github.com/Fxy6969/Stremio-Glass-Theme)
- "Bo0ii/StreamGo" (https://github.com/Bo0ii/StreamGo)
- "TheIntroDB" (https://theintrodb.org/)
- "mgth/Omniphony" (https://github.com/mgth/Omniphony)
- The Omniphony MPV integration and "orender" ecosystem.
- Tidal-Luna and compatible Neptune plugin-loading projects.
- Binlossless-compatible TIDAL API projects.
- MPV and libmpv.
- The Stremio desktop, shell, and Web UI projects.

These projects provided important foundations, tools, research, and inspiration for this custom build.

All trademarks and product names belong to their respective owners.

---

📄 License

This project is distributed under the "MIT License" (LICENSE), except for bundled or referenced third-party components that remain subject to their own licenses.

Review the licenses of all third-party binaries and projects before redistributing a modified package.

---

💬 Feedback

MyStremio began as a personal project and continues to be improved iteratively.

For reproducible bugs, compatibility reports, or feature suggestions, open an issue in the repository:

"MyStremio Spatial Audio Fork issues" (https://github.com/Cxsmo-ai/MyStremio-Spatial-audio-fork-/issues)
