use std::{
    fs::{self, File},
    io::{Read, Write},
    path::{Component, Path, PathBuf},
    sync::Arc,
    time::Duration,
};

use atomic_write_file::AtomicWriteFile;
use chrono::{SecondsFormat, Utc};
use reqwest::{header::USER_AGENT, redirect::Policy, Client, StatusCode};
use serde_yaml_ng::Value;
use url::Url;
use uuid::Uuid;

use crate::core::CoreService;

use super::{
    credentials,
    error::{ProfileError, ProfileResult},
    model::{
        ProfileActivation, ProfileContent, ProfileKind, ProfileManifest, ProfileRecord,
        ProfileStatus, ProfileSummary, SubscriptionUsage,
    },
};

pub(crate) const MAX_PROFILE_BYTES: u64 = 8 * 1024 * 1024;
const MAX_PROFILE_NAME_CHARS: usize = 80;
const MAX_USER_AGENT_BYTES: usize = 256;
const HISTORY_LIMIT: usize = 10;
const DEFAULT_USER_AGENT: &str = concat!(
    "Horion/",
    env!("CARGO_PKG_VERSION"),
    " (+https://github.com/hhhoratioxu/Horion)"
);

#[derive(Clone, Debug, Eq, PartialEq)]
pub(crate) struct ActiveProxyMetadata {
    pub name: String,
    pub proxy_type: String,
    pub server: String,
    pub port: Option<u16>,
}

#[derive(Clone, Debug)]
struct ProfilePaths {
    contents: PathBuf,
    history: PathBuf,
    manifest: PathBuf,
    tombstones: PathBuf,
}

impl ProfilePaths {
    fn create(app_data: &Path) -> ProfileResult<Self> {
        let root = app_data.join("profiles");
        let contents = root.join("items");
        let history = root.join("history");
        let tombstones = root.join("delete-tombstones");
        fs::create_dir_all(&contents)
            .map_err(|error| ProfileError::io("creating the profile content directory", error))?;
        fs::create_dir_all(&history)
            .map_err(|error| ProfileError::io("creating the profile history directory", error))?;
        fs::create_dir_all(&tombstones)
            .map_err(|error| ProfileError::io("creating the profile deletion directory", error))?;
        Ok(Self {
            manifest: root.join("profiles.json"),
            contents,
            history,
            tombstones,
        })
    }

    fn content(&self, id: &str) -> ProfileResult<PathBuf> {
        validate_id(id)?;
        Ok(self.contents.join(format!("{id}.yaml")))
    }

    fn history_directory(&self, id: &str) -> ProfileResult<PathBuf> {
        validate_id(id)?;
        Ok(self.history.join(id))
    }
}

struct ProfileInner {
    paths: ProfilePaths,
    operation: tokio::sync::Mutex<()>,
    client: Client,
}

#[derive(serde::Deserialize, serde::Serialize)]
#[serde(deny_unknown_fields)]
struct DeletionMarker {
    has_credential: bool,
}

#[derive(Clone)]
pub struct ProfileService {
    inner: Arc<ProfileInner>,
}

impl ProfileService {
    pub fn new(app_data: impl AsRef<Path>) -> ProfileResult<Self> {
        let paths = ProfilePaths::create(app_data.as_ref())?;
        let redirects = Policy::custom(|attempt| {
            if attempt.previous().len() >= 8 {
                return attempt.error("subscription redirect limit exceeded");
            }
            if validate_redirect_url(attempt.url()) {
                attempt.follow()
            } else {
                attempt.error("subscription redirect was not secure")
            }
        });
        let client = Client::builder()
            .https_only(true)
            .no_proxy()
            .redirect(redirects)
            .connect_timeout(Duration::from_secs(10))
            .timeout(Duration::from_secs(30))
            .build()
            .map_err(|_| ProfileError::Subscription {
                host: "subscription host".to_owned(),
                reason: "could not initialize the secure HTTP client".to_owned(),
            })?;
        let service = Self {
            inner: Arc::new(ProfileInner {
                paths,
                operation: tokio::sync::Mutex::new(()),
                client,
            }),
        };
        let manifest = service.load_manifest()?;
        service.recover_deletion_tombstones(&manifest)?;
        Ok(service)
    }

    pub async fn list(&self) -> ProfileResult<Vec<ProfileSummary>> {
        let _operation = self.inner.operation.lock().await;
        let manifest = self.load_manifest()?;
        Ok(summaries(&manifest))
    }

    pub async fn import_local(
        &self,
        core: &CoreService,
        name: String,
        path: String,
    ) -> ProfileResult<ProfileSummary> {
        let _operation = self.inner.operation.lock().await;
        let name = validate_name(&name)?;
        let source = validate_local_path(&path)?;
        let content = read_file_bounded(&source)?;
        validate_yaml(&content)?;
        core.validate_profile_content(&content)
            .await
            .map_err(|error| ProfileError::Validation(error.to_string()))?;

        let id = Uuid::new_v4().to_string();
        let now = timestamp();
        let record = ProfileRecord {
            id: id.clone(),
            name,
            kind: ProfileKind::Local,
            updated_at: now.clone(),
            last_checked_at: Some(now),
            source_label: source
                .file_name()
                .and_then(|value| value.to_str())
                .unwrap_or("local.yaml")
                .to_owned(),
            status: ProfileStatus::Ready,
            last_error: None,
            bytes: content.len() as u64,
            revision: 1,
            subscription: None,
            credential_key: None,
            user_agent: None,
            local_source: Some(source.to_string_lossy().into_owned()),
        };
        let path = self.inner.paths.content(&id)?;
        write_bytes_atomic(&path, &content)?;
        let mut manifest = self.load_manifest()?;
        manifest.profiles.push(record.clone());
        if let Err(error) = self.write_manifest(&manifest) {
            let _ = fs::remove_file(path);
            return Err(error);
        }
        Ok(record.summary(manifest.active_profile.as_deref()))
    }

    pub async fn add_subscription(
        &self,
        core: &CoreService,
        name: String,
        url: String,
        user_agent: Option<String>,
    ) -> ProfileResult<ProfileSummary> {
        let _operation = self.inner.operation.lock().await;
        let name = validate_name(&name)?;
        let subscription = validate_subscription_url(&url)?;
        let user_agent = validate_user_agent(user_agent)?;
        let downloaded = self
            .download_subscription(&subscription, user_agent.as_deref())
            .await?;
        validate_yaml(&downloaded.content)?;
        core.validate_profile_content(&downloaded.content)
            .await
            .map_err(|error| ProfileError::Validation(error.to_string()))?;

        let id = Uuid::new_v4().to_string();
        let credential_key = credential_key(&id);
        credentials::store(&credential_key, &url)?;
        let now = timestamp();
        let record = ProfileRecord {
            id: id.clone(),
            name,
            kind: ProfileKind::Subscription,
            updated_at: now.clone(),
            last_checked_at: Some(now),
            source_label: subscription.host,
            status: ProfileStatus::Ready,
            last_error: None,
            bytes: downloaded.content.len() as u64,
            revision: 1,
            subscription: Some(downloaded.usage),
            credential_key: Some(credential_key.clone()),
            user_agent,
            local_source: None,
        };
        let path = self.inner.paths.content(&id)?;
        if let Err(error) = write_bytes_atomic(&path, &downloaded.content) {
            let _ = credentials::delete(&credential_key);
            return Err(error);
        }
        let mut manifest = self.load_manifest()?;
        manifest.profiles.push(record.clone());
        if let Err(error) = self.write_manifest(&manifest) {
            let _ = fs::remove_file(path);
            let _ = credentials::delete(&credential_key);
            return Err(error);
        }
        Ok(record.summary(manifest.active_profile.as_deref()))
    }

