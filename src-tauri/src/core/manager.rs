use std::{
    collections::VecDeque,
    io::{Read, Write},
    net::{IpAddr, Ipv4Addr, SocketAddr, TcpListener},
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex, MutexGuard,
    },
    thread,
    time::{Duration, Instant},
};

use chrono::{SecondsFormat, Utc};
use rand::RngCore;
use reqwest::{header::AUTHORIZATION, redirect::Policy, Client};
use serde::Deserialize;
use zeroize::Zeroizing;

use super::{
    error::{CoreError, CoreResult},
    install::CoreInstaller,
    model::{CoreLifecycle, CoreLogEntry, CoreManifest, CoreSnapshot},
    paths::CorePaths,
};

const LOG_CAPACITY: usize = 1_000;
const MAX_LOG_LINE_BYTES: usize = 16 * 1024;
const START_TIMEOUT: Duration = Duration::from_secs(15);
const STOP_TIMEOUT: Duration = Duration::from_secs(5);

struct ControllerSecret(Zeroizing<String>);

impl ControllerSecret {
    fn generate() -> Self {
        let mut bytes = [0_u8; 32];
        rand::rng().fill_bytes(&mut bytes);
        let value = bytes
            .iter()
            .map(|byte| format!("{byte:02x}"))
            .collect::<String>();
        Self(Zeroizing::new(value))
    }

    fn as_str(&self) -> &str {
        self.0.as_str()
    }
}

#[derive(Clone)]
struct ControllerRuntime {
    address: SocketAddr,
    secret: Arc<ControllerSecret>,
    expected_version: String,
}

struct Runtime {
    snapshot: CoreSnapshot,
    manifest: Option<CoreManifest>,
    executable: Option<PathBuf>,
    child: Option<Child>,
    controller: Option<ControllerRuntime>,
}

impl Runtime {
    fn transition(&mut self, next: CoreLifecycle) -> CoreResult<()> {
        if !self.snapshot.state.can_transition_to(next) {
            return Err(CoreError::InvalidTransition(format!(
                "{:?} -> {next:?}",
                self.snapshot.state
            )));
        }
        self.snapshot.state = next;
        Ok(())
    }

    fn apply_manifest(&mut self, manifest: CoreManifest, executable: PathBuf) {
        self.snapshot = CoreSnapshot {
            state: CoreLifecycle::Stopped,
            installed: true,
            version: Some(manifest.version.clone()),
            source: Some(manifest.source.clone()),
            path: Some(executable.to_string_lossy().into_owned()),
            pid: None,
            healthy: false,
            controller_available: false,
            last_error: None,
        };
        self.manifest = Some(manifest);
        self.executable = Some(executable);
        self.child = None;
        self.controller = None;
    }
}

pub struct CoreService {
    paths: CorePaths,
    installer: CoreInstaller,
    runtime: Mutex<Runtime>,
    logs: Arc<Mutex<VecDeque<CoreLogEntry>>>,
    operation: tokio::sync::Mutex<()>,
    controller_client: Client,
    shutting_down: AtomicBool,
}

impl CoreService {
    pub fn new(app_data: impl AsRef<Path>) -> CoreResult<Self> {
        let paths = CorePaths::create(app_data)?;
        let installer = CoreInstaller::new(paths.clone())?;
        let logs = Arc::new(Mutex::new(VecDeque::with_capacity(LOG_CAPACITY)));
        let (runtime, startup_warning) = match installer.load_manifest() {
            Ok(Some((manifest, executable))) => {
                let snapshot = CoreSnapshot {
                    state: CoreLifecycle::Stopped,
                    installed: true,
                    version: Some(manifest.version.clone()),
                    source: Some(manifest.source.clone()),
                    path: Some(executable.to_string_lossy().into_owned()),
                    pid: None,
                    healthy: false,
                    controller_available: false,
                    last_error: None,
                };
                (
                    Runtime {
                        snapshot,
                        manifest: Some(manifest),
                        executable: Some(executable),
                        child: None,
                        controller: None,
                    },
                    None,
                )
            }
            Ok(None) => (
                Runtime {
                    snapshot: CoreSnapshot::not_installed(),
                    manifest: None,
                    executable: None,
                    child: None,
                    controller: None,
                },
                None,
            ),
            Err(error) => {
                let message = format!("Installed core validation failed: {error}");
                let mut snapshot = CoreSnapshot::not_installed();
                snapshot.state = CoreLifecycle::Error;
                snapshot.last_error = Some(message.clone());
                (
                    Runtime {
                        snapshot,
                        manifest: None,
                        executable: None,
                        child: None,
                        controller: None,
                    },
                    Some(message),
                )
            }
        };
        let controller_client = Client::builder()
            .no_proxy()
            .redirect(Policy::none())
            .connect_timeout(Duration::from_secs(1))
            .timeout(Duration::from_secs(2))
            .build()
            .map_err(|error| {
                CoreError::Process(format!("could not create health client: {error}"))
            })?;
        let service = Self {
            paths,
            installer,
            runtime: Mutex::new(runtime),
            logs,
            operation: tokio::sync::Mutex::new(()),
            controller_client,
            shutting_down: AtomicBool::new(false),
        };
        if let Some(warning) = startup_warning {
            service.push_log("error", "system", warning);
        }
        Ok(service)
    }

