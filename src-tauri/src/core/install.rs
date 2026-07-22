use std::{
    fs::{self, File, OpenOptions},
    io::{Read, Write},
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
    thread,
    time::{Duration, Instant},
};

use atomic_write_file::AtomicWriteFile;
use chrono::{SecondsFormat, Utc};
use reqwest::{redirect::Policy, Client};
use sha2::{Digest, Sha256};

use super::{
    error::{CoreError, CoreResult},
    model::CoreManifest,
    paths::CorePaths,
};

const DOWNLOAD_TIMEOUT: Duration = Duration::from_secs(180);
const VERSION_TIMEOUT: Duration = Duration::from_secs(10);
const MAX_EXECUTABLE_BYTES: u64 = 200 * 1024 * 1024;
const MAX_MANIFEST_BYTES: u64 = 64 * 1024;
const MANIFEST_SCHEMA_VERSION: u32 = 1;
const PINNED_VERSION: &str = "1.19.29";
const MIHOMO_LICENSE: &str = include_str!("../../../third_party/mihomo/LICENSE");
const MIHOMO_NOTICE: &str = include_str!("../../../third_party/mihomo/NOTICE.md");

#[derive(Clone, Copy, Debug)]
struct OfficialAsset {
    url: &'static str,
    archive_name: &'static str,
    archive_size: u64,
    archive_sha256: &'static str,
    entry_name: &'static str,
    entry_size: u64,
}

#[cfg(target_arch = "x86_64")]
const OFFICIAL_ASSET: OfficialAsset = OfficialAsset {
    url: "https://github.com/MetaCubeX/mihomo/releases/download/v1.19.29/mihomo-windows-amd64-v1-v1.19.29.zip",
    archive_name: "mihomo-windows-amd64-v1-v1.19.29.zip",
    archive_size: 17_509_589,
    archive_sha256: "4a5b4cdf76f1879043cea7488162517fd3fb95d5b7a205d89601f1942791ee39",
    entry_name: "mihomo-windows-amd64-v1.exe",
    entry_size: 47_484_928,
};

#[cfg(target_arch = "aarch64")]
const OFFICIAL_ASSET: OfficialAsset = OfficialAsset {
    url: "https://github.com/MetaCubeX/mihomo/releases/download/v1.19.29/mihomo-windows-arm64-v1.19.29.zip",
    archive_name: "mihomo-windows-arm64-v1.19.29.zip",
    archive_size: 15_430_938,
    archive_sha256: "f71736f9c2a17abb8909a726c69ac55279d0cb43d1d9f2c85afdbb70a0f326a3",
    entry_name: "mihomo-windows-arm64.exe",
    entry_size: 42_606_080,
};

#[cfg(not(any(target_arch = "x86_64", target_arch = "aarch64")))]
fn official_asset() -> CoreResult<OfficialAsset> {
    Err(CoreError::UnsupportedPlatform(format!(
        "Windows {} has no pinned official Mihomo asset",
        std::env::consts::ARCH
    )))
}

#[cfg(any(target_arch = "x86_64", target_arch = "aarch64"))]
fn official_asset() -> CoreResult<OfficialAsset> {
    if !cfg!(target_os = "windows") {
        return Err(CoreError::UnsupportedPlatform(format!(
            "{} {}",
            std::env::consts::OS,
            std::env::consts::ARCH
        )));
    }
    Ok(OFFICIAL_ASSET)
}

#[derive(Clone)]
pub(crate) struct CoreInstaller {
    paths: CorePaths,
    client: Client,
}

impl CoreInstaller {
    pub fn new(paths: CorePaths) -> CoreResult<Self> {
        let redirects = Policy::custom(|attempt| {
            if attempt.previous().len() >= 8 {
                return attempt.error("too many redirects while downloading Mihomo");
            }
            let trusted = attempt
                .url()
                .host_str()
                .is_some_and(is_trusted_download_host)
                && attempt.url().scheme() == "https";
            if trusted {
                attempt.follow()
            } else {
                attempt.error("Mihomo download redirected to an untrusted host")
            }
        });
        let client = Client::builder()
            .https_only(true)
            .redirect(redirects)
            .connect_timeout(Duration::from_secs(15))
            .timeout(Duration::from_secs(120))
            .user_agent(concat!("Horion/", env!("CARGO_PKG_VERSION")))
            .build()
            .map_err(|error| CoreError::Download(error.to_string()))?;
        Ok(Self { paths, client })
    }

