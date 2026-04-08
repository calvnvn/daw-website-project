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

/**
 * @interface SectionData
 * Represents a major business division (e.g., Resources, Energy).
 */
export interface SectionData {
  id: string; // The slug-based unique identifier
  category: string; // Display name of the sector
  title: string; // The eyebrow/hero title
  htmlContent: string; // Rich text editorial content
  hasMap: boolean; // Toggle for interactive map visibility
  orderIndex: number; // Sequence for frontend display sorting
  mapMarkers: MapMarker[];
}

/**
 * @interface BusinessContextType
 * Defines the global state and methods accessible throughout the business management module.
 */
interface BusinessContextType {
  sections: SectionData[];
  categories: MapCategory[];
  publicProjects: any[];
  isLoading: boolean;
  isProcessing: boolean;
  refreshData: () => Promise<void>;
  updateSection: (id: string, data: Partial<SectionData>) => Promise<void>;
  addSection: (category: string, title: string) => Promise<void>;
  deleteSection: (id: string) => Promise<void>;
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
  const [publicProjects, setPublicProjects] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  /**
   * @desc Synchronizes local memory with the remote database.
   * Fetches both business sections and map categories concurrently for performance.
   */
  const refreshData = useCallback(async () => {
    setIsLoading(true);
    try {
      // FIX 5: Tarik data proyek publik secara paralel bersama data bisnis lainnya
      const [bizRes, catRes, projRes] = await Promise.all([
        api.get("/businesses/public"),
        api.get("/map-categories"),
        api.get("/projects/public"), // Nambah 1 API Call ini bikin sisa web kenceng banget
      ]);
      setSections(bizRes.data);
      setCategories(catRes.data);
      setPublicProjects(projRes.data); // Simpan ke state global
    } catch (error) {
      console.error("[REFRESH_DATA_FAILURE]:", error);
      toast.error(
        "Connectivity issue: Unable to sync with the business database.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fungsi untuk menyimpan data ke Backend
  const updateSection = useCallback(
    async (id: string, data: Partial<SectionData>) => {
      setIsProcessing(true);
      try {
        await api.put(`/businesses/admin/${id}`, data);
        await refreshData();
        toast.success("Data bisnis berhasil diperbarui!");
      } catch (error: any) {
        console.error("Save error:", error);
        toast.error(
          error.response?.data?.message || "Gagal menyimpan perubahan",
        );
        throw error;
      } finally {
        setIsProcessing(false);
      }
    },
    [refreshData],
  );

  const addCategory = useCallback(
    async (data: MapCategory) => {
      setIsProcessing(true);
      try {
        await api.post("/map-categories", data);
        await refreshData();
        toast.success("Kategori baru berhasil ditambahkan!");
      } catch (error: any) {
        toast.error(error.response?.data?.message || "Gagal menambah kategori");
        throw error;
      } finally {
        setIsProcessing(false);
      }
    },
    [refreshData],
  );

  // 2. Update Kategori (Warna/Nama)
  const updateCategory = useCallback(
    async (id: string, data: Partial<MapCategory>) => {
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
    },
    [refreshData],
  );

  // 3. Hapus Kategori
  const deleteCategory = useCallback(
    async (id: string) => {
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
    },
    [refreshData],
  );

  /**
   * @desc Dispatches a POST request to initialize a new business unit.
   * @param {string} category - The display name (e.g., "Logistics").
   * @param {string} title - Initial eyebrow title.
   */
  const addSection = useCallback(
    async (category: string, title: string) => {
      setIsProcessing(true);
      try {
        await api.post("/businesses/admin", { category, title });
        await refreshData();
        toast.success(`Sektor ${category} berhasil dibuat!`);
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : "Failed to create section";
        console.error("[ADD_SECTION_ERROR]:", error);
        toast.error(message);
        throw error;
      } finally {
        setIsProcessing(false);
      }
    },
    [refreshData],
  );

  /**
   * @desc Removes an entire business section and its associated map markers.
   * @param {string} id - The slug-based ID of the section to be purged.
   */
  const deleteSection = useCallback(
    async (id: string) => {
      setIsProcessing(true);
      try {
        await api.delete(`/businesses/admin/${id}`);
        await refreshData();
        toast.success("Sektor bisnis berhasil dihapus");
      } catch (error: any) {
        toast.error("Gagal menghapus sektor bisnis");
        throw error;
      } finally {
        setIsProcessing(false);
      }
    },
    [refreshData],
  );

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  return (
    <BusinessContext.Provider
      value={{
        sections,
        categories,
        publicProjects, // FIX 6: Export ini ke luar supaya bisa dipakai komponen lain
        isLoading,
        isProcessing,
        refreshData,
        updateSection,
        addCategory,
        updateCategory,
        deleteCategory,
        addSection,
        deleteSection,
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
