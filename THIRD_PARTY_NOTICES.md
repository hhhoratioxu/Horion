# Third-Party Notices

Horion does not modify or claim authorship of Mihomo. Mihomo is not embedded in
the Horion installer. At the user's request, Horion can download the pinned
official `v1.19.29` executable and manage it as a separate process. Its exact
source commit, accepted assets, sizes, hashes, GPLv3 license, and source link are
recorded in [`third_party/mihomo/NOTICE.md`](third_party/mihomo/NOTICE.md).

The following direct application dependencies retain their own licenses and
copyright notices. Versions are locked in `package.json` and `Cargo.toml`.

| Component | Version | License | Project |
| --- | ---: | --- | --- |
| Mihomo executable | 1.19.29 | GPL-3.0 | https://github.com/MetaCubeX/mihomo/tree/v1.19.29 |
| React / React DOM | 19.2.8 | MIT | https://github.com/facebook/react |
| React Router | 7.18.1 | MIT | https://github.com/remix-run/react-router |
| Zustand | 5.0.14 | MIT | https://github.com/pmndrs/zustand |
| Lucide React | 1.25.0 | ISC | https://github.com/lucide-icons/lucide |
| Tauri JavaScript API | 2.11.1 | Apache-2.0 OR MIT | https://github.com/tauri-apps/tauri |
| Tauri CLI | 2.11.4 | Apache-2.0 OR MIT | https://github.com/tauri-apps/tauri |
| Tauri Rust crate | 2.11.5 | Apache-2.0 OR MIT | https://github.com/tauri-apps/tauri |
| Tauri Build | 2.6.3 | Apache-2.0 OR MIT | https://github.com/tauri-apps/tauri |
| Tauri single-instance plugin | 2.4.3 | Apache-2.0 OR MIT | https://github.com/tauri-apps/plugins-workspace |
| atomic-write-file | 0.3.0 | BSD-3-Clause | https://github.com/andreacorbellini/rust-atomic-write-file |
| Chrono | 0.4.45 | MIT OR Apache-2.0 | https://github.com/chronotope/chrono |
| Rand | 0.9.2 | MIT OR Apache-2.0 | https://github.com/rust-random/rand |
| Reqwest | 0.13.4 | MIT OR Apache-2.0 | https://github.com/seanmonstar/reqwest |
| Serde | 1.0.229 | MIT OR Apache-2.0 | https://github.com/serde-rs/serde |
| serde_json | 1.0.151 | MIT OR Apache-2.0 | https://github.com/serde-rs/json |
| SHA-2 | 0.10.9 | MIT OR Apache-2.0 | https://github.com/RustCrypto/hashes |
| tempfile | 3.23.0 | MIT OR Apache-2.0 | https://github.com/Stebalien/tempfile |
| thiserror | 2.0.19 | MIT OR Apache-2.0 | https://github.com/dtolnay/thiserror |
| Tokio | 1.53.1 | MIT | https://github.com/tokio-rs/tokio |
| zeroize | 1.9.0 | Apache-2.0 OR MIT | https://github.com/RustCrypto/utils |
| zip | 2.4.2 | MIT | https://github.com/zip-rs/zip2 |
| Tailwind CSS | 4.3.3 | MIT | https://github.com/tailwindlabs/tailwindcss |
| Tailwind Vite plugin | 4.3.3 | MIT | https://github.com/tailwindlabs/tailwindcss |
| Vite | 8.1.5 | MIT | https://github.com/vitejs/vite |
| Vite React plugin | 6.0.4 | MIT | https://github.com/vitejs/vite-plugin-react |
| TypeScript | 6.0.3 | Apache-2.0 | https://github.com/microsoft/TypeScript |
| typescript-eslint | 8.65.0 | MIT | https://github.com/typescript-eslint/typescript-eslint |
| Vitest | 4.1.10 | MIT | https://github.com/vitest-dev/vitest |
| ESLint | 10.7.0 | MIT | https://github.com/eslint/eslint |
| ESLint JavaScript config | 10.0.1 | MIT | https://github.com/eslint/eslint |
| ESLint React Hooks plugin | 7.1.1 | MIT | https://github.com/facebook/react |
| ESLint React Refresh plugin | 0.5.3 | MIT | https://github.com/ArnaudBarre/eslint-plugin-react-refresh |
| Testing Library jest-dom | 7.0.0 | MIT | https://github.com/testing-library/jest-dom |
| Testing Library React | 16.3.2 | MIT | https://github.com/testing-library/react-testing-library |
| jsdom | 29.1.1 | MIT | https://github.com/jsdom/jsdom |
| Node.js type definitions | 24.10.9 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped |
| React type definitions | 19.2.14 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped |
| React DOM type definitions | 19.2.3 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped |

This summary is informational and does not replace the copyright and license
texts supplied by each dependency or included with distributed artifacts.

## Local verification tools (not distributed)

The Windows verification workstation used xwin 0.9.0 (Apache-2.0 OR MIT), LLVM-MinGW
20260616 (LLVM/Apache-2.0 with LLVM exceptions and bundled component licenses),
and WinLibs 16.1.0-14.0.0-r3 (multiple upstream licenses) to verify Windows
builds without running the application as administrator. These tools and the
Microsoft CRT/Windows SDK files they download are not application dependencies
and are not bundled with Horion.
