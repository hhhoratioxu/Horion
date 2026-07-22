# Security Policy

Horion treats process execution, downloaded binaries, local files,
subscriptions, and Controller credentials as security boundaries. Version
0.3.0 manages profiles and proxy nodes, while system proxy and TUN remain
explicitly outside the supported feature set.

## Supported versions

| Version | Security fixes |
| --- | --- |
| 0.3.x | Supported while it is the current development/release line |
| 0.2.x and earlier | No longer supported |

Horion does not yet include an in-app updater. Obtain builds and source only
from the project's GitHub repository and inspect release information before
running a new executable.

## Reporting a vulnerability

Please use a private
[GitHub Security Advisory](https://github.com/hhhoratioxu/Horion/security/advisories/new)
when possible. Include the affected version, Windows architecture, reproduction
steps, expected and observed behavior, and whether the issue can execute code,
expose credentials, escape the managed data directory, or alter network state.

Do not include secrets, subscription URLs, or personal traffic data in a public
issue. A normal bug without security impact can be reported through the public
issue tracker.

## Official Mihomo download

Mihomo is not embedded in the Horion installer. Opening Horion does not fetch a
core. Only the user's explicit official-install action makes a network request.

Horion v0.3.0 is pinned to Mihomo `v1.19.29` and does not query `latest`:

| Architecture | Archive | Exact bytes | SHA-256 |
| --- | --- | ---: | --- |
| Windows x86_64 | `mihomo-windows-amd64-v1-v1.19.29.zip` | 17,509,589 | `4a5b4cdf76f1879043cea7488162517fd3fb95d5b7a205d89601f1942791ee39` |
| Windows ARM64 | `mihomo-windows-arm64-v1.19.29.zip` | 15,430,938 | `f71736f9c2a17abb8909a726c69ac55279d0cb43d1d9f2c85afdbb70a0f326a3` |

The downloader requires HTTPS, restricts redirects to an allowlist of GitHub
release-asset hosts, enforces timeouts and exact byte limits, and verifies the
streamed SHA-256. Extraction accepts exactly one pinned, enclosed, non-symlink
ZIP entry with an exact uncompressed size. The executable must then complete
`-v` within ten seconds and report the pinned Mihomo version.

These checks ensure the downloaded bytes match the values reviewed and embedded
in Horion. They are not a Windows Authenticode verification and should not be
described as one. Updating a pin requires independent review of the release,
asset sizes, hashes, ZIP entries, source reference, and license notice.

## Local import warning

Importing a local core is an explicit code-execution action. Horion copies the
selected file into a staging directory and runs that copy with `-v` to identify
it before installation. A malicious executable can imitate the expected output
while doing something harmful.

Only import a Mihomo executable from a source you trust. File-extension, size,
output-format, and calculated-hash checks do not establish publisher identity.
Prefer the pinned official install when provenance is uncertain.

## Managed files and path safety

Core files live under Tauri's application data directory, normally
`%APPDATA%\io.horion.desktop\core\` on Windows. Installs are staged before an
atomic directory/manifest commit. Manifest executable paths must be relative,
cannot contain parent traversal, and must resolve inside the managed core root.
Horion rehashes the managed executable when loading the manifest and again
before every start, and refuses to run it after an integrity mismatch.

This protects Horion's path boundary; it does not protect the application data
directory from another process already running with the same user's authority.

## Runtime isolation and Controller secret

For every start, Horion:

- allocates an IPv4 loopback Controller address with an ephemeral port;
- creates a fresh 32-byte random secret;
- parses the active YAML, expands merge keys, removes unmanaged Controller,
  UI, CORS, TUN, inbound-server, tunnel, and DNS-listener settings;
- forces ordinary proxy listeners to IPv4 loopback and injects a restrictive
  Controller CORS policy;
- removes inherited `CLASH_*` overrides, lifecycle hooks, and `SAFE_PATHS`
  from the child environment;
- passes the resulting configuration through stdin rather than a runtime
  configuration file;
- first runs `mihomo -t` against that same in-memory configuration;
- launches the managed executable only if the preflight succeeds;
- authenticates `GET /version` with the secret and checks the installed version;
- keeps the secret in the Rust backend and redacts it from captured output; and
- stops only the exact child handle that Horion owns.

The Controller is not exposed on a LAN address. Its HTTP endpoint is acceptable
only because it is loopback-only and authenticated with a per-start secret;
future code must not expose the address or secret to arbitrary frontend content.
The health client bypasses configured system proxies.

The application does not need administrator privileges for this lifecycle.
Version 0.3.0 does not alter the Windows proxy or install a privileged TUN
helper. A profile cannot silently enable TUN or expose an unmanaged inbound
listener; those capabilities require a future, explicit security design.

## Profiles and subscriptions

Managed profiles live below `%APPDATA%\io.horion.desktop\profiles\`. Horion
requires a UTF-8 YAML mapping no larger than 8 MiB, validates it with the
installed Mihomo executable, uses atomic writes, and retains at most ten
pre-change backups. Activating or reapplying a profile uses stop/start of the
exact owned child. If the new configuration cannot start, Horion restores the
previous content, revision, active profile, and—where possible—the previous
running core.

Subscription downloads require HTTPS, reject URL user information and
fragments, restrict redirects to HTTPS, enforce connection/total timeouts,
bound streamed response bytes, and retry only transient failures. The complete
subscription URL may contain a bearer token, so it is stored in Windows
Credential Manager. Profile metadata and frontend responses contain only the
hostname and a generated credential key.

Adding a subscription is an explicit network authorization by the user. HTTPS
does not make a profile trustworthy: the remote YAML can still describe proxy
servers, rules, and providers. Horion removes local control-plane and inbound
surfaces before execution, but users should add only providers they trust.

Profile YAML is available to the WebView only when the user explicitly opens
the editor. It is not written to localStorage. Revision checks reject stale
editor saves rather than silently overwriting a newer managed version.

## Node Controller access

The frontend cannot supply a Controller address, secret, delay-test URL, or
arbitrary API path. Rust constructs URLs from the current private loopback
runtime, encodes proxy names as individual path segments, adds the Bearer
secret, validates requested names against a fresh proxy overview, and bounds
all response bodies. Delay tests use a fixed HTTPS 204 endpoint and a bounded
timeout. Complete Controller objects are converted to a narrow Horion model;
credentials and provider configuration are not returned to the WebView.

## Logs and sensitive data

Core logs are held in memory, capped at 1,000 entries, and lost when Horion
exits. Individual process-output lines are capped at 16 KiB. The generated
Controller secret is replaced with `[REDACTED]` before an entry reaches the UI.

Controller secrets and URL-shaped values are redacted from captured core and
validation output. Subscription errors report only the hostname and a bounded,
sanitized reason. Do not paste subscription URLs, profile credentials, local
paths, traffic data, or unreviewed logs into screenshots or public issues.
Redaction remains defense in depth and must not be treated as a general-purpose
credential scanner.

## Network and privacy boundary

Horion contains no advertising, analytics, or telemetry. An official core
install contacts GitHub's release infrastructure. Adding or updating a
subscription contacts the hostname shown in that profile; delay tests ask the
selected Mihomo proxy to reach a fixed public HTTPS 204 endpoint. These services
necessarily receive ordinary connection metadata. Horion does not modify the
Windows system proxy or enable TUN.

## Future security requirements

Controller traffic metrics, system proxy, TUN, privileged helpers, tray
controls, and update delivery remain outside the current implementation. Adding
any of them requires a separate threat review, narrow Rust command interfaces,
strict validation, rollback behavior, and tests that demonstrate the resulting
system and network state.