    pub async fn status(&self) -> CoreResult<CoreSnapshot> {
        let controller = {
            let mut runtime = self.lock_runtime()?;
            self.refresh_child(&mut runtime)?;
            if runtime.snapshot.state == CoreLifecycle::Running {
                runtime.controller.clone()
            } else {
                None
            }
        };
        if let Some(controller) = controller {
            let healthy = self.controller_health(&controller).await;
            let mut runtime = self.lock_runtime()?;
            self.refresh_child(&mut runtime)?;
            let same_controller = runtime.controller.as_ref().is_some_and(|current| {
                current.address == controller.address
                    && Arc::ptr_eq(&current.secret, &controller.secret)
            });
            if runtime.snapshot.state == CoreLifecycle::Running && same_controller {
                runtime.snapshot.healthy = healthy;
                runtime.snapshot.controller_available = healthy;
            }
        }
        Ok(self.lock_runtime()?.snapshot.clone())
    }

    pub async fn install_official(&self) -> CoreResult<CoreSnapshot> {
        let _operation = self.operation.lock().await;
        {
            let mut runtime = self.lock_runtime()?;
            self.refresh_child(&mut runtime)?;
            ensure_install_allowed(&runtime)?;
            runtime.transition(CoreLifecycle::Downloading)?;
            runtime.snapshot.last_error = None;
        }
        self.push_log(
            "info",
            "system",
            "Downloading the pinned official Mihomo v1.19.29 release",
        );

        let manifest = match self.installer.install_official().await {
            Ok(manifest) => manifest,
            Err(error) => {
                self.record_failure(&error)?;
                return Err(error);
            }
        };
        let executable = match self.paths.resolve_manifest_executable(&manifest) {
            Ok(executable) => executable,
            Err(error) => {
                self.record_failure(&error)?;
                return Err(error);
            }
        };
        let mut runtime = self.lock_runtime()?;
        runtime.transition(CoreLifecycle::Installing)?;
        runtime.apply_manifest(manifest, executable);
        self.push_log(
            "info",
            "system",
            "Pinned official Mihomo core installed and verified",
        );
        Ok(runtime.snapshot.clone())
    }

    pub async fn import_from_path(&self, path: String) -> CoreResult<CoreSnapshot> {
        let _operation = self.operation.lock().await;
        {
            let mut runtime = self.lock_runtime()?;
            self.refresh_child(&mut runtime)?;
            ensure_install_allowed(&runtime)?;
            runtime.transition(CoreLifecycle::Installing)?;
            runtime.snapshot.last_error = None;
        }
        self.push_log(
            "info",
            "system",
            "Validating a locally selected Mihomo core",
        );
        let manifest = match self.installer.install_import(Path::new(&path)) {
            Ok(manifest) => manifest,
            Err(error) => {
                self.record_failure(&error)?;
                return Err(error);
            }
        };
        let executable = match self.paths.resolve_manifest_executable(&manifest) {
            Ok(executable) => executable,
            Err(error) => {
                self.record_failure(&error)?;
                return Err(error);
            }
        };
        let mut runtime = self.lock_runtime()?;
        runtime.apply_manifest(manifest, executable);
        self.push_log(
            "info",
            "system",
            "Imported Mihomo core installed and verified",
        );
        Ok(runtime.snapshot.clone())
    }

