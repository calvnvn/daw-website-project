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
  is_locked?: boolean;
  lock_ticket?: string;
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
  id: string;
  category: string;
  title: string;
  htmlContent: string;
  hasMap: boolean;
  orderIndex: number;
  mapMarkers: MapMarker[];
  is_locked: boolean;
  lock_ticket?: string;
  has_rejected?: boolean;
  rejection_reason?: string;
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
  rejectedDraft: any | null;
  fetchRejectedDraft: (
    id: string,
    moduleName: string,
    signal?: AbortSignal,
  ) => Promise<void>;
  clearRejectedDraft: () => void;
  refreshData: () => Promise<void>;
  updateSection: (
    id: string,
    data: Partial<SectionData> & { previous_notrans?: string },
  ) => Promise<void>;
  addSection: (category: string, title: string) => Promise<void>;
  deleteSection: (id: string) => Promise<void>;
  addCategory: (data: MapCategory, status?: string) => Promise<void>;
  updateCategory: (
    id: string,
    data: Partial<MapCategory>,
    status?: string,
  ) => Promise<void>;
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
  const [rejectedDraft, setRejectedDraft] = useState<any | null>(null);

  // Menarik data draf yang ditolak dari backend untuk fitur Recovery Editor
  const fetchRejectedDraft = useCallback(
    async (id: string, moduleName: string, signal?: AbortSignal) => {
      try {
        const response = await api.get(`/approval/rejected/${id}`, {
          params: { module: moduleName },
          signal, // 💡 FIX: Teruskan signal pembatalan ke Axios
        });
        if (response.data.hasRejected) {
          setRejectedDraft(response.data.data);
        }
      } catch (error: any) {
        if (
          error.name === "CanceledError" ||
          error.message?.includes("canceled")
        ) {
          return;
        }

        if (error.response?.status === 404) {
          setRejectedDraft(null);
        } else {
          console.error("[FETCH_REJECTED_ERROR]:", error);
        }
      }
    },
    [],
  );

  // Cleaning Draf's State (saat save atau pindah tab)
  const clearRejectedDraft = useCallback(() => {
    setRejectedDraft(null);
  }, []);
  /**
   * @desc Synchronizes local memory with the remote database.
   * Fetches both business sections and map categories concurrently for performance.
   */
  // BusinessContext.tsx
  const refreshData = useCallback(async () => {
    console.log("🚀 [DEBUG] refreshData dipicu!");
    if (sections.length === 0) setIsLoading(true);

    try {
      const results = await Promise.allSettled([
        api.get("/businesses/public"),
        api.get("/map-categories"),
        api.get("/projects/public"),
      ]);

      console.log("📦 [DEBUG] Data Bisnis dari API:", results[0]);

      if (results[0].status === "fulfilled") setSections(results[0].value.data);
      if (results[1].status === "fulfilled")
        setCategories(results[1].value.data);
      if (results[2].status === "fulfilled")
        setPublicProjects(results[2].value.data);
    } catch (error) {
      console.error("❌ [DEBUG] refreshData Error:", error);
    } finally {
      setIsLoading(false);
    }
  }, []); // 💡 WAJIB KOSONG! Agar fungsi ini tidak dibuat ulang terus menerus.

  // Fungsi untuk menyimpan data ke Backend
  const updateSection = useCallback(
    async (
      id: string,
      data: Partial<SectionData> & { previous_notrans?: string },
    ) => {
      setIsProcessing(true);
      const toastId = toast.loading(
        "Menyinkronkan revisi dengan sistem OWL...",
      );
      try {
        const res = await api.put(`/businesses/admin/${id}`, data);

        if (res.status === 202) {
          setSections((prev) =>
            prev.map((s) =>
              s.id === id
                ? { ...s, is_locked: true, lock_ticket: res.data.ticket }
                : s,
            ),
          );
          toast.success("Revisi Diajukan!", {
            id: toastId,
            description: `Tiket ${res.data.ticket} berhasil dibuat. Data sementara dikunci.`,
            duration: 5000,
          });
        } else {
          toast.success("Data berhasil diperbarui secara langsung!", {
            id: toastId,
          });
        }

        clearRejectedDraft();
        await refreshData();
      } catch (error: any) {
        console.error(
          "🚨 [UPDATE_SECTION_FAILURE]:",
          error.response?.data || error.message,
        );

        const errorMessage =
          error.response?.data?.message ||
          "Gagal memproses perubahan sektor bisnis.";

        toast.error("Gagal Memperbarui", {
          id: toastId,
          description: errorMessage,
        });
        throw error;
      } finally {
        setIsProcessing(false); // Mematikan isProcessing global
      }
    },
    [refreshData, clearRejectedDraft],
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
   */
  const addSection = useCallback(
    async (category: string, title: string) => {
      setIsProcessing(true);
      const toastId = toast.loading("Membuat sektor bisnis baru...");
      try {
        // 1. FIX: Tambahkan deklarasi 'res'
        const res = await api.post("/businesses/admin", { category, title });

        if (res.status === 202) {
          toast.success("Sektor Baru Diajukan!", {
            id: toastId,
            description: `Tiket: ${res.data.ticket}. Menunggu approval Admin.`,
          });
        } else {
          toast.success(`Sektor ${category} berhasil dibuat!`, { id: toastId });
        }

        // 2. Refresh data setelah feedback muncul
        await refreshData();
      } catch (error: any) {
        console.error("[ADD_SECTION_ERROR]:", error);
        // 3. FIX: Gunakan toastId agar loading-nya hilang saat error
        toast.error("Gagal Membuat Sektor", {
          id: toastId,
          description: error.response?.data?.message || error.message,
        });
        throw error;
      } finally {
        setIsProcessing(false);
      }
    },
    [refreshData],
  );

  /**
   * @desc Removes an entire business section.
   */
  const deleteSection = useCallback(
    async (id: string) => {
      setIsProcessing(true);
      const toastId = toast.loading("Memproses penghapusan...");
      try {
        // 1. FIX: Tambahkan deklarasi 'res'
        const res = await api.delete(`/businesses/admin/${id}`);

        if (res.status === 202) {
          toast.success("Permintaan Hapus Dikirim", {
            id: toastId,
            description: `Tiket: ${res.data.ticket}. Data akan dikunci sampai disetujui.`,
          });
        } else {
          toast.success("Sektor berhasil dihapus permanen.", { id: toastId });
        }

        await refreshData();
      } catch (error: any) {
        console.error("[DELETE_SECTION_ERROR]:", error);
        toast.error("Gagal Menghapus", {
          id: toastId,
          description:
            error.response?.data?.message || "Terjadi kesalahan server.",
        });
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
        publicProjects,
        isLoading,
        isProcessing,
        rejectedDraft,
        fetchRejectedDraft,
        clearRejectedDraft,
        refreshData,
        updateSection,
        addCategory,
        updateCategory,
        deleteCategory,
        addSection,
        deleteSection,
      }}>
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
