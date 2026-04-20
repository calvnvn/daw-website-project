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

// 🛡️ Interface Terpusat dengan "Gembok Awareness"
export interface HeroSlides {
  id: number | string;
  title: string;
  subtitle: string;
  imageUrl: string | null;
  order: number;
  is_locked?: boolean; // Status gembok dari backend
  lock_ticket?: string; // Nomor tiket OWL
  has_rejected?: boolean; // Indikator draf ditolak
}

export interface HomeSettings {
  introHeadline: string;
  introBody: string;
  is_locked?: boolean;
  lock_ticket?: string;
  has_rejected?: boolean;
}

export interface ImpactStats {
  id: number | string;
  icon: string;
  value: string;
  label: string;
  desc: string;
  order: number;
  is_locked?: boolean;
  lock_ticket?: string;
  has_rejected?: boolean;
}

interface HomeContextType {
  slides: HeroSlides[];
  stats: ImpactStats[];
  settings: HomeSettings | null;
  isLoading: boolean;
  refreshData: () => Promise<void>;
}

export const HomeContext = createContext<HomeContextType>({
  slides: [],
  stats: [],
  settings: null,
  isLoading: true,
  refreshData: async () => {},
});

export function HomeProvider({ children }: { children: ReactNode }) {
  const [slides, setSlides] = useState<HeroSlides[]>([]);
  const [stats, setStats] = useState<ImpactStats[]>([]);
  const [settings, setSettings] = useState<HomeSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await api.get("/homepage", { signal });
      const data = res.data;

      setSlides(data.slides || []);
      setStats(data.stats || []);
      setSettings(data.settings || null);
    } catch (err: any) {
      if (err.name !== "CanceledError") {
        console.error("🚨 Failed to fetch homepage data:", err);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchData(controller.signal);

    return () => {
      controller.abort();
    };
  }, [fetchData]);

  const contextValue = useMemo(
    () => ({
      slides,
      stats,
      settings,
      isLoading,
      refreshData: () => fetchData(),
    }),
    [slides, stats, settings, isLoading, fetchData],
  );

  return (
    <HomeContext.Provider value={contextValue}>{children}</HomeContext.Provider>
  );
}

export function useHome() {
  const context = useContext(HomeContext);
  if (!context) {
    throw new Error("useHome must be used within a HomeProvider");
  }
  return context;
}
