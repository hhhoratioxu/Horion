import { invoke, isTauri } from "@tauri-apps/api/core";

import type { CoreLogEntry, CoreSnapshot } from "../types/core";

export interface CoreClient {
  isAvailable: () => boolean;
  getStatus: () => Promise<CoreSnapshot>;
  getLogs: () => Promise<CoreLogEntry[]>;
  installOfficial: () => Promise<CoreSnapshot>;
  importFromPath: (path: string) => Promise<CoreSnapshot>;
  start: () => Promise<CoreSnapshot>;
  stop: () => Promise<CoreSnapshot>;
  restart: () => Promise<CoreSnapshot>;
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (typeof error === "string" && error.trim()) {
    return error;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string" &&
    error.message.trim()
  ) {
    return error.message;
  }

  return "内核操作失败，请查看日志后重试。";
}

export const coreClient: CoreClient = {
  isAvailable: isTauri,
  getStatus: () => invoke<CoreSnapshot>("core_get_status"),
  getLogs: () => invoke<CoreLogEntry[]>("core_get_logs"),
  installOfficial: () => invoke<CoreSnapshot>("core_install_official"),
  importFromPath: (path) =>
    invoke<CoreSnapshot>("core_import_from_path", {
      path,
    }),
  start: () => invoke<CoreSnapshot>("core_start"),
  stop: () => invoke<CoreSnapshot>("core_stop"),
  restart: () => invoke<CoreSnapshot>("core_restart"),
};
