import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App.tsx";
import "./index.css";
import "./lib/i18n";
import { SettingsProvider } from "@/contexts/SettingsContext";
import { AboutProvider } from "./contexts/AboutContext.tsx";
import { InvestmentProvider } from "./contexts/InvestmentContext";
import { BusinessProvider } from "./contexts/BusinessContext";
import { HomeProvider } from "./contexts/HomeContext";
import { HelmetProvider } from "react-helmet-async";
import { AuthProvider } from "./contexts/AuthContext.tsx";

// === GLOBAL CONSOLE OVERRIDE (PRODUCTION MODE) ===
// Secara otomatis membungkam seluruh log debugging dan error di browser klien saat production,
// MENCEGAH kebocoran data rahasia. Bisa dinyalakan paksa dengan VITE_ENABLE_DEBUG_LOGS=true di .env
const SHOW_DEBUG_LOGS = import.meta.env.VITE_ENABLE_DEBUG_LOGS === "true";

if (import.meta.env.PROD && !SHOW_DEBUG_LOGS) {
  console.log = () => {};
  console.warn = () => {};
  console.debug = () => {};
  console.error = () => {};
}
// ==================================================

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <HelmetProvider>
        <BrowserRouter>
          <AuthProvider>
            <SettingsProvider>
              <AboutProvider>
                <InvestmentProvider>
                  <HomeProvider>
                    <BusinessProvider>
                      <App />
                    </BusinessProvider>
                  </HomeProvider>
                </InvestmentProvider>
              </AboutProvider>
            </SettingsProvider>
          </AuthProvider>
        </BrowserRouter>
      </HelmetProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
