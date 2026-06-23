/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  type ReactNode,
  useCallback,
} from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

export interface SettingsData {
  companyName: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  googleMapsUrl: string;
  linkedinUrl: string;
  logoUrl: string | null;
  faviconUrl: string | null;

  is_locked?: boolean;
  lock_ticket?: string | null;
  has_rejected?: boolean;
  previous_notrans?: string | null;
}

export interface RejectedDraft {
  notrans: string;
  action: "CREATE" | "UPDATE" | "DELETE";
  payload: Partial<SettingsData>;
  rejection_reason?: string;
}

interface SettingsContextType {
  settings: SettingsData | null;
  rejectedSettings: RejectedDraft | null;
  isLoading: boolean;
  isSuperadmin: boolean;
  refreshSettings: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType>({
  settings: null,
  rejectedSettings: null,
  isLoading: true,
  isSuperadmin: false,
  refreshSettings: async () => {},
});

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [rejectedSettings, setRejectedSettings] =
    useState<RejectedDraft | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const { user } = useAuth();
  const isSuperadmin =
    user?.role?.toLowerCase() === "superadmin" ||
    user?.role?.toLowerCase() === "admin" ||
    user?.role?.toLowerCase() === "owner";

  const fetchSettings = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    try {
      const hasToken = !!localStorage.getItem("daw_token");
      const requests = [
        api.get("/settings", { signal })
      ];

      if (hasToken) {
        requests.push(api.get("/approval/rejected/1?module=Settings", { signal }));
      }

      const results = await Promise.allSettled(requests);

      let finalRejectedData: RejectedDraft | null = null;

      if (results[0].status === "fulfilled") {
        const res = results[0].value.data;
        const liveData = res.data || res;
        setSettings(liveData);

        if (res.has_rejected || res.hasRejected) {
          // console.log("🎯 Radar Detected Rejection via Main Ledger");
          finalRejectedData = res.rejected_data || res.rejectedData;
        }
      }

      const secondaryResult = hasToken ? results[1] : null;

      if (secondaryResult && !finalRejectedData && secondaryResult.status === "fulfilled") {
        const resRadar = (secondaryResult.value as any).data;
        if (resRadar.has_rejected || resRadar.hasRejected || resRadar.success) {
          const draftData = resRadar.rejected_data || resRadar.data;
          if (draftData) {
            // console.log("📡 Radar Detected Rejection via Secondary Vault Scan");
            finalRejectedData = draftData;
          }
        }
      }

      setRejectedSettings(finalRejectedData);
    } catch (err: unknown) {
      if (!(typeof err === "object" && err !== null && "name" in err && (err as { name?: string }).name === "CanceledError")) {
        console.error("🚨 Radar System Failure:", err);
        toast.error("Gagal sinkronisasi radar birokrasi.");
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchSettings(controller.signal);

    return () => {
      controller.abort();
    };
  }, [fetchSettings]);

  const contextValue = useMemo(
    () => ({
      settings,
      rejectedSettings,
      isLoading,
      isSuperadmin,
      refreshSettings: () => fetchSettings(),
    }),
    [settings, rejectedSettings, isLoading, isSuperadmin, fetchSettings],
  );

  return (
    <SettingsContext.Provider value={contextValue}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
}
