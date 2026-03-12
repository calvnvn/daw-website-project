/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";

interface SettingsData {
  companyName: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  googleMapsUrl: string;
  linkedinUrl: string;
}
interface SettingsContextType {
  settings: SettingsData | null;
  isLoading: boolean;
}

const SettingsContext = createContext<SettingsContextType>({
  settings: null,
  isLoading: true,
});

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch("http://localhost:5000/api/settings")
      .then((res) => res.json())
      .then((data) => setSettings(data))
      .catch((err) => console.error("Failed to fetch settings:", err))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, isLoading }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}