    pub async fn update(&self, core: &CoreService, id: String) -> ProfileResult<ProfileSummary> {
        let _operation = self.inner.operation.lock().await;
        validate_id(&id)?;
        let mut manifest = self.load_manifest()?;
        self.update_one_locked(core, &mut manifest, &id).await?;
        let record = find_record(&manifest, &id)?;
        Ok(record.summary(manifest.active_profile.as_deref()))
    }

    pub async fn update_all(&self, core: &CoreService) -> ProfileResult<Vec<ProfileSummary>> {
        let _operation = self.inner.operation.lock().await;
        let mut manifest = self.load_manifest()?;
        let ids = manifest
            .profiles
            .iter()
            .filter(|profile| profile.kind == ProfileKind::Subscription)
            .map(|profile| profile.id.clone())
            .collect::<Vec<_>>();
        for id in ids {
            let _ = self.update_one_locked(core, &mut manifest, &id).await;
        }
        Ok(summaries(&manifest))
    }

    pub async fn rename(&self, id: String, name: String) -> ProfileResult<ProfileSummary> {
        let _operation = self.inner.operation.lock().await;
        validate_id(&id)?;
        let name = validate_name(&name)?;
        let mut manifest = self.load_manifest()?;
        let active = manifest.active_profile.clone();
        let record = find_record_mut(&mut manifest, &id)?;
        record.name = name;
        record.updated_at = timestamp();
        self.write_manifest(&manifest)?;
        Ok(find_record(&manifest, &id)?.summary(active.as_deref()))
    }

    pub async fn duplicate(&self, id: String, name: String) -> ProfileResult<ProfileSummary> {
        let _operation = self.inner.operation.lock().await;
        validate_id(&id)?;
        let name = validate_name(&name)?;
        let mut manifest = self.load_manifest()?;
        let source = find_record(&manifest, &id)?.clone();
        let content = self.read_content(&id)?;
        let new_id = Uuid::new_v4().to_string();
        let mut credential_to_remove = None;
        let (credential_key, user_agent) = if source.kind == ProfileKind::Subscription {
            let source_key = source.credential_key.as_deref().ok_or_else(|| {
                ProfileError::InvalidMetadata("subscription has no credential key".to_owned())
            })?;
            let secret = credentials::load(source_key)?;
            let new_key = credential_key(&new_id);
            credentials::store(&new_key, secret.as_str())?;
            credential_to_remove = Some(new_key.clone());
            (Some(new_key), source.user_agent.clone())
        } else {
            (None, None)
        };
        let now = timestamp();
        let record = ProfileRecord {
            id: new_id.clone(),
            name,
            kind: source.kind,
            updated_at: now,
            last_checked_at: source.last_checked_at,
            source_label: source.source_label,
            status: ProfileStatus::Ready,
            last_error: None,
            bytes: content.len() as u64,
            revision: 1,
            subscription: source.subscription,
            credential_key,
            user_agent,
            local_source: source.local_source,
        };
        let destination = self.inner.paths.content(&new_id)?;
        if let Err(error) = write_bytes_atomic(&destination, &content) {
            if let Some(key) = credential_to_remove.as_deref() {
                let _ = credentials::delete(key);
            }
            return Err(error);
        }
        manifest.profiles.push(record.clone());
        if let Err(error) = self.write_manifest(&manifest) {
            let _ = fs::remove_file(destination);
            if let Some(key) = credential_to_remove.as_deref() {
                let _ = credentials::delete(key);
            }
            return Err(error);
        }
        Ok(record.summary(manifest.active_profile.as_deref()))
    }

    pub async fn delete(&self, id: String) -> ProfileResult<()> {
        let _operation = self.inner.operation.lock().await;
        validate_id(&id)?;
        let mut manifest = self.load_manifest()?;
        if manifest.active_profile.as_deref() == Some(id.as_str()) {
            return Err(ProfileError::ActiveProfile);
        }
        let index = manifest
            .profiles
            .iter()
            .position(|profile| profile.id == id)
            .ok_or(ProfileError::NotFound)?;
        let original_manifest = manifest.clone();
        let removed = manifest.profiles.remove(index);
        let path = self.inner.paths.content(&id)?;
        let history = self.inner.paths.history_directory(&id)?;
        let tombstone =
            self.stage_profile_deletion(&id, &path, &history, removed.credential_key.is_some())?;
        if let Err(error) = self.write_manifest(&manifest) {
            self.write_manifest(&original_manifest)?;
            self.restore_profile_deletion(&path, &history, &tombstone)?;
            return Err(error);
        }

        let credential_removed = removed
            .credential_key
            .as_deref()
            .is_none_or(|key| credentials::delete(key).is_ok());
        if credential_removed {
            let _ = remove_managed_directory(&tombstone);
        } else {
            cleanup_tombstone_payload(&tombstone);
        }
        Ok(())
    }

    pub async fn get_content(&self, id: String) -> ProfileResult<ProfileContent> {
        let _operation = self.inner.operation.lock().await;
        validate_id(&id)?;
        let manifest = self.load_manifest()?;
        let record = find_record(&manifest, &id)?;
        let content = self.read_content(&id)?;
        let content = String::from_utf8(content).map_err(|_| {
            ProfileError::InvalidMetadata("managed profile is not valid UTF-8".to_owned())
        })?;
        Ok(ProfileContent {
            id,
            content,
            revision: record.revision,
        })
    }

    pub async fn save_content(
        &self,
        core: &CoreService,
        id: String,
        content: String,
        expected_revision: u64,
    ) -> ProfileResult<ProfileSummary> {
        let _operation = self.inner.operation.lock().await;
        validate_id(&id)?;
        validate_yaml(content.as_bytes())?;
        core.validate_profile_content(content.as_bytes())
            .await
            .map_err(|error| ProfileError::Validation(error.to_string()))?;
        let mut manifest = self.load_manifest()?;
        let active = manifest.active_profile.clone();
        let index = manifest
            .profiles
            .iter()
            .position(|profile| profile.id == id)
            .ok_or(ProfileError::NotFound)?;
        if manifest.profiles[index].revision != expected_revision {
            return Err(ProfileError::RevisionConflict);
        }
        let old_content = self.read_content(&id)?;
        self.backup_content(&id, expected_revision, &old_content)?;
        let path = self.inner.paths.content(&id)?;
        write_bytes_atomic(&path, content.as_bytes())?;
        let previous = manifest.profiles[index].clone();
        let record = &mut manifest.profiles[index];
        record.revision = record.revision.saturating_add(1);
        record.bytes = content.len() as u64;
        record.updated_at = timestamp();
        record.status = ProfileStatus::Ready;
        record.last_error = None;
        if let Err(error) = self.write_manifest(&manifest) {
            let _ = write_bytes_atomic(&path, &old_content);
            manifest.profiles[index] = previous;
            return Err(error);
        }
        if active.as_deref() == Some(id.as_str()) {
            if let Err(error) = core.reapply_active_profile_if_running().await {
                let error = ProfileError::Validation(redact_urls(&error.to_string()));
                let mut rollback = previous;
                rollback.status = ProfileStatus::Error;
                rollback.last_error = Some(safe_error(&error));
                manifest.profiles[index] = rollback;
                write_bytes_atomic(&path, &old_content)?;
                self.write_manifest(&manifest)?;
                let _ = core.start().await;
                return Err(error);
            }
        }
        self.prune_history(&id)?;
        Ok(find_record(&manifest, &id)?.summary(active.as_deref()))
    }