    pub async fn install_official(&self) -> CoreResult<CoreManifest> {
        let asset = official_asset()?;
        let operation = async {
            let staging = tempfile::Builder::new()
                .prefix(".official-")
                .tempdir_in(&self.paths.versions)
                .map_err(|error| {
                    CoreError::io("creating an official core staging directory", error)
                })?;
            let archive_path = staging.path().join(asset.archive_name);
            self.download_pinned_asset(asset, &archive_path).await?;

            let payload = staging.path().join("payload");
            fs::create_dir(&payload)
                .map_err(|error| CoreError::io("creating the extracted core directory", error))?;
            let executable = payload.join("mihomo.exe");
            extract_exact_executable(asset, &archive_path, &executable)?;
            write_license_files(&payload)?;
            let version = validate_mihomo_executable(&executable)?;
            if version != PINNED_VERSION {
                return Err(CoreError::Integrity(format!(
                    "the verified archive reported Mihomo {version}, expected {PINNED_VERSION}"
                )));
            }
            let executable_sha256 = hash_file_limited(&executable, MAX_EXECUTABLE_BYTES)?;
            self.commit_install(payload, &version, "official", &executable_sha256)
        };

        tokio::time::timeout(DOWNLOAD_TIMEOUT, operation)
            .await
            .map_err(|_| {
                CoreError::Download("the verified download exceeded 180 seconds".to_owned())
            })?
    }

    pub fn install_import(&self, source: &Path) -> CoreResult<CoreManifest> {
        validate_import_source_path(source)?;
        let canonical = source
            .canonicalize()
            .map_err(|error| CoreError::io("resolving the imported executable", error))?;
        let metadata = fs::metadata(&canonical)
            .map_err(|error| CoreError::io("reading the imported executable metadata", error))?;
        if !metadata.is_file() || metadata.len() == 0 || metadata.len() > MAX_EXECUTABLE_BYTES {
            return Err(CoreError::InvalidExecutable(format!(
                "the imported file must be a non-empty executable no larger than {MAX_EXECUTABLE_BYTES} bytes"
            )));
        }
        let has_exe_extension = canonical
            .extension()
            .and_then(|extension| extension.to_str())
            .is_some_and(|extension| extension.eq_ignore_ascii_case("exe"));
        if cfg!(windows) && !has_exe_extension {
            return Err(CoreError::InvalidExecutable(
                "a Windows Mihomo import must have an .exe extension".to_owned(),
            ));
        }

        let staging = tempfile::Builder::new()
            .prefix(".import-")
            .tempdir_in(&self.paths.versions)
            .map_err(|error| CoreError::io("creating an imported core staging directory", error))?;
        let payload = staging.path().join("payload");
        fs::create_dir(&payload)
            .map_err(|error| CoreError::io("creating the imported core directory", error))?;
        let executable = payload.join("mihomo.exe");
        let sha256 = copy_file_limited(&canonical, &executable, MAX_EXECUTABLE_BYTES)?;
        write_license_files(&payload)?;
        let version = validate_mihomo_executable(&executable)?;
        self.commit_install(payload, &version, "imported", &sha256)
    }

    pub fn load_manifest(&self) -> CoreResult<Option<(CoreManifest, PathBuf)>> {
        if !self.paths.manifest.exists() {
            return Ok(None);
        }
        let metadata = fs::metadata(&self.paths.manifest)
            .map_err(|error| CoreError::io("reading the core manifest metadata", error))?;
        if metadata.len() == 0 || metadata.len() > MAX_MANIFEST_BYTES {
            return Err(CoreError::InvalidManifest(
                "the manifest has an invalid size".to_owned(),
            ));
        }
        let bytes = fs::read(&self.paths.manifest)
            .map_err(|error| CoreError::io("reading the core manifest", error))?;
        let manifest: CoreManifest = serde_json::from_slice(&bytes)
            .map_err(|error| CoreError::InvalidManifest(error.to_string()))?;
        validate_manifest_fields(&manifest)?;
        let executable = self.paths.resolve_manifest_executable(&manifest)?;
        let actual_sha256 = hash_file_limited(&executable, MAX_EXECUTABLE_BYTES)?;
        if !actual_sha256.eq_ignore_ascii_case(&manifest.sha256) {
            return Err(CoreError::Integrity(
                "the installed executable no longer matches its manifest".to_owned(),
            ));
        }
        Ok(Some((manifest, executable)))
    }

