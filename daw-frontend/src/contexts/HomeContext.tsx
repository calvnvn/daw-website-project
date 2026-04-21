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

export interface HeroSlides {
  id: number | string;
  title: string;
  subtitle: string;
  imageUrl: string | null;
  order: number;
  is_locked?: boolean;
  lock_ticket?: string;
  has_rejected?: boolean;
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
  rejectedIntro: any | null; //
  isLoading: boolean;
  refreshData: () => Promise<void>;
}

export const HomeContext = createContext<HomeContextType>({
  slides: [],
  stats: [],
  settings: null,
  rejectedIntro: null,
  isLoading: true,
  refreshData: async () => {},
});

export function HomeProvider({ children }: { children: ReactNode }) {
  const [slides, setSlides] = useState<HeroSlides[]>([]);
  const [stats, setStats] = useState<ImpactStats[]>([]);
  const [settings, setSettings] = useState<HomeSettings | null>(null);
  const [rejectedIntro, setRejectedIntro] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async (signal?: AbortSignal) => {
    try {
      const results = await Promise.allSettled([
        api.get("/homepage", { signal }),
        // Kita tarik draf rejected untuk Intro (Singleton ID 1) di level context
        api.get("/approval/rejected/1?module=HomeSettings", { signal }),
      ]);

      // 1. Handle Live Homepage Data
      if (results[0].status === "fulfilled") {
        const data = results[0].value.data.data || results[0].value.data;
        setSlides(data.slides || []);
        setStats(data.stats || []);
        setSettings(data.settings || null);
      } else {
        if (results[0].reason?.name !== "CanceledError") {
          console.error(
            "🚨 Failed to fetch live homepage data:",
            results[0].reason,
          );
        }
      }

      // 2. Handle Rejected Intro Draft (Singleton)
      if (
        results[1].status === "fulfilled" &&
        results[1].value.data.hasRejected
      ) {
        setRejectedIntro(results[1].value.data.data);
      } else {
        setRejectedIntro(null);
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
      rejectedIntro,
      isLoading,
      refreshSettings: () => fetchData(), // Alias konsisten
      refreshData: () => fetchData(),
    }),
    [slides, stats, settings, rejectedIntro, isLoading, fetchData],
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