    pub async fn start(&self) -> CoreResult<CoreSnapshot> {
        let _operation = self.operation.lock().await;
        self.start_locked().await
    }

    pub async fn stop(&self) -> CoreResult<CoreSnapshot> {
        let _operation = self.operation.lock().await;
        self.stop_locked()
    }

    pub async fn restart(&self) -> CoreResult<CoreSnapshot> {
        let _operation = self.operation.lock().await;
        self.stop_locked()?;
        self.start_locked().await
    }

    pub fn logs(&self) -> CoreResult<Vec<CoreLogEntry>> {
        let logs = self.logs.lock().map_err(|_| CoreError::Synchronization)?;
        Ok(logs.iter().cloned().collect())
    }

    pub fn shutdown_sync(&self) {
        self.shutting_down.store(true, Ordering::SeqCst);
        let child = self.runtime.lock().ok().and_then(|mut runtime| {
            runtime.snapshot.state = CoreLifecycle::Stopping;
            runtime.snapshot.healthy = false;
            runtime.snapshot.controller_available = false;
            runtime.snapshot.pid = None;
            runtime.controller = None;
            runtime.child.take()
        });
        if let Some(mut child) = child {
            if let Err(error) = terminate_exact_child(&mut child) {
                if let Ok(mut runtime) = self.runtime.lock() {
                    runtime.snapshot.state = CoreLifecycle::Error;
                    runtime.snapshot.pid = Some(child.id());
                    runtime.snapshot.last_error = Some(error.to_string());
                    runtime.child = Some(child);
                }
            }
        }
    }

    async fn start_locked(&self) -> CoreResult<CoreSnapshot> {
        if self.shutting_down.load(Ordering::SeqCst) {
            return Err(CoreError::Busy("the application is shutting down"));
        }
        {
            let mut runtime = self.lock_runtime()?;
            self.refresh_child(&mut runtime)?;
            if runtime.child.is_some() || runtime.snapshot.state == CoreLifecycle::Running {
                return Err(CoreError::AlreadyRunning);
            }
        }

        let (manifest, executable) = match self.installer.load_manifest() {
            Ok(Some(install)) => install,
            Ok(None) => return Err(CoreError::NotInstalled),
            Err(error) => {
                self.record_failure(&error)?;
                return Err(error);
            }
        };
        let expected_version = manifest.version.clone();
        {
            let mut runtime = self.lock_runtime()?;
            self.refresh_child(&mut runtime)?;
            if runtime.child.is_some() || runtime.snapshot.state == CoreLifecycle::Running {
                return Err(CoreError::AlreadyRunning);
            }
            runtime.apply_manifest(manifest, executable.clone());
            runtime.transition(CoreLifecycle::Starting)?;
            runtime.snapshot.last_error = None;
        }

        let (port_reservation, address) = match reserve_loopback_address() {
            Ok(reservation) => reservation,
            Err(error) => {
                self.record_failure(&error)?;
                return Err(error);
            }
        };
        let secret = Arc::new(ControllerSecret::generate());
        let controller = ControllerRuntime {
            address,
            secret: Arc::clone(&secret),
            expected_version,
        };
        let config = build_runtime_config(&controller);
        if let Err(error) = self.preflight_core(&executable, &config, &controller) {
            self.record_failure(&error)?;
            return Err(error);
        }
        if self.shutting_down.load(Ordering::SeqCst) {
            return Err(CoreError::Busy("the application is shutting down"));
        }
        drop(port_reservation);
        let mut child = match self.spawn_core(&executable, &controller, config.as_bytes()) {
            Ok(child) => child,
            Err(error) => {
                self.record_failure(&error)?;
                return Err(error);
            }
        };
        let pid = child.id();
        {
            let mut runtime = self.lock_runtime()?;
            if self.shutting_down.load(Ordering::SeqCst) {
                drop(runtime);
                if terminate_exact_child(&mut child).is_err() {
                    self.retain_child_for_retry(child)?;
                }
                return Err(CoreError::Busy("the application is shutting down"));
            }
            runtime.child = Some(child);
            runtime.controller = Some(controller.clone());
            runtime.snapshot.pid = Some(pid);
        }
        self.push_log(
            "info",
            "system",
            format!("Mihomo process started with PID {pid}"),
        );

        let deadline = Instant::now() + START_TIMEOUT;
        loop {
            {
                let mut runtime = self.lock_runtime()?;
                self.refresh_child(&mut runtime)?;
                if runtime.child.is_none() {
                    return Err(CoreError::Process(
                        runtime
                            .snapshot
                            .last_error
                            .clone()
                            .unwrap_or_else(|| "Mihomo exited while starting".to_owned()),
                    ));
                }
            }
            if self.controller_health(&controller).await {
                let mut runtime = self.lock_runtime()?;
                self.refresh_child(&mut runtime)?;
                if runtime.child.is_none() {
                    return Err(CoreError::Process(
                        "Mihomo exited immediately after its Controller became available"
                            .to_owned(),
                    ));
                }
                runtime.transition(CoreLifecycle::Running)?;
                runtime.snapshot.healthy = true;
                runtime.snapshot.controller_available = true;
                self.push_log("info", "system", "Mihomo Controller health check passed");
                return Ok(runtime.snapshot.clone());
            }
            if Instant::now() >= deadline {
                let child = {
                    let mut runtime = self.lock_runtime()?;
                    runtime.snapshot.pid = None;
                    runtime.snapshot.healthy = false;
                    runtime.snapshot.controller_available = false;
                    runtime.controller = None;
                    runtime.child.take()
                };
                if let Some(mut child) = child {
                    if let Err(termination_error) = terminate_exact_child(&mut child) {
                        let mut runtime = self.lock_runtime()?;
                        runtime.snapshot.pid = Some(child.id());
                        runtime.child = Some(child);
                        drop(runtime);
                        self.record_failure(&termination_error)?;
                        return Err(termination_error);
                    }
                }
                let error = CoreError::HealthTimeout;
                self.record_failure(&error)?;
                return Err(error);
            }
            tokio::time::sleep(Duration::from_millis(150)).await;
        }
    }

