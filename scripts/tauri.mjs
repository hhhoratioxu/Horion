import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { delimiter, dirname, join, resolve } from "node:path";
import process from "node:process";

const MSVC_COMPONENT = "Microsoft.VisualStudio.Component.VC.Tools.x86.x64";
const MSVC_TARGET = "x86_64-pc-windows-msvc";

function addUserToolPaths(environment) {
  const candidates = [
    dirname(process.execPath),
    environment.USERPROFILE ? join(environment.USERPROFILE, ".cargo", "bin") : undefined,
  ].filter((path) => path && existsSync(path));

  environment.PATH = [...candidates, environment.PATH ?? ""].join(delimiter);
}

function hasNativeMsvc(environment) {
  if (environment.VSINSTALLDIR) {
    return true;
  }

  const linkLookup = spawnSync("where.exe", ["link.exe"], {
    env: environment,
    stdio: "ignore",
  });
  if (linkLookup.status === 0) {
    return true;
  }

  const vswhere = join(
    environment["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)",
    "Microsoft Visual Studio",
    "Installer",
    "vswhere.exe",
  );

  if (!existsSync(vswhere)) {
    return false;
  }

  const result = spawnSync(
    vswhere,
    ["-latest", "-products", "*", "-requires", MSVC_COMPONENT, "-property", "installationPath"],
    { encoding: "utf8", env: environment },
  );

  return result.status === 0 && result.stdout.trim().length > 0;
}

function findDirectory(parent, predicate) {
  if (!existsSync(parent)) {
    return undefined;
  }

  const match = readdirSync(parent, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && predicate(entry.name))
    .sort((left, right) => left.name.localeCompare(right.name))
    .at(-1);

  return match ? join(parent, match.name) : undefined;
}

function configurePortableMsvc(environment) {
  const localAppData = environment.LOCALAPPDATA;
  if (!localAppData) {
    return false;
  }

  const buildRoot = join(localAppData, "HorionBuild");
  const sdkRoot = join(buildRoot, "xwin-sdk", "sdk");
  const crtRoot = join(buildRoot, "xwin-sdk", "crt");
  const toolsRoot = join(buildRoot, "msvc-tools");
  const packagesRoot = join(localAppData, "Microsoft", "WinGet", "Packages");
  const llvmPackage = findDirectory(packagesRoot, (name) =>
    name.startsWith("MartinStorsjo.LLVM-MinGW.UCRT_"),
  );
  const llvmRoot = llvmPackage
    ? findDirectory(
        llvmPackage,
        (name) => name.startsWith("llvm-mingw-") && name.endsWith("-ucrt-x86_64"),
      )
    : undefined;
  const llvmBin = llvmRoot ? join(llvmRoot, "bin") : undefined;

  const requiredPaths = [
    join(crtRoot, "lib", "x86_64"),
    join(sdkRoot, "lib", "ucrt", "x86_64"),
    join(sdkRoot, "lib", "um", "x86_64"),
    join(toolsRoot, "lld-link.exe"),
    join(toolsRoot, "llvm-rc.exe"),
    llvmBin ? join(llvmBin, "clang.exe") : "",
  ];

  if (!llvmBin || requiredPaths.some((path) => !path || !existsSync(path))) {
    return false;
  }

  environment.PATH = [toolsRoot, llvmBin, environment.PATH ?? ""].join(delimiter);
  environment.LIB = [
    join(crtRoot, "lib", "x86_64"),
    join(sdkRoot, "lib", "ucrt", "x86_64"),
    join(sdkRoot, "lib", "um", "x86_64"),
  ].join(delimiter);
  environment.INCLUDE = [
    join(crtRoot, "include"),
    join(sdkRoot, "include", "ucrt"),
    join(sdkRoot, "include", "um"),
    join(sdkRoot, "include", "shared"),
    join(sdkRoot, "include", "winrt"),
    join(sdkRoot, "include", "cppwinrt"),
  ].join(delimiter);
  environment.RC = join(toolsRoot, "llvm-rc.exe");
  environment.CARGO_TARGET_X86_64_PC_WINDOWS_MSVC_LINKER = join(
    toolsRoot,
    "lld-link.exe",
  );

  const compiler = `${join(llvmBin, "clang.exe")} --driver-mode=cl --target=${MSVC_TARGET}`;
  environment.CC_x86_64_pc_windows_msvc = compiler;
  environment.CXX_x86_64_pc_windows_msvc = compiler;
  environment.HOST_CXX = compiler;
  environment.CXX = compiler;
  environment.AR_x86_64_pc_windows_msvc = join(toolsRoot, "llvm-lib.exe");
  environment.CARGO_TARGET_DIR ??= join(buildRoot, "msvc-target");
  environment.RUSTUP_TOOLCHAIN ??= `stable-${MSVC_TARGET}`;
  environment.RUSTFLAGS = [environment.RUSTFLAGS, "-C link-arg=/ignore:4099"]
    .filter(Boolean)
    .join(" ");

  return true;
}

const args = process.argv.slice(2);
const environment = { ...process.env };
addUserToolPaths(environment);

if (process.platform === "win32" && !hasNativeMsvc(environment)) {
  if (!configurePortableMsvc(environment)) {
    process.stderr.write(
      "Horion cannot find Microsoft C++ Build Tools. Install the 'Desktop development with C++' workload, restart the terminal, and retry.\n",
    );
    process.exit(1);
  }

  if ((args[0] === "dev" || args[0] === "build") && !args.includes("--target")) {
    args.push("--target", MSVC_TARGET);
  }
}

const tauriCli = resolve("node_modules", "@tauri-apps", "cli", "tauri.js");
const result = spawnSync(process.execPath, [tauriCli, ...args], {
  env: environment,
  stdio: "inherit",
});

if (result.error) {
  process.stderr.write(`Unable to start the Tauri CLI: ${result.error.message}\n`);
  process.exit(1);
}

process.exit(result.status ?? 1);
