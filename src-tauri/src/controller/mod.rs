mod error;
mod model;
mod service;
mod transport;

pub use error::ControllerCommandError;
pub(crate) use error::{ControllerError, ControllerResult};
pub(crate) use model::ProxyMetadata;
pub use model::{ProxyDelayResult, ProxyMode, ProxyOverview};
pub(crate) use transport::{
    ControllerFuture, ControllerMethod, ControllerRequest, ControllerResponse, ControllerTransport,
};

use crate::core::CoreService;

#[tauri::command]
pub async fn proxy_get_overview(
    service: tauri::State<'_, CoreService>,
) -> Result<ProxyOverview, ControllerCommandError> {
    service::get_overview(service.inner())
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn proxy_select(
    group: String,
    name: String,
    service: tauri::State<'_, CoreService>,
) -> Result<(), ControllerCommandError> {
    service::select_proxy(service.inner(), group, name)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn proxy_test_delay(
    name: String,
    timeout_ms: u64,
    service: tauri::State<'_, CoreService>,
) -> Result<ProxyDelayResult, ControllerCommandError> {
    service::test_delay(service.inner(), name, timeout_ms)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn proxy_set_mode(
    mode: ProxyMode,
    service: tauri::State<'_, CoreService>,
) -> Result<(), ControllerCommandError> {
    service::set_mode(service.inner(), mode)
        .await
        .map_err(Into::into)
}
