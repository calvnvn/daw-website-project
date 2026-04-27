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
import { useAuth } from "./AuthContext";

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
  const { user } = useAuth();
  const [settings, setSettings] = useState<InvestmentSettings | null>(null);
  const [companies, setCompanies] = useState<Affiliate[]>([]);
  const [rejectedSettings, setRejectedSettings] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(
    async (signal?: AbortSignal) => {
      const token = localStorage.getItem("daw_token");
      if (token && user === null) return;

      const canAccessAdmin = [
        "superadmin",
        "admin",
        "editor",
        "approver",
      ].includes(user?.role || "");

      try {
        const promises: Promise<any>[] = [];

        if (canAccessAdmin) {
          promises.push(api.get("/investments/admin", { signal }));
          promises.push(
            api.get("/approval/rejected/1?module=InvestmentSettings", {
              signal,
            }),
          );
        } else {
          promises.push(api.get("/investments/public", { signal }));
        }

        const results = await Promise.allSettled(promises);

        const dataRes = results[0];
        if (dataRes.status === "fulfilled") {
          setSettings(dataRes.value.data.settings || null);
          setCompanies(dataRes.value.data.companies || []);
        } else {
          const error = dataRes.reason;
          if (
            error?.name !== "CanceledError" &&
            error?.code !== "ERR_CANCELED"
          ) {
            console.error("🚨 [FETCH_INVESTMENT_FAILED]:", error);

            if (canAccessAdmin) {
              console.warn("⚠️ Falling back to public investment data...");
              try {
                const fallback = await api.get("/investments/public", {
                  signal,
                });
                setSettings(fallback.data.settings || null);
                setCompanies(fallback.data.companies || []);
              } catch {
                console.error("🚨 Fatal Fallback Error.");
              }
            }
          }
        }

        // HANDLE REJECTED DRAFT (Hanya jika Admin/Editor)
        if (canAccessAdmin && results[1]) {
          const rejectedRes = results[1];
          if (
            rejectedRes.status === "fulfilled" &&
            rejectedRes.value.data.hasRejected
          ) {
            setRejectedSettings(rejectedRes.value.data.data);
          } else {
            setRejectedSettings(null);
          }
        } else {
          setRejectedSettings(null);
        }
      } catch (error) {
        console.error("❌ Global Fetch Execution Error:", error);
      } finally {
        setIsLoading(false);
      }
    },
    [user],
  );

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
