import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface LayoutState {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
}

export const useLayoutStore = create<LayoutState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      toggleSidebar: () =>
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
    }),
    {
      name: "horion.ui.layout",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
