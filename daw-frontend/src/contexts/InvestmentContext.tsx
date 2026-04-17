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
  isLoading: boolean;
  refreshData: () => Promise<void>;
}

export const InvestmentContext = createContext<InvestmentContextType>({
  settings: null,
  companies: [],
  isLoading: true,
  refreshData: async () => {},
});

export function InvestmentProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<InvestmentSettings | null>(null);
  const [companies, setCompanies] = useState<Affiliate[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await api.get("/investment", { signal });
      setSettings(res.data.settings);
      setCompanies(res.data.companies);
    } catch (err: any) {
      if (err.name !== "CanceledError") {
        console.error("🚨 Investment Sync Error:", err.message);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchData(controller.signal);

    // 🛡️ BLUEPRINT: Memory Leak Cleanup
    return () => controller.abort();
  }, [fetchData]);

  // 🛡️ PERFORMA: Memoize value agar provider tidak re-render anak secara brutal
  const contextValue = useMemo(
    () => ({
      settings,
      companies,
      isLoading,
      refreshData: () => fetchData(),
    }),
    [settings, companies, isLoading, fetchData],
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
