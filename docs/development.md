# Development

These instructions apply to Horion v0.3.0 on Windows.

## Prerequisites

- Windows 10 or Windows 11
- Node.js 24 LTS with npm
- Rust stable with the `x86_64-pc-windows-msvc` host for the standard x64 build
- Microsoft C++ Build Tools with the “Desktop development with C++” workload
- Microsoft Edge WebView2 Runtime

Restart the terminal after installing a toolchain so PATH changes are visible.
The npm Tauri wrapper checks for a native MSVC linker. The project verification
workstation also has an already-provisioned user-local fallback; the wrapper can
use it when present, but it is not downloaded automatically or bundled with
Horion.

## Install

```powershell
git clone https://github.com/hhhoratioxu/Horion.git
cd Horion
npm.cmd install
```

Dependencies are version-locked. Commit `package-lock.json` and
`src-tauri/Cargo.lock` whenever an intentional dependency change updates them.

## Run

Run the complete desktop application:

```powershell
npm.cmd run tauri:dev
```

This is required for every `core_*`, `profile_*`, and `proxy_*` command. To run
only the web frontend:

```powershell
npm.cmd run dev
```

The frontend listens on `http://127.0.0.1:1420`. Browser-only mode has no Tauri
IPC and deliberately shows an unavailable/offline state; it cannot install or
execute Mihomo, read credentials, manage profiles, or query a Controller.

Opening Horion does not download Mihomo. Only the explicit official-install
action performs the pinned download. Importing a local core executes the copied
binary with `-v`; importing or saving a profile executes the installed Mihomo
with `-t`. Use only trusted inputs on a development machine.

## Code map

```text
src/
├─ services/core-client.ts, profile-client.ts, proxy-client.ts
├─ stores/core-store.ts, profile-store.ts, proxy-store.ts
├─ types/core.ts, profile.ts, proxy.ts
└─ core/proxy-view.ts

src-tauri/src/
├─ core/
│  ├─ install.rs       pinned core supply chain
│  ├─ manager.rs       process, runtime YAML and Controller operations
│  ├─ model.rs         lifecycle and IPC models
│  └─ paths.rs         managed path boundaries
└─ profile/
   ├─ credentials.rs   Windows Credential Manager
   ├─ service.rs       profile store, download, revision and rollback
   ├─ model.rs         profile IPC models
   └─ error.rs         stable safe errors
```

`CoreService` owns the private Controller runtime and a clone of
`ProfileService`. Do not expose the Controller address or secret to the
frontend. New Controller features must be narrow Rust methods and allowlisted
Tauri commands, not a generic URL/method/body relay.

## IPC contract

The v0.3.0 allowlist is:

```text
core_get_status
core_install_official
core_import_from_path { path }
core_start
core_stop
core_restart
core_get_logs

profile_list
profile_import_local { name, path }
profile_add_subscription { name, url, userAgent }
profile_update { id }
profile_update_all
profile_rename { id, name }
profile_duplicate { id, name }
profile_delete { id }
profile_get_content { id }
profile_save_content { id, content, expectedRevision }
profile_activate { id }

proxy_get_overview
proxy_select { group, name }
proxy_test_delay { name, timeoutMs }
proxy_set_mode { mode }
```

Rust fields serialize as `snake_case`; Tauri command arguments are invoked with
the camelCase keys shown above where applicable. Keep TypeScript interfaces and
Rust response structs aligned in the same change.

## Standard verification

From the repository root:

```powershell
npm.cmd run lint
npm.cmd test -- --run
npm.cmd run build

Set-Location src-tauri
cargo fmt --all -- --check
cargo check --locked --all-targets
cargo test --locked --lib
cargo clippy --locked --all-targets -- -D warnings
Set-Location ..

npm.cmd run tauri:build -- --debug --no-bundle
```

The final command compiles the frontend and Rust desktop application without
creating an installer. Direct Cargo commands require a working MSVC linker in
the current shell. If the machine relies on the repository wrapper’s existing
local fallback, use the Tauri command for the full link check; format-only
commands still run without a linker.

Normal tests must not access the network, write real subscription credentials,
or execute the official Mihomo release. They cover at least:

- core lifecycle transitions, manifest/path validation, integrity and version parsing;
- profile URL/path/YAML validation, URL redaction and subscription usage parsing;
- atomic revision behavior and the ten-backup retention boundary;
- malicious YAML merge/controller/TUN stripping and child environment removal;
- safe active-profile proxy metadata projection;
- frontend offline behavior, profile revision conflicts, modal errors, proxy grouping/sorting;
- bounded delay concurrency and cancellation of queued frontend tests.

