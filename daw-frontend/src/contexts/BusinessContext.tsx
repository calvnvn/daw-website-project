import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import api from "@/lib/api"; // Sesuaikan dengan instance axios Anda
import { toast } from "sonner";

export interface MapCategory {
  id: string;
  name: string;
  color: string;
}

export interface MapMarker {
  id: string;
  title: string;
  desc: string;
  categoryId: string;
  dotX: string;
  dotY: string;
  boxX: string;
  boxY: string;
  mapUrl?: string;
  categoryData?: MapCategory;
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
  categories: MapCategory[];
  isLoading: boolean;
  isProcessing: boolean;
  refreshData: () => Promise<void>;
  updateSection: (id: string, data: Partial<SectionData>) => Promise<void>;
  addCategory: (data: MapCategory) => Promise<void>;
  updateCategory: (id: string, data: Partial<MapCategory>) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
}

const BusinessContext = createContext<BusinessContextType | undefined>(
  undefined,
);

export const BusinessProvider = ({ children }: { children: ReactNode }) => {
  const [sections, setSections] = useState<SectionData[]>([]);
  const [categories, setCategories] = useState<MapCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  // Fungsi untuk menarik data dari Backend (Dipanggil sekali saat aplikasi render)
  const refreshData = async () => {
    setIsLoading(true);
    try {
      const [bizRes, catRes] = await Promise.all([
        api.get("/businesses/public"),
        api.get("/map-categories"),
      ]);
      setSections(bizRes.data);
      setCategories(catRes.data);
    } catch (error) {
      console.error("Failed to fetch businesses data", error);
      toast.error("Failed to connect to database");
    } finally {
      setIsLoading(false);
    }
  };

  // Fungsi untuk menyimpan data ke Backend
  const updateSection = async (id: string, data: Partial<SectionData>) => {
    setIsProcessing(true);
    try {
      await api.put(`/businesses/admin/${id}`, data);
      await refreshData();
      toast.success("Data bisnis berhasil diperbarui!");
    } catch (error: any) {
      console.error("Save error:", error);
      toast.error(error.response?.data?.message || "Gagal menyimpan perubahan");
      throw error; // Re-throw agar komponen bisa menangani state loading lokalnya
    } finally {
      setIsProcessing(false);
    }
  };

  const addCategory = async (data: MapCategory) => {
    setIsProcessing(true);
    try {
      await api.post("/map-categories", data);
      await refreshData(); // Sinkronisasi ulang data global
      toast.success("Kategori baru berhasil ditambahkan!");
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Gagal menambah kategori");
      throw error;
    } finally {
      setIsProcessing(false);
    }
  };

  // 2. Update Kategori (Warna/Nama)
  const updateCategory = async (id: string, data: Partial<MapCategory>) => {
    setIsProcessing(true);
    try {
      await api.put(`/map-categories/${id}`, data);
      await refreshData();
      toast.success("Kategori berhasil diperbarui!");
    } catch (error: any) {
      toast.error("Gagal memperbarui kategori");
      throw error;
    } finally {
      setIsProcessing(false);
    }
  };

  // 3. Hapus Kategori
  const deleteCategory = async (id: string) => {
    setIsProcessing(true);

    try {
      await api.delete(`/map-categories/${id}`);
      await refreshData();
      toast.success("Kategori telah dihapus");
    } catch (error: any) {
      toast.error(
        "Gagal menghapus (Kategori mungkin masih digunakan oleh marker)",
      );
      throw error;
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  return (
    <BusinessContext.Provider
      value={{
        sections,
        categories,
        isLoading,
        isProcessing,
        refreshData,
        updateSection,
        addCategory,
        updateCategory,
        deleteCategory,
      }}
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
