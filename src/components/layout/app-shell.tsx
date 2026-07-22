import { Outlet } from "react-router-dom";

import { AppHeader } from "./app-header";
import { Sidebar } from "./sidebar";

export function AppShell() {
  return (
    <div className="flex h-screen min-h-[640px] overflow-hidden bg-canvas text-text antialiased">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader />
        <main className="min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1680px] p-5 xl:p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