    pub async fn activate(
        &self,
        core: &CoreService,
        id: String,
    ) -> ProfileResult<ProfileActivation> {
        let _operation = self.inner.operation.lock().await;
        validate_id(&id)?;
        let content = self.content_for_unlocked(&id)?;
        validate_yaml(&content)?;
        let snapshot = core
            .activate_profile_locked(self, &id, &content)
            .await
            .map_err(|error| ProfileError::Validation(error.to_string()))?;
        let profile = self.summary_unlocked(&id)?;
        Ok(ProfileActivation {
            profile,
            core: snapshot,
        })
    }

    pub(crate) fn active_id_unlocked(&self) -> ProfileResult<Option<String>> {
        Ok(self.load_manifest()?.active_profile)
    }

    pub(crate) fn set_active_id_unlocked(&self, id: Option<&str>) -> ProfileResult<()> {
        if let Some(id) = id {
            validate_id(id)?;
        }
        let mut manifest = self.load_manifest()?;
        if let Some(id) = id {
            find_record(&manifest, id)?;
        }
        manifest.active_profile = id.map(str::to_owned);
        self.write_manifest(&manifest)
    }

    pub(crate) fn content_for_unlocked(&self, id: &str) -> ProfileResult<Vec<u8>> {
        let manifest = self.load_manifest()?;
        find_record(&manifest, id)?;
        self.read_content(id)
    }

    pub(crate) fn active_content_unlocked(&self) -> ProfileResult<Option<Vec<u8>>> {
        let manifest = self.load_manifest()?;
        let Some(id) = manifest.active_profile.as_deref() else {
            return Ok(None);
        };
        find_record(&manifest, id)?;
        self.read_content(id).map(Some)
    }

    #[allow(dead_code)]
    pub(crate) fn active_proxy_metadata_unlocked(&self) -> ProfileResult<Vec<ActiveProxyMetadata>> {
        let Some(content) = self.active_content_unlocked()? else {
            return Ok(Vec::new());
        };
        let value: Value = serde_yaml_ng::from_slice(&content)
            .map_err(|error| ProfileError::InvalidYaml(error.to_string()))?;
        let Some(proxies) = value
            .as_mapping()
            .and_then(|mapping| mapping.get(Value::String("proxies".to_owned())))
            .and_then(Value::as_sequence)
        else {
            return Ok(Vec::new());
        };
        Ok(proxies
            .iter()
            .filter_map(|proxy| {
                let mapping = proxy.as_mapping()?;
                let string = |key: &str| {
                    mapping
                        .get(Value::String(key.to_owned()))
                        .and_then(Value::as_str)
                        .map(str::to_owned)
                };
                let name = string("name")?;
                let proxy_type = string("type")?;
                let server = string("server")?;
                let port = mapping
                    .get(Value::String("port".to_owned()))
                    .and_then(|value| {
                        value
                            .as_u64()
                            .and_then(|port| u16::try_from(port).ok())
                            .or_else(|| value.as_str().and_then(|port| port.parse().ok()))
                    });
                Some(ActiveProxyMetadata {
                    name,
                    proxy_type,
                    server,
                    port,
                })
            })
            .collect())
    }

    pub(crate) fn summary_unlocked(&self, id: &str) -> ProfileResult<ProfileSummary> {
        let manifest = self.load_manifest()?;
        Ok(find_record(&manifest, id)?.summary(manifest.active_profile.as_deref()))
    }

    async fn update_one_locked(
        &self,
        core: &CoreService,
        manifest: &mut ProfileManifest,
        id: &str,
    ) -> ProfileResult<()> {
        let index = manifest
            .profiles
            .iter()
            .position(|profile| profile.id == id)
            .ok_or(ProfileError::NotFound)?;
        manifest.profiles[index].status = ProfileStatus::Updating;
        manifest.profiles[index].last_error = None;
        self.write_manifest(manifest)?;
        let current = manifest.profiles[index].clone();
        let checked_at = timestamp();
        let result = match current.kind {
            ProfileKind::Local => {
                let source = current.local_source.as_deref().ok_or_else(|| {
                    ProfileError::InvalidMetadata("local profile has no source path".to_owned())
                });
                source.and_then(validate_local_path).and_then(|path| {
                    read_file_bounded(&path).map(|content| DownloadedProfile {
                        content,
                        usage: SubscriptionUsage::default(),
                    })
                })
            }
            ProfileKind::Subscription => match current.credential_key.as_deref() {
                Some(key) => match credentials::load(key) {
                    Ok(secret) => match validate_subscription_url(secret.as_str()) {
                        Ok(subscription) => {
                            self.download_subscription(&subscription, current.user_agent.as_deref())
                                .await
                        }
                        Err(error) => Err(error),
                    },
                    Err(error) => Err(error),
                },
                None => Err(ProfileError::InvalidMetadata(
                    "subscription profile has no credential key".to_owned(),
                )),
            },
        };
        let downloaded = match result {
            Ok(downloaded) => downloaded,
            Err(error) => {
                let record = &mut manifest.profiles[index];
                record.status = ProfileStatus::Error;
                record.last_checked_at = Some(checked_at);
                record.last_error = Some(safe_error(&error));
                self.write_manifest(manifest)?;
                return Err(error);
            }
        };
        if let Err(error) = validate_yaml(&downloaded.content) {
            let record = &mut manifest.profiles[index];
            record.status = ProfileStatus::Error;
            record.last_checked_at = Some(checked_at);
            record.last_error = Some(safe_error(&error));
            self.write_manifest(manifest)?;
            return Err(error);
        }
        if let Err(error) = core.validate_profile_content(&downloaded.content).await {
            let error = ProfileError::Validation(error.to_string());
            let record = &mut manifest.profiles[index];
            record.status = ProfileStatus::Error;
            record.last_checked_at = Some(checked_at);
            record.last_error = Some(safe_error(&error));
            self.write_manifest(manifest)?;
            return Err(error);
        }

        let old_content = self.read_content(id)?;
        self.backup_content(id, current.revision, &old_content)?;
        let path = self.inner.paths.content(id)?;
        write_bytes_atomic(&path, &downloaded.content)?;
        let record = &mut manifest.profiles[index];
        record.revision = record.revision.saturating_add(1);
        record.bytes = downloaded.content.len() as u64;
        record.updated_at = checked_at.clone();
        record.last_checked_at = Some(checked_at);
        record.status = ProfileStatus::Ready;
        record.last_error = None;
        if record.kind == ProfileKind::Subscription {
            record.subscription = Some(downloaded.usage);
        }
        if let Err(error) = self.write_manifest(manifest) {
            let _ = write_bytes_atomic(&path, &old_content);
            manifest.profiles[index] = current;
            return Err(error);
        }
        if manifest.active_profile.as_deref() == Some(id) {
            if let Err(error) = core.reapply_active_profile_if_running().await {
                let error = ProfileError::Validation(redact_urls(&error.to_string()));
                let mut rollback = current;
                rollback.status = ProfileStatus::Error;
                rollback.last_checked_at = Some(timestamp());
                rollback.last_error = Some(safe_error(&error));
                manifest.profiles[index] = rollback;
                write_bytes_atomic(&path, &old_content)?;
                self.write_manifest(manifest)?;
                let _ = core.start().await;
                return Err(error);
            }
        }
        self.prune_history(id)?;
        Ok(())
    }

