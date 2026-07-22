import { beforeEach, describe, expect, it, vi } from "vitest";

const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock, isTauri: () => true }));

import { profileClient } from "./profile-client";
import { proxyClient } from "./proxy-client";

describe("management IPC clients", () => {
  beforeEach(() => invokeMock.mockReset().mockResolvedValue(undefined));

  it("uses proxy command names and camel-case payload fields", async () => {
    await proxyClient.getOverview();
    await proxyClient.select("AUTO", "Node A");
    await proxyClient.testDelay("Node A", 5000);
    await proxyClient.setMode("rule");
    expect(invokeMock).toHaveBeenNthCalledWith(1, "proxy_get_overview");
    expect(invokeMock).toHaveBeenNthCalledWith(2, "proxy_select", { group: "AUTO", name: "Node A" });
    expect(invokeMock).toHaveBeenNthCalledWith(3, "proxy_test_delay", { name: "Node A", timeoutMs: 5000 });
    expect(invokeMock).toHaveBeenNthCalledWith(4, "proxy_set_mode", { mode: "rule" });
  });

  it("never renames subscription or revision parameters", async () => {
    await profileClient.addSubscription("main", "https://example.test/sub", "Horion");
    await profileClient.saveContent("p1", "mode: rule", 7);
    expect(invokeMock).toHaveBeenNthCalledWith(1, "profile_add_subscription", {
      name: "main",
      url: "https://example.test/sub",
      userAgent: "Horion",
    });
    expect(invokeMock).toHaveBeenNthCalledWith(2, "profile_save_content", {
      id: "p1",
      content: "mode: rule",
      expectedRevision: 7,
    });
  });
});
