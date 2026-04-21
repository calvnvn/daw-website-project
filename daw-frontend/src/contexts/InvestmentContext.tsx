/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import api from "@/lib/api";

export interface InvestmentSettings {
  id?: number; // Singleton ID 1
  teaserHeadline: string;
  teaserBody: string;
  sectionIntro: string;
  is_locked?: boolean;
  lock_ticket?: string | null;
}

export interface Affiliate {
  id: number;
  name: string;
  desc: string;
  category: "fnb" | "steel" | "finance" | "edu";
  logoUrl: string | null;
  websiteUrl: string | null;
  is_locked?: boolean;
  lock_ticket?: string | null;
  has_rejected?: boolean;
}

interface InvestmentContextType {
  settings: InvestmentSettings | null;
  companies: Affiliate[];
  rejectedSettings: any | null;
  isLoading: boolean;
  refreshData: () => Promise<void>;
}

export const InvestmentContext = createContext<InvestmentContextType>({
  settings: null,
  companies: [],
  rejectedSettings: null,
  isLoading: true,
  refreshData: async () => {},
});

export function InvestmentProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<InvestmentSettings | null>(null);
  const [companies, setCompanies] = useState<Affiliate[]>([]);
  const [rejectedSettings, setRejectedSettings] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async (signal?: AbortSignal) => {
    const results = await Promise.allSettled([
      api.get("/investment", { signal }),
      api.get("/approval/rejected/1?module=InvestmentSettings", { signal }),
    ]);

    // Handle Data Live
    if (results[0].status === "fulfilled") {
      setSettings(results[0].value.data.settings);
      setCompanies(results[0].value.data.companies);
    } else {
      const error = results[0].reason;

      if (error?.name !== "CanceledError" && error?.code !== "ERR_CANCELED") {
        console.error("🚨 Live Data Fetch Failed:", error);
      }
    }

    // Handle Rejected Draft (Singleton Settings)
    if (
      results[1].status === "fulfilled" &&
      results[1].value.data.hasRejected
    ) {
      setRejectedSettings(results[1].value.data.data);
    } else {
      setRejectedSettings(null);
    }

    setIsLoading(false);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchData(controller.signal);
    return () => controller.abort();
  }, [fetchData]);

  const contextValue = useMemo(
    () => ({
      settings,
      companies,
      rejectedSettings,
      isLoading,
      refreshData: () => fetchData(),
    }),
    [settings, companies, rejectedSettings, isLoading, fetchData],
  );

  return (
    <InvestmentContext.Provider value={contextValue}>
      {children}
    </InvestmentContext.Provider>
  );
}
export function useInvestments() {
  const context = useContext(InvestmentContext);
  if (context === undefined) {
    throw new Error("useInvestments must be used within an InvestmentProvider");
  }
  return context;
}