    async fn download_subscription(
        &self,
        subscription: &ValidatedSubscription,
        user_agent: Option<&str>,
    ) -> ProfileResult<DownloadedProfile> {
        let mut last_reason = "request failed".to_owned();
        for attempt in 0..=2 {
            let request = self
                .inner
                .client
                .get(subscription.url.clone())
                .header(USER_AGENT, user_agent.unwrap_or(DEFAULT_USER_AGENT));
            match request.send().await {
                Ok(mut response) if response.status().is_success() => {
                    if response
                        .content_length()
                        .is_some_and(|length| length > MAX_PROFILE_BYTES)
                    {
                        return Err(ProfileError::SizeLimit);
                    }
                    let usage = response
                        .headers()
                        .get("subscription-userinfo")
                        .and_then(|value| value.to_str().ok())
                        .map(parse_subscription_userinfo)
                        .unwrap_or_default();
                    let mut content = Vec::with_capacity(64 * 1024);
                    while let Some(chunk) = response.chunk().await.map_err(|error| {
                        subscription_error(&subscription.host, network_reason(&error))
                    })? {
                        if content.len().saturating_add(chunk.len()) > MAX_PROFILE_BYTES as usize {
                            return Err(ProfileError::SizeLimit);
                        }
                        content.extend_from_slice(&chunk);
                    }
                    if content.is_empty() {
                        return Err(ProfileError::SizeLimit);
                    }
                    return Ok(DownloadedProfile { content, usage });
                }
                Ok(response) => {
                    let status = response.status();
                    last_reason = format!("server returned HTTP {}", status.as_u16());
                    if !retryable_status(status) {
                        return Err(subscription_error(&subscription.host, last_reason));
                    }
                }
                Err(error) => {
                    last_reason = network_reason(&error);
                }
            }
            if attempt < 2 {
                tokio::time::sleep(Duration::from_millis(200 * (attempt + 1) as u64)).await;
            }
        }
        Err(subscription_error(&subscription.host, last_reason))
    }

    fn read_content(&self, id: &str) -> ProfileResult<Vec<u8>> {
        read_managed_file_bounded(&self.inner.paths.contents, &self.inner.paths.content(id)?)
    }

    fn backup_content(&self, id: &str, revision: u64, content: &[u8]) -> ProfileResult<()> {
        let directory = self.inner.paths.history_directory(id)?;
        fs::create_dir_all(&directory)
            .map_err(|error| ProfileError::io("creating profile history", error))?;
        let filename = format!(
            "{revision:020}-{}.yaml",
            Utc::now().timestamp_nanos_opt().unwrap_or_default()
        );
        write_bytes_atomic(&directory.join(filename), content)
    }

    fn prune_history(&self, id: &str) -> ProfileResult<()> {
        let directory = self.inner.paths.history_directory(id)?;
        if !directory.exists() {
            return Ok(());
        }
        let mut entries = fs::read_dir(&directory)
            .map_err(|error| ProfileError::io("reading profile history", error))?
            .filter_map(Result::ok)
            .filter(|entry| entry.file_type().is_ok_and(|kind| kind.is_file()))
            .collect::<Vec<_>>();
        entries.sort_by_key(|entry| entry.file_name());
        let remove_count = entries.len().saturating_sub(HISTORY_LIMIT);
        for entry in entries.into_iter().take(remove_count) {
            fs::remove_file(entry.path())
                .map_err(|error| ProfileError::io("pruning profile history", error))?;
        }
        Ok(())
    }

    fn stage_profile_deletion(
        &self,
        id: &str,
        content: &Path,
        history: &Path,
        has_credential: bool,
    ) -> ProfileResult<PathBuf> {
        reject_symlink(content)?;
        let history_exists = managed_directory_exists(history)?;
        let tombstone = self.inner.paths.tombstones.join(id);
        match fs::symlink_metadata(&tombstone) {
            Ok(_) => {
                return Err(ProfileError::InvalidMetadata(
                    "profile has an unfinished deletion transaction".to_owned(),
                ))
            }
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
            Err(error) => {
                return Err(ProfileError::io(
                    "checking the profile deletion transaction",
                    error,
                ))
            }
        }
        fs::create_dir(&tombstone)
            .map_err(|error| ProfileError::io("creating a profile deletion transaction", error))?;
        let marker = DeletionMarker { has_credential };
        let marker_content = serde_json::to_vec(&marker).map_err(|error| {
            ProfileError::InvalidMetadata(format!(
                "could not serialize profile deletion metadata: {error}"
            ))
        })?;
        if let Err(error) = write_bytes_atomic(&tombstone.join("transaction.json"), &marker_content)
        {
            let _ = remove_managed_directory(&tombstone);
            return Err(error);
        }

        let staged_content = tombstone.join("content.yaml");
        if let Err(error) = fs::rename(content, &staged_content) {
            let _ = remove_managed_directory(&tombstone);
            return Err(ProfileError::io(
                "staging profile content for deletion",
                error,
            ));
        }
        if history_exists {
            if let Err(error) = fs::rename(history, tombstone.join("history")) {
                let restore = fs::rename(&staged_content, content);
                let _ = remove_managed_directory(&tombstone);
                if let Err(restore) = restore {
                    return Err(ProfileError::InvalidMetadata(format!(
                        "could not stage profile history for deletion: {error}; content rollback failed: {restore}"
                    )));
                }
                return Err(ProfileError::io(
                    "staging profile history for deletion",
                    error,
                ));
            }
        }
        Ok(tombstone)
    }

