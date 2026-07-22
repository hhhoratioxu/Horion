mod credentials;
mod error;
mod model;
mod service;

pub use error::ProfileCommandError;
pub use model::{ProfileActivation, ProfileContent, ProfileSummary};
pub(crate) use service::redact_urls;
pub(crate) use service::ActiveProxyMetadata;
pub use service::ProfileService;

use crate::core::CoreService;

#[tauri::command]
pub async fn profile_list(
    service: tauri::State<'_, ProfileService>,
) -> Result<Vec<ProfileSummary>, ProfileCommandError> {
    service.list().await.map_err(Into::into)
}

#[tauri::command]
pub async fn profile_import_local(
    name: String,
    path: String,
    service: tauri::State<'_, ProfileService>,
    core: tauri::State<'_, CoreService>,
) -> Result<ProfileSummary, ProfileCommandError> {
    service
        .import_local(&core, name, path)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn profile_add_subscription(
    name: String,
    url: String,
    user_agent: Option<String>,
    service: tauri::State<'_, ProfileService>,
    core: tauri::State<'_, CoreService>,
) -> Result<ProfileSummary, ProfileCommandError> {
    service
        .add_subscription(&core, name, url, user_agent)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn profile_update(
    id: String,
    service: tauri::State<'_, ProfileService>,
    core: tauri::State<'_, CoreService>,
) -> Result<ProfileSummary, ProfileCommandError> {
    service.update(&core, id).await.map_err(Into::into)
}

#[tauri::command]
pub async fn profile_update_all(
    service: tauri::State<'_, ProfileService>,
    core: tauri::State<'_, CoreService>,
) -> Result<Vec<ProfileSummary>, ProfileCommandError> {
    service.update_all(&core).await.map_err(Into::into)
}

#[tauri::command]
pub async fn profile_rename(
    id: String,
    name: String,
    service: tauri::State<'_, ProfileService>,
) -> Result<ProfileSummary, ProfileCommandError> {
    service.rename(id, name).await.map_err(Into::into)
}

#[tauri::command]
pub async fn profile_duplicate(
    id: String,
    name: String,
    service: tauri::State<'_, ProfileService>,
) -> Result<ProfileSummary, ProfileCommandError> {
    service.duplicate(id, name).await.map_err(Into::into)
}

#[tauri::command]
pub async fn profile_delete(
    id: String,
    service: tauri::State<'_, ProfileService>,
) -> Result<(), ProfileCommandError> {
    service.delete(id).await.map_err(Into::into)
}

#[tauri::command]
pub async fn profile_get_content(
    id: String,
    service: tauri::State<'_, ProfileService>,
) -> Result<ProfileContent, ProfileCommandError> {
    service.get_content(id).await.map_err(Into::into)
}

#[tauri::command]
pub async fn profile_save_content(
    id: String,
    content: String,
    expected_revision: u64,
    service: tauri::State<'_, ProfileService>,
    core: tauri::State<'_, CoreService>,
) -> Result<ProfileSummary, ProfileCommandError> {
    service
        .save_content(&core, id, content, expected_revision)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn profile_activate(
    id: String,
    service: tauri::State<'_, ProfileService>,
    core: tauri::State<'_, CoreService>,
) -> Result<ProfileActivation, ProfileCommandError> {
    service.activate(&core, id).await.map_err(Into::into)
}