    fn stop_locked(&self) -> CoreResult<CoreSnapshot> {
        let (mut child, controller) = {
            let mut runtime = self.lock_runtime()?;
            self.refresh_child(&mut runtime)?;
            if runtime.child.is_none() {
                if runtime.snapshot.installed {
                    if runtime.snapshot.state != CoreLifecycle::Stopped {
                        runtime.transition(CoreLifecycle::Stopped)?;
                    }
                } else {
                    runtime.snapshot.state = CoreLifecycle::NotInstalled;
                }
                runtime.snapshot.pid = None;
                runtime.snapshot.healthy = false;
                runtime.snapshot.controller_available = false;
                runtime.controller = None;
                return Ok(runtime.snapshot.clone());
            }
            runtime.transition(CoreLifecycle::Stopping)?;
            let child = runtime.child.take().ok_or(CoreError::Synchronization)?;
            runtime.snapshot.pid = None;
            runtime.snapshot.healthy = false;
            runtime.snapshot.controller_available = false;
            let controller = runtime.controller.take();
            (child, controller)
        };

        let result = terminate_exact_child(&mut child);
        let mut runtime = self.lock_runtime()?;
        match result {
            Ok(()) => {
                runtime.transition(CoreLifecycle::Stopped)?;
                runtime.snapshot.last_error = None;
                self.push_log("info", "system", "Mihomo process stopped");
                Ok(runtime.snapshot.clone())
            }
            Err(error) => {
                runtime.transition(CoreLifecycle::Error)?;
                runtime.snapshot.pid = Some(child.id());
                runtime.snapshot.last_error = Some(error.to_string());
                runtime.child = Some(child);
                runtime.controller = controller;
                Err(error)
            }
        }
    }

