use crate::stremio_app::constants::APP_DATA_DIR;
use std::{
    env,
    fs,
    io,
    path::{Path, PathBuf},
};

const PLUGIN_EXT: &str = ".plugin.js";
const PLUGIN_SCHEMA_EXT: &str = ".plugin.schema.json";
const THEME_EXT: &str = ".theme.css";

pub fn app_data_dir() -> PathBuf {
    env::var_os("APPDATA")
        .map(PathBuf::from)
        .unwrap_or_else(env::temp_dir)
        .join(APP_DATA_DIR)
}

pub fn plugins_dir() -> PathBuf {
    app_data_dir().join("plugins")
}

pub fn themes_dir() -> PathBuf {
    app_data_dir().join("themes")
}

pub fn webview_user_data_dir() -> PathBuf {
    app_data_dir().join("WebView2")
}

const RUNTIME_STATE_FILE: &str = "mystremio-runtime.json";
/// Bump when a one-time WebView2 cache repair must run for existing installs.
const CACHE_REPAIR_GENERATION: u32 = 4;

pub fn ensure_webview_user_data_dir() {
    clear_webview_cache_if_stale();
    let target = webview_user_data_dir();
    migrate_legacy_webview_user_data(&target);
    let _ = fs::create_dir_all(&target);
}

fn runtime_state_path() -> PathBuf {
    app_data_dir().join(RUNTIME_STATE_FILE)
}

fn webui_bundle_fingerprint() -> String {
    let service_worker = bundled_root().join("webui").join("service-worker.js");
    let content = match fs::read_to_string(&service_worker) {
        Ok(content) => content,
        Err(_) => return "missing-webui".to_string(),
    };

    if let Some(marker) = content.find("main.js\",revision:\"") {
        let rest = &content[marker + 19..];
        if let Some(end) = rest.find('"') {
            return format!("mainjs-{}", &rest[..end]);
        }
    }

    service_worker
        .metadata()
        .map(|meta| format!("sw-{}", meta.len()))
        .unwrap_or_else(|_| "unknown-webui".to_string())
}

fn read_runtime_state() -> (String, String, u32) {
    let path = runtime_state_path();
    if !path.exists() {
        return (String::new(), String::new(), 0);
    }

    let content = match fs::read_to_string(&path) {
        Ok(content) => content,
        Err(_) => return (String::new(), String::new(), 0),
    };

    let value: serde_json::Value = match serde_json::from_str(&content) {
        Ok(value) => value,
        Err(_) => return (String::new(), String::new(), 0),
    };

    let shell_version = value
        .get("shellVersion")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let webui_fingerprint = value
        .get("webuiFingerprint")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let cache_repair_generation = value
        .get("cacheRepairGeneration")
        .and_then(|v| v.as_u64())
        .unwrap_or(0) as u32;

    (shell_version, webui_fingerprint, cache_repair_generation)
}

fn write_runtime_state(shell_version: &str, webui_fingerprint: &str) {
    let path = runtime_state_path();
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }

    let payload = serde_json::json!({
        "shellVersion": shell_version,
        "webuiFingerprint": webui_fingerprint,
        "cacheRepairGeneration": CACHE_REPAIR_GENERATION,
    });

    if let Ok(content) = serde_json::to_string_pretty(&payload) {
        let _ = fs::write(path, content);
    }
}

fn clear_webview_browsing_cache() {
    const CACHE_SUBDIRS: &[&str] = &[
        "EBWebView/Default/Cache",
        "EBWebView/Default/Code Cache",
        "EBWebView/Default/Service Worker",
        "EBWebView/Default/GPUCache",
        "EBWebView/ShaderCache",
        "EBWebView/GrShaderCache",
        "EBWebView/BrowserMetrics",
        // Legacy layout before WebView2 used the EBWebView subfolder.
        "Default/Cache",
        "Default/Code Cache",
        "Default/Service Worker",
        "Default/GPUCache",
        "ShaderCache",
        "GrShaderCache",
        "BrowserMetrics",
    ];

    let base = webview_user_data_dir();
    for subdir in CACHE_SUBDIRS {
        let path = base.join(subdir);
        if !path.exists() {
            continue;
        }
        if let Err(error) = remove_dir_all(&path) {
            eprintln!(
                "Failed to clear WebView2 browsing cache at {}: {error}",
                path.display()
            );
        }
    }
}

/// Refresh only volatile WebView2 caches when the shell or bundled web UI changes.
///
/// We intentionally never delete the whole WebView2 profile: doing so also wipes
/// `Local Storage`, which holds the Stremio login (`profile` key), logging the user
/// out on every update. Clearing the browsing/service-worker caches is sufficient to
/// drop stale bundles that previously caused black screens, while login and settings
/// survive across updates.
fn clear_webview_cache_if_stale() {
    let current_version = env!("CARGO_PKG_VERSION");
    let current_fingerprint = webui_bundle_fingerprint();
    let (stored_version, stored_fingerprint, stored_cache_repair) = read_runtime_state();

    let version_changed = stored_version != current_version;
    let webui_changed = !stored_fingerprint.is_empty() && stored_fingerprint != current_fingerprint;
    let repair_pending = stored_cache_repair < CACHE_REPAIR_GENERATION;

    if version_changed || webui_changed || repair_pending {
        clear_webview_browsing_cache();
        println!(
            "WebView2 browsing cache refresh (version_changed={version_changed}, webui_changed={webui_changed}, repair_pending={repair_pending})"
        );
    }

    write_runtime_state(current_version, &current_fingerprint);
}

