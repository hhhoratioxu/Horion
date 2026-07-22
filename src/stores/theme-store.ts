import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { ThemePreference } from "../types/theme";

interface ThemeState {
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      preference: "dark",
      setPreference: (preference) => set({ preference }),
    }),
    {
      name: "horion.ui.theme",
      storage: createJSONStorage(() => localStorage),
      partialize: ({ preference }) => ({ preference }),
    },
  ),
);