    fn commit_install(
        &self,
        staged_payload: PathBuf,
        version: &str,
        source: &str,
        sha256: &str,
    ) -> CoreResult<CoreManifest> {
        let directory_name = format!("{}-{}", safe_version(version)?, &sha256[..12]);
        let final_directory = self.paths.versions.join(directory_name);
        let final_executable = final_directory.join("mihomo.exe");

        if final_directory.exists() {
            let existing_sha256 = hash_file_limited(&final_executable, MAX_EXECUTABLE_BYTES)?;
            if existing_sha256 != sha256 {
                return Err(CoreError::Integrity(
                    "an immutable core version directory contains different bytes".to_owned(),
                ));
            }
        } else {
            fs::rename(&staged_payload, &final_directory).map_err(|error| {
                CoreError::io("atomically installing the core directory", error)
            })?;
        }

        let relative = final_executable
            .strip_prefix(&self.paths.root)
            .map_err(|_| {
                CoreError::InvalidManifest(
                    "the installed executable escaped the core directory".to_owned(),
                )
            })?
            .to_string_lossy()
            .into_owned();
        let manifest = CoreManifest {
            schema_version: MANIFEST_SCHEMA_VERSION,
            version: version.to_owned(),
            source: source.to_owned(),
            executable: relative,
            sha256: sha256.to_owned(),
            installed_at: Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true),
        };
        write_manifest_atomic(&self.paths.manifest, &manifest)?;
        Ok(manifest)
    }

    async fn download_pinned_asset(
        &self,
        asset: OfficialAsset,
        destination: &Path,
    ) -> CoreResult<()> {
        if !is_lower_sha256(asset.archive_sha256) {
            return Err(CoreError::Integrity(
                "the embedded official SHA-256 is malformed".to_owned(),
            ));
        }
        let mut response = self
            .client
            .get(asset.url)
            .send()
            .await
            .map_err(|error| CoreError::Download(error.to_string()))?
            .error_for_status()
            .map_err(|error| CoreError::Download(error.to_string()))?;
        if response.url().scheme() != "https"
            || !response
                .url()
                .host_str()
                .is_some_and(is_trusted_download_host)
        {
            return Err(CoreError::Download(
                "the final download URL is not a trusted HTTPS host".to_owned(),
            ));
        }
        if response
            .content_length()
            .is_some_and(|length| length != asset.archive_size)
        {
            return Err(CoreError::Integrity(
                "the server reported an unexpected archive size".to_owned(),
            ));
        }

        let mut file = OpenOptions::new()
            .create_new(true)
            .write(true)
            .open(destination)
            .map_err(|error| CoreError::io("creating the downloaded archive", error))?;
        let mut hasher = Sha256::new();
        let mut written = 0_u64;
        while let Some(chunk) = response
            .chunk()
            .await
            .map_err(|error| CoreError::Download(error.to_string()))?
        {
            written = written
                .checked_add(chunk.len() as u64)
                .ok_or_else(|| CoreError::Integrity("download size overflow".to_owned()))?;
            if written > asset.archive_size {
                return Err(CoreError::Integrity(
                    "the download exceeded its pinned byte size".to_owned(),
                ));
            }
            hasher.update(&chunk);
            file.write_all(&chunk)
                .map_err(|error| CoreError::io("writing the downloaded archive", error))?;
        }
        file.sync_all()
            .map_err(|error| CoreError::io("syncing the downloaded archive", error))?;
        if written != asset.archive_size {
            return Err(CoreError::Integrity(format!(
                "downloaded {written} bytes, expected {}",
                asset.archive_size
            )));
        }
        verify_sha256_digest(&hasher.finalize(), asset.archive_sha256)
    }
}

fn is_trusted_download_host(host: &str) -> bool {
    matches!(
        host,
        "github.com"
            | "objects.githubusercontent.com"
            | "release-assets.githubusercontent.com"
            | "github-releases.githubusercontent.com"
    )
}

