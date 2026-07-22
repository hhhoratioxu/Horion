use serde::Serialize;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum ProfileError {
    #[error("profile name is invalid: {0}")]
    InvalidName(String),
    #[error("profile identifier is invalid")]
    InvalidId,
    #[error("profile was not found")]
    NotFound,
    #[error("profile source path is invalid: {0}")]
    InvalidPath(String),
    #[error("profile content must be non-empty and no larger than 8 MiB")]
    SizeLimit,
    #[error("profile YAML is invalid: {0}")]
    InvalidYaml(String),
    #[error("Mihomo rejected the profile: {0}")]
    Validation(String),
    #[error("subscription operation failed for {host}: {reason}")]
    Subscription { host: String, reason: String },
    #[error("Windows Credential Manager operation failed")]
    Credential,
    #[error("the profile changed since it was opened")]
    RevisionConflict,
    #[error("the active profile cannot be deleted")]
    ActiveProfile,
    #[error("operation is unsupported on this platform: {0}")]
    #[cfg_attr(windows, allow(dead_code))]
    Unsupported(&'static str),
    #[error("profile storage operation failed while {action}: {source}")]
    Io {
        action: &'static str,
        #[source]
        source: std::io::Error,
    },
    #[error("profile metadata is invalid: {0}")]
    InvalidMetadata(String),
}

impl ProfileError {
    pub(crate) fn io(action: &'static str, source: std::io::Error) -> Self {
        Self::Io { action, source }
    }

    fn code(&self) -> &'static str {
        match self {
            Self::InvalidName(_) => "profile_name_invalid",
            Self::InvalidId => "profile_id_invalid",
            Self::NotFound => "profile_not_found",
            Self::InvalidPath(_) => "profile_path_invalid",
            Self::SizeLimit => "profile_size_invalid",
            Self::InvalidYaml(_) => "profile_yaml_invalid",
            Self::Validation(_) => "profile_validation_failed",
            Self::Subscription { .. } => "subscription_failed",
            Self::Credential => "credential_manager_failed",
            Self::RevisionConflict => "profile_revision_conflict",
            Self::ActiveProfile => "profile_is_active",
            Self::Unsupported(_) => "unsupported_platform",
            Self::Io { .. } => "profile_filesystem_error",
            Self::InvalidMetadata(_) => "profile_metadata_invalid",
        }
    }

    fn retryable(&self) -> bool {
        matches!(self, Self::Subscription { .. } | Self::Io { .. })
    }
}

#[derive(Clone, Debug, Serialize)]
pub struct ProfileCommandError {
    pub code: String,
    pub message: String,
    pub retryable: bool,
}

impl From<ProfileError> for ProfileCommandError {
    fn from(error: ProfileError) -> Self {
        Self {
            code: error.code().to_owned(),
            message: super::service::redact_urls(&error.to_string()),
            retryable: error.retryable(),
        }
    }
}

pub(crate) type ProfileResult<T> = Result<T, ProfileError>;
