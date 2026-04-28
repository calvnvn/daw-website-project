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

// 1. TYPE DEFINITIONS
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

export interface RejectionDraft {
  notrans: string;
  module_name: string;
  target_id: string;
  payload: any;
  rejection_reason: string;
  created_by: string;
  createdAt: string;
}

interface HomeContextType {
  // Data Ledger (Live)
  slides: HeroSlides[];
  stats: ImpactStats[];
  settings: HomeSettings | null;

  // Data Vault (Rejection Radar)
  rejectedIntro: RejectionDraft | null;
  rejectedSlidesMap: Record<string, RejectionDraft>;
  rejectedStatsMap: Record<string, RejectionDraft>;

  // Lifecycle
  isLoading: boolean;
  refreshData: () => Promise<void>;
  refreshSettings: () => Promise<void>;
}

// 2. CONTEXT INITIALIZATION
export const HomeContext = createContext<HomeContextType>({
  slides: [],
  stats: [],
  settings: null,
  rejectedIntro: null,
  rejectedSlidesMap: {},
  rejectedStatsMap: {},
  isLoading: true,
  refreshData: async () => {},
  refreshSettings: async () => {},
});

export function HomeProvider({ children }: { children: ReactNode }) {
  // Data States
  const [slides, setSlides] = useState<HeroSlides[]>([]);
  const [stats, setStats] = useState<ImpactStats[]>([]);
  const [settings, setSettings] = useState<HomeSettings | null>(null);

  // Raw Radar State
  const [rawRejectionRadar, setRawRejectionRadar] = useState<RejectionDraft[]>(
    [],
  );

  // Loading State
  const [isLoading, setIsLoading] = useState(true);

  //FETCHING
  const fetchData = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    try {
      const response = await api.get("/homepage", { signal });
      const payload = response.data?.data || response.data;

      setSlides(payload.slides || []);
      setStats(payload.stats || []);
      setSettings(payload.settings || null);

      setRawRejectionRadar(payload.rejectionRadar || []);
    } catch (error: any) {
      if (error.name !== "CanceledError") {
        console.error("🚨 [HomeContext] Gagal menarik data:", error.message);
        setSlides([]);
        setStats([]);
        setRawRejectionRadar([]);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ABORT CONTROLLER LIFECYCLE
  useEffect(() => {
    const controller = new AbortController();
    fetchData(controller.signal);

    return () => {
      controller.abort();
    };
  }, [fetchData]);

  // DERIVED STATES
  const rejectedIntro = useMemo(() => {
    return (
      rawRejectionRadar.find((d) => d.module_name === "HomeSettings") || null
    );
  }, [rawRejectionRadar]);

  const rejectedSlidesMap = useMemo(() => {
    return rawRejectionRadar
      .filter((d) => d.module_name === "HeroSlides")
      .reduce(
        (acc, curr) => {
          acc[String(curr.target_id)] = curr;
          return acc;
        },
        {} as Record<string, RejectionDraft>,
      );
  }, [rawRejectionRadar]);

  const rejectedStatsMap = useMemo(() => {
    return rawRejectionRadar
      .filter((d) => d.module_name === "ImpactStats")
      .reduce(
        (acc, curr) => {
          acc[String(curr.target_id)] = curr;
          return acc;
        },
        {} as Record<string, RejectionDraft>,
      );
  }, [rawRejectionRadar]);

  // CONTEXT VALUE MEMOIZATION
  const contextValue = useMemo(
    () => ({
      slides,
      stats,
      settings,
      rejectedIntro,
      rejectedSlidesMap,
      rejectedStatsMap,
      isLoading,
      refreshSettings: () => fetchData(),
      refreshData: () => fetchData(),
    }),
    [
      slides,
      stats,
      settings,
      rejectedIntro,
      rejectedSlidesMap,
      rejectedStatsMap,
      isLoading,
      fetchData,
    ],
  );

  return (
    <HomeContext.Provider value={contextValue}>{children}</HomeContext.Provider>
  );
}

// HOOK EXPORT
export function useHome() {
  const context = useContext(HomeContext);
  if (!context) {
    throw new Error("useHome must be used within a HomeProvider");
  }
  return context;
}
