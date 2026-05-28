import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter } from "react-router-dom";
import { Toaster } from "sonner";
import App from "./App";
import "./index.css";

// Tauri ships a single window with strict-port webview — HashRouter avoids
// having to configure deep-link handlers in Rust just to make navigation work.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, refetchOnWindowFocus: false },
    mutations: { retry: 0 },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <App />
        <Toaster position="top-right" richColors closeButton />
      </HashRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
