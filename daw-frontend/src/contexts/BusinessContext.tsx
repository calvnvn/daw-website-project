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
import { useTranslation } from "react-i18next";
import { useAuth } from "./AuthContext";
import { getErrorMessage } from "@/lib/utils";

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
  terjemahanDesc?: string;
}

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

interface BusinessContextType {
  sections: SectionData[];
  publicSections: SectionData[];
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
  deleteSection: (id: string) => Promise<any>;
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
  const { user } = useAuth();
  const { i18n } = useTranslation();
  const [sections, setSections] = useState<SectionData[]>([]);
  const [publicSections, setPublicSections] = useState<SectionData[]>([]);
  const [categories, setCategories] = useState<MapCategory[]>([]);
  const [publicProjects, setPublicProjects] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [rejectedDraft, setRejectedDraft] = useState<any | null>(null);

  const fetchRejectedDraft = useCallback(
    async (id: string, moduleName: string, signal?: AbortSignal) => {
      try {
        const response = await api.get(`/approval/rejected/${id}`, {
          params: { module: moduleName },
          signal,
        });
        if (response.data.hasRejected) {
          setRejectedDraft(response.data.data);
        }
      } catch (error: unknown) {
        if (
          (typeof error === "object" &&
            error !== null &&
            "name" in error &&
            (error as { name?: string }).name === "CanceledError") ||
          (typeof error === "object" &&
            error !== null &&
            "message" in error &&
            typeof (error as { message?: string }).message === "string" &&
            (error as { message: string }).message.includes("canceled"))
        ) {
          return;
        }

        if (
          typeof error === "object" &&
          error !== null &&
          "response" in error &&
          (error as { response?: { status?: number } }).response?.status === 404
        ) {
          setRejectedDraft(null);
        } else {
          console.error("[FETCH_REJECTED_ERROR]:", error);
        }
      }
    },
    [],
  );

  const clearRejectedDraft = useCallback(() => {
    setRejectedDraft(null);
  }, []);

  const refreshData = useCallback(async () => {
    const token = localStorage.getItem("daw_token");
    if (token && user === null) return;

    const canAccessAdmin = ["superadmin", "admin", "editor"].includes(
      user?.role || "",
    );

    if (sections.length === 0) setIsLoading(true);

    try {
      const isAdminArea = window.location.pathname.startsWith("/admin");
      const langParam = isAdminArea
        ? "en"
        : i18n.language === "id"
          ? "id"
          : "en";

      const promises: Promise<any>[] = [
        api.get("/map-categories", {
          params: { lang: langParam },
        }), // index 0
        api.get("/projects/public", {
          params: { lang: langParam },
        }), // index 1
        api.get("/businesses/public", {
          params: { lang: langParam },
        }), // index 2
      ];

      const sectionsIndex = promises.length; // index 3

      if (canAccessAdmin) {
        promises.push(api.get("/businesses/admin"));
      }

      const results = await Promise.allSettled(promises);

      if (results[0].status === "fulfilled")
        setCategories(
          results[0].value.data?.data || results[0].value.data || [],
        );
      if (results[1].status === "fulfilled")
        setPublicProjects(
          results[1].value.data?.data || results[1].value.data || [],
        );
      if (results[2].status === "fulfilled") {
        const pData = results[2].value.data;
        setPublicSections(
          Array.isArray(pData?.data)
            ? pData.data
            : Array.isArray(pData)
              ? pData
              : [],
        );
      }

      if (canAccessAdmin) {
        const sectionRes = results[sectionsIndex];

        if (sectionRes.status === "fulfilled") {
          const data = sectionRes.value.data;
          setSections(
            Array.isArray(data?.data)
              ? data.data
              : Array.isArray(data)
                ? data
                : [],
          );
        } else {
          console.warn(
            "⚠️ [RETRY] Admin fetch failed, falling back to public data...",
          );
          if (results[2].status === "fulfilled") {
            const pData = results[2].value.data;
            setSections(Array.isArray(pData) ? pData : []);
          }
        }
      } else {
        // Non-admin uses publicSections for both sections and publicSections
        if (results[2].status === "fulfilled") {
          const pData = results[2].value.data;
          setSections(Array.isArray(pData) ? pData : []);
        }
      }
    } catch (error) {
      console.error("❌ [DEBUG] refreshData Global Error:", error);
    } finally {
      setIsLoading(false);
    }
  }, [user, i18n.language]);

  const updateSection = useCallback(
    async (
      id: string,
      data: Partial<SectionData> & { previous_notrans?: string },
    ) => {
      setIsProcessing(true);
      const toastId = toast.loading("Menyinkronkan revisi dengan ERP...");
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
      } catch (error: unknown) {
        console.error(
          "🚨 [UPDATE_SECTION_FAILURE]:",
          (typeof error === "object" && error !== null && "response" in error
            ? (error as any).response
            : undefined) || getErrorMessage(error),
        );

        const errorMessage =
          (typeof error === "object" && error !== null && "response" in error
            ? (error as any).response?.data?.message
            : undefined) || "Gagal memproses perubahan sektor bisnis.";

        toast.error("Gagal Memperbarui", {
          id: toastId,
          description: errorMessage,
        });
        throw error;
      } finally {
        setIsProcessing(false);
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
      } catch (error: unknown) {
        toast.error(getErrorMessage(error) || "Gagal menambah kategori");
        throw error;
      } finally {
        setIsProcessing(false);
      }
    },
    [refreshData],
  );

  const updateCategory = useCallback(
    async (id: string, data: Partial<MapCategory>) => {
      setIsProcessing(true);
      try {
        await api.put(`/map-categories/${id}`, data);
        await refreshData();
        toast.success("Kategori berhasil diperbarui!");
      } catch (error) {
        toast.error("Gagal memperbarui kategori");
        throw error;
      } finally {
        setIsProcessing(false);
      }
    },
    [refreshData],
  );

  const deleteCategory = useCallback(
    async (id: string) => {
      setIsProcessing(true);
      try {
        await api.delete(`/map-categories/${id}`);
        await refreshData();
        toast.success("Kategori telah dihapus");
      } catch (error) {
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

  const addSection = useCallback(
    async (category: string, title: string) => {
      setIsProcessing(true);
      const toastId = toast.loading("Membuat sektor bisnis baru...");
      try {
        const res = await api.post("/businesses/admin", { category, title });

        if (res.status === 202) {
          toast.success("Sektor Baru Diajukan!", {
            id: toastId,
            description: `Tiket: ${res.data.ticket}. Menunggu approval Admin.`,
          });
        } else {
          toast.success(`Sektor ${category} berhasil dibuat!`, { id: toastId });
        }

        await refreshData();
      } catch (error: unknown) {
        console.error("[ADD_SECTION_ERROR]:", error);
        toast.error("Gagal Membuat Sektor", {
          id: toastId,
          description: getErrorMessage(error) || "Gagal Membuat Sektor",
        });
        throw error;
      } finally {
        setIsProcessing(false);
      }
    },
    [refreshData],
  );

  const deleteSection = useCallback(
    async (id: string) => {
      setIsProcessing(true);
      try {
        const res = await api.delete(`/businesses/admin/${id}`);
        await refreshData();
        return res;
      } catch (error) {
        console.error("[DELETE_SECTION_ERROR]:", error);
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
        publicSections,
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
