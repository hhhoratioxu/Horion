import { describe, expect, it } from "vitest";

import type { CoreClient } from "../services/core-client";
import type { CoreSnapshot } from "../types/core";
import { createCoreStore, emptyCoreSnapshot } from "./core-store";

function createClient(overrides: Partial<CoreClient> = {}): CoreClient {
  return {
    isAvailable: () => true,
    getStatus: () => Promise.resolve(emptyCoreSnapshot),
    getLogs: () => Promise.resolve([]),
    installOfficial: () => Promise.resolve(emptyCoreSnapshot),
    importFromPath: () => Promise.resolve(emptyCoreSnapshot),
    start: () => Promise.resolve(emptyCoreSnapshot),
    stop: () => Promise.resolve(emptyCoreSnapshot),
    restart: () => Promise.resolve(emptyCoreSnapshot),
    ...overrides,
  };
}

describe("core store", () => {
  it("does not invoke native commands outside Tauri", async () => {
    let statusCalls = 0;
    let installCalls = 0;
    const store = createCoreStore(
      createClient({
        isAvailable: () => false,
        getStatus: () => {
          statusCalls += 1;
          return Promise.resolve(emptyCoreSnapshot);
        },
        installOfficial: () => {
          installCalls += 1;
          return Promise.resolve(emptyCoreSnapshot);
        },
      }),
    );

    await store.getState().refreshStatus();
    await store.getState().installOfficial();

    expect(statusCalls).toBe(0);
    expect(installCalls).toBe(0);
    expect(store.getState().runtimeAvailable).toBe(false);
    expect(store.getState().actionError).toContain("桌面应用");
  });

  it("refreshes the snapshot after a successful action", async () => {
    const installedSnapshot: CoreSnapshot = {
      ...emptyCoreSnapshot,
      state: "stopped",
      installed: true,
      version: "1.19.10",
      source: "official",
      path: "C:\\Horion\\mihomo.exe",
    };
    const store = createCoreStore(
      createClient({
        installOfficial: () => Promise.resolve(installedSnapshot),
      }),
    );

    await store.getState().installOfficial();

    expect(store.getState().snapshot).toEqual(installedSnapshot);
    expect(store.getState().pendingAction).toBeNull();
    expect(store.getState().actionError).toBeNull();
  });

  it("surfaces action errors and clears the busy state", async () => {
    const store = createCoreStore(
      createClient({
        start: () => Promise.reject(new Error("内核启动失败")),
      }),
    );

    await store.getState().start();

    expect(store.getState().actionError).toBe("内核启动失败");
    expect(store.getState().pendingAction).toBeNull();
  });

  it("validates and trims imported paths", async () => {
    let importedPath: string | null = null;
    const store = createCoreStore(
      createClient({
        importFromPath: (path) => {
          importedPath = path;
          return Promise.resolve(emptyCoreSnapshot);
        },
      }),
    );

    await store.getState().importFromPath("   ");
    expect(importedPath).toBeNull();
    expect(store.getState().actionError).toContain("完整路径");

    await store.getState().importFromPath("  C:\\Tools\\mihomo.exe  ");
    expect(importedPath).toBe("C:\\Tools\\mihomo.exe");
  });
});
