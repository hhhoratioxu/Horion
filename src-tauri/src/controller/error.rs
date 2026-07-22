use serde::Serialize;
use thiserror::Error;

#[derive(Debug, Error)]
pub(crate) enum ControllerError {
    #[error("Mihomo Controller is unavailable; start the core and try again")]
    Unavailable,
    #[error("the proxy or group name is invalid")]
    InvalidName,
    #[error("the requested proxy mode is unsupported")]
    InvalidMode,
    #[error("the proxy or group was not found in the current Mihomo configuration")]
    NotFound,
    #[error("the requested proxy selection is not valid for this group")]
    InvalidSelection,
    #[error("Mihomo Controller returned an invalid {0} response")]
    InvalidResponse(&'static str),
    #[error("Mihomo Controller rejected {operation} with HTTP status {status}")]
    Api {
        operation: &'static str,
        status: u16,
    },
    #[error("Mihomo Controller response exceeded the allowed size")]
    ResponseTooLarge,
    #[error("Mihomo Controller request failed")]
    Transport,
}

impl ControllerError {
    fn code(&self) -> &'static str {
        match self {
            Self::Unavailable => "controller_unavailable",
            Self::InvalidName => "proxy_name_invalid",
            Self::InvalidMode => "proxy_mode_invalid",
            Self::NotFound => "proxy_not_found",
            Self::InvalidSelection => "proxy_selection_invalid",
            Self::InvalidResponse(_) => "controller_response_invalid",
            Self::Api { .. } => "controller_request_rejected",
            Self::ResponseTooLarge => "controller_response_too_large",
            Self::Transport => "controller_request_failed",
        }
    }

    fn retryable(&self) -> bool {
        matches!(
            self,
            Self::Unavailable
                | Self::Api {
                    status: 429 | 500..=599,
                    ..
                }
                | Self::Transport
        )
    }
}

#[derive(Clone, Debug, Serialize)]
pub struct ControllerCommandError {
    pub code: String,
    pub message: String,
    pub retryable: bool,
}

impl From<ControllerError> for ControllerCommandError {
    fn from(error: ControllerError) -> Self {
        Self {
            code: error.code().to_owned(),
            message: error.to_string(),
            retryable: error.retryable(),
        }
    }
}

pub(crate) type ControllerResult<T> = Result<T, ControllerError>;
