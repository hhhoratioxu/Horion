import { describe, expect, it, vi } from "vitest";

import type { ProxyClient } from "../services/proxy-client";
import type { ProxyOverview } from "../types/proxy";
import { createProxyStore } from "./proxy-store";

const overview: ProxyOverview = {
  mode: "rule",
  updated_at: "2026-07-22T00:00:00Z",
  groups: [{ name: "手动", type: "Selector", now: "A", all: ["A", "B"], alive: true, delay: 20 }],
  nodes: [
    { name: "A", type: "ss", server: "a.test", port: 443, groups: ["手动"], alive: true, delay: 20 },
    { name: "B", type: "ss", server: "b.test", port: 443, groups: ["手动"], alive: true, delay: null },
  ],
};

function client(overrides: Partial<ProxyClient> = {}): ProxyClient {
  return {
    isAvailable: () => true,
    getOverview: vi.fn(() => Promise.resolve(overview)),
    select: vi.fn(() => Promise.resolve()),
    testDelay: vi.fn(() => Promise.resolve({ delay: 42 })),
    setMode: vi.fn(() => Promise.resolve()),
    ...overrides,
  };
}

describe("proxy store", () => {
  it("calls group selection and mode switching contracts", async () => {
    const api = client();
    const store = createProxyStore(api);
    await store.getState().load();
    await store.getState().selectGroup("手动", "B");
    await store.getState().setMode("global");

    expect(api.select).toHaveBeenCalledWith("手动", "B");
    expect(api.setMode).toHaveBeenCalledWith("global");
  });

  it("never runs more than four delay checks and cancels queued work", async () => {
    let active = 0;
    let maximum = 0;
    const resolvers: (() => void)[] = [];
    const delay = vi.fn(
      () =>
        new Promise<{ delay: number }>((resolve) => {
          active += 1;
          maximum = Math.max(maximum, active);
          resolvers.push(() => {
            active -= 1;
            resolve({ delay: 10 });
          });
        }),
    );
    const store = createProxyStore(client({ testDelay: delay }));
    const run = store.getState().testAll(["A", "B", "C", "D", "E", "F"]);
    await vi.waitFor(() => { expect(delay).toHaveBeenCalledTimes(4); });
    store.getState().cancelTests();
    resolvers.splice(0).forEach((resolve) => { resolve(); });
    await run;

    expect(maximum).toBe(4);
    expect(delay).toHaveBeenCalledTimes(4);
    expect(store.getState().testingAll).toBe(false);
  });

  it("reports browser offline and backend error states", async () => {
    const offline = createProxyStore(client({ isAvailable: () => false }));
    await offline.getState().load();
    expect(offline.getState().runtimeAvailable).toBe(false);
    expect(offline.getState().initialized).toBe(true);

    const failed = createProxyStore(client({ getOverview: () => Promise.reject(new Error("offline")) }));
    await failed.getState().load();
    expect(failed.getState().error).toBe("offline");
  });
});
