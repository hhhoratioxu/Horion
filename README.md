# Horion

Horion is an in-progress, security-first desktop control plane for the official
[Mihomo](https://github.com/MetaCubeX/mihomo) executable. The application uses
Tauri 2, Rust, React, TypeScript, Vite, and Tailwind CSS.

> Current status: **Phase 1 — desktop application shell**. Routing, navigation,
> responsive layout, and dark/light/system themes are implemented. Mihomo is not
> downloaded, started, or controlled yet, and Horion does not currently modify
> system proxy or TUN settings.

## Screenshot

An application screenshot will be added after the phase-one UI is validated on
Windows at multiple DPI settings.

## Implemented in phase 1

- Tauri 2 project configured for Windows 10 and Windows 11
- Strict React and TypeScript frontend built with Vite
- Tailwind CSS 4 semantic theme tokens
- Hash-based desktop routing and six primary sections
- Dark, light, and system theme preferences
- Responsive sidebar and runtime status header
- Honest offline/development states for unimplemented features
- Frontend lint, tests, and production build scripts

## Not implemented yet

Mihomo installation and lifecycle management, Controller API integration,
profiles and subscriptions, system proxy, TUN, tray integration, and release
updating belong to later verified phases. No protocol support is claimed until
the installed Mihomo version reports it.

## Prerequisites

- Windows 10 or Windows 11
- Node.js 24 LTS with npm
- Rust stable using the MSVC toolchain
- Microsoft C++ Build Tools with the “Desktop development with C++” workload
- Microsoft Edge WebView2 Runtime

See [`docs/development.md`](docs/development.md) for setup and commands.

## Run

```powershell
npm.cmd install
npm.cmd run tauri:dev
```

Using `npm.cmd` avoids PowerShell execution-policy conflicts on Windows; `npm`
is equivalent in shells where it is already enabled. Frontend-only development
is available with `npm.cmd run dev`. Run the complete
verification suite with the commands documented in
[`docs/development.md`](docs/development.md).

## Mihomo

Mihomo is a separate third-party project and is not authored by Horion. A later
phase will download only official release artifacts, verify their integrity,
and detect capabilities from the installed version before exposing them in the
UI.

## Privacy

Horion has no advertising, analytics, or telemetry. Phase 1 performs no proxy
configuration and sends no application data. Future network operations and
sensitive-storage behavior are governed by the security design in
[`docs/architecture.md`](docs/architecture.md).

## License

Horion is licensed under the MIT License. It was selected for its simple,
permissive terms while preserving copyright and license notices. Third-party
components remain under their own licenses; see
[`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).

## Known limitations

- The Mihomo core and Controller API are not integrated in phase 1.
- System proxy, TUN, subscriptions, tray controls, and installers are not yet available.
- Windows ARM64 is an architectural target but is not built in phase 1.
