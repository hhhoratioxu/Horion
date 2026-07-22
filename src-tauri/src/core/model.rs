use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum CoreLifecycle {
    NotInstalled,
    Stopped,
    Downloading,
    Installing,
    Starting,
    Running,
    Stopping,
    Crashed,
    Error,
}

impl CoreLifecycle {
    pub(crate) fn can_transition_to(self, next: Self) -> bool {
        if self == next {
            return true;
        }

        matches!(
            (self, next),
            (
                Self::NotInstalled,
                Self::Downloading | Self::Installing | Self::Error
            ) | (
                Self::Stopped,
                Self::Downloading | Self::Installing | Self::Starting | Self::Error
            ) | (
                Self::Downloading,
                Self::Installing | Self::NotInstalled | Self::Stopped | Self::Error
            ) | (
                Self::Installing,
                Self::NotInstalled | Self::Stopped | Self::Error
            ) | (
                Self::Starting,
                Self::Stopped | Self::Running | Self::Stopping | Self::Crashed | Self::Error
            ) | (Self::Running, Self::Stopping | Self::Crashed | Self::Error)
                | (Self::Stopping, Self::Stopped | Self::Crashed | Self::Error)
                | (
                    Self::Crashed,
                    Self::Stopped
                        | Self::Starting
                        | Self::Downloading
                        | Self::Installing
                        | Self::Error
                )
                | (
                    Self::Error,
                    Self::NotInstalled
                        | Self::Stopped
                        | Self::Downloading
                        | Self::Installing
                        | Self::Starting
                        | Self::Stopping
                        | Self::Crashed
                )
        )
    }
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct CoreSnapshot {
    pub state: CoreLifecycle,
    pub installed: bool,
    pub version: Option<String>,
    pub source: Option<String>,
    pub path: Option<String>,
    pub pid: Option<u32>,
    pub healthy: bool,
    pub controller_available: bool,
    pub last_error: Option<String>,
}

impl CoreSnapshot {
    pub(crate) fn not_installed() -> Self {
        Self {
            state: CoreLifecycle::NotInstalled,
            installed: false,
            version: None,
            source: None,
            path: None,
            pid: None,
            healthy: false,
            controller_available: false,
            last_error: None,
        }
    }
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct CoreLogEntry {
    pub timestamp: String,
    pub level: String,
    pub stream: String,
    pub message: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub(crate) struct CoreManifest {
    pub schema_version: u32,
    pub version: String,
    pub source: String,
    pub executable: String,
    pub sha256: String,
    pub installed_at: String,
}

#[cfg(test)]
mod tests {
    use super::CoreLifecycle;

    #[test]
    fn lifecycle_accepts_expected_runtime_transitions() {
        assert!(CoreLifecycle::Stopped.can_transition_to(CoreLifecycle::Starting));
        assert!(CoreLifecycle::Starting.can_transition_to(CoreLifecycle::Running));
        assert!(CoreLifecycle::Running.can_transition_to(CoreLifecycle::Stopping));
        assert!(CoreLifecycle::Stopping.can_transition_to(CoreLifecycle::Stopped));
        assert!(CoreLifecycle::Running.can_transition_to(CoreLifecycle::Crashed));
        assert!(CoreLifecycle::Error.can_transition_to(CoreLifecycle::Stopping));
        assert!(CoreLifecycle::Error.can_transition_to(CoreLifecycle::Crashed));
    }

    #[test]
    fn lifecycle_rejects_impossible_transitions() {
        assert!(!CoreLifecycle::NotInstalled.can_transition_to(CoreLifecycle::Running));
        assert!(!CoreLifecycle::Running.can_transition_to(CoreLifecycle::Installing));
        assert!(!CoreLifecycle::Stopped.can_transition_to(CoreLifecycle::Running));
    }
}
