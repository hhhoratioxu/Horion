import { create } from "zustand";

import { getErrorMessage } from "../services/core-client";
import { proxyClient, type ProxyClient } from "../services/proxy-client";
import type { ProxyMode, ProxyOverview } from "../types/proxy";

export interface ProxyStore {
  overview: ProxyOverview | null;
  runtimeAvailable: boolean;
  initialized: boolean;
  loading: boolean;
  error: string | null;
  pendingSelection: string | null;
  pendingMode: ProxyMode | null;
  testingNames: string[];
  testingAll: boolean;
  load: () => Promise<void>;
  selectGroup: (group: string, name: string) => Promise<void>;
  setMode: (mode: ProxyMode) => Promise<void>;
  testDelay: (name: string, timeoutMs?: number) => Promise<void>;
  testAll: (names: string[], timeoutMs?: number) => Promise<void>;
  cancelTests: () => void;
  reset: () => void;
}

function updateDelay(
  overview: ProxyOverview | null,
  name: string,
  delay: number,
): ProxyOverview | null {
  if (!overview) return overview;
  return {
    ...overview,
    nodes: overview.nodes.map((node) =>
      node.name === name ? { ...node, delay, alive: delay > 0 } : node,
    ),
  };
}

export function createProxyStore(client: ProxyClient) {
  let loadRequest: Promise<void> | null = null;
  let testGeneration = 0;

  return create<ProxyStore>((set, get) => {
    const load = (): Promise<void> => {
      if (loadRequest) return loadRequest;
      if (!client.isAvailable()) {
        set({ runtimeAvailable: false, initialized: true, loading: false, error: null });
        return Promise.resolve();
      }
      set({ runtimeAvailable: true, loading: true });
      loadRequest = client
        .getOverview()
        .then((overview) => { set({ overview, initialized: true, error: null }); })
        .catch((error: unknown) =>
          { set({ initialized: true, error: getErrorMessage(error) }); },
        )
        .finally(() => {
          loadRequest = null;
          set({ loading: false });
        });
      return loadRequest;
    };

    const runDelay = async (name: string, timeoutMs: number): Promise<void> => {
      set((state) => ({
        testingNames: state.testingNames.includes(name)
          ? state.testingNames
          : [...state.testingNames, name],
      }));
      try {
        const result = await client.testDelay(name, timeoutMs);
        set((state) => ({
          overview: updateDelay(state.overview, name, result.delay),
          error: null,
        }));
      } catch (error: unknown) {
        set({ error: getErrorMessage(error) });
      } finally {
        set((state) => ({
          testingNames: state.testingNames.filter((item) => item !== name),
        }));
      }
    };

    return {
      overview: null,
      runtimeAvailable: false,
      initialized: false,
      loading: false,
      error: null,
      pendingSelection: null,
      pendingMode: null,
      testingNames: [],
      testingAll: false,
      load,
      selectGroup: async (group, name) => {
        if (!client.isAvailable() || get().pendingSelection) return;
        set({ pendingSelection: `${group}\u0000${name}`, error: null });
        try {
          await client.select(group, name);
          await load();
        } catch (error: unknown) {
          set({ error: getErrorMessage(error) });
        } finally {
          set({ pendingSelection: null });
        }
      },
      setMode: async (mode) => {
        if (!client.isAvailable() || get().pendingMode) return;
        set({ pendingMode: mode, error: null });
        try {
          await client.setMode(mode);
          await load();
        } catch (error: unknown) {
          set({ error: getErrorMessage(error) });
        } finally {
          set({ pendingMode: null });
        }
      },
      testDelay: async (name, timeoutMs = 5_000) => {
        if (!client.isAvailable() || get().testingNames.includes(name)) return;
        await runDelay(name, timeoutMs);
      },
      testAll: async (names, timeoutMs = 5_000) => {
        if (!client.isAvailable() || get().testingAll) return;
        const uniqueNames = [...new Set(names)];
        const generation = ++testGeneration;
        let cursor = 0;
        set({ testingAll: true, error: null });

        const worker = async () => {
          while (generation === testGeneration) {
            const index = cursor++;
            if (index >= uniqueNames.length) return;
            const name = uniqueNames[index];
            if (!name) return;
            await runDelay(name, timeoutMs);
          }
        };
        await Promise.all(
          Array.from({ length: Math.min(4, uniqueNames.length) }, () => worker()),
        );
        if (generation === testGeneration) set({ testingAll: false });
      },
      cancelTests: () => {
        testGeneration += 1;
        set({ testingAll: false });
      },
      reset: () => {
        testGeneration += 1;
        set({
          overview: null,
          initialized: false,
          loading: false,
          error: null,
          testingNames: [],
          testingAll: false,
        });
      },
    };
  });
}

export const useProxyStore = createProxyStore(proxyClient);
