import { invoke, isTauri } from "@tauri-apps/api/core";

import type { ProxyDelayResult, ProxyMode, ProxyOverview } from "../types/proxy";

export interface ProxyClient {
  isAvailable: () => boolean;
  getOverview: () => Promise<ProxyOverview>;
  select: (group: string, name: string) => Promise<void>;
  testDelay: (name: string, timeoutMs: number) => Promise<ProxyDelayResult>;
  setMode: (mode: ProxyMode) => Promise<void>;
}

export const proxyClient: ProxyClient = {
  isAvailable: isTauri,
  getOverview: () => invoke<ProxyOverview>("proxy_get_overview"),
  select: async (group, name) => {
    await invoke("proxy_select", { group, name });
  },
  testDelay: (name, timeoutMs) =>
    invoke<ProxyDelayResult>("proxy_test_delay", { name, timeoutMs }),
  setMode: async (mode) => {
    await invoke("proxy_set_mode", { mode });
  },
};
