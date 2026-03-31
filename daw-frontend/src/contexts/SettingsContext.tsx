/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useContext,
  useState,
  useEffect,
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
  // 👇 TAMBAHAN FIELD BARU
  logoUrl: string | null;
  faviconUrl: string | null;
}

interface SettingsContextType {
  settings: SettingsData | null;
  isLoading: boolean;
  refreshSettings: () => Promise<void>; // 👇 Biar Navbar & SEO bisa update otomatis
}

const SettingsContext = createContext<SettingsContextType>({
  settings: null,
  isLoading: true,
  refreshSettings: async () => {},
});

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Bungkus fetch dalam useCallback biar bisa dipanggil berulang kali
  const fetchSettings = useCallback(async () => {
    try {
      const res = await api.get("/settings");
      setSettings(res.data);
    } catch (err) {
      console.error("Failed to fetch settings:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return (
    <SettingsContext.Provider
      value={{
        settings,
        isLoading,
        refreshSettings: fetchSettings, // Expous fungsi refresh
      }}
    >
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