    fn restore_profile_deletion(
        &self,
        content: &Path,
        history: &Path,
        tombstone: &Path,
    ) -> ProfileResult<()> {
        let staged_history = tombstone.join("history");
        if managed_directory_exists(&staged_history)? {
            if path_exists_without_following(history)? {
                return Err(ProfileError::InvalidMetadata(
                    "profile history exists both inside and outside its deletion transaction"
                        .to_owned(),
                ));
            }
            fs::rename(&staged_history, history)
                .map_err(|error| ProfileError::io("restoring profile history", error))?;
        }

        let staged_content = tombstone.join("content.yaml");
        if path_exists_without_following(&staged_content)? {
            reject_symlink(&staged_content)?;
            if path_exists_without_following(content)? {
                return Err(ProfileError::InvalidMetadata(
                    "profile content exists both inside and outside its deletion transaction"
                        .to_owned(),
                ));
            }
            fs::rename(&staged_content, content)
                .map_err(|error| ProfileError::io("restoring profile content", error))?;
        } else if !path_exists_without_following(content)? {
            return Err(ProfileError::InvalidMetadata(
                "profile deletion transaction has no recoverable content".to_owned(),
            ));
        }
        remove_managed_directory(tombstone)
    }

    fn recover_deletion_tombstones(&self, manifest: &ProfileManifest) -> ProfileResult<()> {
        let entries = fs::read_dir(&self.inner.paths.tombstones)
            .map_err(|error| ProfileError::io("reading profile deletion transactions", error))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|error| ProfileError::io("reading a profile deletion transaction", error))?;
        for entry in entries {
            let id = entry.file_name().into_string().map_err(|_| {
                ProfileError::InvalidMetadata(
                    "profile deletion transaction has an invalid identifier".to_owned(),
                )
            })?;
            validate_id(&id)?;
            let tombstone = entry.path();
            let file_type = entry.file_type().map_err(|error| {
                ProfileError::io("reading profile deletion transaction metadata", error)
            })?;
            if file_type.is_symlink() || !file_type.is_dir() {
                return Err(ProfileError::InvalidPath(
                    "profile deletion transaction is not a regular directory".to_owned(),
                ));
            }
            if manifest.profiles.iter().any(|profile| profile.id == id) {
                let content = self.inner.paths.content(&id)?;
                let history = self.inner.paths.history_directory(&id)?;
                self.restore_profile_deletion(&content, &history, &tombstone)?;
                continue;
            }

            let marker = read_deletion_marker(&tombstone.join("transaction.json"));
            let credential_removed = marker.is_ok_and(|marker| {
                !marker.has_credential || credentials::delete(&credential_key(&id)).is_ok()
            });
            if credential_removed {
                let _ = remove_managed_directory(&tombstone);
            } else {
                cleanup_tombstone_payload(&tombstone);
            }
        }
        Ok(())
    }

    fn load_manifest(&self) -> ProfileResult<ProfileManifest> {
        if !self.inner.paths.manifest.exists() {
            return Ok(ProfileManifest::default());
        }
        reject_symlink(&self.inner.paths.manifest)?;
        let file = File::open(&self.inner.paths.manifest)
            .map_err(|error| ProfileError::io("opening profile metadata", error))?;
        let manifest: ProfileManifest = serde_json::from_reader(file).map_err(|error| {
            ProfileError::InvalidMetadata(format!("could not parse metadata: {error}"))
        })?;
        validate_manifest(&manifest)?;
        Ok(manifest)
    }

    fn write_manifest(&self, manifest: &ProfileManifest) -> ProfileResult<()> {
        validate_manifest(manifest)?;
        if self.inner.paths.manifest.exists() {
            reject_symlink(&self.inner.paths.manifest)?;
        }
        let mut file = AtomicWriteFile::options()
            .open(&self.inner.paths.manifest)
            .map_err(|error| ProfileError::io("opening atomic profile metadata", error))?;
        serde_json::to_writer_pretty(&mut file, manifest).map_err(|error| {
            ProfileError::InvalidMetadata(format!("could not serialize metadata: {error}"))
        })?;
        file.write_all(b"\n")
            .map_err(|error| ProfileError::io("writing atomic profile metadata", error))?;
        file.commit()
            .map_err(|error| ProfileError::io("committing atomic profile metadata", error))
    }

    #[cfg(test)]
    pub(crate) fn history_count(&self, id: &str) -> usize {
        self.inner
            .paths
            .history_directory(id)
            .ok()
            .and_then(|path| fs::read_dir(path).ok())
            .map(|entries| entries.filter_map(Result::ok).count())
            .unwrap_or_default()
    }
}

struct ValidatedSubscription {
    url: Url,
    host: String,
}

struct DownloadedProfile {
    content: Vec<u8>,
    usage: SubscriptionUsage,
}

pub(crate) fn validate_yaml(content: &[u8]) -> ProfileResult<()> {
    if content.is_empty() || content.len() > MAX_PROFILE_BYTES as usize {
        return Err(ProfileError::SizeLimit);
    }
    let value: Value = serde_yaml_ng::from_slice(content)
        .map_err(|error| ProfileError::InvalidYaml(error.to_string()))?;
    if !matches!(value, Value::Mapping(_)) {
        return Err(ProfileError::InvalidYaml(
            "the document root must be a mapping".to_owned(),
        ));
    }
    Ok(())
}

fn validate_subscription_url(value: &str) -> ProfileResult<ValidatedSubscription> {
    if value.is_empty() || value.len() > credentials::MAX_SUBSCRIPTION_URL_BYTES {
        return Err(subscription_error(
            "subscription host",
            "URL length is invalid",
        ));
    }
    let url = Url::parse(value)
        .map_err(|_| subscription_error("subscription host", "URL is not valid absolute HTTPS"))?;
    if !validate_redirect_url(&url) || url.fragment().is_some() {
        return Err(subscription_error(
            url.host_str().unwrap_or("subscription host"),
            "URL must use HTTPS without user information or a fragment",
        ));
    }
    let host = url
        .host_str()
        .ok_or_else(|| subscription_error("subscription host", "URL has no host"))?
        .to_ascii_lowercase();
    Ok(ValidatedSubscription { url, host })
}

fn validate_redirect_url(url: &Url) -> bool {
    url.scheme() == "https"
        && url.host_str().is_some()
        && url.username().is_empty()
        && url.password().is_none()
}

fn validate_name(value: &str) -> ProfileResult<String> {
    let trimmed = value.trim();
    let valid = !trimmed.is_empty()
        && trimmed.chars().count() <= MAX_PROFILE_NAME_CHARS
        && !trimmed.chars().any(char::is_control);
    if valid {
        Ok(trimmed.to_owned())
    } else {
        Err(ProfileError::InvalidName(format!(
            "use 1 to {MAX_PROFILE_NAME_CHARS} visible characters"
        )))
    }
}

fn validate_user_agent(value: Option<String>) -> ProfileResult<Option<String>> {
    let Some(value) = value else {
        return Ok(None);
    };
    let trimmed = value.trim();
    let valid = !trimmed.is_empty()
        && trimmed.len() <= MAX_USER_AGENT_BYTES
        && trimmed
            .bytes()
            .all(|byte| byte.is_ascii() && (0x20..=0x7e).contains(&byte));
    if valid {
        Ok(Some(trimmed.to_owned()))
    } else {
        Err(ProfileError::Subscription {
            host: "subscription host".to_owned(),
            reason: "custom User-Agent must contain 1 to 256 printable ASCII bytes".to_owned(),
        })
    }
}

