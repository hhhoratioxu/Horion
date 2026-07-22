# Horion

Horion is a security-first Windows desktop control plane for the
[Mihomo](https://github.com/MetaCubeX/mihomo) proxy core. It is built with
Tauri 2, Rust, React, TypeScript, Vite, and Tailwind CSS.

> Current version: **v0.2.0 — real core lifecycle integration**. Horion can
> install or import Mihomo and can start, stop, restart, health-check, and show
> logs for that process. Profiles, subscriptions, proxy nodes, system proxy,
> TUN, and Controller metrics are not connected yet. **A running core does not
> mean Windows traffic is being proxied.**

## What v0.2.0 implements

- Explicit, user-triggered download of a pinned official Mihomo release
- Local Mihomo executable import, copied into Horion's managed data directory
- Install-time file-size, SHA-256, ZIP-entry, and `mihomo -v` validation
- Start, stop, and restart of the exact child process owned by Horion
- A loopback-only Controller on a random port with a fresh random secret
- Authenticated `GET /version` health checks and version matching
- Bounded in-memory capture of stdout, stderr, and lifecycle logs
- Core lifecycle states and actionable errors in the desktop UI
- Single-instance behavior that focuses the existing window
- Dark, light, and system themes with responsive desktop navigation

## Deliberate limitations

v0.2.0 starts Mihomo with a minimal direct-mode runtime configuration. It does
not install a profile, expose a local proxy listener, configure Windows proxy
settings, or enable TUN. The following features remain unimplemented:

- Subscription and profile management
- Proxy-node and policy-group selection
- System proxy and TUN control
- Controller traffic, connection, and rule metrics
- Tray controls and application/core update workflows

The UI labels these areas as not connected or under development. Horion does
not claim protocol support independently of the installed Mihomo executable.

## Pinned official core

Horion v0.2.0 never resolves a mutable `latest` release. An official install
uses Mihomo `v1.19.29` and chooses one of the following assets at compile time:

| Architecture | Official asset | Archive bytes | SHA-256 |
| --- | --- | ---: | --- |
| Windows x86_64 | `mihomo-windows-amd64-v1-v1.19.29.zip` | 17,509,589 | `4a5b4cdf76f1879043cea7488162517fd3fb95d5b7a205d89601f1942791ee39` |
| Windows ARM64 | `mihomo-windows-arm64-v1.19.29.zip` | 15,430,938 | `f71736f9c2a17abb8909a726c69ac55279d0cb43d1d9f2c85afdbb70a0f326a3` |

No network request is made merely by opening Horion. The official archive is
downloaded only after the user selects **Install official core**. Horion checks
the exact downloaded size and SHA-256, requires one allowlisted ZIP entry with
the pinned uncompressed size, and runs the extracted executable with `-v`
before committing it to the managed core directory.

See [`docs/core-management.md`](docs/core-management.md) for the complete trust
and lifecycle model. Mihomo is a separate GPL-3.0 third-party project and is not
embedded in the Horion installer; see
[`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).

## Requirements

- Windows 10 or Windows 11
- Microsoft Edge WebView2 Runtime
- For source development: Node.js 24 LTS, Rust stable (MSVC host), and Microsoft
  C++ Build Tools with the Desktop development with C++ workload

## Run from source

```powershell
npm.cmd install
npm.cmd run tauri:dev
```

Using `npm.cmd` avoids PowerShell execution-policy conflicts. Frontend-only
development is available with `npm.cmd run dev`, but core commands require the
Tauri desktop runtime. Build and test instructions, including the opt-in live
Mihomo test, are in [`docs/development.md`](docs/development.md).

## Data and privacy

Managed core files are stored below Tauri's application data directory. On a
normal Windows installation this is `%APPDATA%\io.horion.desktop\core\`. The
Controller secret is generated for each start, sent to Mihomo through stdin,
kept out of frontend state, and redacted from captured process output.

Horion contains no advertising, analytics, or telemetry. An official core
install necessarily contacts GitHub's release infrastructure, and a locally
imported executable is executed with `-v` during validation. Import only a
Mihomo executable you trust. See [`SECURITY.md`](SECURITY.md) for details.

## License

Horion is licensed under the MIT License. Third-party components retain their
own licenses. Mihomo `v1.19.29` is managed as a separate process under
GPL-3.0; its pinned source and license are recorded in
[`third_party/mihomo/NOTICE.md`](third_party/mihomo/NOTICE.md).
