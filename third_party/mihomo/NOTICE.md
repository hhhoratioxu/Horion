# Mihomo third-party notice

Horion can download and manage an unmodified Mihomo executable as a separate
process. Mihomo is not authored by Horion and is not embedded in the Horion
installer.

- Project: Mihomo
- Upstream: https://github.com/MetaCubeX/mihomo
- Pinned release: `v1.19.29`
- Pinned source commit: `e26714a181ac0e2fa803453c0a8e9a9ce94e31cb`
- Source for the pinned version:
  https://github.com/MetaCubeX/mihomo/tree/v1.19.29
- Source archive for the pinned version:
  https://github.com/MetaCubeX/mihomo/archive/refs/tags/v1.19.29.tar.gz
- License: GNU General Public License v3.0; see `LICENSE` in this directory.

Horion accepts only these Windows release archives:

| Architecture | Asset | Archive bytes | SHA-256 | Expected executable |
| --- | --- | ---: | --- | --- |
| x86_64 | `mihomo-windows-amd64-v1-v1.19.29.zip` | 17,509,589 | `4a5b4cdf76f1879043cea7488162517fd3fb95d5b7a205d89601f1942791ee39` | `mihomo-windows-amd64-v1.exe` |
| ARM64 | `mihomo-windows-arm64-v1.19.29.zip` | 15,430,938 | `f71736f9c2a17abb8909a726c69ac55279d0cb43d1d9f2c85afdbb70a0f326a3` | `mihomo-windows-arm64.exe` |

The downloaded archive is verified before extraction. Horion rejects missing
or extra ZIP entries, unexpected names, size mismatches, hash mismatches, and
executables that do not identify themselves as Mihomo. Horion does not follow
the mutable upstream default branch or automatically resolve `/latest`.