fn extract_exact_executable(
    asset: OfficialAsset,
    archive_path: &Path,
    destination: &Path,
) -> CoreResult<()> {
    let file = File::open(archive_path)
        .map_err(|error| CoreError::io("opening the verified archive", error))?;
    let mut archive =
        zip::ZipArchive::new(file).map_err(|error| CoreError::Archive(error.to_string()))?;
    if archive.len() != 1 {
        return Err(CoreError::Archive(format!(
            "the pinned archive must contain exactly one entry, found {}",
            archive.len()
        )));
    }
    let mut entry = archive
        .by_index(0)
        .map_err(|error| CoreError::Archive(error.to_string()))?;
    if entry.name() != asset.entry_name
        || entry.enclosed_name() != Some(Path::new(asset.entry_name).to_path_buf())
        || entry.is_dir()
    {
        return Err(CoreError::Archive(
            "the archive entry did not match the pinned executable allowlist".to_owned(),
        ));
    }
    if entry
        .unix_mode()
        .is_some_and(|mode| mode & 0o170000 == 0o120000)
    {
        return Err(CoreError::Archive(
            "symbolic links are not permitted in a core archive".to_owned(),
        ));
    }
    if entry.size() != asset.entry_size || entry.size() > MAX_EXECUTABLE_BYTES {
        return Err(CoreError::Archive(
            "the uncompressed executable size did not match the pinned release".to_owned(),
        ));
    }

    let mut output = OpenOptions::new()
        .create_new(true)
        .write(true)
        .open(destination)
        .map_err(|error| CoreError::io("creating the extracted executable", error))?;
    let copied = copy_reader_limited(&mut entry, &mut output, asset.entry_size)
        .map_err(|error| CoreError::io("extracting the verified executable", error))?;
    if copied != asset.entry_size {
        return Err(CoreError::Archive(
            "the extracted executable was truncated".to_owned(),
        ));
    }
    output
        .sync_all()
        .map_err(|error| CoreError::io("syncing the extracted executable", error))?;
    Ok(())
}

fn validate_mihomo_executable(path: &Path) -> CoreResult<String> {
    let mut command = Command::new(path);
    command
        .arg("-v")
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    configure_hidden_process(&mut command);
    let mut child = command.spawn().map_err(|error| {
        CoreError::Process(format!("could not execute the imported core: {error}"))
    })?;
    let stdout = child.stdout.take();
    let stderr = child.stderr.take();
    let stdout_reader = thread::spawn(move || read_bounded(stdout, 64 * 1024));
    let stderr_reader = thread::spawn(move || read_bounded(stderr, 64 * 1024));

    let deadline = Instant::now() + VERSION_TIMEOUT;
    let status = loop {
        match child.try_wait() {
            Ok(Some(status)) => break status,
            Ok(None) if Instant::now() < deadline => thread::sleep(Duration::from_millis(20)),
            Ok(None) => {
                let termination = terminate_validation_child(&mut child);
                if termination.is_ok() {
                    let _ = stdout_reader.join();
                    let _ = stderr_reader.join();
                }
                return Err(termination.err().unwrap_or_else(|| {
                    CoreError::InvalidExecutable("the version check exceeded 10 seconds".to_owned())
                }));
            }
            Err(error) => {
                let termination = terminate_validation_child(&mut child);
                if termination.is_ok() {
                    let _ = stdout_reader.join();
                    let _ = stderr_reader.join();
                }
                return Err(termination.err().unwrap_or_else(|| {
                    CoreError::Process(format!("could not inspect the version process: {error}"))
                }));
            }
        }
    };
    let stdout = stdout_reader.join().unwrap_or_default();
    let stderr = stderr_reader.join().unwrap_or_default();
    if !status.success() {
        return Err(CoreError::InvalidExecutable(format!(
            "`mihomo -v` exited with {status}"
        )));
    }
    let combined = format!(
        "{}\n{}",
        String::from_utf8_lossy(&stdout),
        String::from_utf8_lossy(&stderr)
    );
    parse_mihomo_version(&combined).ok_or_else(|| {
        CoreError::InvalidExecutable(
            "the executable did not emit the expected `Mihomo Meta vX.Y.Z` version".to_owned(),
        )
    })
}

fn terminate_validation_child(child: &mut Child) -> CoreResult<()> {
    if let Ok(Some(_)) = child.try_wait() {
        return Ok(());
    }

    if let Err(error) = child.kill() {
        if matches!(child.try_wait(), Ok(Some(_))) {
            return Ok(());
        }
        return Err(CoreError::Process(format!(
            "could not terminate the Mihomo version check: {error}"
        )));
    }

    let deadline = Instant::now() + Duration::from_secs(5);
    loop {
        match child.try_wait() {
            Ok(Some(_)) => return Ok(()),
            Ok(None) if Instant::now() < deadline => {
                thread::sleep(Duration::from_millis(20));
            }
            Ok(None) => {
                return Err(CoreError::Process(
                    "the Mihomo version check did not terminate within 5 seconds".to_owned(),
                ));
            }
            Err(error) => {
                return Err(CoreError::Process(format!(
                    "could not confirm termination of the Mihomo version check: {error}"
                )));
            }
        }
    }
}