    fn preflight_core(
        &self,
        executable: &Path,
        config: &Zeroizing<String>,
        controller: &ControllerRuntime,
    ) -> CoreResult<()> {
        let mut command = Command::new(executable);
        command
            .arg("-t")
            .arg("-d")
            .arg(&self.paths.runtime)
            .arg("-f")
            .arg("-")
            .current_dir(&self.paths.runtime)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        configure_hidden_process(&mut command);
        let mut child = command.spawn().map_err(|error| {
            CoreError::Process(format!(
                "could not start Mihomo configuration validation: {error}"
            ))
        })?;
        let Some(mut stdin) = child.stdin.take() else {
            let error = CoreError::Process("could not open the Mihomo validation pipe".to_owned());
            if let Err(termination_error) = terminate_exact_child(&mut child) {
                self.retain_child_for_retry(child)?;
                return Err(termination_error);
            }
            return Err(error);
        };
        if let Err(error) = stdin.write_all(config.as_bytes()) {
            drop(stdin);
            if let Err(termination_error) = terminate_exact_child(&mut child) {
                self.retain_child_for_retry(child)?;
                return Err(termination_error);
            }
            return Err(CoreError::Process(format!(
                "could not send the in-memory configuration for validation: {error}"
            )));
        }
        drop(stdin);

        let stdout = child.stdout.take();
        let stderr = child.stderr.take();
        let stdout_reader = thread::spawn(move || read_output_bounded(stdout, 64 * 1024));
        let stderr_reader = thread::spawn(move || read_output_bounded(stderr, 64 * 1024));
        let deadline = Instant::now() + Duration::from_secs(10);
        let outcome = loop {
            match child.try_wait() {
                Ok(Some(status)) => break Ok(status),
                Ok(None) if Instant::now() < deadline => {
                    thread::sleep(Duration::from_millis(20));
                }
                Ok(None) => {
                    if let Err(error) = terminate_exact_child(&mut child) {
                        self.retain_child_for_retry(child)?;
                        return Err(error);
                    }
                    break Err(CoreError::InvalidExecutable(
                        "Mihomo configuration validation exceeded 10 seconds".to_owned(),
                    ));
                }
                Err(error) => {
                    if let Err(termination_error) = terminate_exact_child(&mut child) {
                        self.retain_child_for_retry(child)?;
                        return Err(termination_error);
                    }
                    break Err(CoreError::Process(format!(
                        "could not inspect Mihomo configuration validation: {error}"
                    )));
                }
            }
        };
        let stdout = stdout_reader.join().unwrap_or_default();
        let stderr = stderr_reader.join().unwrap_or_default();
        self.emit_preflight_output("stdout", &stdout, controller);
        self.emit_preflight_output("stderr", &stderr, controller);

        let status = outcome?;
        if !status.success() {
            return Err(CoreError::InvalidExecutable(format!(
                "Mihomo rejected the safe in-memory configuration with {status}"
            )));
        }
        self.push_log("info", "system", "Mihomo configuration preflight passed");
        Ok(())
    }

    fn retain_child_for_retry(&self, child: Child) -> CoreResult<()> {
        let mut runtime = self.lock_runtime()?;
        runtime.snapshot.pid = Some(child.id());
        runtime.child = Some(child);
        Ok(())
    }

    fn emit_preflight_output(
        &self,
        stream: &'static str,
        bytes: &[u8],
        controller: &ControllerRuntime,
    ) {
        for line in bytes.split(|byte| *byte == b'\n') {
            emit_captured_line(&self.logs, stream, &controller.secret, line, false);
        }
    }

    fn spawn_core(
        &self,
        executable: &Path,
        controller: &ControllerRuntime,
        config: &[u8],
    ) -> CoreResult<Child> {
        let mut command = Command::new(executable);
        command
            .arg("-d")
            .arg(&self.paths.runtime)
            .arg("-f")
            .arg("-")
            .current_dir(&self.paths.runtime)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        configure_hidden_process(&mut command);
        let mut child = command
            .spawn()
            .map_err(|error| CoreError::Process(format!("could not start Mihomo: {error}")))?;

        let Some(mut stdin) = child.stdin.take() else {
            let error =
                CoreError::Process("could not open the Mihomo configuration pipe".to_owned());
            if let Err(termination_error) = terminate_exact_child(&mut child) {
                self.retain_child_for_retry(child)?;
                return Err(termination_error);
            }
            return Err(error);
        };
        if let Err(error) = stdin.write_all(config) {
            drop(stdin);
            if let Err(termination_error) = terminate_exact_child(&mut child) {
                self.retain_child_for_retry(child)?;
                return Err(termination_error);
            }
            return Err(CoreError::Process(format!(
                "could not send the in-memory Mihomo configuration: {error}"
            )));
        }
        drop(stdin);

        if let Some(stdout) = child.stdout.take() {
            spawn_log_reader(
                stdout,
                "stdout",
                Arc::clone(&self.logs),
                Arc::clone(&controller.secret),
            );
        }
        if let Some(stderr) = child.stderr.take() {
            spawn_log_reader(
                stderr,
                "stderr",
                Arc::clone(&self.logs),
                Arc::clone(&controller.secret),
            );
        }
        Ok(child)
    }