fn validate_local_path(value: &str) -> ProfileResult<PathBuf> {
    let path = Path::new(value);
    if value.is_empty()
        || value.len() > 32_768
        || !path.is_absolute()
        || path
            .components()
            .any(|component| matches!(component, Component::ParentDir | Component::CurDir))
    {
        return Err(ProfileError::InvalidPath(
            "use an absolute path without traversal components".to_owned(),
        ));
    }
    let extension_ok = path
        .extension()
        .and_then(|value| value.to_str())
        .is_some_and(|extension| {
            extension.eq_ignore_ascii_case("yaml") || extension.eq_ignore_ascii_case("yml")
        });
    if !extension_ok {
        return Err(ProfileError::InvalidPath(
            "the source must use a .yaml or .yml extension".to_owned(),
        ));
    }
    let link_metadata = fs::symlink_metadata(path)
        .map_err(|error| ProfileError::io("reading local profile metadata", error))?;
    if link_metadata.file_type().is_symlink() || !link_metadata.file_type().is_file() {
        return Err(ProfileError::InvalidPath(
            "the source must be a regular file, not a link".to_owned(),
        ));
    }
    let canonical = path
        .canonicalize()
        .map_err(|error| ProfileError::io("resolving the local profile", error))?;
    let metadata = fs::metadata(&canonical)
        .map_err(|error| ProfileError::io("reading the local profile", error))?;
    if !metadata.is_file() || metadata.len() == 0 || metadata.len() > MAX_PROFILE_BYTES {
        return Err(ProfileError::SizeLimit);
    }
    Ok(canonical)
}

fn validate_id(id: &str) -> ProfileResult<()> {
    let parsed = Uuid::parse_str(id).map_err(|_| ProfileError::InvalidId)?;
    if parsed.hyphenated().to_string() != id.to_ascii_lowercase() {
        return Err(ProfileError::InvalidId);
    }
    Ok(())
}

fn validate_manifest(manifest: &ProfileManifest) -> ProfileResult<()> {
    if manifest.schema_version != 1 {
        return Err(ProfileError::InvalidMetadata(
            "unsupported schema version".to_owned(),
        ));
    }
    let mut ids = std::collections::HashSet::new();
    for record in &manifest.profiles {
        validate_id(&record.id)?;
        validate_name(&record.name)?;
        if !ids.insert(record.id.as_str()) {
            return Err(ProfileError::InvalidMetadata(
                "duplicate profile identifier".to_owned(),
            ));
        }
        if record.revision == 0 || record.bytes == 0 || record.bytes > MAX_PROFILE_BYTES {
            return Err(ProfileError::InvalidMetadata(
                "profile size or revision is invalid".to_owned(),
            ));
        }
        match record.kind {
            ProfileKind::Local if record.local_source.is_none() => {
                return Err(ProfileError::InvalidMetadata(
                    "local profile source is missing".to_owned(),
                ));
            }
            ProfileKind::Subscription => {
                let expected = credential_key(&record.id);
                if record.credential_key.as_deref() != Some(expected.as_str()) {
                    return Err(ProfileError::InvalidMetadata(
                        "subscription credential key is invalid".to_owned(),
                    ));
                }
                validate_user_agent(record.user_agent.clone())?;
                if record.source_label.is_empty()
                    || record.source_label.contains('/')
                    || record.source_label.contains(':')
                {
                    return Err(ProfileError::InvalidMetadata(
                        "subscription source label is invalid".to_owned(),
                    ));
                }
            }
            _ => {}
        }
    }
    if let Some(active) = manifest.active_profile.as_deref() {
        validate_id(active)?;
        if !ids.contains(active) {
            return Err(ProfileError::InvalidMetadata(
                "active profile does not exist".to_owned(),
            ));
        }
    }
    Ok(())
}

fn read_file_bounded(path: &Path) -> ProfileResult<Vec<u8>> {
    let file =
        File::open(path).map_err(|error| ProfileError::io("opening a profile source", error))?;
    read_bounded(file)
}

fn read_managed_file_bounded(root: &Path, path: &Path) -> ProfileResult<Vec<u8>> {
    reject_symlink(path)?;
    let canonical_root = root
        .canonicalize()
        .map_err(|error| ProfileError::io("resolving the managed profile directory", error))?;
    let canonical = path
        .canonicalize()
        .map_err(|error| ProfileError::io("resolving the managed profile", error))?;
    if !canonical.starts_with(canonical_root) {
        return Err(ProfileError::InvalidPath(
            "managed profile escaped its storage directory".to_owned(),
        ));
    }
    read_file_bounded(&canonical)
}

fn read_bounded(file: File) -> ProfileResult<Vec<u8>> {
    let metadata = file
        .metadata()
        .map_err(|error| ProfileError::io("reading profile metadata", error))?;
    if !metadata.is_file() || metadata.len() == 0 || metadata.len() > MAX_PROFILE_BYTES {
        return Err(ProfileError::SizeLimit);
    }
    let mut content = Vec::with_capacity(metadata.len() as usize);
    file.take(MAX_PROFILE_BYTES.saturating_add(1))
        .read_to_end(&mut content)
        .map_err(|error| ProfileError::io("reading profile content", error))?;
    if content.is_empty() || content.len() > MAX_PROFILE_BYTES as usize {
        return Err(ProfileError::SizeLimit);
    }
    Ok(content)
}

fn write_bytes_atomic(path: &Path, content: &[u8]) -> ProfileResult<()> {
    if content.is_empty() || content.len() > MAX_PROFILE_BYTES as usize {
        return Err(ProfileError::SizeLimit);
    }
    if path.exists() {
        reject_symlink(path)?;
    }
    let mut file = AtomicWriteFile::options()
        .open(path)
        .map_err(|error| ProfileError::io("opening an atomic profile file", error))?;
    file.write_all(content)
        .map_err(|error| ProfileError::io("writing an atomic profile file", error))?;
    file.commit()
        .map_err(|error| ProfileError::io("committing an atomic profile file", error))
}

fn reject_symlink(path: &Path) -> ProfileResult<()> {
    let metadata = fs::symlink_metadata(path)
        .map_err(|error| ProfileError::io("reading managed file metadata", error))?;
    if metadata.file_type().is_symlink() || !metadata.file_type().is_file() {
        return Err(ProfileError::InvalidPath(
            "managed path is not a regular file".to_owned(),
        ));
    }
    Ok(())
}

fn remove_managed_file(path: &Path) -> ProfileResult<()> {
    if !path.exists() {
        return Ok(());
    }
    reject_symlink(path)?;
    fs::remove_file(path).map_err(|error| ProfileError::io("deleting profile content", error))
}

fn remove_managed_directory(path: &Path) -> ProfileResult<()> {
    if !path.exists() {
        return Ok(());
    }
    let metadata = fs::symlink_metadata(path)
        .map_err(|error| ProfileError::io("reading profile history metadata", error))?;
    if metadata.file_type().is_symlink() || !metadata.file_type().is_dir() {
        return Err(ProfileError::InvalidPath(
            "profile history path is not a regular directory".to_owned(),
        ));
    }
    fs::remove_dir_all(path).map_err(|error| ProfileError::io("deleting profile history", error))
}

