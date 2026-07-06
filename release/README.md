# Release artifacts

Upload these files to each GitHub Release:

- `MyStremioSetup-v{version}_x64.exe`
- `SHA256SUMS.txt`

Both are produced by `package-release.ps1`. Installer binaries (`.exe`, `.zip`) are gitignored and must not be committed.

## In-app updater requirements

The app checks `https://api.github.com/repos/xAlphiiJr/MyStremio/releases/latest`.

For updates to be detected automatically:

1. Create a **GitHub Release** (not only a git tag or CI artifact).
2. Use tag `v{version}` (example: `v2.2.1`).
3. The tag version must be **higher** than the installed app version in `Cargo.toml`.
4. Attach `MyStremioSetup-v{version}_x64.exe` and `SHA256SUMS.txt` with matching names.

Pushing a tag like `v2.2.1` also triggers `.github/workflows/release.yml`, which builds and publishes the release assets automatically.