    async fn controller_health(&self, controller: &ControllerRuntime) -> bool {
        let url = format!("http://{}/version", controller.address);
        let authorization = Zeroizing::new(format!("Bearer {}", controller.secret.as_str()));
        let Ok(mut response) = self
            .controller_client
            .get(url)
            .header(AUTHORIZATION, authorization.as_str())
            .send()
            .await
        else {
            return false;
        };
        if !response.status().is_success()
            || response
                .content_length()
                .is_some_and(|length| length > 64 * 1024)
        {
            return false;
        }
        let mut bytes = Vec::with_capacity(256);
        loop {
            match response.chunk().await {
                Ok(Some(chunk)) => {
                    if bytes.len().saturating_add(chunk.len()) > 64 * 1024 {
                        return false;
                    }
                    bytes.extend_from_slice(&chunk);
                }
                Ok(None) => break,
                Err(_) => return false,
            }
        }
        let Ok(body) = serde_json::from_slice::<ControllerVersion>(&bytes) else {
            return false;
        };
        body.version.trim_start_matches('v') == controller.expected_version
    }

    fn refresh_child(&self, runtime: &mut Runtime) -> CoreResult<()> {
        let Some(child) = runtime.child.as_mut() else {
            return Ok(());
        };
        let status = child
            .try_wait()
            .map_err(|error| CoreError::Process(format!("could not query Mihomo: {error}")))?;
        let Some(status) = status else {
            return Ok(());
        };

        runtime.child = None;
        runtime.controller = None;
        runtime.snapshot.pid = None;
        runtime.snapshot.healthy = false;
        runtime.snapshot.controller_available = false;
        let message = format!("Mihomo exited unexpectedly with {status}");
        if runtime.snapshot.state == CoreLifecycle::Stopping {
            runtime.transition(CoreLifecycle::Stopped)?;
            runtime.snapshot.last_error = None;
        } else {
            runtime.transition(CoreLifecycle::Crashed)?;
            runtime.snapshot.last_error = Some(message.clone());
            self.push_log("error", "system", message);
        }
        Ok(())
    }

    fn record_failure(&self, error: &CoreError) -> CoreResult<()> {
        let message = error.to_string();
        let mut runtime = self.lock_runtime()?;
        runtime.transition(CoreLifecycle::Error)?;
        if runtime.child.is_none() {
            runtime.snapshot.pid = None;
        }
        runtime.snapshot.healthy = false;
        runtime.snapshot.controller_available = false;
        runtime.snapshot.last_error = Some(message.clone());
        self.push_log("error", "system", message);
        Ok(())
    }

    fn lock_runtime(&self) -> CoreResult<MutexGuard<'_, Runtime>> {
        self.runtime.lock().map_err(|_| CoreError::Synchronization)
    }

    fn push_log(
        &self,
        level: impl Into<String>,
        stream: impl Into<String>,
        message: impl Into<String>,
    ) {
        push_log_entry(
            &self.logs,
            CoreLogEntry {
                timestamp: Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true),
                level: level.into(),
                stream: stream.into(),
                message: message.into(),
            },
        );
    }
}

#[derive(Deserialize)]
struct ControllerVersion {
    version: String,
}

fn ensure_install_allowed(runtime: &Runtime) -> CoreResult<()> {
    if runtime.child.is_some()
        || matches!(
            runtime.snapshot.state,
            CoreLifecycle::Starting | CoreLifecycle::Running | CoreLifecycle::Stopping
        )
    {
        return Err(CoreError::Busy(
            "stop Mihomo before installing another core",
        ));
    }
    Ok(())
}

