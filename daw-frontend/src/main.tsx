import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App.tsx";
import "./index.css";
import "./lib/i18n";
import { SettingsProvider } from "./contexts/SettingsContext";
import { AboutProvider } from "./contexts/AboutContext.tsx";
import { InvestmentProvider } from "./contexts/InvestmentContext";
import { BusinessProvider } from "./contexts/BusinessContext";
import { HomeProvider } from "./contexts/HomeContext";
import { HelmetProvider } from "react-helmet-async"; //  1. Import ini

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <HelmetProvider>
        <BrowserRouter>
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
        </BrowserRouter>
      </HelmetProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
