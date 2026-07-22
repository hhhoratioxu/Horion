import { create } from "zustand";

import { coreClient, getErrorMessage, type CoreClient } from "../services/core-client";
import type { CoreAction, CoreLogEntry, CoreSnapshot } from "../types/core";

export const emptyCoreSnapshot: CoreSnapshot = {
  state: "not_installed",
  installed: false,
  version: null,
  source: null,
  path: null,
  pid: null,
  healthy: false,
  controller_available: false,
  last_error: null,
};

export interface CoreStore {
  snapshot: CoreSnapshot;
  logs: CoreLogEntry[];
  runtimeAvailable: boolean;
  initialized: boolean;
  isRefreshingStatus: boolean;
  isRefreshingLogs: boolean;
  pendingAction: CoreAction | null;
  statusError: string | null;
  logsError: string | null;
  actionError: string | null;
  clearActionError: () => void;
  refreshStatus: () => Promise<void>;
  refreshLogs: () => Promise<void>;
  installOfficial: () => Promise<void>;
  importFromPath: (path: string) => Promise<void>;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  restart: () => Promise<void>;
}

const unavailableMessage = "内核管理仅可在 Horion 桌面应用中使用。";

export function createCoreStore(client: CoreClient) {
  let statusRequest: Promise<void> | null = null;
  let logsRequest: Promise<void> | null = null;

  return create<CoreStore>((set, get) => {
    const refreshStatus = (): Promise<void> => {
      if (statusRequest) {
        return statusRequest;
      }

      if (!client.isAvailable()) {
        set({
          runtimeAvailable: false,
          initialized: true,
          isRefreshingStatus: false,
          statusError: null,
        });
        return Promise.resolve();
      }

      set({ runtimeAvailable: true, isRefreshingStatus: true });
      statusRequest = client
        .getStatus()
        .then((snapshot) => {
          set({ snapshot, initialized: true, statusError: null });
        })
        .catch((error: unknown) => {
          set({ initialized: true, statusError: getErrorMessage(error) });
        })
        .finally(() => {
          statusRequest = null;
          set({ isRefreshingStatus: false });
        });

      return statusRequest;
    };

    const refreshLogs = (): Promise<void> => {
      if (logsRequest) {
        return logsRequest;
      }

      if (!client.isAvailable()) {
        set({
          runtimeAvailable: false,
          isRefreshingLogs: false,
          logsError: null,
        });
        return Promise.resolve();
      }

      set({ runtimeAvailable: true, isRefreshingLogs: true });
      logsRequest = client
        .getLogs()
        .then((logs) => {
          set({ logs, logsError: null });
        })
        .catch((error: unknown) => {
          set({ logsError: getErrorMessage(error) });
        })
        .finally(() => {
          logsRequest = null;
          set({ isRefreshingLogs: false });
        });

      return logsRequest;
    };

    const runAction = async (
      action: CoreAction,
      operation: () => Promise<CoreSnapshot>,
    ): Promise<void> => {
      if (get().pendingAction) {
        return;
      }

      if (!client.isAvailable()) {
        set({ actionError: unavailableMessage, runtimeAvailable: false });
        return;
      }

      set({ actionError: null, pendingAction: action, runtimeAvailable: true });

      try {
        const snapshot = await operation();
        set({ snapshot, initialized: true, statusError: null });
      } catch (error: unknown) {
        set({ actionError: getErrorMessage(error) });
        await refreshStatus();
      } finally {
        await refreshLogs();
        set({ pendingAction: null });
      }
    };

    return {
      snapshot: emptyCoreSnapshot,
      logs: [],
      runtimeAvailable: false,
      initialized: false,
      isRefreshingStatus: false,
      isRefreshingLogs: false,
      pendingAction: null,
      statusError: null,
      logsError: null,
      actionError: null,
      clearActionError: () => {
        set({ actionError: null });
      },
      refreshStatus,
      refreshLogs,
      installOfficial: () => runAction("install_official", client.installOfficial),
      importFromPath: (path) => {
        const normalizedPath = path.trim();
        if (!normalizedPath) {
          set({ actionError: "请输入 Mihomo 可执行文件的完整路径。" });
          return Promise.resolve();
        }
        return runAction("import_from_path", () => client.importFromPath(normalizedPath));
      },
      start: () => runAction("start", client.start),
      stop: () => runAction("stop", client.stop),
      restart: () => runAction("restart", client.restart),
    };
  });
}

export const useCoreStore = createCoreStore(coreClient);
