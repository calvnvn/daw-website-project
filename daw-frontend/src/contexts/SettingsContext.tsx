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

interface SettingsData {
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
  isLoading: boolean;
  refreshSettings: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType>({
  settings: null,
  isLoading: true,
  refreshSettings: async () => {},
});

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSettings = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await api.get("/settings", { signal });
      setSettings(res.data);
    } catch (err: any) {
      if (err.name !== "CanceledError") {
        console.error("🚨 Failed to fetch settings:", err);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchSettings(controller.signal);

    // Cleanup: Batalkan request API jika komponen mati sebelum request selesai
    return () => {
      controller.abort();
    };
  }, [fetchSettings]);

  const contextValue = useMemo(
    () => ({
      settings,
      isLoading,
      refreshSettings: () => fetchSettings(),
    }),
    [settings, isLoading, fetchSettings],
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