fn reserve_loopback_address() -> CoreResult<(TcpListener, SocketAddr)> {
    let listener = TcpListener::bind((Ipv4Addr::LOCALHOST, 0)).map_err(|error| {
        CoreError::Process(format!("could not reserve a Controller port: {error}"))
    })?;
    let address = listener.local_addr().map_err(|error| {
        CoreError::Process(format!("could not read the Controller port: {error}"))
    })?;
    if address.ip() != IpAddr::V4(Ipv4Addr::LOCALHOST) {
        return Err(CoreError::Process(
            "the Controller address was not loopback".to_owned(),
        ));
    }
    Ok((listener, address))
}

fn build_runtime_config(controller: &ControllerRuntime) -> Zeroizing<String> {
    Zeroizing::new(format!(
        concat!(
            "mixed-port: 0\n",
            "allow-lan: false\n",
            "ipv6: false\n",
            "mode: direct\n",
            "log-level: warning\n",
            "geo-auto-update: false\n",
            "external-controller: \"{}\"\n",
            "secret: \"{}\"\n",
            "proxies: []\n",
            "proxy-groups: []\n",
            "rules:\n",
            "  - MATCH,DIRECT\n"
        ),
        controller.address,
        controller.secret.as_str()
    ))
}

fn read_output_bounded<R: Read>(reader: Option<R>, limit: usize) -> Vec<u8> {
    let Some(reader) = reader else {
        return Vec::new();
    };
    let mut output = Vec::with_capacity(limit.min(4 * 1024));
    let _ = reader.take(limit as u64).read_to_end(&mut output);
    output
}

fn terminate_exact_child(child: &mut Child) -> CoreResult<()> {
    let first_kill_error = match child.kill() {
        Ok(()) => None,
        Err(error) if error.kind() == std::io::ErrorKind::InvalidInput => None,
        Err(error) => Some(error),
    };
    let deadline = Instant::now() + STOP_TIMEOUT;
    loop {
        match child.try_wait() {
            Ok(Some(_)) => return Ok(()),
            Ok(None) if Instant::now() < deadline => thread::sleep(Duration::from_millis(25)),
            Ok(None) => {
                let retry = child.kill();
                return Err(CoreError::Process(match (first_kill_error, retry) {
                    (Some(first), Err(second)) => format!(
                        "could not terminate Mihomo PID {} within five seconds: {first}; retry: {second}",
                        child.id()
                    ),
                    (Some(first), Ok(())) => format!(
                        "Mihomo PID {} did not exit within five seconds after retrying: {first}",
                        child.id()
                    ),
                    (None, Err(error)) => format!(
                        "Mihomo PID {} did not exit and retry failed: {error}",
                        child.id()
                    ),
                    (None, Ok(())) => format!(
                        "Mihomo PID {} did not exit within five seconds",
                        child.id()
                    ),
                }));
            }
            Err(error) => {
                return Err(CoreError::Process(format!(
                    "could not wait for Mihomo PID {}: {error}",
                    child.id()
                )))
            }
        }
    }
}

fn spawn_log_reader<R: Read + Send + 'static>(
    mut reader: R,
    stream: &'static str,
    logs: Arc<Mutex<VecDeque<CoreLogEntry>>>,
    secret: Arc<ControllerSecret>,
) {
    thread::spawn(move || {
        let mut chunk = [0_u8; 4 * 1024];
        let mut line = Vec::with_capacity(256);
        let mut truncated = false;
        loop {
            let read = match reader.read(&mut chunk) {
                Ok(0) => break,
                Ok(read) => read,
                Err(_) => break,
            };
            for byte in &chunk[..read] {
                if *byte == b'\n' {
                    emit_captured_line(&logs, stream, &secret, &line, truncated);
                    line.clear();
                    truncated = false;
                } else if line.len() < MAX_LOG_LINE_BYTES {
                    line.push(*byte);
                } else {
                    truncated = true;
                }
            }
        }
        if !line.is_empty() || truncated {
            emit_captured_line(&logs, stream, &secret, &line, truncated);
        }
    });
}

