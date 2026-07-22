use serde::Serialize;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum CoreError {
    #[error("the Mihomo core is not installed")]
    NotInstalled,
    #[error("the Mihomo core is already running")]
    AlreadyRunning,
    #[error("the Mihomo core is busy: {0}")]
    Busy(&'static str),
    #[error("unsupported platform: {0}")]
    UnsupportedPlatform(String),
    #[error("download failed: {0}")]
    Download(String),
    #[error("downloaded core failed integrity validation: {0}")]
    Integrity(String),
    #[error("unsafe or invalid archive: {0}")]
    Archive(String),
    #[error("invalid Mihomo executable: {0}")]
    InvalidExecutable(String),
    #[error("invalid core installation manifest: {0}")]
    InvalidManifest(String),
    #[error("core process failed: {0}")]
    Process(String),
    #[error("Mihomo Controller did not become healthy before the deadline")]
    HealthTimeout,
    #[error("invalid lifecycle transition: {0}")]
    InvalidTransition(String),
    #[error("filesystem operation failed while {action}: {source}")]
    Io {
        action: &'static str,
        #[source]
        source: std::io::Error,
    },
    #[error("internal synchronization failure")]
    Synchronization,
}

impl CoreError {
    pub(crate) fn io(action: &'static str, source: std::io::Error) -> Self {
        Self::Io { action, source }
    }

    fn code(&self) -> &'static str {
        match self {
            Self::NotInstalled => "core_not_installed",
            Self::AlreadyRunning => "core_already_running",
            Self::Busy(_) => "core_busy",
            Self::UnsupportedPlatform(_) => "unsupported_platform",
            Self::Download(_) => "download_failed",
            Self::Integrity(_) => "integrity_failed",
            Self::Archive(_) => "archive_invalid",
            Self::InvalidExecutable(_) => "executable_invalid",
            Self::InvalidManifest(_) => "manifest_invalid",
            Self::Process(_) => "process_failed",
            Self::HealthTimeout => "health_timeout",
            Self::InvalidTransition(_) => "state_transition_invalid",
            Self::Io { .. } => "filesystem_error",
            Self::Synchronization => "synchronization_error",
        }
    }

    fn retryable(&self) -> bool {
        matches!(
            self,
            Self::Download(_) | Self::Process(_) | Self::HealthTimeout | Self::Io { .. }
        )
    }
}

#[derive(Clone, Debug, Serialize)]
pub struct CommandError {
    pub code: String,
    pub message: String,
    pub retryable: bool,
}

impl From<CoreError> for CommandError {
    fn from(error: CoreError) -> Self {
        Self {
            code: error.code().to_owned(),
            message: error.to_string(),
            retryable: error.retryable(),
        }
    }
}

pub(crate) type CoreResult<T> = Result<T, CoreError>;
