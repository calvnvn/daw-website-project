/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";

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
    Promise.all([
      fetch("http://localhost:5000/api/about").then((res) => res.json()),
      fetch("http://localhost:5000/api/history").then((res) => res.json()),
      fetch("http://localhost:5000/api/management").then((res) => res.json()),
    ])
      .then(([about, history, management]) => {
        setAboutData(about);
        setCompanyHistory(history);
        setManagementTeam(management);
      })
      .catch((err) => console.error("Error fetching data:", err))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <AboutContext.Provider
      value={{ aboutData, companyHistory, managementTeam, isLoading }}
    >
      {children}
    </AboutContext.Provider>
  );
}

// 4. Custom Hook
export function useAbout() {
  return useContext(AboutContext);
}