fn remove_dir_all(path: &Path) -> io::Result<()> {
    if !path.exists() {
        return Ok(());
    }

    for entry in fs::read_dir(path)? {
        let entry = entry?;
        let entry_path = entry.path();
        if entry_path.is_dir() {
            remove_dir_all(&entry_path)?;
        } else {
            let _ = fs::remove_file(&entry_path);
        }
    }

    fs::remove_dir(path)
}

fn migrate_legacy_webview_user_data(target: &Path) {
    if dir_has_entries(target) {
        return;
    }

    let Some(exe_dir) = env::current_exe()
        .ok()
        .and_then(|mut path| {
            path.pop();
            Some(path)
        })
    else {
        return;
    };

    for legacy in [
        exe_dir.join("mystremio-shell.exe.WebView2"),
        exe_dir.join("stremio-shell.exe.WebView2"),
        exe_dir.join("Stremio.exe.WebView2"),
    ] {
        if legacy.is_dir() {
            let _ = copy_dir_recursive(&legacy, target);
            break;
        }
    }
}

fn dir_has_entries(path: &Path) -> bool {
    fs::read_dir(path)
        .ok()
        .is_some_and(|mut entries| entries.next().is_some())
}

fn copy_dir_recursive(source: &Path, target: &Path) -> std::io::Result<()> {
    if !source.is_dir() {
        return Ok(());
    }

    fs::create_dir_all(target)?;
    for entry in fs::read_dir(source)?.flatten() {
        let from = entry.path();
        let to = target.join(entry.file_name());
        if from.is_dir() {
            copy_dir_recursive(&from, &to)?;
        } else {
            let _ = fs::copy(&from, &to);
        }
    }
    Ok(())
}

pub fn bundled_root() -> PathBuf {
    env::current_exe()
        .ok()
        .and_then(|mut path| {
            path.pop();
            Some(path)
        })
        .unwrap_or_else(env::temp_dir)
}

pub fn bundled_plugins_dir() -> PathBuf {
    bundled_root().join("plugins")
}

pub fn bundled_themes_dir() -> PathBuf {
    bundled_root().join("themes")
}

pub fn ensure_asset_dirs() {
    let _ = fs::create_dir_all(plugins_dir());
    let _ = fs::create_dir_all(themes_dir());
    sync_bundled_assets(&bundled_plugins_dir(), &plugins_dir(), PLUGIN_EXT);
    sync_bundled_assets(&bundled_plugins_dir(), &plugins_dir(), PLUGIN_SCHEMA_EXT);
    sync_bundled_assets(&bundled_themes_dir(), &themes_dir(), THEME_EXT);
}

fn sync_bundled_assets(source: &Path, target: &Path, extension: &str) {
    if !source.exists() {
        return;
    }

    let _ = fs::create_dir_all(target);
    copy_tree(source, target, extension);
}

fn copy_tree(source: &Path, target: &Path, extension: &str) {
    let entries = match fs::read_dir(source) {
        Ok(entries) => entries,
        Err(_) => return,
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            let child_target = target.join(entry.file_name());
            let _ = fs::create_dir_all(&child_target);
            copy_tree(&path, &child_target, extension);
            continue;
        }

        if path
            .file_name()
            .and_then(|name| name.to_str())
            .is_some_and(|name| name.ends_with(extension))
        {
            let destination = target.join(entry.file_name());
            // Keep executable assets in AppData updated on each launch.
            // Sensitive user values live in *.plugin.json and are not part of this sync.
            let _ = fs::copy(&path, &destination);
        }
    }
}

pub fn walk_files(dir: &Path, extension: &str) -> Vec<String> {
    if !dir.exists() {
        return Vec::new();
    }

    let mut files = Vec::new();
    walk_files_inner(dir, dir, extension, &mut files);
    files.sort();
    files
}

fn walk_files_inner(root: &Path, current: &Path, extension: &str, files: &mut Vec<String>) {
    let entries = match fs::read_dir(current) {
        Ok(entries) => entries,
        Err(_) => return,
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            walk_files_inner(root, &path, extension, files);
            continue;
        }

        if path
            .extension()
            .and_then(|ext| ext.to_str())
            .is_some_and(|ext| format!(".{ext}") == extension || path.to_string_lossy().ends_with(extension))
        {
            if let Ok(relative) = path.strip_prefix(root) {
                files.push(relative.to_string_lossy().replace('\\', "/"));
            }
        }
    }
}

pub fn resolve_asset_path(relative_path: &str) -> Option<PathBuf> {
    let normalized = relative_path.replace('\\', "/");
    if normalized.is_empty() {
        return None;
    }

    let direct = plugins_dir().join(&normalized);
    if direct.exists() {
        return Some(direct);
    }

    let theme_direct = themes_dir().join(&normalized);
    if theme_direct.exists() {
        return Some(theme_direct);
    }

    let file_name = Path::new(&normalized)
        .file_name()
        .map(|name| name.to_string_lossy().to_string())?;

    for file in walk_files(&plugins_dir(), PLUGIN_EXT) {
        if file.ends_with(&file_name) {
            return Some(plugins_dir().join(&file));
        }
    }

    for file in walk_files(&themes_dir(), THEME_EXT) {
        if file.ends_with(&file_name) {
            return Some(themes_dir().join(&file));
        }
    }

    None
}