fn emit_captured_line(
    logs: &Arc<Mutex<VecDeque<CoreLogEntry>>>,
    stream: &str,
    secret: &ControllerSecret,
    bytes: &[u8],
    truncated: bool,
) {
    let mut message = String::from_utf8_lossy(bytes)
        .trim_end_matches('\r')
        .replace(secret.as_str(), "[REDACTED]");
    if truncated {
        message.push_str(" … [truncated]");
    }
    if message.is_empty() {
        return;
    }
    let lowercase = message.to_ascii_lowercase();
    let level = if lowercase.contains("error") || lowercase.contains("fatal") {
        "error"
    } else if lowercase.contains("warn") || stream == "stderr" {
        "warn"
    } else {
        "info"
    };
    push_log_entry(
        logs,
        CoreLogEntry {
            timestamp: Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true),
            level: level.to_owned(),
            stream: stream.to_owned(),
            message,
        },
    );
}

fn push_log_entry(logs: &Arc<Mutex<VecDeque<CoreLogEntry>>>, entry: CoreLogEntry) {
    if let Ok(mut logs) = logs.lock() {
        if logs.len() == LOG_CAPACITY {
            logs.pop_front();
        }
        logs.push_back(entry);
    }
}

fn configure_hidden_process(command: &mut Command) {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        command.creation_flags(CREATE_NO_WINDOW);
    }
}

#[cfg(test)]
mod tests {
    use super::{emit_captured_line, ControllerSecret, CoreService, LOG_CAPACITY};
    use std::{
        collections::VecDeque,
        sync::{Arc, Mutex},
    };

    #[test]
    fn captured_logs_redact_secret_and_remain_bounded() {
        let logs = Arc::new(Mutex::new(VecDeque::new()));
        let secret = ControllerSecret(zeroize::Zeroizing::new("top-secret".to_owned()));
        emit_captured_line(&logs, "stdout", &secret, b"token=top-secret", false);
        assert_eq!(
            logs.lock().expect("logs").front().expect("entry").message,
            "token=[REDACTED]"
        );

        let service_dir = tempfile::tempdir().expect("temp directory");
        let service = CoreService::new(service_dir.path()).expect("core service");
        for index in 0..(LOG_CAPACITY + 5) {
            service.push_log("info", "test", index.to_string());
        }
        let entries = service.logs().expect("logs");
        assert_eq!(entries.len(), LOG_CAPACITY);
        assert_eq!(entries.first().expect("first").message, "5");
    }

    #[cfg(windows)]
    #[tokio::test]
    #[ignore = "downloads and executes the pinned official Mihomo release"]
    async fn live_official_install_start_health_and_exact_stop() {
        if std::env::var("HORION_LIVE_CORE_TEST").as_deref() != Ok("1") {
            eprintln!("set HORION_LIVE_CORE_TEST=1 to permit the live core test");
            return;
        }
        let temp = tempfile::tempdir().expect("temp directory");
        let service = CoreService::new(temp.path()).expect("core service");
        let installed = service
            .install_official()
            .await
            .expect("verified official install");
        assert_eq!(installed.version.as_deref(), Some("1.19.29"));
        let executable = std::path::PathBuf::from(installed.path.expect("installed path"));
        let install_directory = executable.parent().expect("install directory");
        assert!(install_directory.join("LICENSE.mihomo.txt").is_file());
        assert!(install_directory.join("NOTICE.mihomo.md").is_file());
        let running = service
            .start()
            .await
            .expect("Mihomo start and GET /version");
        assert!(running.healthy);
        assert!(running.controller_available);
        assert!(running.pid.is_some());
        let (address, secret) = {
            let runtime = service.lock_runtime().expect("runtime");
            let controller = runtime.controller.as_ref().expect("controller");
            assert!(controller.address.ip().is_loopback());
            (
                controller.address,
                zeroize::Zeroizing::new(controller.secret.as_str().to_owned()),
            )
        };
        let unauthorized = service
            .controller_client
            .get(format!("http://{address}/version"))
            .send()
            .await
            .expect("unauthenticated loopback request");
        assert_eq!(unauthorized.status(), reqwest::StatusCode::UNAUTHORIZED);
        assert!(service
            .logs()
            .expect("logs")
            .iter()
            .all(|entry| !entry.message.contains(secret.as_str())));
        let stopped = service.stop().await.expect("exact child stop");
        assert_eq!(stopped.state, crate::core::model::CoreLifecycle::Stopped);
        assert!(stopped.pid.is_none());
    }
}
