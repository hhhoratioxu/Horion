use std::{collections::BTreeMap, time::Duration};

use chrono::{SecondsFormat, Utc};
use serde::Deserialize;
use serde_json::json;

use super::{
    error::{ControllerError, ControllerResult},
    model::{ProxyDelayResult, ProxyGroup, ProxyMetadata, ProxyMode, ProxyNode, ProxyOverview},
    transport::{ControllerMethod, ControllerRequest, ControllerResponse, ControllerTransport},
};

const CONFIG_RESPONSE_LIMIT: usize = 1024 * 1024;
const PROXIES_RESPONSE_LIMIT: usize = 8 * 1024 * 1024;
const SMALL_RESPONSE_LIMIT: usize = 64 * 1024;
const STANDARD_TIMEOUT: Duration = Duration::from_secs(5);
const DELAY_URL: &str = "https://www.gstatic.com/generate_204";
const MIN_DELAY_TIMEOUT_MS: u64 = 1_000;
const MAX_DELAY_TIMEOUT_MS: u64 = 30_000;
const DELAY_TRANSPORT_GRACE_MS: u64 = 2_000;
const MAX_PROXY_NAME_BYTES: usize = 512;

#[derive(Debug, Deserialize)]
struct RawConfigs {
    mode: String,
}

#[derive(Debug, Deserialize)]
struct RawProxies {
    proxies: BTreeMap<String, RawProxy>,
}

#[derive(Clone, Debug, Deserialize)]
struct RawProxy {
    #[serde(default, rename = "type")]
    proxy_type: Option<String>,
    #[serde(default)]
    now: Option<String>,
    #[serde(default)]
    all: Option<Vec<String>>,
    #[serde(default)]
    alive: Option<bool>,
    #[serde(default)]
    history: Option<Vec<RawHistory>>,
}

#[derive(Clone, Debug, Deserialize)]
struct RawHistory {
    #[serde(default)]
    delay: Option<u64>,
}

#[derive(Debug, Deserialize)]
struct RawDelay {
    delay: u64,
}

struct ControllerSnapshot {
    overview: ProxyOverview,
    raw_proxies: BTreeMap<String, RawProxy>,
}

pub(crate) async fn get_overview<T>(transport: &T) -> ControllerResult<ProxyOverview>
where
    T: ControllerTransport + ?Sized,
{
    Ok(fetch_snapshot(transport).await?.overview)
}

pub(crate) async fn select_proxy<T>(
    transport: &T,
    group: String,
    name: String,
) -> ControllerResult<()>
where
    T: ControllerTransport + ?Sized,
{
    validate_proxy_name(&group)?;
    validate_proxy_name(&name)?;

    // Always validate against a fresh Controller snapshot. Besides preventing
    // stale UI actions, this keeps arbitrary user input away from mutation
    // endpoints unless both objects exist in Mihomo's current configuration.
    let snapshot = fetch_snapshot(transport).await?;
    let selected_group = snapshot
        .raw_proxies
        .get(&group)
        .ok_or(ControllerError::NotFound)?;
    let members = selected_group
        .all
        .as_ref()
        .ok_or(ControllerError::InvalidSelection)?;
    if !members.iter().any(|member| member == &name) {
        return Err(ControllerError::InvalidSelection);
    }
    if !snapshot.raw_proxies.contains_key(&name) {
        return Err(ControllerError::NotFound);
    }

    let response = transport
        .send(ControllerRequest {
            method: ControllerMethod::Put,
            path_segments: vec!["proxies".to_owned(), group],
            query: Vec::new(),
            json_body: Some(json!({ "name": name })),
            timeout: STANDARD_TIMEOUT,
            response_limit: SMALL_RESPONSE_LIMIT,
        })
        .await?;
    expect_no_content(response, "proxy selection")
}

