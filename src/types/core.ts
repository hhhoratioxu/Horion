export type CoreState =
  | "not_installed"
  | "stopped"
  | "downloading"
  | "installing"
  | "starting"
  | "running"
  | "stopping"
  | "crashed"
  | "error";

export interface CoreSnapshot {
  state: CoreState;
  installed: boolean;
  version: string | null;
  source: string | null;
  path: string | null;
  pid: number | null;
  healthy: boolean;
  controller_available: boolean;
  last_error: string | null;
}

export type CoreLogLevel = "trace" | "debug" | "info" | "warn" | "error";

export type CoreLogStream = "stdout" | "stderr" | "system";

export interface CoreLogEntry {
  timestamp: string;
  level: CoreLogLevel;
  stream: CoreLogStream;
  message: string;
}

export type CoreAction =
  | "install_official"
  | "import_from_path"
  | "start"
  | "stop"
  | "restart";
