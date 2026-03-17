/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";

import api from "@/lib/api";

interface PhilosophyPillar {
  id: string;
  title: string;
  text: string;
}

interface AboutData {
  spiritText: string;
  missionText: string;
  visionText: string;
  philosophyTitle: string;
  philosophyPillars: PhilosophyPillar[];
}

interface HistoryItem {
  id: number;
  year: string;
  description: string;
}

interface ManagementItem {
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
}

export const AboutContext = createContext<AboutContextType>({
  aboutData: null,
  companyHistory: [],
  managementTeam: [],
  isLoading: true,
});

export function AboutProvider({ children }: { children: ReactNode }) {
  const [aboutData, setAboutData] = useState<AboutData | null>(null);
  const [companyHistory, setCompanyHistory] = useState<HistoryItem[]>([]);
  const [managementTeam, setManagementTeam] = useState<ManagementItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [resAbout, resHistory, resManagement] = await Promise.all([
          api.get("/about"),
          api.get("/history"),
          api.get("/management"),
        ]);

        setAboutData(resAbout.data);
        setCompanyHistory(resHistory.data);
        setManagementTeam(resManagement.data);
      } catch (err) {
        console.error("Error fetching About data:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  return (
    <AboutContext.Provider
      value={{ aboutData, companyHistory, managementTeam, isLoading }}
    >
      {children}
    </AboutContext.Provider>
  );
}

export function useAbout() {
  return useContext(AboutContext);
}
