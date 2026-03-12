/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";

// 1. Definisikan Struktur Data
export interface InvestmentSettings {
  teaserHeadline: string;
  teaserBody: string;
  sectionIntro: string;
}

export interface Affiliate {
  id: number;
  name: string;
  desc: string;
  category: "fnb" | "steel" | "finance" | "edu";
  logoUrl: string | null;
}

interface InvestmentContextType {
  settings: InvestmentSettings | null;
  companies: Affiliate[];
  isLoading: boolean;
  refreshData: () => Promise<void>; // Fungsi untuk memanggil ulang data setelah admin nge-save
}

// 2. Buat Context
export const InvestmentContext = createContext<InvestmentContextType>({
  settings: null,
  companies: [],
  isLoading: true,
  refreshData: async () => {},
});

// 3. Buat Provider
export function InvestmentProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<InvestmentSettings | null>(null);
  const [companies, setCompanies] = useState<Affiliate[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = async () => {
    try {
      const res = await fetch("http://localhost:5000/api/investment");
      if (res.ok) {
        const data = await res.json();
        setSettings(data.settings);
        setCompanies(data.companies);
      }
    } catch (err) {
      console.error("Failed to fetch investment data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <InvestmentContext.Provider
      value={{ settings, companies, isLoading, refreshData: fetchData }}
    >
      {children}
    </InvestmentContext.Provider>
  );
}

// 4. Custom Hook
export function useInvestments() {
  return useContext(InvestmentContext);
}