fn parse_mihomo_version(output: &str) -> Option<String> {
    output.lines().find_map(|line| {
        if !line.contains("Mihomo Meta") {
            return None;
        }
        line.split_ascii_whitespace().find_map(|token| {
            let version = token.strip_prefix('v')?;
            let valid = version.len() <= 64
                && version.split('.').count() >= 3
                && version
                    .split('.')
                    .all(|part| !part.is_empty() && part.bytes().all(|byte| byte.is_ascii_digit()));
            valid.then(|| version.to_owned())
        })
    })
}

fn read_bounded<R: Read>(reader: Option<R>, limit: usize) -> Vec<u8> {
    let Some(reader) = reader else {
        return Vec::new();
    };
    let mut output = Vec::with_capacity(limit.min(4 * 1024));
    let _ = reader.take(limit as u64).read_to_end(&mut output);
    output
}

fn configure_hidden_process(command: &mut Command) {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        command.creation_flags(CREATE_NO_WINDOW);
    }
}

fn copy_reader_limited<R: Read, W: Write>(
    reader: &mut R,
    writer: &mut W,
    limit: u64,
) -> std::io::Result<u64> {
    let mut limited = reader.take(limit.saturating_add(1));
    let copied = std::io::copy(&mut limited, writer)?;
    if copied > limit {
        return Err(std::io::Error::new(
            std::io::ErrorKind::InvalidData,
            "input exceeded its byte limit",
        ));
    }
    Ok(copied)
}

fn copy_file_limited(source: &Path, destination: &Path, limit: u64) -> CoreResult<String> {
    let mut input = File::open(source)
        .map_err(|error| CoreError::io("opening the imported executable", error))?;
    let mut output = OpenOptions::new()
        .create_new(true)
        .write(true)
        .open(destination)
        .map_err(|error| CoreError::io("creating the managed executable", error))?;
    let mut hasher = Sha256::new();
    let mut buffer = [0_u8; 64 * 1024];
    let mut total = 0_u64;
    loop {
        let read = input
            .read(&mut buffer)
            .map_err(|error| CoreError::io("reading the imported executable", error))?;
        if read == 0 {
            break;
        }
        total = total
            .checked_add(read as u64)
            .ok_or_else(|| CoreError::InvalidExecutable("file size overflow".to_owned()))?;
        if total > limit {
            return Err(CoreError::InvalidExecutable(format!(
                "the executable exceeded {limit} bytes"
            )));
        }
        hasher.update(&buffer[..read]);
        output
            .write_all(&buffer[..read])
            .map_err(|error| CoreError::io("writing the managed executable", error))?;
    }
    if total == 0 {
        return Err(CoreError::InvalidExecutable(
            "the executable was empty".to_owned(),
        ));
    }
    output
        .sync_all()
        .map_err(|error| CoreError::io("syncing the managed executable", error))?;
    Ok(format!("{:x}", hasher.finalize()))
}

fn hash_file_limited(path: &Path, limit: u64) -> CoreResult<String> {
    let mut file = File::open(path)
        .map_err(|error| CoreError::io("opening an executable for verification", error))?;
    let mut hasher = Sha256::new();
    let mut buffer = [0_u8; 64 * 1024];
    let mut total = 0_u64;
    loop {
        let read = file
            .read(&mut buffer)
            .map_err(|error| CoreError::io("hashing an executable", error))?;
        if read == 0 {
            break;
        }
        total = total
            .checked_add(read as u64)
            .ok_or_else(|| CoreError::Integrity("file size overflow".to_owned()))?;
        if total > limit {
            return Err(CoreError::Integrity(format!(
                "the executable exceeded {limit} bytes"
            )));
        }
        hasher.update(&buffer[..read]);
    }
    if total == 0 {
        return Err(CoreError::Integrity("the executable is empty".to_owned()));
    }
    Ok(format!("{:x}", hasher.finalize()))
}

fn verify_sha256_digest(actual: &[u8], expected: &str) -> CoreResult<()> {
    if !is_lower_sha256(expected) {
        return Err(CoreError::Integrity(
            "the expected SHA-256 is malformed".to_owned(),
        ));
    }
    let actual_hex = actual
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect::<String>();
    if actual_hex == expected {
        Ok(())
    } else {
        Err(CoreError::Integrity(
            "the archive SHA-256 did not match the pinned release".to_owned(),
        ))
    }
}

