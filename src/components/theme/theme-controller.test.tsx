import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { useThemeStore } from "../../stores/theme-store";
import { ThemeController } from "./theme-controller";

describe("ThemeController", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark");
    useThemeStore.setState({ preference: "dark" });
  });

  it("uses dark mode by default", () => {
    render(<ThemeController />);
    expect(document.documentElement).toHaveClass("dark");
  });

  it("applies a changed theme preference", () => {
    render(<ThemeController />);

    act(() => {
      useThemeStore.getState().setPreference("light");
    });

    expect(document.documentElement).not.toHaveClass("dark");
    expect(document.documentElement.style.colorScheme).toBe("light");
  });
});
