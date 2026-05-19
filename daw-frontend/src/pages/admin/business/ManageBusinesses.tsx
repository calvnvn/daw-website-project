import { useState, useEffect, useMemo, useCallback } from "react";
import { toast } from "sonner";
import api from "@/lib/api";

import {
  useBusiness,
  type SectionData,
  type MapMarker,
} from "@/contexts/BusinessContext";
import SectionHeader from "./components/SectionHeader";
import SectionTabs from "./components/SectionTabs";
import BusinessEditor from "./components/BusinessEditor";
import MapManager from "./components/MapManager";
import CategoryManager from "./components/CategoryManager";
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
    refreshData,
  } = useBusiness();

  // --- 1. CORE & DATA STATES (Blueprint Form: 1A) ---
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

  // --- 3. DERIVED STATES & AUTHORITY (Blueprint Logic: 1 & 5) ---
  const categoryMap = useMemo(() => {
    if (!Array.isArray(categories)) return {};
    return Object.fromEntries(categories.map((cat) => [cat.id, cat.color]));
  }, [categories]);

  const isSuperadmin = user?.role === "superadmin" || user?.role === "admin";
  const currentSection = useMemo(
    () => sections.find((s) => s.id === activeTab),
    [sections, activeTab],
  );

  // Standard Variables Mapping
  const isSectionLocked = currentSection?.is_locked === true;
  const isNeedsRevision = currentSection?.has_rejected === true;
  const isPending = isSectionLocked && !isNeedsRevision;

  const shouldLockUI = isPending && !isSuperadmin;
  const isOverrideMode = isPending && isSuperadmin;
  const isDeleting = isPending && currentSection?.lock_ticket?.includes("DEL");

  const lockStyles = shouldLockUI
    ? "opacity-60 grayscale-[30%] pointer-events-none cursor-not-allowed select-none"
    : "";

  // --- 4. DIFF ENGINE / SPAM PREVENTION (Blueprint Form: 4) ---
  const hasDataChanged = useCallback(() => {
    const currentData = { ...formData };
    delete (currentData as any).is_locked;
    delete (currentData as any).lock_ticket;

    const baseData = { ...originalData };
    delete (baseData as any).is_locked;
    delete (baseData as any).lock_ticket;

    return JSON.stringify(currentData) !== JSON.stringify(baseData);
  }, [formData, originalData]);

  // --- 5. LIFECYCLE & SYNCHRONIZATION (Blueprint Logic: 3) ---

  // A. Local State Synchronization
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

    if (currentSection && !isEditing) {
      const rawMarkers =
        (currentSection as any).mapMarkers ||
        (currentSection as any).BusinessMapMarkers ||
        [];
      const normalizedData = {
        category: currentSection.category ?? "",
        title: currentSection.title || "",
        htmlContent: currentSection.htmlContent || "",
        hasMap: normalizeBool(currentSection.hasMap),
        orderIndex: currentSection.orderIndex || 0,
        mapMarkers: Array.isArray(rawMarkers)
          ? rawMarkers.map((m: any) => ({
              ...m,
              title: m.title ?? "",
              desc: m.desc ?? "",
              mapUrl: m.mapUrl ?? "",
              categoryId: m.categoryId ?? "",
            }))
          : [],
        is_locked: currentSection.is_locked || false,
        lock_ticket: currentSection.lock_ticket || "",
      };

      setFormData(normalizedData);
      setOriginalData(normalizedData);
    }
  }, [activeTab, sections, currentSection, isEditing]);

  // B. Aggressive Lockdown Guard
  useEffect(() => {
    if (shouldLockUI && isEditing) {
      setIsEditing(false);
      toast.info("Akses ditutup. Sektor ini sedang dalam proses peninjauan.");
    }
  }, [shouldLockUI, isEditing]);

  // C. Parallel Fetching for Rejections (Blueprint Form: 2)
  useEffect(() => {
    if (!activeTab || activeTab === "categories") {
      clearRejectedDraft();
      return;
    }

    const abortController = new AbortController();
    fetchRejectedDraft(activeTab, "BusinessSection", abortController.signal);

    return () => abortController.abort();
  }, [activeTab, fetchRejectedDraft, clearRejectedDraft]);

  // D. Dirty State Guard
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

  // 6. DECISION HANDLERS & API
  // Discard Backend Notification
  const handleDiscardDraft = async () => {
    if (!rejectedDraft?.notrans) return;

    const toastId = toast.loading("Mengabaikan notifikasi penolakan...");
    try {
      await api.patch('/approval/discard', { notrans: rejectedDraft.notrans });

      toast.success("Notifikasi revisi berhasil diabaikan.", { id: toastId });
      clearRejectedDraft();
      await refreshData(); // Sinkronisasi state Live dari backend
    } catch (error: any) {
      toast.error("Gagal mengabaikan draf", {
        id: toastId,
        description:
          error.response?.data?.message ||
          "Kesalahan komunikasi dengan server.",
      });
    }
  };

  const handleSave = async () => {
    if (activeTab === "categories") return;

    if (shouldLockUI) {
      return toast.error("Akses Dibatasi.", {
        description: "Data ini sedang dalam peninjauan.",
      });
    }

    // Integrity Validation (HTML Stripping)
    if (!formData.title.trim()) {
      return toast.error("Judul sektor utama wajib diisi.");
    }
    const plainTextContent = formData.htmlContent
      .replace(/<[^>]*>?/gm, "")
      .trim();
    if (!formData.htmlContent || plainTextContent.length === 0) {
      return toast.error("Narasi konten artikel wajib diisi.");
    }

    if (formData.htmlContent.includes("data:image/")) {
      return toast.error("Terdeteksi Gambar Ilegal!", {
        description:
          "Dilarang copy-paste gambar langsung. Gunakan tombol 'image' di toolbar editor.",
      });
    }

    // Spam Prevention
    if (!hasDataChanged()) {
      setIsEditing(false);
      return toast.info("Tidak ada perubahan terdeteksi.", {
        description: "Data Anda masih identik dengan versi live.",
        duration: 3000,
      });
    }

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

  // --- 7. LOCAL HANDLERS ---

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

  const handleTabChange = (targetTab: string) => {
    if (targetTab === activeTab) return;
    if (isEditing) {
      setPendingTab(targetTab);
      setIsDiscardModalOpen(true);
    } else {
      setActiveTab(targetTab);
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

  // 8. RENDER LAYOUT
  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500 pb-12">
      {/* SOVEREIGN BANNERS (Otoritas & Birokrasi) */}
      {isOverrideMode && activeTab !== "categories" && (
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-center gap-4 animate-in slide-in-from-top-4 shadow-sm">
          <div className="bg-amber-100 p-2 rounded-full text-amber-600 shrink-0">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-black text-amber-900 uppercase tracking-tight">
              Mode Override Admin
            </h4>
            <p className="text-xs text-amber-700 leading-relaxed mt-0.5">
              Sektor ini sedang dikunci oleh tiket{" "}
              <strong>{currentSection?.lock_ticket}</strong>. Menyimpan akan
              otomatis membatalkan antrean tersebut.
            </p>
          </div>
        </div>
      )}

      {/* Blue/Rose Banner: Status Antrean Editor (Blueprint III) */}
      {shouldLockUI && activeTab !== "categories" && (
        <div
          className={`p-4 rounded-xl flex items-center gap-4 shadow-sm animate-pulse ${
            isDeleting
              ? "bg-rose-50 border border-rose-200"
              : "bg-blue-50 border border-blue-200"
          }`}>
          <div
            className={`p-2 rounded-full shrink-0 ${isDeleting ? "bg-rose-100 text-rose-600" : "bg-blue-100 text-blue-600"}`}>
            <LockIcon className="w-5 h-5" />
          </div>
          <div>
            <h4
              className={`text-xs font-black uppercase tracking-tight ${isDeleting ? "text-rose-900" : "text-blue-900"}`}>
              {isDeleting ? "Menunggu Penghapusan" : "Akses Dibatasi"}
            </h4>
            <p
              className={`text-xs leading-relaxed mt-0.5 ${isDeleting ? "text-rose-700" : "text-blue-700"}`}>
              {isDeleting
                ? "Permintaan penghapusan sedang ditinjau. Data tidak dapat diubah."
                : "Revisi sedang ditinjau. Anda tidak dapat mengubah data ini sampai ada keputusan."}
            </p>
          </div>
        </div>
      )}

      {/* Recovery Banner: Draf Ditolak (Resilient Form Pattern) */}
      {isNeedsRevision && !isEditing && (
        <div className="bg-red-50 border border-red-200 p-4 rounded-xl flex items-center justify-between gap-4 animate-in slide-in-from-top-4 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="bg-red-100 p-2 rounded-full text-red-600 shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-black text-red-900 uppercase tracking-tight">
                Revisi Diperlukan
              </h4>
              <p className="text-xs text-red-700 leading-relaxed mt-0.5">
                Pengajuan sebelumnya ditolak:{" "}
                <strong>"{currentSection?.rejection_reason}"</strong>
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsEditing(true)}
            className="px-4 py-2 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700 transition-all shadow-md active:scale-95">
            Perbaiki Sekarang
          </button>
        </div>
      )}

      {/* HEADER & NAVIGATION CONTROL */}

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

      {/* MAIN CONTENT AREA (The Vault Perspective) */}

      <main
        className={`bg-white rounded-b-xl border border-t-0 border-slate-200 shadow-sm p-6 lg:p-8 min-h-[500px] transition-all duration-500 ${lockStyles}`}>
        {activeTab === "categories" ? (
          <CategoryManager />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <BusinessEditor
              activeTab={activeTab}
              formData={formData}
              setFormData={setFormData}
              isEditing={isEditing && !shouldLockUI}
              handleDiscardDraft={handleDiscardDraft}
            />

            <MapManager
              formData={formData}
              setFormData={setFormData}
              isEditing={isEditing && !shouldLockUI}
              categories={categories}
              categoryMap={categoryMap}
              onOpenMapPicker={() => setIsMapModalOpen(true)}
              updateMarker={updateMarker}
              removeMarker={removeMarker}
            />
          </div>
        )}
      </main>

      {/* MODAL OVERLAYS */}
      {isAddModalOpen && (
        <AddSectionModal
          onClose={() => setIsAddModalOpen(false)}
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
