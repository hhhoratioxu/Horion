mod error;
mod install;
mod manager;
mod model;
mod paths;

pub use error::CommandError;
pub use manager::CoreService;
pub use model::{CoreLogEntry, CoreSnapshot};

#[tauri::command]
pub async fn core_get_status(
    service: tauri::State<'_, CoreService>,
) -> Result<CoreSnapshot, CommandError> {
    service.status().await.map_err(Into::into)
}

#[tauri::command]
pub async fn core_install_official(
    service: tauri::State<'_, CoreService>,
) -> Result<CoreSnapshot, CommandError> {
    service.install_official().await.map_err(Into::into)
}

#[tauri::command]
pub async fn core_import_from_path(
    path: String,
    service: tauri::State<'_, CoreService>,
) -> Result<CoreSnapshot, CommandError> {
    service.import_from_path(path).await.map_err(Into::into)
}

#[tauri::command]
pub async fn core_start(
    service: tauri::State<'_, CoreService>,
) -> Result<CoreSnapshot, CommandError> {
    service.start().await.map_err(Into::into)
}

#[tauri::command]
pub async fn core_stop(
    service: tauri::State<'_, CoreService>,
) -> Result<CoreSnapshot, CommandError> {
    service.stop().await.map_err(Into::into)
}

#[tauri::command]
pub async fn core_restart(
    service: tauri::State<'_, CoreService>,
) -> Result<CoreSnapshot, CommandError> {
    service.restart().await.map_err(Into::into)
}

#[tauri::command]
pub fn core_get_logs(
    service: tauri::State<'_, CoreService>,
) -> Result<Vec<CoreLogEntry>, CommandError> {
    service.logs().map_err(Into::into)
}
