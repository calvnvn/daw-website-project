/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";

// 1. Definisikan Struktur Data (Sesuai dengan Model Database)
export interface HeroSlide {
  id: number | string;
  title: string;
  subtitle: string;
  imageUrl: string | null;
  order: number;
}

export interface HomeSetting {
  introHeadline: string;
  introBody: string;
}

export interface ImpactStat {
  id: number | string;
  icon: string;
  value: string;
  label: string;
  desc: string;
  order: number;
}

interface HomeContextType {
  slides: HeroSlide[];
  stats: ImpactStat[];
  settings: HomeSetting | null;
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
  const [slides, setSlides] = useState<HeroSlide[]>([]);
  const [stats, setStats] = useState<ImpactStat[]>([]);
  const [settings, setSettings] = useState<HomeSetting | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = async () => {
    try {
      // MEGA-GET
      const res = await fetch("http://localhost:5000/api/homepage");
      if (res.ok) {
        const data = await res.json();
        setSlides(data.slides);
        setStats(data.stats);
        setSettings(data.settings);
      }
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
      value={{ slides, stats, settings, isLoading, refreshData: fetchData }}
    >
      {children}
    </HomeContext.Provider>
  );
}

// 4. Custom Hook
export function useHome() {
  return useContext(HomeContext);
}
