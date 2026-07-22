import { useEffect, type ReactNode } from "react";

import { useCoreStore } from "../../stores/core-store";

interface CoreProviderProps {
  children: ReactNode;
}

const statusPollInterval = 2_000;
const logsPollInterval = 2_500;

export function CoreProvider({ children }: CoreProviderProps) {
  useEffect(() => {
    const refreshStatus = () => {
      if (document.visibilityState === "visible") {
        void useCoreStore.getState().refreshStatus();
      }
    };
    const refreshLogs = () => {
      const state = useCoreStore.getState();
      if (document.visibilityState === "visible" && state.snapshot.installed) {
        void state.refreshLogs();
      }
    };
    const refreshVisibleData = () => {
      if (document.visibilityState === "visible") {
        refreshStatus();
        refreshLogs();
      }
    };

    refreshStatus();
    const statusTimer = window.setInterval(refreshStatus, statusPollInterval);
    const logsTimer = window.setInterval(refreshLogs, logsPollInterval);
    document.addEventListener("visibilitychange", refreshVisibleData);

    return () => {
      window.clearInterval(statusTimer);
      window.clearInterval(logsTimer);
      document.removeEventListener("visibilitychange", refreshVisibleData);
    };
  }, []);

  return children;
}
