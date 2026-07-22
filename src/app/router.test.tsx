import { render, screen } from "@testing-library/react";
import { RouterProvider } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";

import { emptyCoreSnapshot, useCoreStore } from "../stores/core-store";
import { useLayoutStore } from "../stores/layout-store";
import { router } from "./router";

describe("application router", () => {
  beforeEach(async () => {
    localStorage.clear();
    useLayoutStore.setState({ sidebarCollapsed: false });
    useCoreStore.setState({
      snapshot: emptyCoreSnapshot,
      logs: [],
      runtimeAvailable: false,
      initialized: true,
      isRefreshingStatus: false,
      isRefreshingLogs: false,
      pendingAction: null,
      statusError: null,
      logsError: null,
      actionError: null,
    });
    await router.navigate("/");
  });

  it("renders the core dashboard and primary navigation", () => {
    render(<RouterProvider router={router} />);

    expect(screen.getByRole("heading", { name: "运行概览" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "主导航" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "设置" })).toHaveAttribute(
      "href",
      "#/settings",
    );
  });

  it("keeps desktop and future network actions disabled in browser tests", () => {
    render(<RouterProvider router={router} />);

    expect(screen.getByRole("button", { name: "安装已验证内核" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "系统代理未接入" })).toBeDisabled();
  });
});
