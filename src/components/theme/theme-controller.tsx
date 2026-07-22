import { useEffect } from "react";

import { useResolvedTheme } from "../../hooks/use-resolved-theme";

export function ThemeController() {
  const theme = useResolvedTheme();

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    root.style.colorScheme = theme;
  }, [theme]);

  return null;
}