Use temporary application-data directories in Rust tests. Do not put test
subscription URLs into fixture manifests: the production design stores complete
URLs only in Windows Credential Manager.

## Profile and subscription invariants

Changes to `ProfileService` must preserve all of these properties:

1. Content is non-empty UTF-8 YAML with a mapping root and at most 8 MiB.
2. Local sources are absolute regular `.yml`/`.yaml` files without traversal.
3. Subscription URLs are HTTPS-only, contain no userinfo/fragment, and never
   appear in the disk manifest, response models, logs, or error messages.
4. Existing content is backed up before save/update; each profile retains at
   most ten backups.
5. Content and metadata use atomic replacement and revision-based optimistic
   concurrency.
6. Failed downloads or validation preserve the last usable revision.
7. Activating or reapplying an active profile rolls back on start failure.
8. `profile_update_all` updates subscriptions only. A local source is reread
   only by explicit `profile_update`.

On Windows, credential tests should avoid modifying a developer’s persistent
Credential Manager unless they are explicitly opt-in and clean up their target.
Non-Windows code must return an unsupported error rather than write a plaintext
fallback URL.

## Runtime configuration invariants

Every active YAML passes through the structured sanitizer before both `-t` and
the real child start. Tests must prove that it:

- expands YAML merge keys before filtering;
- replaces Controller address/secret with random loopback values;
- injects empty Controller CORS origins and disables private-network CORS;
- forces `allow-lan: false` and `bind-address: 127.0.0.1`;
- removes alternate Controller endpoints, external UI and auth bypasses;
- removes TUN, extra listeners/tunnels/server modes, redir/tproxy ports and
  `dns.listen`;
- removes every approved `CLASH_*` override/hook variable and `SAFE_PATHS` from
  both the preflight and real child environments.

Do not validate one YAML and start a different YAML. Both invocations must
receive the same sanitized bytes through stdin, and no secret-bearing runtime
configuration may be persisted.

## Controller command boundaries

Proxy commands are valid only while the owned child has a healthy Controller.
Backends must validate a selection against a fresh Controller overview, accept
only `rule`, `global`, or `direct`, reject empty/control-character/over-512-byte
names, and clamp delay timeouts to 1,000–30,000 ms. Delay tests use only the
fixed `https://www.gstatic.com/generate_204` target with `expected=204`; the
frontend must never supply a test URL. URL-encode each path segment through the
HTTP client rather than concatenating untrusted names into raw paths.

Controller clients must bypass the system proxy, use the private Bearer secret,
and revalidate health for each operation. `/configs` and `/proxies` responses
are bounded to 1 MiB and 8 MiB; small mutation/delay responses are bounded to
64 KiB. Standard requests time out after five seconds, while a delay request
uses its clamped timeout plus a two-second transport grace period. Never include
raw response bodies in user errors. Node metadata returned from active YAML is
limited to name/type/server/port.

Connections and traffic endpoints are intentionally not implemented in
v0.3.0. Adding them requires separate bounded response models and tests; do not
describe placeholder frontend cards as live metrics.

## Opt-in live core test

The ignored Windows integration test performs the real pinned-core flow in a
temporary application-data directory: download, integrity check, install,
`-v`, sanitized `-t`, process start, authenticated `GET /version`, and exact
child stop.

It downloads and executes third-party code, so both gates are required:

```powershell
Set-Location src-tauri
$env:HORION_LIVE_CORE_TEST = "1"
cargo test --locked live_official_install_start_health_and_exact_stop -- --ignored --nocapture
Remove-Item Env:\HORION_LIVE_CORE_TEST
Set-Location ..
```

Do not add this command to an always-on hook. It does not use a user
subscription, enable TUN, change the system proxy, or generate live traffic.

## Release build

Create the configured NSIS installer with:

```powershell
npm.cmd run tauri:build
```

Before publishing v0.3.0, run the standard checks and the opt-in live test on
the release architecture. The installer does not embed Mihomo; the end user’s
separate explicit install action downloads the pinned asset.

## Changing the pinned core

A core update is a supply-chain-sensitive change. Update and review together:

- exact release tag and URL;
- architecture-specific archive name and byte size;
- archive SHA-256;
- sole expected ZIP entry and uncompressed size;
- third-party notice, source reference and GPL license text;
- unit/live expectations and user documentation.

Never replace these constants with a runtime `latest` lookup. Independently
download and hash every supported architecture before review.
