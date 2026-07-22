# Development

## Windows prerequisites

Install Node.js 24 LTS, Rust stable with the MSVC host, Microsoft C++ Build
Tools (Desktop development with C++), and WebView2. Restart the terminal after
installing toolchains so their PATH updates are visible.

The npm Tauri scripts detect a standard Visual Studio toolchain first. The
phase-one verification machine also has a hash-verified, user-local MSVC fallback;
it is a development-only adapter and is never included in Horion builds.

## Install

```powershell
git clone https://github.com/hhhoratioxu/Horion.git
cd Horion
npm.cmd install
```

## Run

Run the desktop application:

```powershell
npm.cmd run tauri:dev
```

Run only the web frontend:

```powershell
npm.cmd run dev
```

The frontend development server listens on `http://127.0.0.1:1420`.

## Verify

```powershell
npm.cmd run lint
npm.cmd test
npm.cmd run build
cd src-tauri
cargo fmt --check
cargo clippy --all-targets --all-features -- -D warnings
cargo test --locked
cd ..
npm.cmd run tauri:build -- --debug --no-bundle
```

The last command compiles the complete Tauri application without creating an
installer. The direct `cargo` commands expect the standard Visual Studio C++
toolchain. On the phase-one verification machine, the npm Tauri scripts inject
the user-local fallback automatically; other machines should install the normal
prerequisite. Release installers belong to the release phase.
