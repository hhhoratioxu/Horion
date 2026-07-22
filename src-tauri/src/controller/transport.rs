use std::{future::Future, pin::Pin, time::Duration};

use serde_json::Value;

use super::{error::ControllerResult, model::ProxyMetadata};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) enum ControllerMethod {
    Get,
    Put,
    Patch,
}

#[derive(Clone, Debug, PartialEq)]
pub(crate) struct ControllerRequest {
    pub method: ControllerMethod,
    /// Individual unescaped URL path segments. The transport must append each
    /// segment with a URL API rather than concatenate it into a path string.
    pub path_segments: Vec<String>,
    pub query: Vec<(String, String)>,
    pub json_body: Option<Value>,
    pub timeout: Duration,
    pub response_limit: usize,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub(crate) struct ControllerResponse {
    pub status: u16,
    pub body: Vec<u8>,
}

pub(crate) type ControllerFuture<'a> =
    Pin<Box<dyn Future<Output = ControllerResult<ControllerResponse>> + Send + 'a>>;

pub(crate) trait ControllerTransport: Sync {
    fn send(&self, request: ControllerRequest) -> ControllerFuture<'_>;

    fn active_proxy_metadata(&self) -> ControllerResult<Vec<ProxyMetadata>>;
}
