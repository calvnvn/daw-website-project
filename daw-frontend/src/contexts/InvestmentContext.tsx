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

      const hasPhysicalToken = !!token;
      const canAccessAdmin =
        hasPhysicalToken &&
        ["superadmin", "admin", "editor", "approver"].includes(
          user?.role?.toLowerCase() || "",
        );

      setIsLoading(true);

      try {
        let payload;
        const promises: Promise<any>[] = [];

        if (canAccessAdmin) {
          try {
            promises.push(api.get("/investments/admin", { signal }));
            promises.push(
              api.get("/approval/rejected/1?module=InvestmentSettings", {
                signal,
              }),
            );

            const results = await Promise.allSettled(promises);
            const dataRes = results[0];

            if (dataRes.status === "fulfilled") {
              payload = dataRes.value.data?.data || dataRes.value.data;

              const rejectedRes = results[1];
              if (
                rejectedRes.status === "fulfilled" &&
                rejectedRes.value.data?.data?.hasRejected
              ) {
                setRejectedSettings(rejectedRes.value.data.data.data);
              } else {
                setRejectedSettings(null);
              }
            } else {
              throw dataRes.reason;
            }
          } catch (adminError: any) {
            if (
              adminError.name === "CanceledError" ||
              adminError.code === "ERR_CANCELED"
            ) {
              return;
            }

            console.warn(
              "⚠️ [RETRY] Admin fetch failed (401), falling back to public data...",
            );

            const fallback = await api.get("/investments/public", { signal });
            payload = fallback.data?.data || fallback.data;
            setRejectedSettings(null);
          }
        } else {
          // Public Site
          const response = await api.get("/investments/public", { signal });
          payload = response.data?.data || response.data;
          setRejectedSettings(null);
        }

        setSettings(payload?.settings || null);
        setCompanies(payload?.companies || []);
      } catch (error: any) {
        if (error.name !== "CanceledError" && error.code !== "ERR_CANCELED") {
          console.error("🚨 [FATAL] Global Investment Fetch Error:", {
            message: error.message,
            status: error.response?.status,
            data: error.response?.data,
          });
          setSettings(null);
          setCompanies([]);
          setRejectedSettings(null);
        }
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
