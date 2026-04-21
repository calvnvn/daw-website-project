import { useState, useEffect, useMemo, useCallback } from "react";
import { toast } from "sonner";

// Context
import {
  useBusiness,
  type SectionData,
  type MapMarker,
} from "@/contexts/BusinessContext";

// Components
import SectionHeader from "./components/SectionHeader";
import SectionTabs from "./components/SectionTabs";
import BusinessEditor from "./components/BusinessEditor";
import MapManager from "./components/MapManager";
import CategoryManager from "./components/CategoryManager";

// Modals
import AddSectionModal from "./modals/AddSectionModal";
import DeleteSectionModal from "./modals/DeleteSectionModal";
import MapPickerModal from "./modals/MapPickerModal";
import { useAuth } from "@/contexts/AuthContext";
import { LockIcon, ShieldAlert } from "lucide-react";

const normalizeBool = (val: any): boolean => {
  return val === true || val === "true" || val === 1 || val === "1";
};

const initialFormData: Omit<SectionData, "id"> = {
  category: "",
  title: "",
  htmlContent: "",
  hasMap: false,
  orderIndex: 0,
  mapMarkers: [],
  is_locked: false,
};

export default function ManageBusinesses() {
  const { user } = useAuth();
  const {
    sections,
    categories,
    isLoading,
    updateSection,
    addSection,
    deleteSection,
    fetchRejectedDraft,
    clearRejectedDraft,
    rejectedDraft,
  } = useBusiness();

  // --- 1. CORE STATES ---
  const [activeTab, setActiveTab] = useState<string>("");
  const [formData, setFormData] =
    useState<Omit<SectionData, "id">>(initialFormData);
  const [originalData, setOriginalData] =
    useState<Omit<SectionData, "id">>(initialFormData);

  // --- 2. UI & MODAL STATES ---
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDiscardModalOpen, setIsDiscardModalOpen] = useState(false);
  const [isMapModalOpen, setIsMapModalOpen] = useState(false);
  const [pendingTab, setPendingTab] = useState<string | null>(null);

  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

  // --- 3. MEMOIZED UTILITIES (Performance Guard) ---
  const categoryMap = useMemo(() => {
    return Object.fromEntries(categories.map((cat) => [cat.id, cat.color]));
  }, [categories]);

  const isSuperadmin = user?.role === "Superadmin" || user?.role === "admin";
  const currentSection = sections.find((s) => s.id === activeTab);
  const isSectionLocked = currentSection?.is_locked === true;

  const shouldLockUI = isSectionLocked && !isSuperadmin;
  const isOverrideMode = isSectionLocked && isSuperadmin;

  const lockStyles = shouldLockUI
    ? "opacity-60 grayscale-[30%] pointer-events-none cursor-not-allowed select-none"
    : "";

  // LOGIC: DIFF ENGINE (Mencegah Spam Approval)
  const hasDataChanged = useCallback(() => {
    // Clone data dan hapus metadata sistem agar komparasi murni pada konten
    const currentData = { ...formData };
    delete (currentData as any).is_locked;
    delete (currentData as any).lock_ticket;

    const baseData = { ...originalData };
    delete (baseData as any).is_locked;
    delete (baseData as any).lock_ticket;

    // Deep compare menggunakan JSON stringify (aman untuk array MapMarkers)
    return JSON.stringify(currentData) !== JSON.stringify(baseData);
  }, [formData, originalData]);

  // DATA ENGINE (SAFE SYNC & SNAPSHOT)
  useEffect(() => {
    if (!sections || sections.length === 0) {
      if (activeTab !== "categories") setActiveTab("categories");
      return;
    }

    if (!activeTab) {
      setActiveTab(sections[0].id);
      return;
    }

    if (activeTab === "categories") {
      setFormData(initialFormData);
      setOriginalData(initialFormData);
      return;
    }

    // Sync Form Data & Anchor Original Data
    if (currentSection && !isEditing) {
      const rawMarkers =
        (currentSection as any).mapMarkers ||
        (currentSection as any).BusinessMapMarkers ||
        [];

      const normalizedData = {
        category: currentSection.category || "",
        title: currentSection.title || "",
        htmlContent: currentSection.htmlContent || "",
        hasMap: normalizeBool(currentSection.hasMap),
        orderIndex: currentSection.orderIndex || 0,
        mapMarkers: Array.isArray(rawMarkers) ? [...rawMarkers] : [],
        is_locked: currentSection.is_locked || false,
        lock_ticket: (currentSection as any).lock_ticket || "",
      };

      setFormData(normalizedData);
      setOriginalData(normalizedData); // ⚓ The Diff Anchor
    }
  }, [activeTab, sections, currentSection, isEditing]);

  // AGGRESSIVE LOCKDOWN GUARD (Consolidated)
  useEffect(() => {
    if (shouldLockUI && isEditing) {
      setIsEditing(false);
      toast.info("Akses ditutup. Sektor ini sedang dalam proses peninjauan.");
    }
  }, [shouldLockUI, isEditing]);

  // PARALLEL FETCHING (REJECTED DRAFT)
  useEffect(() => {
    if (!activeTab || activeTab === "categories") {
      clearRejectedDraft();
      return;
    }

    const abortController = new AbortController();
    fetchRejectedDraft(activeTab, "BusinessSection", abortController.signal);

    return () => abortController.abort();
  }, [activeTab, fetchRejectedDraft, clearRejectedDraft]);

  // SECURITY GUARD (Unsaved changes warning)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isEditing) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isEditing]);

  // DATA HANDLERS (MapManager Props)
  const updateMarker = useCallback(
    (index: number, field: keyof MapMarker, value: string) => {
      setFormData((prev) => {
        const updated = [...prev.mapMarkers];
        updated[index] = { ...updated[index], [field]: value };
        return { ...prev, mapMarkers: updated };
      });
    },
    [],
  );

  const removeMarker = useCallback((index: number) => {
    setFormData((prev) => ({
      ...prev,
      mapMarkers: prev.mapMarkers.filter((_, i) => i !== index),
    }));
  }, []);

  const handleSelectLocation = useCallback(
    (coords: { x: string; y: string }) => {
      const newMarker: MapMarker = {
        id: `new-${Date.now()}`,
        title: "Lokasi Baru",
        desc: "",
        categoryId: categories.length > 0 ? categories[0].id : "",
        dotX: coords.x,
        dotY: coords.y,
        boxX: coords.x,
        boxY: coords.y,
        mapUrl: "",
      };
      setFormData((prev) => ({
        ...prev,
        mapMarkers: [...prev.mapMarkers, newMarker],
      }));
      setIsMapModalOpen(false);
      toast.success("Titik lokasi berhasil ditambahkan.");
    },
    [categories],
  );

  // UI HANDLERS
  const handleTabChange = (targetTab: string) => {
    if (targetTab === activeTab) return;
    if (isEditing) {
      setPendingTab(targetTab);
      setIsDiscardModalOpen(true);
    } else {
      setActiveTab(targetTab);
    }
  };

  const handleSave = async () => {
    if (activeTab === "categories") return;

    // 1. Sovereign Guard: Cegah submit dari Inspect Element
    if (shouldLockUI) {
      return toast.error("Akses Dibatasi.", {
        description: "Data ini sedang dalam peninjauan.",
      });
    }

    // 2. Anti-Spam Check: Jangan kirim ke server jika tidak ada perubahan
    if (!hasDataChanged()) {
      setIsEditing(false);
      return toast.info("Tidak ada perubahan terdeteksi.", {
        description: "Data Anda masih sama dengan versi live.",
        duration: 3000,
      });
    }

    // 3. Execution
    setIsSaving(true);
    const toastId = toast.loading(
      isSuperadmin
        ? "Menyimpan langsung (Override)..."
        : "Mengirim revisi ke sistem...",
    );

    try {
      await updateSection(activeTab, {
        ...formData,
        previous_notrans: rejectedDraft?.notrans,
      });

      // Cleanup setelah sukses
      clearRejectedDraft();
      setIsEditing(false);

      toast.success(
        isSuperadmin
          ? "Pembaruan berhasil diterapkan."
          : "Revisi diajukan! Menunggu persetujuan.",
        { id: toastId },
      );
    } catch (err: any) {
      console.error("Save Error:", err);
      toast.error(err.response?.data?.message || "Gagal menyimpan perubahan.", {
        id: toastId,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDiscard = () => {
    setIsEditing(false);
    if (pendingTab) setActiveTab(pendingTab);
    setIsDiscardModalOpen(false);
    setPendingTab(null);
    toast.info("Perubahan dibatalkan.");
  };

  if (isLoading && sections.length === 0) {
    return (
      <div className="h-[60vh] flex items-center justify-center text-slate-500">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-daw-green border-t-transparent rounded-full animate-spin"></div>
          Memuat tata letak bisnis...
        </div>
      </div>
    );
  }

  // --- 8. RENDER LAYOUT ---
  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500 pb-12">
      {/* 🚀 THE SOVEREIGN BANNERS (Contextual Awareness) */}
      {/* 1. Amber Banner (Superadmin Override) */}
      {isOverrideMode && activeTab !== "categories" && (
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-center gap-4 animate-in slide-in-from-top-4 shadow-sm">
          <div className="bg-amber-100 p-2 rounded-full text-amber-600 shrink-0">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-black text-amber-900 uppercase tracking-tight">
              Mode Override Superadmin
            </h4>
            <p className="text-xs text-amber-700 leading-relaxed mt-0.5">
              Data sektor ini sedang dikunci oleh tiket peninjauan{" "}
              <strong>{currentSection?.lock_ticket}</strong>.
              <span className="font-bold underline ml-1">
                Menyimpan akan membatalkan draf tersebut secara sepihak.
              </span>
            </p>
          </div>
        </div>
      )}

      {/* 2. Blue Banner (Editor Locked) */}
      {shouldLockUI && activeTab !== "categories" && (
        <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl flex items-center gap-4 animate-pulse shadow-sm">
          <div className="bg-blue-100 p-2 rounded-full text-blue-600 shrink-0">
            <LockIcon className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-black text-blue-900 uppercase tracking-tight">
              Sedang Ditinjau
            </h4>
            <p className="text-xs text-blue-700 leading-relaxed mt-0.5">
              Akses Dibatasi. Anda tidak dapat mengubah data ini karena revisi
              sebelumnya sedang menunggu persetujuan.
            </p>
          </div>
        </div>
      )}

      <SectionHeader
        activeTab={activeTab}
        isEditing={isEditing}
        setIsEditing={setIsEditing}
        isSaving={isSaving}
        onSave={handleSave}
        onDeleteClick={() => setIsDeleteModalOpen(true)}
        isLocked={shouldLockUI}
        lockTicket={currentSection?.lock_ticket}
        isSuperadmin={isSuperadmin}
      />

      <SectionTabs
        activeTab={activeTab}
        sections={sections}
        onChange={handleTabChange}
        isEditing={isEditing}
        onAddClick={() => setIsAddModalOpen(true)}
      />

      {/* 🚀 AGGRESSIVE VISUAL LOCKDOWN */}
      {/* lockStyles disuntikkan ke class utama main */}
      <main
        className={`bg-white rounded-b-xl border border-t-0 border-slate-200 shadow-sm p-6 lg:p-8 min-h-[500px] transition-all duration-500 ${lockStyles}`}>
        {activeTab === "categories" ? (
          <CategoryManager />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* 1. EDITOR ARTIKEL (MANDATORY APPROVAL) */}
            <BusinessEditor
              activeTab={activeTab}
              formData={formData}
              setFormData={setFormData}
              isEditing={isEditing && !shouldLockUI} // Guard ganda
            />

            {/* 2. MAP MANAGER (BYPASS APPROVAL) */}
            <MapManager
              formData={formData}
              setFormData={setFormData}
              isEditing={isEditing && !shouldLockUI} // Guard ganda
              categories={categories}
              categoryMap={categoryMap}
              onOpenMapPicker={() => setIsMapModalOpen(true)}
              updateMarker={updateMarker}
              removeMarker={removeMarker}
            />
          </div>
        )}
      </main>

      {/* --- MODALS (BYPASS GATEWAYS) --- */}
      {isAddModalOpen && (
        <AddSectionModal
          onClose={() => setIsAddModalOpen(false)}
          // addSection sekarang langsung simpan (Bypass) di backend
          addSection={addSection}
        />
      )}

      {isDeleteModalOpen && (
        <DeleteSectionModal
          activeTab={activeTab}
          sections={sections}
          onClose={() => setIsDeleteModalOpen(false)}
          deleteSection={deleteSection}
          setActiveTab={setActiveTab}
        />
      )}

      {/* Map Picker tetap bisa dibuka kapan saja selama isEditing aktif */}
      <MapPickerModal
        isOpen={isMapModalOpen}
        onClose={() => setIsMapModalOpen(false)}
        onSelectLocation={handleSelectLocation}
        mapMarkers={formData.mapMarkers}
        categoryMap={categoryMap}
        isMobile={isMobile}
      />

      {/* Discard Modal Tetap Dipertahankan untuk Safety */}
      {isDiscardModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 ">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-lg font-serif font-bold text-slate-900 mb-2">
              Perubahan Belum Disimpan
            </h3>
            <p className="text-sm text-slate-500 mb-6">
              Keluar dari tab ini akan membatalkan perubahan Anda.
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={confirmDiscard}
                className="w-full py-2.5 bg-red-50 text-red-600 rounded-xl font-bold hover:bg-red-100 transition-colors">
                Buang & Keluar
              </button>
              <button
                onClick={() => setIsDiscardModalOpen(false)}
                className="w-full py-2.5 bg-slate-100 text-slate-900 rounded-xl font-bold hover:bg-slate-200 transition-colors">
                Tetap di Sini
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
