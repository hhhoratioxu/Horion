import { beforeEach, describe, expect, it, vi } from "vitest";

const { invokeMock, isTauriMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  isTauriMock: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: invokeMock,
  isTauri: isTauriMock,
}));

import { coreClient, getErrorMessage } from "./core-client";

describe("core client", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    invokeMock.mockResolvedValue(undefined);
    isTauriMock.mockReset();
  });

  it("uses the fixed Tauri command contract", async () => {
    await coreClient.getStatus();
    await coreClient.installOfficial();
    await coreClient.importFromPath("C:\\Tools\\mihomo.exe");
    await coreClient.start();
    await coreClient.stop();
    await coreClient.restart();
    await coreClient.getLogs();

    expect(invokeMock).toHaveBeenNthCalledWith(1, "core_get_status");
    expect(invokeMock).toHaveBeenNthCalledWith(2, "core_install_official");
    expect(invokeMock).toHaveBeenNthCalledWith(3, "core_import_from_path", {
      path: "C:\\Tools\\mihomo.exe",
    });
    expect(invokeMock).toHaveBeenNthCalledWith(4, "core_start");
    expect(invokeMock).toHaveBeenNthCalledWith(5, "core_stop");
    expect(invokeMock).toHaveBeenNthCalledWith(6, "core_restart");
    expect(invokeMock).toHaveBeenNthCalledWith(7, "core_get_logs");
  });

  it("normalizes native errors for the interface", () => {
    expect(getErrorMessage(new Error("boom"))).toBe("boom");
    expect(getErrorMessage({ message: "后端错误" })).toBe("后端错误");
    expect(getErrorMessage(null)).toContain("内核操作失败");
  });
});
