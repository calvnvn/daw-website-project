/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";

import api from "@/lib/api";
// 1. Definisikan Struktur Data (Sesuai dengan Model Database)
export interface HeroSlides {
  id: number | string;
  title: string;
  subtitle: string;
  imageUrl: string | null;
  order: number;
}

export interface HomeSettings {
  introHeadline: string;
  introBody: string;
}

export interface ImpactStats {
  id: number | string;
  icon: string;
  value: string;
  label: string;
  desc: string;
  order: number;
}

interface HomeContextType {
  slides: HeroSlides[];
  stats: ImpactStats[];
  settings: HomeSettings | null;
  isLoading: boolean;
  refreshData: () => Promise<void>;
}

// 2. Default Context
export const HomeContext = createContext<HomeContextType>({
  slides: [],
  stats: [],
  settings: null,
  isLoading: true,
  refreshData: async () => {},
});

// 3. Provider
export function HomeProvider({ children }: { children: ReactNode }) {
  const [slides, setSlides] = useState<HeroSlides[]>([]);
  const [stats, setStats] = useState<ImpactStats[]>([]);
  const [settings, setSettings] = useState<HomeSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = async () => {
    setIsLoading(true); // Pastikan loading aktif saat refresh
    try {
      const res = await api.get("/homepage");
      const data = res.data;

      setSlides(data.slides);
      setStats(data.stats);
      setSettings(data.settings);
    } catch (err) {
      console.error("Failed to fetch homepage data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <HomeContext.Provider
      value={{ slides, stats, settings, isLoading, refreshData: fetchData }}>
      {children}
    </HomeContext.Provider>
  );
}

// 4. Custom Hook
export function useHome() {
  return useContext(HomeContext);
}