fn managed_directory_exists(path: &Path) -> ProfileResult<bool> {
    match fs::symlink_metadata(path) {
        Ok(metadata) if metadata.file_type().is_dir() && !metadata.file_type().is_symlink() => {
            Ok(true)
        }
        Ok(_) => Err(ProfileError::InvalidPath(
            "managed path is not a regular directory".to_owned(),
        )),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(false),
        Err(error) => Err(ProfileError::io(
            "reading managed directory metadata",
            error,
        )),
    }
}

fn path_exists_without_following(path: &Path) -> ProfileResult<bool> {
    match fs::symlink_metadata(path) {
        Ok(_) => Ok(true),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(false),
        Err(error) => Err(ProfileError::io("reading managed path metadata", error)),
    }
}

fn read_deletion_marker(path: &Path) -> ProfileResult<DeletionMarker> {
    reject_symlink(path)?;
    let file = File::open(path)
        .map_err(|error| ProfileError::io("opening profile deletion metadata", error))?;
    serde_json::from_reader(file).map_err(|error| {
        ProfileError::InvalidMetadata(format!(
            "could not parse profile deletion metadata: {error}"
        ))
    })
}

fn cleanup_tombstone_payload(tombstone: &Path) {
    let _ = remove_managed_file(&tombstone.join("content.yaml"));
    let _ = remove_managed_directory(&tombstone.join("history"));
}

fn find_record<'a>(manifest: &'a ProfileManifest, id: &str) -> ProfileResult<&'a ProfileRecord> {
    manifest
        .profiles
        .iter()
        .find(|profile| profile.id == id)
        .ok_or(ProfileError::NotFound)
}

fn find_record_mut<'a>(
    manifest: &'a mut ProfileManifest,
    id: &str,
) -> ProfileResult<&'a mut ProfileRecord> {
    manifest
        .profiles
        .iter_mut()
        .find(|profile| profile.id == id)
        .ok_or(ProfileError::NotFound)
}

fn summaries(manifest: &ProfileManifest) -> Vec<ProfileSummary> {
    manifest
        .profiles
        .iter()
        .map(|profile| profile.summary(manifest.active_profile.as_deref()))
        .collect()
}

fn credential_key(id: &str) -> String {
    format!("Horion/Profile/{id}")
}

fn parse_subscription_userinfo(value: &str) -> SubscriptionUsage {
    let mut usage = SubscriptionUsage::default();
    for pair in value.split(';') {
        let Some((key, value)) = pair.trim().split_once('=') else {
            continue;
        };
        let Ok(value) = value.trim().parse::<u64>() else {
            continue;
        };
        match key.trim().to_ascii_lowercase().as_str() {
            "upload" => usage.upload = Some(value),
            "download" => usage.download = Some(value),
            "total" => usage.total = Some(value),
            "expire" => usage.expire = Some(value),
            _ => {}
        }
    }
    usage
}

fn retryable_status(status: StatusCode) -> bool {
    status == StatusCode::TOO_MANY_REQUESTS || status.is_server_error()
}

fn network_reason(error: &reqwest::Error) -> String {
    if error.is_timeout() {
        "request timed out".to_owned()
    } else if error.is_connect() {
        "could not connect securely".to_owned()
    } else if error.is_redirect() {
        "redirect was rejected".to_owned()
    } else if error.is_decode() {
        "response could not be read".to_owned()
    } else {
        "secure request failed".to_owned()
    }
}

fn subscription_error(host: impl Into<String>, reason: impl Into<String>) -> ProfileError {
    ProfileError::Subscription {
        host: host.into(),
        reason: reason.into(),
    }
}

fn safe_error(error: &ProfileError) -> String {
    redact_urls(&error.to_string())
}

pub(crate) fn redact_urls(value: &str) -> String {
    let mut output = value.to_owned();
    for prefix in ["https://", "http://"] {
        while let Some(start) = output.find(prefix) {
            let tail = &output[start..];
            let length = tail
                .find(|character: char| {
                    character.is_whitespace()
                        || matches!(character, '\"' | '\'' | '<' | '>' | ')' | ']' | '}')
                })
                .unwrap_or(tail.len());
            output.replace_range(start..start + length, "[REDACTED_URL]");
        }
    }
    output
}

