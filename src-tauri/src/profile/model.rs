use serde::{Deserialize, Serialize};

use crate::core::CoreSnapshot;

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ProfileKind {
    Local,
    Subscription,
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ProfileStatus {
    Ready,
    Updating,
    Error,
}

#[derive(Clone, Debug, Default, Deserialize, Eq, PartialEq, Serialize)]
pub struct SubscriptionUsage {
    pub upload: Option<u64>,
    pub download: Option<u64>,
    pub total: Option<u64>,
    pub expire: Option<u64>,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct ProfileSummary {
    pub id: String,
    pub name: String,
    pub kind: ProfileKind,
    pub active: bool,
    pub updated_at: String,
    pub last_checked_at: Option<String>,
    pub source_label: String,
    pub status: ProfileStatus,
    pub last_error: Option<String>,
    pub bytes: u64,
    pub revision: u64,
    pub subscription: Option<SubscriptionUsage>,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct ProfileContent {
    pub id: String,
    pub content: String,
    pub revision: u64,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct ProfileActivation {
    pub profile: ProfileSummary,
    pub core: CoreSnapshot,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub(crate) struct ProfileRecord {
    pub id: String,
    pub name: String,
    pub kind: ProfileKind,
    pub updated_at: String,
    pub last_checked_at: Option<String>,
    pub source_label: String,
    pub status: ProfileStatus,
    pub last_error: Option<String>,
    pub bytes: u64,
    pub revision: u64,
    pub subscription: Option<SubscriptionUsage>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) credential_key: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) user_agent: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) local_source: Option<String>,
}

impl ProfileRecord {
    pub(crate) fn summary(&self, active_profile: Option<&str>) -> ProfileSummary {
        ProfileSummary {
            id: self.id.clone(),
            name: self.name.clone(),
            kind: self.kind,
            active: active_profile == Some(self.id.as_str()),
            updated_at: self.updated_at.clone(),
            last_checked_at: self.last_checked_at.clone(),
            source_label: self.source_label.clone(),
            status: self.status,
            last_error: self.last_error.clone(),
            bytes: self.bytes,
            revision: self.revision,
            subscription: self.subscription.clone(),
        }
    }
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub(crate) struct ProfileManifest {
    pub schema_version: u32,
    pub active_profile: Option<String>,
    pub profiles: Vec<ProfileRecord>,
}

impl Default for ProfileManifest {
    fn default() -> Self {
        Self {
            schema_version: 1,
            active_profile: None,
            profiles: Vec::new(),
        }
    }
}
