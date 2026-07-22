use serde::{Deserialize, Serialize};

use super::error::ControllerError;

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum ProxyMode {
    Rule,
    Global,
    Direct,
}

impl ProxyMode {
    pub(crate) fn as_str(self) -> &'static str {
        match self {
            Self::Rule => "rule",
            Self::Global => "global",
            Self::Direct => "direct",
        }
    }

    pub(crate) fn from_controller(value: &str) -> Result<Self, ControllerError> {
        match value.to_ascii_lowercase().as_str() {
            "rule" => Ok(Self::Rule),
            "global" => Ok(Self::Global),
            "direct" => Ok(Self::Direct),
            _ => Err(ControllerError::InvalidMode),
        }
    }
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct ProxyGroup {
    pub name: String,
    #[serde(rename = "type")]
    pub proxy_type: String,
    pub now: String,
    pub all: Vec<String>,
    pub alive: bool,
    pub delay: Option<u32>,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct ProxyNode {
    pub name: String,
    #[serde(rename = "type")]
    pub proxy_type: String,
    pub server: Option<String>,
    pub port: Option<u16>,
    pub groups: Vec<String>,
    pub alive: bool,
    pub delay: Option<u32>,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct ProxyOverview {
    pub mode: ProxyMode,
    pub groups: Vec<ProxyGroup>,
    pub nodes: Vec<ProxyNode>,
    pub updated_at: String,
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct ProxyDelayResult {
    pub delay: u32,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub(crate) struct ProxyMetadata {
    pub name: String,
    pub proxy_type: String,
    pub server: String,
    pub port: Option<u16>,
}
