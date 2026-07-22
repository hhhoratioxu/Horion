# Third-Party Notices

Horion does not modify or claim authorship of Mihomo. Mihomo is not bundled in
phase 1. Before a later phase downloads it, its exact release version, license,
official source, and integrity metadata will be recorded here.

The following direct phase-one dependencies retain their own licenses and
copyright notices. Versions are locked in `package.json` and `Cargo.toml`.

| Component | Version | License | Project |
| --- | ---: | --- | --- |
| React / React DOM | 19.2.8 | MIT | https://github.com/facebook/react |
| React Router | 7.18.1 | MIT | https://github.com/remix-run/react-router |
| Zustand | 5.0.14 | MIT | https://github.com/pmndrs/zustand |
| Lucide React | 1.25.0 | ISC | https://github.com/lucide-icons/lucide |
| Tauri JavaScript API | 2.11.1 | Apache-2.0 OR MIT | https://github.com/tauri-apps/tauri |
| Tauri CLI | 2.11.4 | Apache-2.0 OR MIT | https://github.com/tauri-apps/tauri |
| Tauri Rust crate | 2.11.5 | Apache-2.0 OR MIT | https://github.com/tauri-apps/tauri |
| Tauri Build | 2.6.3 | Apache-2.0 OR MIT | https://github.com/tauri-apps/tauri |
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

Transitive dependency notices will be generated and audited before the first
distributed build. This file is informational and does not replace the license
texts supplied by each dependency.

## Local verification tools (not distributed)

The phase-one workstation used xwin 0.9.0 (Apache-2.0 OR MIT), LLVM-MinGW
20260616 (LLVM/Apache-2.0 with LLVM exceptions and bundled component licenses),
and WinLibs 16.1.0-14.0.0-r3 (multiple upstream licenses) to verify Windows
builds without running the application as administrator. These tools and the
Microsoft CRT/Windows SDK files they download are not application dependencies
and are not bundled with Horion.
