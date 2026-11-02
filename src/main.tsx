import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./ui/App";
import { StoreProvider } from "./state/store";
import "./ui/styles.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <StoreProvider>
      <App />
    </StoreProvider>
  </React.StrictMode>,
);

// PWA: register the service worker when the page is served from a real origin (not file:// or a sandboxed frame).
if ("serviceWorker" in navigator && location.protocol.startsWith("http") && window.top === window) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {/* offline mode unavailable */});
  });
}
