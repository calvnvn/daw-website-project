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

export interface PhilosophyPillar {
  id: string;
  title: string;
  text: string;
}

export interface Lockable {
  is_locked: boolean;
  lock_ticket?: string | null;
}

export interface AboutData extends Lockable {
  spiritText: string;
  missionText: string;
  visionText: string;
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

interface AboutContextType {
  aboutData: AboutData | null;
  companyHistory: HistoryItem[];
  managementTeam: ManagementItem[];
  isLoading: boolean;
  refreshData: () => Promise<void>;
}

export const AboutContext = createContext<AboutContextType>({
  aboutData: null,
  companyHistory: [],
  managementTeam: [],
  isLoading: true,
  refreshData: async () => {},
});

export function AboutProvider({ children }: { children: ReactNode }) {
  const [aboutData, setAboutData] = useState<AboutData | null>(null);
  const [companyHistory, setCompanyHistory] = useState<HistoryItem[]>([]);
  const [managementTeam, setManagementTeam] = useState<ManagementItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async (signal?: AbortSignal) => {
    try {
      const [resAbout, resHistory, resManagement] = await Promise.allSettled([
        api.get("/about", { signal }),
        api.get("/history", { signal }),
        api.get("/management", { signal }),
      ]);

      if (resAbout.status === "fulfilled") {
        setAboutData(resAbout.value.data);
      } else if (resAbout.reason.name !== "CanceledError") {
        console.error("❌ About Data Fetch Failed");
      }

      if (resHistory.status === "fulfilled") {
        setCompanyHistory(resHistory.value.data);
      } else if (resHistory.reason.name !== "CanceledError") {
        console.error("❌ History Fetch Failed");
      }

      if (resManagement.status === "fulfilled") {
        setManagementTeam(resManagement.value.data);
      } else if (resManagement.reason.name !== "CanceledError") {
        console.error("❌ Management Fetch Failed");
      }
    } catch (err) {
      console.error("🚨 Critical Fetch Error:", err);
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
      console.log("🧠 AboutContext: Fetch Aborted on Unmount.");
    };
  }, [fetchData]);

  return (
    <AboutContext.Provider
      value={{
        aboutData,
        companyHistory,
        managementTeam,
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
