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

interface SettingsContextType {
  settings: SettingsData | null;
  rejectedSettings: any | null;
  isLoading: boolean;
  refreshSettings: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType>({
  settings: null,
  rejectedSettings: null,
  isLoading: true,
  refreshSettings: async () => {},
});

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [rejectedSettings, setRejectedSettings] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSettings = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    try {
      // Mengambil data Live dan data Rejected (Draft) secara bersamaan tanpa saling memblokir
      const results = await Promise.allSettled([
        api.get("/settings", { signal }),
        api.get("/approval/rejected/1?module=Settings", { signal }),
      ]);

      // 1. Handle Live Data
      if (results[0].status === "fulfilled") {
        // Backend baru membalas dengan { success: true, data: {...} }
        const liveData = results[0].value.data.data || results[0].value.data;
        setSettings(liveData);
      } else {
        if (results[0].reason?.name !== "CanceledError") {
          console.error("🚨 Failed to fetch live settings:", results[0].reason);
        }
      }

      // 2. Handle Rejected Draft Data
      if (
        results[1].status === "fulfilled" &&
        results[1].value.data.hasRejected
      ) {
        setRejectedSettings(results[1].value.data.data);
      } else {
        setRejectedSettings(null); // Bersihkan jika tidak ada atau API gagal
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
      refreshSettings: () => fetchSettings(),
    }),
    [settings, rejectedSettings, isLoading, fetchSettings],
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
