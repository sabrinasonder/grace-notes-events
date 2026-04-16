import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

// ── Service Worker registration ──────────────────────────────────────────────
// Only register in production builds and only in browsers that support it.
// Vite dev server serves files directly, so SW would intercept HMR — skip it.
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((registration) => {
        // Check for updates every time the page loads
        registration.update();
      })
      .catch((err) => {
        console.warn("Service worker registration failed:", err);
      });
  });
}
