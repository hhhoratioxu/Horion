# Development

These instructions apply to Horion v0.2.0 on Windows.

## Prerequisites

- Windows 10 or Windows 11
- Node.js 24 LTS with npm
- Rust stable with the `x86_64-pc-windows-msvc` host for the standard x64 build
- Microsoft C++ Build Tools with the Desktop development with C++ workload
- Microsoft Edge WebView2 Runtime

Restart the terminal after installing a toolchain so its PATH changes are
visible. The npm Tauri wrapper checks for a native MSVC linker. The project
verification workstation also has an already-provisioned, user-local fallback;
the wrapper can use it when present, but it is not downloaded automatically and
is never bundled with Horion.

## Install

```powershell
git clone https://github.com/hhhoratioxu/Horion.git
cd Horion
npm.cmd install
```

Dependencies are version-locked. Keep `package-lock.json` and
`src-tauri/Cargo.lock` in sync when intentionally changing dependencies.

## Run

Run the complete desktop application:

```powershell
npm.cmd run tauri:dev
```

This is required for `core_*` commands. Run only the web frontend with:

```powershell
npm.cmd run dev
```

The frontend server listens on `http://127.0.0.1:1420`. Outside Tauri, the UI
cannot install, import, start, or stop a real Mihomo process.

Opening Horion does not download Mihomo. An official network download happens
only after clicking the official-install action. A local import runs the
selected executable with `-v`; use a trusted test binary.

## Standard verification

From the repository root:

```powershell
npm.cmd run lint
npm.cmd test
npm.cmd run build

Set-Location src-tauri
cargo fmt --check
cargo clippy --locked --all-targets --all-features -- -D warnings
cargo test --locked
Set-Location ..

npm.cmd run tauri:build -- --debug --no-bundle
```

The last command compiles the frontend and Rust desktop application without
creating an installer. Direct `cargo` commands require a working MSVC linker in
the current shell. If a machine relies on the repository wrapper's
already-provisioned local fallback, use the Tauri build command for the full
link check and run format-only checks directly.

Normal unit tests do not access the network or execute the official Mihomo
release. They cover lifecycle transitions, manifest/path validation, integrity
helpers, version parsing, secret redaction, bounded logs, and frontend state.

## Opt-in live core test

The ignored Windows integration test performs the complete real flow in a
temporary application-data directory: download the pinned official archive,
verify and install it, execute `-v`, pass the `-t` configuration preflight,
start Mihomo, authenticate to
`GET /version`, and stop the exact child process.

It requires network access and executes third-party code, so two gates are
required: the environment variable and Rust's explicit ignored-test flag.

```powershell
Set-Location src-tauri
$env:HORION_LIVE_CORE_TEST = "1"
cargo test --locked live_official_install_start_health_and_exact_stop -- --ignored --nocapture
Remove-Item Env:\HORION_LIVE_CORE_TEST
Set-Location ..
```

Do not put this command in an always-on test hook. It downloads Mihomo
`v1.19.29` from GitHub and may take several minutes. It does not use a user
subscription, load proxy nodes, change the system proxy, or enable TUN.

## Release build

Create the configured NSIS installer with:

```powershell
npm.cmd run tauri:build
```

Before publishing v0.2.0, run all standard checks and the opt-in live test on
the release architecture. Building an installer does not embed Mihomo; the
end-user's separate, explicit official-install action downloads the pinned
asset appropriate for the compiled architecture.

## Changing the pinned core

A core-version update is a security-sensitive code change. Update all of the
following together and review the resulting diff:

- Exact release tag and download URL
- Architecture-specific archive name and byte size
- Archive SHA-256
- Sole expected ZIP entry name and uncompressed byte size
- Bundled third-party notice, source reference, and GPL license text
- Unit/live-test expectations and user-facing documentation

Never replace these constants with a runtime `latest` lookup. Independently
download and hash every supported architecture asset before review.
