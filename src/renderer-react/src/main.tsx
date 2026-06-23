import React from "react";
import { createRoot } from "react-dom/client";
import App from "./AppV30";
import "./styles-v30.css";

// Dev-only mock API: in the packaged app the real window.api is injected by the
// Electron preload, so the mock is only for the browser dev preview and is never
// bundled into production. It MUST be installed BEFORE AppV30 renders, otherwise
// the app's startup effects call an undefined window.api (blank dev page).
async function bootstrap() {
  if (import.meta.env.DEV && !window.api) {
    const mock = await import("./mockApi");
    mock.installMockApi();
  }
  createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

void bootstrap();
