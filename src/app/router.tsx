import { createHashRouter } from "react-router-dom";

import { AppShell } from "../components/layout/app-shell";
import { ConnectionsPage } from "../pages/connections-page";
import { DashboardPage } from "../pages/dashboard-page";
import { LogsPage } from "../pages/logs-page";
import { NotFoundPage } from "../pages/not-found-page";
import { ProfilesPage } from "../pages/profiles-page";
import { ProxyGroupsPage } from "../pages/proxy-groups-page";
import { ProxyNodesPage } from "../pages/proxy-nodes-page";
import { RouteErrorPage } from "../pages/route-error-page";
import { SettingsPage } from "../pages/settings-page";

export const router = createHashRouter([
  {
    path: "/",
    element: <AppShell />,
    errorElement: <RouteErrorPage />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: "proxies", element: <ProxyNodesPage /> },
      { path: "proxies/nodes", element: <ProxyNodesPage /> },
      { path: "proxies/groups", element: <ProxyGroupsPage /> },
      { path: "connections", element: <ConnectionsPage /> },
      { path: "profiles", element: <ProfilesPage /> },
      { path: "logs", element: <LogsPage /> },
      { path: "settings", element: <SettingsPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);
