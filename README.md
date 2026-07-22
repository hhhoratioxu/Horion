# Horion

Horion is a security-first Windows desktop control plane for the
[Mihomo](https://github.com/MetaCubeX/mihomo) proxy core. It is built with
Tauri 2, Rust, React, TypeScript, Vite, and Tailwind CSS.

> Current version: **v0.3.0 — profiles, subscriptions, and proxy nodes**.
> Horion can manage Mihomo, import local YAML, update HTTPS subscriptions,
> switch policy groups, select nodes, run delay tests, and change the current
> proxy mode. **System proxy and TUN are not connected yet, so a running core
> does not automatically route Windows traffic.**

## What v0.3.0 implements

- Pinned official Mihomo installation or trusted local executable import
- Exact child-process start, stop, restart, health checks, cleanup, and bounded logs
- Local `.yaml` / `.yml` import by absolute path or desktop drag-and-drop
- HTTPS subscriptions whose complete URLs are stored only in Windows Credential Manager
- Rename, duplicate, delete, and revision-protected YAML editing
- Atomic writes and up to ten backups per managed profile
- Real `mihomo -t` validation before activation, with content and runtime rollback
- Real Controller nodes and policy groups with search, protocol filters, delay sorting,
  and at most four concurrent single-node tests
- Selector changes and rule/global/direct runtime mode switching
- A redesigned light/dark desktop UI with explicit loading, empty, offline, and error states

## Quick start

1. Download the latest `Horion_*_x64-setup.exe` from
   [GitHub Releases](https://github.com/hhhoratioxu/Horion/releases).
2. Install the verified official Mihomo core from the dashboard.
3. Import a local YAML profile or add a trusted HTTPS subscription.
4. Activate the profile and start the core.
5. Test nodes and choose a policy-group target from the Proxies pages.

This personal project is not Authenticode-signed, so Windows SmartScreen may
warn on first launch. Download only from this repository and compare the
installer SHA-256 with the value on the Release page.

## Deliberate limitations

v0.3.0 can use local HTTP, SOCKS, and Mixed ports from the active profile, but
forces those listeners to loopback. It does not yet provide:

- Windows system-proxy changes
- TUN, custom inbound servers, or LAN sharing
- Live traffic, connection, rule, or memory metrics
- Tray controls or automatic app/core updates

Before execution, Horion removes TUN, custom listeners/tunnels, DNS listeners,
TUIC/SS/VMess server settings, external Controllers, Web UI, and user CORS
settings from managed profiles. They cannot override Horion's authenticated
loopback Controller.

## Pinned official core

Horion v0.3.0 never resolves a mutable `latest` release. Official installation
uses Mihomo `v1.19.29`:

| Architecture | Official asset | Archive bytes | SHA-256 |
| --- | --- | ---: | --- |
| Windows x86_64 | `mihomo-windows-amd64-v1-v1.19.29.zip` | 17,509,589 | `4a5b4cdf76f1879043cea7488162517fd3fb95d5b7a205d89601f1942791ee39` |
| Windows ARM64 | `mihomo-windows-arm64-v1.19.29.zip` | 15,430,938 | `f71736f9c2a17abb8909a726c69ac55279d0cb43d1d9f2c85afdbb70a0f326a3` |

The network request happens only after the user selects the official-install
action. Horion verifies exact size, SHA-256, the allowlisted ZIP entry, and
`mihomo -v` before committing the executable. Mihomo remains a separate
GPL-3.0 project and is not embedded in the Horion installer; see
[`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).

## Run from source

Requirements are Windows 10/11, WebView2, Node.js 24 LTS, Rust stable with the
MSVC host, and Microsoft C++ Build Tools with Desktop development with C++.

```powershell
npm.cmd install
npm.cmd run tauri:dev
```

`npm.cmd run dev` is a browser-only preview and cannot access the local core,
profiles, or Controller. See [`docs/development.md`](docs/development.md) for
the full verification and release flow.

## Data and privacy

A normal Windows installation stores data below `%APPDATA%\io.horion.desktop\`:

- `core\` contains the managed Mihomo executable and runtime data.
- `profiles\` contains managed YAML, metadata, and up to ten backups.
- Windows Credential Manager stores complete subscription URLs, which may contain tokens.

Each start receives a fresh Controller secret that stays in Rust and is sent to
Mihomo through stdin. Complete subscription URLs, profile content, and the
secret are not put in browser localStorage or ordinary UI logs. Horion contains
no advertising, analytics, or telemetry. See [`SECURITY.md`](SECURITY.md).

## License

Horion is licensed under the MIT License. Third-party components retain their
own licenses. Mihomo `v1.19.29` runs as a separate GPL-3.0 process; its pinned
source and license are recorded in
[`third_party/mihomo/NOTICE.md`](third_party/mihomo/NOTICE.md).
