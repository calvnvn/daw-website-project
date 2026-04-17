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

// --- INTERFACES ---
export interface PageOption {
  id: string;
  title: string;
  slug: string;
  is_locked?: boolean;
  lock_ticket?: string | null;
}

export interface Menu {
  id: string;
  label: string;
  parentId: string | null;
  orderIndex: number;
  type: "page" | "external" | "folder";
  pageId: string | null;
  externalLink: string | null;
  isActive: boolean;
  is_locked?: boolean;
  lock_ticket?: string | null;
  children?: Menu[];
}

interface ContentContextType {
  pages: PageOption[];
  treeMenus: Menu[];
  flatMenus: Menu[];
  isLoading: boolean;
  isNavigationLocked: boolean;
  navigationLockTicket: string | null;
  refreshData: () => Promise<void>;
}

// --- CONTEXT INITIALIZATION ---
const ContentContext = createContext<ContentContextType | undefined>(undefined);

export function ContentProvider({ children }: { children: ReactNode }) {
  const [pages, setPages] = useState<PageOption[]>([]);
  const [treeMenus, setTreeMenus] = useState<Menu[]>([]);
  const [flatMenus, setFlatMenus] = useState<Menu[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // State khusus untuk mendeteksi ALL_TREE lock pada navigasi
  const [isNavigationLocked, setIsNavigationLocked] = useState(false);
  const [navigationLockTicket, setNavigationLockTicket] = useState<
    string | null
  >(null);

  /**
   * ENGINE: Parallel Fetching & Identity Stability
   * Menggunakan useCallback dengan array kosong [] untuk mencegah infinite loop.
   * Menggunakan Promise.allSettled agar jika satu API gagal, yang lain tetap jalan.
   */
  const refreshData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [pagesRes, treeRes, flatRes] = await Promise.allSettled([
        api.get("/pages"),
        api.get("/menus/tree"),
        api.get("/menus/flat"),
      ]);

      // 1. Process Pages Data
      if (pagesRes.status === "fulfilled") {
        setPages(pagesRes.value.data?.data || pagesRes.value.data || []);
      } else {
        console.error("[ContentContext] Gagal memuat Pages:", pagesRes.reason);
      }

      // 2. Process Tree Menus Data
      if (treeRes.status === "fulfilled") {
        setTreeMenus(treeRes.value.data?.data || treeRes.value.data || []);
      } else {
        console.error(
          "[ContentContext] Gagal memuat Menu Tree:",
          treeRes.reason,
        );
      }

      // 3. Process Flat Menus & Global Lock Detection
      if (flatRes.status === "fulfilled") {
        const flatData: Menu[] =
          flatRes.value.data?.data || flatRes.value.data || [];
        setFlatMenus(flatData);

        // GLOBAL LOCK DETECTION:
        // Cukup cari 1 saja menu yang is_locked, berarti ALL_TREE sedang terkunci
        const lockedMenu = flatData.find((m) => m.is_locked);
        if (lockedMenu) {
          setIsNavigationLocked(true);
          setNavigationLockTicket(lockedMenu.lock_ticket || null);
        } else {
          setIsNavigationLocked(false);
          setNavigationLockTicket(null);
        }
      } else {
        console.error(
          "[ContentContext] Gagal memuat Menu Flat:",
          flatRes.reason,
        );
      }
    } catch (error) {
      console.error("[ContentContext] Kesalahan Sinkronisasi Fatal:", error);
      toast.error("Gagal menyinkronkan data Content Manager.");
    } finally {
      setIsLoading(false);
    }
  }, []); // Array kosong wajib hukumnya di sini!

  /**
   * LIFECYCLE & EVENT LISTENER
   * Menjalankan fetch saat pertama kali mount dan mendengarkan "teriakan" (Event)
   * dari komponen lain (misal: saat Editor sukses publish halaman baru).
   */
  useEffect(() => {
    refreshData();

    const handleDataUpdate = () => {
      console.log(
        "🔄 [ContentContext] Sinyal pembaruan diterima, menyinkronkan ulang...",
      );
      refreshData();
    };

    // Pasang telinga untuk sinyal custom
    window.addEventListener("contentDataUpdated", handleDataUpdate);
    window.addEventListener("pagesDataUpdated", handleDataUpdate);

    return () => {
      // Cabut telinga saat unmount biar memori gak bocor
      window.removeEventListener("contentDataUpdated", handleDataUpdate);
      window.removeEventListener("pagesDataUpdated", handleDataUpdate);
    };
  }, [refreshData]);

  return (
    <ContentContext.Provider
      value={{
        pages,
        treeMenus,
        flatMenus,
        isLoading,
        isNavigationLocked,
        navigationLockTicket,
        refreshData,
      }}>
      {children}
    </ContentContext.Provider>
  );
}

// --- CUSTOM HOOK ---
export function useContent() {
  const context = useContext(ContentContext);
  if (context === undefined) {
    throw new Error("useContent must be used within a ContentProvider");
  }
  return context;
}
