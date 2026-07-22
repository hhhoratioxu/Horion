import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";

import { router } from "./app/router";
import { CoreProvider } from "./components/core/core-provider";
import { ThemeController } from "./components/theme/theme-controller";
import "./styles/index.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Horion could not find the application root element.");
}

createRoot(root).render(
  <StrictMode>
    <CoreProvider>
      <ThemeController />
      <RouterProvider router={router} />
    </CoreProvider>
  </StrictMode>,
);
