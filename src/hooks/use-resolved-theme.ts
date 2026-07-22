import { useEffect, useState } from "react";

import { useThemeStore } from "../stores/theme-store";
import type { ResolvedTheme } from "../types/theme";

const DARK_MODE_QUERY = "(prefers-color-scheme: dark)";

function getSystemTheme(): ResolvedTheme {
  return window.matchMedia(DARK_MODE_QUERY).matches ? "dark" : "light";
}

export function useResolvedTheme(): ResolvedTheme {
  const preference = useThemeStore((state) => state.preference);
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(getSystemTheme);

  useEffect(() => {
    const mediaQuery = window.matchMedia(DARK_MODE_QUERY);
    const handleChange = (event: MediaQueryListEvent) => {
      setSystemTheme(event.matches ? "dark" : "light");
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, []);

  return preference === "system" ? systemTheme : preference;
}
