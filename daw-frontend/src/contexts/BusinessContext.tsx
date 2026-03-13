import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import api from "@/lib/api"; // Sesuaikan dengan instance axios Anda
import { toast } from "sonner";

export interface MapMarker {
  id: string;
  title: string;
  desc: string;
  type: "direct" | "tudung";
  dotX: string;
  dotY: string;
  boxX: string;
  boxY: string;
}

export interface SectionData {
  id: string; // "resources" atau "energy"
  title: string;
  htmlContent: string;
  hasMap: boolean;
  mapMarkers: MapMarker[];
}

interface BusinessContextType {
  sections: SectionData[];
  isLoading: boolean;
  refreshData: () => Promise<void>;
  updateSection: (id: string, data: Partial<SectionData>) => Promise<void>;
}

const BusinessContext = createContext<BusinessContextType | undefined>(
  undefined,
);

export const BusinessProvider = ({ children }: { children: ReactNode }) => {
  const [sections, setSections] = useState<SectionData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fungsi untuk menarik data dari Backend (Dipanggil sekali saat aplikasi render)
  const refreshData = async () => {
    setIsLoading(true);
    try {
      const response = await api.get("/businesses/public");
      setSections(response.data);
    } catch (error) {
      console.error("Failed to fetch businesses data", error);
      toast.error("Failed to connect to database");
    } finally {
      setIsLoading(false);
    }
  };

  // Fungsi untuk menyimpan data ke Backend
  const updateSection = async (id: string, data: Partial<SectionData>) => {
    await api.put(`/businesses/admin/${id}`, data);
    await refreshData(); // Otomatis refresh state global setelah berhasil save
  };

  useEffect(() => {
    refreshData();
  }, []);

  return (
    <BusinessContext.Provider
      value={{ sections, isLoading, refreshData, updateSection }}
    >
      {children}
    </BusinessContext.Provider>
  );
};

export const useBusiness = () => {
  const context = useContext(BusinessContext);
  if (context === undefined) {
    throw new Error("useBusiness must be used within a BusinessProvider");
  }
  return context;
};
