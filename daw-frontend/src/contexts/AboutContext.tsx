/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import api from "@/lib/api";
import { toast } from "sonner";

export interface PhilosophyPillar extends Lockable {
  id: number;
  iconId: string;
  title: string;
  text: string;
  orderIndex: number;
}

export interface Lockable {
  is_locked: boolean;
  lock_ticket?: string | null;
  hasRejected?: boolean;
}

export interface AboutData extends Lockable {
  id?: number;
  spiritText: string;
  missionText: string;
  visionText: string;
}

export interface PhilosophyData extends Lockable {
  id?: number;
  philosophyTitle: string;
  philosophyPillars: PhilosophyPillar[];
}

export interface HistoryItem extends Lockable {
  id: number;
  year: string;
  description: string;
}

export interface ManagementItem extends Lockable {
  id: number;
  name: string;
  role: string;
  description: string;
  level: "chairman" | "director" | "division";
  order: number;
  photoUrl: string | null;
}

export interface AchievementItem extends Lockable {
  id: number;
  year: string;
  title: string;
  category: string;
  iconId: string;
  date: string;
  description: string;
  imageUrl: string | null;
}

interface AboutContextType {
  aboutData: AboutData | null;
  philosophyData: PhilosophyData | null;
  philosophyPillars: PhilosophyPillar[];
  companyHistory: HistoryItem[];
  managementTeam: ManagementItem[];
  achievements: AchievementItem[];
  isLoading: boolean;
  refreshData: () => Promise<void>;
}

export const AboutContext = createContext<AboutContextType>({
  aboutData: null,
  philosophyData: null,
  philosophyPillars: [],
  companyHistory: [],
  managementTeam: [],
  achievements: [],
  isLoading: true,
  refreshData: async () => {},
});

export function AboutProvider({ children }: { children: ReactNode }) {
  const [aboutData, setAboutData] = useState<AboutData | null>(null);
  const [philosophyData, setPhilosophyData] = useState<PhilosophyData | null>(
    null,
  );
  const [philosophyPillars, setPhilosophyPillars] = useState<
    PhilosophyPillar[]
  >([]);
  const [companyHistory, setCompanyHistory] = useState<HistoryItem[]>([]);
  const [managementTeam, setManagementTeam] = useState<ManagementItem[]>([]);
  const [achievements, setAchievements] = useState<AchievementItem[]>([]);

  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    try {
      const [
        resAbout,
        resPhilosophy,
        resPillars,
        resHistory,
        resManagement,
        resAchievements,
      ] = await Promise.allSettled([
        api.get("/about", { signal }),
        api.get("/philosophy", { signal }),
        api.get("/philosophy-pillars", { signal }),
        api.get("/history", { signal }),
        api.get("/management", { signal }),
        api.get("/achievements", { signal }),
      ]);

      // 1. Process About Info (Visi Misi)
      if (resAbout.status === "fulfilled") {
        setAboutData(resAbout.value.data);
      } else if (resAbout.reason.name !== "CanceledError") {
        console.error("❌ About Data Fetch Failed");
        toast.error("Gagal memuat Informasi Perusahaan.");
      }

      // 2. Process Philosophy Singleton (Title)
      if (resPhilosophy.status === "fulfilled") {
        setPhilosophyData(resPhilosophy.value.data);
      } else if (resPhilosophy.reason.name !== "CanceledError") {
        console.error("❌ Philosophy Fetch Failed");
        toast.error("Gagal memuat Judul Filosofi.");
      }

      // 3. Process Philosophy Pillars Collection (Granular Rows) 🆕
      if (resPillars.status === "fulfilled") {
        setPhilosophyPillars(
          resPillars.value.data.data || resPillars.value.data,
        );
      } else if (resPillars.reason.name !== "CanceledError") {
        console.error("❌ Philosophy Pillars Fetch Failed");
        toast.error("Gagal memuat Pilar-pilar Filosofi.");
      }

      // 4. Process History
      if (resHistory.status === "fulfilled") {
        setCompanyHistory(resHistory.value.data);
      } else if (resHistory.reason.name !== "CanceledError") {
        console.error("❌ History Fetch Failed");
        toast.error("Gagal memuat Sejarah Perusahaan.");
      }

      // 5. Process Management
      if (resManagement.status === "fulfilled") {
        setManagementTeam(resManagement.value.data);
      } else if (resManagement.reason.name !== "CanceledError") {
        console.error("❌ Management Fetch Failed");
        toast.error("Gagal memuat Data Manajemen.");
      }

      // 6. Process Achievements
      if (resAchievements.status === "fulfilled") {
        const data = resAchievements.value.data;
        setAchievements(data.data || data);
      } else if (resAchievements.reason.name !== "CanceledError") {
        console.error("❌ Achievements Fetch Failed");
        toast.error("Gagal memuat Data Penghargaan.");
      }
    } catch (err) {
      console.error("🚨 Critical Fetch Error:", err);
      toast.error("Kesalahan sinkronisasi data kritis.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshData = useCallback(async () => {
    await fetchData();
  }, [fetchData]);

  useEffect(() => {
    const controller = new AbortController();
    fetchData(controller.signal);

    return () => {
      controller.abort();
      // console.log("🧠 AboutContext: Fetch Aborted on Unmount.");
    };
  }, [fetchData]);

  return (
    <AboutContext.Provider
      value={{
        aboutData,
        philosophyData,
        philosophyPillars,
        companyHistory,
        managementTeam,
        achievements,
        isLoading,
        refreshData,
      }}>
      {children}
    </AboutContext.Provider>
  );
}

export function useAbout() {
  const context = useContext(AboutContext);
  if (!context) {
    throw new Error("useAbout must be used within an AboutProvider");
  }
  return context;
}
