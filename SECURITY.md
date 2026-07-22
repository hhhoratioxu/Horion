# Security Policy

Horion treats process execution, downloaded binaries, local file paths, and
Controller credentials as security boundaries. Version 0.2.0 manages a real
Mihomo child process but intentionally does not manage subscriptions, system
proxy settings, or TUN.

## Supported versions

| Version | Security fixes |
| --- | --- |
| 0.2.x | Supported while it is the current development/release line |
| 0.1.x | No longer supported |

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

Horion v0.2.0 is pinned to Mihomo `v1.19.29` and does not query `latest`:

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
- passes the minimal configuration through stdin rather than a configuration
  file;
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
Version 0.2.0 does not alter the Windows proxy or install a privileged TUN
helper.

## Logs and sensitive data

Core logs are held in memory, capped at 1,000 entries, and lost when Horion
exits. Individual process-output lines are capped at 16 KiB. The generated
Controller secret is replaced with `[REDACTED]` before an entry reaches the UI.

No subscription or profile handling exists yet, so Horion should never receive
those credentials in normal v0.2.0 operation. Do not paste secrets into local
paths, test output, screenshots, public issues, or future diagnostic bundles.
Secret redaction is narrowly scoped and must not be treated as a general-purpose
credential scrubber.

## Network and privacy boundary

Horion contains no advertising, analytics, or telemetry. The explicit official
install contacts GitHub's release infrastructure, which necessarily receives
ordinary connection metadata such as the client IP address. Starting the
minimal core is not equivalent to enabling a proxy, and v0.2.0 does not import
subscriptions, select nodes, expose proxy listeners, modify system proxy state,
or enable TUN.

## Future security requirements

Subscriptions, profiles, Controller metrics, system proxy, TUN, privileged
helpers, and update delivery are outside the current implementation. Adding any
of them requires a separate threat review, narrow Rust command interfaces,
strict input and path validation, secret storage decisions, rollback behavior,
and tests that demonstrate the resulting system/network state.