pub(crate) async fn test_delay<T>(
    transport: &T,
    name: String,
    timeout_ms: u64,
) -> ControllerResult<ProxyDelayResult>
where
    T: ControllerTransport + ?Sized,
{
    validate_proxy_name(&name)?;
    let snapshot = fetch_snapshot(transport).await?;
    let proxy = snapshot
        .raw_proxies
        .get(&name)
        .ok_or(ControllerError::NotFound)?;
    if proxy.all.is_some() || is_builtin_type(proxy.proxy_type.as_deref()) {
        return Err(ControllerError::NotFound);
    }

    let timeout_ms = timeout_ms.clamp(MIN_DELAY_TIMEOUT_MS, MAX_DELAY_TIMEOUT_MS);
    let response = transport
        .send(ControllerRequest {
            method: ControllerMethod::Get,
            path_segments: vec!["proxies".to_owned(), name, "delay".to_owned()],
            query: vec![
                ("url".to_owned(), DELAY_URL.to_owned()),
                ("timeout".to_owned(), timeout_ms.to_string()),
                ("expected".to_owned(), "204".to_owned()),
            ],
            json_body: None,
            timeout: Duration::from_millis(timeout_ms + DELAY_TRANSPORT_GRACE_MS),
            response_limit: SMALL_RESPONSE_LIMIT,
        })
        .await?;
    let body = expect_json::<RawDelay>(response, "delay")?;
    let delay = u32::try_from(body.delay)
        .ok()
        .filter(|delay| *delay > 0)
        .ok_or(ControllerError::InvalidResponse("delay"))?;
    Ok(ProxyDelayResult { delay })
}

pub(crate) async fn set_mode<T>(transport: &T, mode: ProxyMode) -> ControllerResult<()>
where
    T: ControllerTransport + ?Sized,
{
    let response = transport
        .send(ControllerRequest {
            method: ControllerMethod::Patch,
            path_segments: vec!["configs".to_owned()],
            query: Vec::new(),
            json_body: Some(json!({ "mode": mode.as_str() })),
            timeout: STANDARD_TIMEOUT,
            response_limit: SMALL_RESPONSE_LIMIT,
        })
        .await?;
    expect_no_content(response, "mode change")
}

async fn fetch_snapshot<T>(transport: &T) -> ControllerResult<ControllerSnapshot>
where
    T: ControllerTransport + ?Sized,
{
    let config_response = transport
        .send(ControllerRequest {
            method: ControllerMethod::Get,
            path_segments: vec!["configs".to_owned()],
            query: Vec::new(),
            json_body: None,
            timeout: STANDARD_TIMEOUT,
            response_limit: CONFIG_RESPONSE_LIMIT,
        })
        .await?;
    let configs = expect_json::<RawConfigs>(config_response, "configuration")?;
    let mode = ProxyMode::from_controller(&configs.mode)
        .map_err(|_| ControllerError::InvalidResponse("configuration"))?;

    let proxies_response = transport
        .send(ControllerRequest {
            method: ControllerMethod::Get,
            path_segments: vec!["proxies".to_owned()],
            query: Vec::new(),
            json_body: None,
            timeout: STANDARD_TIMEOUT,
            response_limit: PROXIES_RESPONSE_LIMIT,
        })
        .await?;
    let raw = expect_json::<RawProxies>(proxies_response, "proxies")?;
    let metadata = transport.active_proxy_metadata()?;
    let overview = build_overview(mode, &raw.proxies, metadata);
    Ok(ControllerSnapshot {
        overview,
        raw_proxies: raw.proxies,
    })
}

fn build_overview(
    mode: ProxyMode,
    proxies: &BTreeMap<String, RawProxy>,
    metadata: Vec<ProxyMetadata>,
) -> ProxyOverview {
    let metadata = metadata
        .into_iter()
        .map(|proxy| (proxy.name.clone(), proxy))
        .collect::<BTreeMap<_, _>>();

    let groups = proxies
        .iter()
        .filter_map(|(name, proxy)| {
            let all = proxy.all.clone()?;
            Some(ProxyGroup {
                name: name.clone(),
                proxy_type: proxy_type(proxy),
                now: proxy.now.clone().unwrap_or_default(),
                all,
                alive: proxy.alive.unwrap_or(false),
                delay: latest_delay(proxy),
            })
        })
        .collect::<Vec<_>>();

    let nodes = proxies
        .iter()
        .filter(|(_, proxy)| proxy.all.is_none() && !is_builtin_type(proxy.proxy_type.as_deref()))
        .map(|(name, proxy)| {
            let profile = metadata.get(name);
            let groups = groups
                .iter()
                .filter(|group| group.all.iter().any(|member| member == name))
                .map(|group| group.name.clone())
                .collect();
            ProxyNode {
                name: name.clone(),
                proxy_type: profile
                    .map(|value| value.proxy_type.clone())
                    .filter(|value| !value.is_empty())
                    .unwrap_or_else(|| proxy_type(proxy)),
                server: profile
                    .map(|value| value.server.clone())
                    .filter(|value| !value.is_empty()),
                port: profile.and_then(|value| value.port),
                groups,
                alive: proxy.alive.unwrap_or(false),
                delay: latest_delay(proxy),
            }
        })
        .collect();

    ProxyOverview {
        mode,
        groups,
        nodes,
        updated_at: Utc::now().to_rfc3339_opts(SecondsFormat::Secs, true),
    }
}