fn timestamp() -> String {
    Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn local_record(id: &str, bytes: usize) -> ProfileRecord {
        ProfileRecord {
            id: id.to_owned(),
            name: "Test".to_owned(),
            kind: ProfileKind::Local,
            updated_at: timestamp(),
            last_checked_at: None,
            source_label: "test.yaml".to_owned(),
            status: ProfileStatus::Ready,
            last_error: None,
            bytes: bytes as u64,
            revision: 1,
            subscription: None,
            credential_key: None,
            user_agent: None,
            local_source: Some("C:\\test.yaml".to_owned()),
        }
    }

    fn install_test_profile(service: &ProfileService, record: ProfileRecord, content: &[u8]) {
        write_bytes_atomic(
            &service
                .inner
                .paths
                .content(&record.id)
                .expect("content path"),
            content,
        )
        .expect("profile content");
        service
            .write_manifest(&ProfileManifest {
                schema_version: 1,
                active_profile: None,
                profiles: vec![record],
            })
            .expect("profile manifest");
    }

    #[test]
    fn subscription_url_requires_https_without_userinfo() {
        assert!(validate_subscription_url("https://example.com/sub?token=secret").is_ok());
        assert!(validate_subscription_url("http://example.com/sub").is_err());
        assert!(validate_subscription_url("https://user:pass@example.com/sub").is_err());
        assert!(validate_subscription_url("https://example.com/sub#token").is_err());
    }

    #[test]
    fn local_path_requires_absolute_regular_yaml_without_traversal() {
        let temp = tempfile::tempdir().expect("temp directory");
        let yaml = temp.path().join("valid.yaml");
        fs::write(&yaml, "proxies: []\n").expect("write yaml");
        assert!(validate_local_path(yaml.to_str().expect("path")).is_ok());
        assert!(validate_local_path("relative.yaml").is_err());
        assert!(validate_local_path(temp.path().join("bad.txt").to_str().unwrap()).is_err());
    }

    #[test]
    fn yaml_must_be_bounded_and_have_a_mapping_root() {
        assert!(validate_yaml(b"proxies: []\nrules: []\n").is_ok());
        assert!(validate_yaml(b"- item\n").is_err());
        assert!(validate_yaml(b"").is_err());
        assert!(validate_yaml(&vec![b'a'; MAX_PROFILE_BYTES as usize + 1]).is_err());
    }

    #[test]
    fn parses_subscription_usage_and_ignores_invalid_fields() {
        let usage = parse_subscription_userinfo(
            "upload=10; download=20; total=100; expire=1893456000; invalid=nope",
        );
        assert_eq!(usage.upload, Some(10));
        assert_eq!(usage.download, Some(20));
        assert_eq!(usage.total, Some(100));
        assert_eq!(usage.expire, Some(1_893_456_000));
    }

    #[test]
    fn redaction_never_leaves_complete_urls() {
        let message = "failed https://example.com/sub?token=secret and http://127.0.0.1/x";
        let redacted = redact_urls(message);
        assert!(!redacted.contains("token=secret"));
        assert!(!redacted.contains("127.0.0.1"));
        assert_eq!(redacted.matches("[REDACTED_URL]").count(), 2);
    }

    #[test]
    fn history_pruning_keeps_the_ten_most_recent_backups() {
        let temp = tempfile::tempdir().expect("temp directory");
        let service = ProfileService::new(temp.path()).expect("profile service");
        let id = Uuid::new_v4().to_string();
        for revision in 1..=12 {
            service
                .backup_content(&id, revision, b"proxies: []\n")
                .expect("backup");
        }
        service.prune_history(&id).expect("prune");
        assert_eq!(service.history_count(&id), HISTORY_LIMIT);
    }

    #[tokio::test]
    async fn delete_removes_manifest_content_history_and_tombstone() {
        let temp = tempfile::tempdir().expect("temp directory");
        let service = ProfileService::new(temp.path()).expect("profile service");
        let id = Uuid::new_v4().to_string();
        let content = b"proxies: []\n";
        install_test_profile(&service, local_record(&id, content.len()), content);
        service
            .backup_content(&id, 1, content)
            .expect("profile backup");

        service.delete(id.clone()).await.expect("delete profile");

        assert!(service
            .load_manifest()
            .expect("manifest")
            .profiles
            .is_empty());
        assert!(!service.inner.paths.content(&id).expect("path").exists());
        assert!(!service
            .inner
            .paths
            .history_directory(&id)
            .expect("history")
            .exists());
        assert_eq!(
            fs::read_dir(&service.inner.paths.tombstones)
                .expect("tombstones")
                .count(),
            0
        );
    }

    #[tokio::test]
    async fn delete_error_leaves_manifest_content_and_invalid_history_unchanged() {
        let temp = tempfile::tempdir().expect("temp directory");
        let service = ProfileService::new(temp.path()).expect("profile service");
        let id = Uuid::new_v4().to_string();
        let content = b"proxies: []\n";
        install_test_profile(&service, local_record(&id, content.len()), content);
        let history = service.inner.paths.history_directory(&id).expect("history");
        fs::write(&history, b"not a directory").expect("invalid history fixture");

        assert!(service.delete(id.clone()).await.is_err());

        assert_eq!(
            service.load_manifest().expect("manifest").profiles[0].id,
            id
        );
        assert_eq!(service.read_content(&id).expect("content"), content);
        assert_eq!(
            fs::read(&history).expect("history fixture"),
            b"not a directory"
        );
        assert_eq!(
            fs::read_dir(&service.inner.paths.tombstones)
                .expect("tombstones")
                .count(),
            0
        );
    }

    #[test]
    fn startup_recovers_a_precommit_delete_tombstone() {
        let temp = tempfile::tempdir().expect("temp directory");
        let id = Uuid::new_v4().to_string();
        let content = b"proxies: []\n";
        {
            let service = ProfileService::new(temp.path()).expect("profile service");
            install_test_profile(&service, local_record(&id, content.len()), content);
            service
                .backup_content(&id, 1, content)
                .expect("profile backup");
            let path = service.inner.paths.content(&id).expect("content path");
            let history = service.inner.paths.history_directory(&id).expect("history");
            service
                .stage_profile_deletion(&id, &path, &history, false)
                .expect("stage deletion");
            assert!(!path.exists());
            assert!(!history.exists());
        }

        let recovered = ProfileService::new(temp.path()).expect("recover service");
        assert_eq!(recovered.read_content(&id).expect("content"), content);
        assert_eq!(recovered.history_count(&id), 1);
        assert_eq!(
            fs::read_dir(&recovered.inner.paths.tombstones)
                .expect("tombstones")
                .count(),
            0
        );
    }

    #[test]
    fn startup_finishes_a_committed_delete_tombstone() {
        let temp = tempfile::tempdir().expect("temp directory");
        let id = Uuid::new_v4().to_string();
        let content = b"proxies: []\n";
        {
            let service = ProfileService::new(temp.path()).expect("profile service");
            install_test_profile(&service, local_record(&id, content.len()), content);
            service
                .backup_content(&id, 1, content)
                .expect("profile backup");
            let path = service.inner.paths.content(&id).expect("content path");
            let history = service.inner.paths.history_directory(&id).expect("history");
            service
                .stage_profile_deletion(&id, &path, &history, false)
                .expect("stage deletion");
            service
                .write_manifest(&ProfileManifest::default())
                .expect("commit deletion");
        }

        let recovered = ProfileService::new(temp.path()).expect("recover service");
        assert!(recovered
            .load_manifest()
            .expect("manifest")
            .profiles
            .is_empty());
        assert!(!recovered.inner.paths.content(&id).expect("path").exists());
        assert!(!recovered
            .inner
            .paths
            .history_directory(&id)
            .expect("history")
            .exists());
        assert_eq!(
            fs::read_dir(&recovered.inner.paths.tombstones)
                .expect("tombstones")
                .count(),
            0
        );
    }

    #[test]
    fn deletion_marker_cannot_name_a_credential_target() {
        let temp = tempfile::tempdir().expect("temp directory");
        let marker = temp.path().join("transaction.json");
        fs::write(
            &marker,
            br#"{"has_credential":false,"credential_key":"arbitrary-target"}"#,
        )
        .expect("marker");
        assert!(read_deletion_marker(&marker).is_err());
    }

    #[test]
    fn summary_status_is_snake_case_and_active_metadata_is_secret_free() {
        let temp = tempfile::tempdir().expect("temp directory");
        let service = ProfileService::new(temp.path()).expect("profile service");
        let id = Uuid::new_v4().to_string();
        let content = br#"
proxies:
  - name: edge
    type: ss
    server: node.example.com
    port: 443
    password: should-never-be-returned
"#;
        write_bytes_atomic(
            &service.inner.paths.content(&id).expect("content path"),
            content,
        )
        .expect("profile content");
        let record = ProfileRecord {
            id: id.clone(),
            name: "Test".to_owned(),
            kind: ProfileKind::Local,
            updated_at: timestamp(),
            last_checked_at: None,
            source_label: "test.yaml".to_owned(),
            status: ProfileStatus::Error,
            last_error: Some("test".to_owned()),
            bytes: content.len() as u64,
            revision: 1,
            subscription: None,
            credential_key: None,
            user_agent: None,
            local_source: Some(temp.path().join("test.yaml").to_string_lossy().into_owned()),
        };
        service
            .write_manifest(&ProfileManifest {
                schema_version: 1,
                active_profile: Some(id),
                profiles: vec![record.clone()],
            })
            .expect("manifest");
        let summary = serde_json::to_value(record.summary(Some(&record.id))).expect("summary");
        assert_eq!(summary["status"], "error");
        assert_eq!(summary["kind"], "local");
        assert_eq!(summary["active"], true);

        let metadata = service
            .active_proxy_metadata_unlocked()
            .expect("safe proxy metadata");
        assert_eq!(metadata.len(), 1);
        assert_eq!(metadata[0].server, "node.example.com");
        assert_eq!(metadata[0].port, Some(443));
        assert!(!format!("{metadata:?}").contains("should-never-be-returned"));
    }
}
