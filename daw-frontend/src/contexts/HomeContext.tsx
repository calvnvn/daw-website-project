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
import { useAuth } from "./AuthContext"; // 1. Import useAuth
import { useTranslation } from "react-i18next";

// TYPE DEFINITIONS (Tetap Sama)
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
  slides: HeroSlides[];
  stats: ImpactStats[];
  settings: HomeSettings | null;
  rejectedIntro: RejectionDraft | null;
  rejectedSlidesMap: Record<string, RejectionDraft>;
  rejectedStatsMap: Record<string, RejectionDraft>;
  isLoading: boolean;
  refreshData: () => Promise<void>;
  refreshSettings: () => Promise<void>;
}

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
  const { user } = useAuth(); // 2. Ambil state user
  const { i18n } = useTranslation();
  const lang = i18n.language || "en";

  const [slides, setSlides] = useState<HeroSlides[]>([]);
  const [stats, setStats] = useState<ImpactStats[]>([]);
  const [settings, setSettings] = useState<HomeSettings | null>(null);
  const [rawRejectionRadar, setRawRejectionRadar] = useState<RejectionDraft[]>(
    [],
  );
  const [isLoading, setIsLoading] = useState(true);

  // 3. REFACTORED FETCH DATA (Dual-Fetching & Fallback)
  const fetchData = useCallback(
    async (signal?: AbortSignal) => {
      // Tahan fetch jika token ada tapi user profile belum selesai di-load
      const token = localStorage.getItem("daw_token");
      if (token && user === null) return;

      // Cek Otoritas
      const canAccessAdmin = [
        "superadmin",
        "admin",
        "editor",
        "approver",
      ].includes(user?.role?.toLowerCase() || "");

      setIsLoading(true);
      try {
        let payload;

        if (canAccessAdmin) {
          try {
            // Tembak jalur Admin
            const response = await api.get(`/homepage/admin?lang=${lang}`, { signal });
            payload = response.data?.data || response.data;
          } catch (adminError: any) {
            if (adminError.name === "CanceledError") return;
            console.warn(
              "⚠️ [RETRY] Admin fetch failed, falling back to public data...",
            );

            // Banting setir ke jalur publik jika token expired/bermasalah
            const fallback = await api.get(`/homepage/public?lang=${lang}`, { signal });
            payload = fallback.data?.data || fallback.data;
          }
        } else {
          // Tembak jalur Publik langsung untuk pengunjung biasa
          const response = await api.get(`/homepage/public?lang=${lang}`, { signal });
          payload = response.data?.data || response.data;
        }

        setSlides(payload?.slides || []);
        setStats(payload?.stats || []);
        setSettings(payload?.settings || null);

        // Radar hanya diisi jika payload memiliki data rejectionRadar (biasanya dari admin)
        setRawRejectionRadar(payload?.rejectionRadar || []);
      } catch (error: any) {
        if (error.name !== "CanceledError") {
          console.error("🚨 [FATAL] Gagal menarik data Home:", error.message);
          setSlides([]);
          setStats([]);
          setRawRejectionRadar([]);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [user, lang],
  ); // Dependensi ditambahkan ke user dan lang

  useEffect(() => {
    const controller = new AbortController();
    fetchData(controller.signal);

    return () => {
      controller.abort();
    };
  }, [fetchData]);

  // DERIVED STATES (Tetap Sama)
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

export function useHome() {
  const context = useContext(HomeContext);
  if (!context) {
    throw new Error("useHome must be used within a HomeProvider");
  }
  return context;
}