fn latest_delay(proxy: &RawProxy) -> Option<u32> {
    proxy
        .history
        .as_ref()?
        .iter()
        .rev()
        .find_map(|entry| u32::try_from(entry.delay?).ok().filter(|delay| *delay > 0))
}

fn proxy_type(proxy: &RawProxy) -> String {
    proxy
        .proxy_type
        .clone()
        .filter(|proxy_type| !proxy_type.is_empty())
        .unwrap_or_else(|| "Unknown".to_owned())
}

fn is_builtin_type(proxy_type: Option<&str>) -> bool {
    proxy_type.is_some_and(|proxy_type| {
        ["direct", "reject", "pass", "compatible"]
            .iter()
            .any(|builtin| proxy_type.eq_ignore_ascii_case(builtin))
    })
}

fn validate_proxy_name(value: &str) -> ControllerResult<()> {
    if value.is_empty() || value.len() > MAX_PROXY_NAME_BYTES || value.chars().any(char::is_control)
    {
        return Err(ControllerError::InvalidName);
    }
    Ok(())
}

fn expect_no_content(
    response: ControllerResponse,
    operation: &'static str,
) -> ControllerResult<()> {
    if response.status == 204 {
        Ok(())
    } else {
        Err(ControllerError::Api {
            operation,
            status: response.status,
        })
    }
}

