use std::{
    io::{Read, Write},
    path::PathBuf,
};

use anyhow::{anyhow, Context};
use reqwest::blocking::Client;
use reqwest::header::{HeaderMap, HeaderValue, ACCEPT, USER_AGENT};
use semver::{Version, VersionReq};
use serde::Deserialize;
use sha2::{Digest, Sha256};

use crate::stremio_app::constants::{GITHUB_REPO, GITHUB_USER_AGENT};

#[derive(Debug, Clone)]
pub struct Update {
    pub version: Version,
    pub file: PathBuf,
}

#[derive(Debug)]
pub struct Updater {
    pub current_version: Version,
    pub next_version: VersionReq,
    pub force_update: bool,
    pub release_candidate: bool,
}

#[derive(Debug, Deserialize)]
struct GithubRelease {
    tag_name: String,
    prerelease: bool,
    draft: bool,
    assets: Vec<GithubAsset>,
}

#[derive(Debug, Deserialize)]
struct GithubAsset {
    name: String,
    browser_download_url: String,
}

impl Updater {
    pub fn new(current_version: Version, force_update: bool, release_candidate: bool) -> Self {
        Self {
            next_version: VersionReq::parse(&format!(">{current_version}"))
                .expect("Version is type-safe"),
            current_version,
            force_update,
            release_candidate,
        }
    }

    pub fn check_for_update(&self) -> Result<Option<Update>, anyhow::Error> {
        println!("Checking GitHub releases for MyStremio v{}", self.current_version);

        let client = github_client()?;
        let release = fetch_release(&client, self.release_candidate)?;
        if release.draft {
            return Ok(None);
        }

        let version = parse_release_version(&release.tag_name)?;
        if !self.force_update && !self.next_version.matches(&version) {
            println!("Already on latest release (v{version})");
            return Ok(None);
        }

        let installer_asset = find_installer_asset(&release.assets, &version)
            .context("Release is missing MyStremioSetup-v*_x64.exe asset")?;
        let checksums_asset = release
            .assets
            .iter()
            .find(|asset| asset.name == "SHA256SUMS.txt")
            .context("Release is missing SHA256SUMS.txt asset")?;

        let checksums =
            client.get(&checksums_asset.browser_download_url).send()?.text()?;
        let expected_sha256 = parse_sha256sums(&checksums, &installer_asset.name)?;

        let dest = download_installer(&client, installer_asset, &expected_sha256)?;

        println!("Update ready: v{version} ({})", dest.display());
        Ok(Some(Update { version, file: dest }))
    }
}

fn github_client() -> Result<Client, anyhow::Error> {
    let mut headers = HeaderMap::new();
    headers.insert(
        USER_AGENT,
        HeaderValue::from_static(GITHUB_USER_AGENT),
    );
    headers.insert(
        ACCEPT,
        HeaderValue::from_static("application/vnd.github+json"),
    );
    Client::builder()
        .default_headers(headers)
        .build()
        .context("Failed to build GitHub HTTP client")
}

fn fetch_release(
    client: &Client,
    release_candidate: bool,
) -> Result<GithubRelease, anyhow::Error> {
    if release_candidate {
        let url = format!("https://api.github.com/repos/{GITHUB_REPO}/releases");
        let releases: Vec<GithubRelease> = client.get(&url).send()?.json()?;
        return releases
            .into_iter()
            .find(|release| !release.draft && (release_candidate || !release.prerelease))
            .context("No published GitHub release found");
    }

    let url = format!("https://api.github.com/repos/{GITHUB_REPO}/releases/latest");
    client
        .get(&url)
        .send()?
        .json::<GithubRelease>()
        .context("Failed to read latest GitHub release")
}

fn parse_release_version(tag_name: &str) -> Result<Version, anyhow::Error> {
    let trimmed = tag_name.trim().trim_start_matches(['v', 'V']);
    Version::parse(trimmed).with_context(|| format!("Invalid release tag: {tag_name}"))
}

fn find_installer_asset<'a>(
    assets: &'a [GithubAsset],
    version: &Version,
) -> Option<&'a GithubAsset> {
    let expected = format!("MyStremioSetup-v{version}_x64.exe");
    assets
        .iter()
        .find(|asset| asset.name == expected)
        .or_else(|| {
            assets.iter().find(|asset| {
                asset.name.starts_with("MyStremioSetup-v") && asset.name.ends_with("_x64.exe")
            })
        })
}

fn parse_sha256sums(content: &str, file_name: &str) -> Result<String, anyhow::Error> {
    for line in content.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        let mut parts = line.split_whitespace();
        let hash = parts.next().context("Malformed SHA256SUMS line")?;
        let name = parts.next().context("Malformed SHA256SUMS line")?;
        if name == file_name {
            return Ok(hash.to_ascii_lowercase());
        }
    }
    Err(anyhow!("Checksum not found for {file_name} in SHA256SUMS.txt"))
}

fn download_installer(
    client: &Client,
    installer_asset: &GithubAsset,
    expected_sha256: &str,
) -> Result<PathBuf, anyhow::Error> {
    let file_name = installer_asset.name.clone();
    let dest = std::env::temp_dir().join(&file_name);

    println!(
        "Downloading {} to {}",
        installer_asset.browser_download_url,
        dest.display()
    );

    let mut installer_response = client
        .get(&installer_asset.browser_download_url)
        .send()?;
    let size = installer_response.content_length();
    let mut downloaded: u64 = 0;
    let mut sha256 = Sha256::new();

    let mut chunk = [0u8; 8192];
    let mut file = std::fs::File::create(&dest)?;
    loop {
        let chunk_size = installer_response.read(&mut chunk)?;
        if chunk_size == 0 {
            break;
        }
        sha256.update(&chunk[..chunk_size]);
        file.write_all(&chunk[..chunk_size])?;
        if let Some(size) = size {
            downloaded += chunk_size as u64;
            print!("\rProgress: {}%", downloaded * 100 / size);
        } else {
            print!(".");
        }
        std::io::stdout().flush().ok();
    }
    println!();

    let actual_sha256 = format!("{:x}", sha256.finalize());
    if actual_sha256 != expected_sha256 {
        std::fs::remove_file(&dest).ok();
        return Err(anyhow!("Checksum verification failed for {file_name}"));
    }

    println!("Checksum verified.");
    Ok(dest)
}