fn is_lower_sha256(value: &str) -> bool {
    value.len() == 64
        && value
            .bytes()
            .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
}

fn safe_version(version: &str) -> CoreResult<&str> {
    let valid = !version.is_empty()
        && version.len() <= 64
        && version
            .bytes()
            .all(|byte| byte.is_ascii_digit() || byte == b'.');
    if valid {
        Ok(version)
    } else {
        Err(CoreError::InvalidExecutable(
            "the version is not safe for an installation path".to_owned(),
        ))
    }
}

fn validate_manifest_fields(manifest: &CoreManifest) -> CoreResult<()> {
    if manifest.schema_version != MANIFEST_SCHEMA_VERSION {
        return Err(CoreError::InvalidManifest(format!(
            "unsupported schema version {}",
            manifest.schema_version
        )));
    }
    safe_version(&manifest.version)
        .map_err(|error| CoreError::InvalidManifest(error.to_string()))?;
    if !matches!(manifest.source.as_str(), "official" | "imported") {
        return Err(CoreError::InvalidManifest(
            "unknown installation source".to_owned(),
        ));
    }
    if !is_lower_sha256(&manifest.sha256) {
        return Err(CoreError::InvalidManifest(
            "the executable SHA-256 is malformed".to_owned(),
        ));
    }
    Ok(())
}

fn validate_import_source_path(source: &Path) -> CoreResult<()> {
    if source.as_os_str().is_empty()
        || source.as_os_str().to_string_lossy().len() > 32_768
        || !source.is_absolute()
    {
        return Err(CoreError::InvalidExecutable(
            "the imported executable path must be a non-empty absolute path no longer than 32,768 characters"
                .to_owned(),
        ));
    }
    Ok(())
}

fn write_manifest_atomic(path: &Path, manifest: &CoreManifest) -> CoreResult<()> {
    let mut file = AtomicWriteFile::options()
        .open(path)
        .map_err(|error| CoreError::io("opening the atomic core manifest", error))?;
    serde_json::to_writer_pretty(&mut file, manifest).map_err(|error| {
        CoreError::InvalidManifest(format!("could not serialize the manifest: {error}"))
    })?;
    file.write_all(b"\n")
        .map_err(|error| CoreError::io("writing the atomic core manifest", error))?;
    file.commit()
        .map_err(|error| CoreError::io("committing the atomic core manifest", error))
}

fn write_license_files(directory: &Path) -> CoreResult<()> {
    for (name, contents) in [
        ("LICENSE.mihomo.txt", MIHOMO_LICENSE),
        ("NOTICE.mihomo.md", MIHOMO_NOTICE),
    ] {
        let path = directory.join(name);
        let mut file = OpenOptions::new()
            .create_new(true)
            .write(true)
            .open(path)
            .map_err(|error| CoreError::io("creating Mihomo license information", error))?;
        file.write_all(contents.as_bytes())
            .map_err(|error| CoreError::io("writing Mihomo license information", error))?;
        file.sync_all()
            .map_err(|error| CoreError::io("syncing Mihomo license information", error))?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use sha2::{Digest, Sha256};

    use std::path::Path;

    use super::{
        is_lower_sha256, parse_mihomo_version, safe_version, validate_import_source_path,
        verify_sha256_digest,
    };

    #[test]
    fn verifies_sha256_exactly() {
        let digest = Sha256::digest(b"horion");
        let expected = format!("{digest:x}");
        assert!(verify_sha256_digest(&digest, &expected).is_ok());
        assert!(verify_sha256_digest(&digest, &"0".repeat(64)).is_err());
        assert!(!is_lower_sha256(&"A".repeat(64)));
    }

    #[test]
    fn parses_only_expected_mihomo_version_shape() {
        assert_eq!(
            parse_mihomo_version("Mihomo Meta v1.19.29 windows amd64"),
            Some("1.19.29".to_owned())
        );
        assert_eq!(parse_mihomo_version("other v1.19.29"), None);
        assert_eq!(parse_mihomo_version("Mihomo Meta v1.19.x"), None);
    }

    #[test]
    fn version_cannot_escape_install_directory() {
        assert!(safe_version("1.19.29").is_ok());
        assert!(safe_version("../1.19.29").is_err());
        assert!(safe_version("1.19.29-beta").is_err());
    }

    #[test]
    fn imported_core_requires_an_absolute_path() {
        assert!(validate_import_source_path(Path::new("mihomo.exe")).is_err());
        assert!(validate_import_source_path(Path::new("")).is_err());
    }
}