fn expect_json<T>(response: ControllerResponse, response_name: &'static str) -> ControllerResult<T>
where
    T: for<'de> Deserialize<'de>,
{
    if !(200..300).contains(&response.status) {
        return Err(ControllerError::Api {
            operation: response_name,
            status: response.status,
        });
    }
    serde_json::from_slice(&response.body)
        .map_err(|_| ControllerError::InvalidResponse(response_name))
}

#[cfg(test)]
mod tests {
    use std::{
        collections::VecDeque,
        sync::{Arc, Mutex},
    };

    use super::*;
    use crate::controller::transport::ControllerFuture;

    #[derive(Clone)]
    struct FakeTransport {
        responses: Arc<Mutex<VecDeque<ControllerResponse>>>,
        requests: Arc<Mutex<Vec<ControllerRequest>>>,
        metadata: Vec<ProxyMetadata>,
    }

    impl FakeTransport {
        fn new(responses: Vec<ControllerResponse>, metadata: Vec<ProxyMetadata>) -> Self {
            Self {
                responses: Arc::new(Mutex::new(responses.into())),
                requests: Arc::new(Mutex::new(Vec::new())),
                metadata,
            }
        }

        fn requests(&self) -> Vec<ControllerRequest> {
            self.requests.lock().expect("requests").clone()
        }
    }

    impl ControllerTransport for FakeTransport {
        fn send(&self, request: ControllerRequest) -> ControllerFuture<'_> {
            self.requests.lock().expect("requests").push(request);
            let response = self.responses.lock().expect("responses").pop_front();
            Box::pin(async move { response.ok_or(ControllerError::Transport) })
        }

        fn active_proxy_metadata(&self) -> ControllerResult<Vec<ProxyMetadata>> {
            Ok(self.metadata.clone())
        }
    }

    fn json_response(body: serde_json::Value) -> ControllerResponse {
        ControllerResponse {
            status: 200,
            body: serde_json::to_vec(&body).expect("JSON"),
        }
    }

    fn config_response() -> ControllerResponse {
        json_response(json!({ "mode": "rule", "unknown": true }))
    }

    fn proxy_response() -> ControllerResponse {
        json_response(json!({
            "proxies": {
                "DIRECT": { "type": "Direct", "alive": true, "history": [] },
                "REJECT": { "type": "Reject", "alive": true },
                "香港 / 一号?#": {
                    "type": "Shadowsocks",
                    "alive": true,
                    "history": [
                        { "time": "old", "delay": 45 },
                        { "time": "invalid", "delay": 0 },
                        { "time": "new", "delay": 31 }
                    ],
                    "future-field": { "anything": true }
                },
                "选择 / 节点?#": {
                    "type": "Selector",
                    "now": "香港 / 一号?#",
                    "all": ["香港 / 一号?#", "DIRECT"],
                    "alive": true,
                    "history": [{ "delay": 33 }]
                }
            },
            "future": "ignored"
        }))
    }

    #[tokio::test]
    async fn overview_is_stable_and_merges_only_safe_profile_metadata() {
        let transport = FakeTransport::new(
            vec![config_response(), proxy_response()],
            vec![ProxyMetadata {
                name: "香港 / 一号?#".to_owned(),
                proxy_type: "ss".to_owned(),
                server: "hk.example.test".to_owned(),
                port: Some(443),
            }],
        );

        let overview = get_overview(&transport).await.expect("overview");
        assert_eq!(overview.mode, ProxyMode::Rule);
        assert_eq!(overview.groups.len(), 1);
        assert_eq!(overview.groups[0].name, "选择 / 节点?#");
        assert_eq!(overview.groups[0].delay, Some(33));
        assert_eq!(overview.nodes.len(), 1);
        assert_eq!(overview.nodes[0].name, "香港 / 一号?#");
        assert_eq!(overview.nodes[0].proxy_type, "ss");
        assert_eq!(overview.nodes[0].server.as_deref(), Some("hk.example.test"));
        assert_eq!(overview.nodes[0].port, Some(443));
        assert_eq!(overview.nodes[0].groups, vec!["选择 / 节点?#"]);
        assert_eq!(overview.nodes[0].delay, Some(31));
        assert!(overview.updated_at.ends_with('Z'));
    }

    #[tokio::test]
    async fn selection_preserves_special_name_as_a_single_path_segment() {
        let transport = FakeTransport::new(
            vec![
                config_response(),
                proxy_response(),
                ControllerResponse {
                    status: 204,
                    body: Vec::new(),
                },
            ],
            Vec::new(),
        );

        select_proxy(
            &transport,
            "选择 / 节点?#".to_owned(),
            "香港 / 一号?#".to_owned(),
        )
        .await
        .expect("selection");
        let requests = transport.requests();
        assert_eq!(requests[2].path_segments, vec!["proxies", "选择 / 节点?#"]);
        assert_eq!(
            requests[2].json_body,
            Some(json!({ "name": "香港 / 一号?#" }))
        );
    }

    #[tokio::test]
    async fn delay_clamps_timeout_and_uses_fixed_health_endpoint() {
        let transport = FakeTransport::new(
            vec![
                config_response(),
                proxy_response(),
                json_response(json!({ "delay": 27 })),
            ],
            Vec::new(),
        );

        let result = test_delay(&transport, "香港 / 一号?#".to_owned(), u64::MAX)
            .await
            .expect("delay");
        assert_eq!(result.delay, 27);
        let requests = transport.requests();
        let delay = &requests[2];
        assert_eq!(delay.timeout, Duration::from_secs(32));
        assert!(delay
            .query
            .contains(&("timeout".to_owned(), "30000".to_owned())));
        assert!(delay
            .query
            .contains(&("url".to_owned(), DELAY_URL.to_owned())));
        assert!(delay
            .query
            .contains(&("expected".to_owned(), "204".to_owned())));
    }

    #[tokio::test]
    async fn names_are_bounded_by_utf8_bytes_and_reject_controls() {
        let transport = FakeTransport::new(Vec::new(), Vec::new());
        let too_long_chinese = "节".repeat(171);
        assert!(matches!(
            test_delay(&transport, too_long_chinese, 5_000).await,
            Err(ControllerError::InvalidName)
        ));
        assert!(matches!(
            select_proxy(&transport, "group\nname".to_owned(), "node".to_owned()).await,
            Err(ControllerError::InvalidName)
        ));
        assert!(transport.requests().is_empty());
    }

    #[test]
    fn mode_input_is_strict_while_controller_output_is_case_tolerant() {
        assert_eq!(
            serde_json::from_str::<ProxyMode>(r#""rule""#).expect("supported mode"),
            ProxyMode::Rule
        );
        assert!(serde_json::from_str::<ProxyMode>(r#""Rule""#).is_err());
        assert!(serde_json::from_str::<ProxyMode>(r#""script""#).is_err());
        assert_eq!(
            ProxyMode::from_controller("GLOBAL").expect("supported Controller mode"),
            ProxyMode::Global
        );
    }

    #[test]
    fn latest_delay_skips_zero_and_out_of_range_history() {
        let proxy = RawProxy {
            proxy_type: Some("ss".to_owned()),
            now: None,
            all: None,
            alive: Some(true),
            history: Some(vec![
                RawHistory { delay: Some(14) },
                RawHistory { delay: Some(0) },
                RawHistory {
                    delay: Some(u64::from(u32::MAX) + 1),
                },
            ]),
        };
        assert_eq!(latest_delay(&proxy), Some(14));
    }

    #[tokio::test]
    async fn stale_group_members_are_rejected_before_mutation() {
        let stale_group = json_response(json!({
            "proxies": {
                "node": { "type": "ss" },
                "other": { "type": "ss" },
                "auto": { "type": "URLTest", "all": ["other"] }
            }
        }));
        let transport = FakeTransport::new(vec![config_response(), stale_group], Vec::new());
        assert!(matches!(
            select_proxy(&transport, "auto".to_owned(), "node".to_owned()).await,
            Err(ControllerError::InvalidSelection)
        ));
        assert_eq!(transport.requests().len(), 2);
    }

    #[cfg(windows)]
    #[tokio::test]
    #[ignore = "requires HORION_LIVE_CORE_PATH pointing to a trusted Mihomo executable"]
    async fn live_core_profile_overview_selection_and_mode_round_trip() {
        use crate::core::CoreService;

        let executable = std::env::var("HORION_LIVE_CORE_PATH")
            .expect("set HORION_LIVE_CORE_PATH to a trusted Mihomo executable");
        let temp = tempfile::tempdir().expect("temporary application data");
        let fixture = temp.path().join("controller-fixture.yaml");
        std::fs::write(
            &fixture,
            r#"
mixed-port: 0
allow-lan: false
mode: rule
log-level: warning
ipv6: false
proxies:
  - name: Offline Fixture
    type: socks5
    server: 127.0.0.1
    port: 9
proxy-groups:
  - name: Fixture Selector
    type: select
    proxies:
      - DIRECT
      - Offline Fixture
rules:
  - MATCH,Fixture Selector
"#,
        )
        .expect("write fixture profile");

        let core = CoreService::new(temp.path()).expect("CoreService");
        core.import_from_path(executable)
            .await
            .expect("import live Mihomo");
        let profiles = core.profiles();
        let profile = profiles
            .import_local(
                &core,
                "Controller integration fixture".to_owned(),
                fixture.to_string_lossy().into_owned(),
            )
            .await
            .expect("import fixture profile");
        profiles
            .activate(&core, profile.id)
            .await
            .expect("activate fixture profile");
        core.start().await.expect("start live Mihomo");

        let outcome = async {
            let overview = get_overview(&core)
                .await
                .map_err(|error| error.to_string())?;
            if overview.mode != ProxyMode::Rule {
                return Err("fixture did not start in rule mode".to_owned());
            }
            let node = overview
                .nodes
                .iter()
                .find(|node| node.name == "Offline Fixture")
                .ok_or_else(|| "fixture node was absent from overview".to_owned())?;
            if node.server.as_deref() != Some("127.0.0.1") || node.port != Some(9) {
                return Err("active profile metadata was not merged".to_owned());
            }

            select_proxy(&core, "Fixture Selector".to_owned(), "DIRECT".to_owned())
                .await
                .map_err(|error| error.to_string())?;
            let selected = get_overview(&core)
                .await
                .map_err(|error| error.to_string())?;
            if selected.groups.first().map(|group| group.now.as_str()) != Some("DIRECT") {
                return Err("fixture selector did not switch to DIRECT".to_owned());
            }

            set_mode(&core, ProxyMode::Direct)
                .await
                .map_err(|error| error.to_string())?;
            let direct = get_overview(&core)
                .await
                .map_err(|error| error.to_string())?;
            if direct.mode != ProxyMode::Direct {
                return Err("runtime mode did not switch to direct".to_owned());
            }
            Ok::<(), String>(())
        }
        .await;

        let stop = core.stop().await;
        if let Err(error) = outcome {
            panic!("live Controller integration failed: {error}");
        }
        stop.expect("stop live Mihomo");
    }
}
