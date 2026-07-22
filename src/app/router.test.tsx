import { render, screen } from "@testing-library/react";
import { RouterProvider } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";

import { useLayoutStore } from "../stores/layout-store";
import { router } from "./router";

describe("application router", () => {
  beforeEach(async () => {
    localStorage.clear();
    useLayoutStore.setState({ sidebarCollapsed: false });
    await router.navigate("/");
  });

  it("renders the phase-one dashboard and primary navigation", () => {
    render(<RouterProvider router={router} />);

    expect(screen.getByRole("heading", { name: "运行概览" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "主导航" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "设置" })).toHaveAttribute(
      "href",
      "#/settings",
    );
  });

  it("keeps unavailable runtime actions disabled", () => {
    render(<RouterProvider router={router} />);

    expect(screen.getByRole("button", { name: "启动内核" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "开启系统代理" })).toBeDisabled();
  });
});
