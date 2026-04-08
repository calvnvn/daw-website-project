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
};

export default function ManageBusinesses() {
  const {
    sections,
    categories,
    isLoading,
    updateSection,
    addSection,
    deleteSection,
  } = useBusiness();

  // --- 1. CORE STATES ---
  const [activeTab, setActiveTab] = useState<string>("");
  const [formData, setFormData] =
    useState<Omit<SectionData, "id">>(initialFormData);

  // --- 2. UI & MODAL STATES ---
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDiscardModalOpen, setIsDiscardModalOpen] = useState(false);
  const [isMapModalOpen, setIsMapModalOpen] = useState(false); // FIX: Restored map modal state
  const [pendingTab, setPendingTab] = useState<string | null>(null);

  // Deteksi perangkat untuk UX Map Picker
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

  // --- 3. MEMOIZED UTILITIES (Performance Guard) ---
  const categoryMap = useMemo(() => {
    return Object.fromEntries(categories.map((cat) => [cat.id, cat.color]));
  }, [categories]);

  // --- 4. DATA ENGINE (SYNC) ---
  useEffect(() => {
    // FIX: Fallback logic jika Admin menghapus sektor terakhir
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
      return;
    }

    const currentSection = sections.find((sec) => sec.id === activeTab);
    if (currentSection) {
      const rawMarkers =
        (currentSection as any).mapMarkers ||
        (currentSection as any).BusinessMapMarkers ||
        [];
      setFormData({
        category: currentSection.category || "",
        title: currentSection.title || "",
        htmlContent: currentSection.htmlContent || "",
        hasMap: normalizeBool(currentSection.hasMap),
        orderIndex: currentSection.orderIndex || 0,
        mapMarkers: Array.isArray(rawMarkers) ? [...rawMarkers] : [],
      });
    }
  }, [activeTab, sections]);

  // --- 5. SECURITY GUARD ---
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

  // --- 6. DATA HANDLERS (Dikirim ke MapManager sebagai Props) ---
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

  // --- 7. UI HANDLERS ---
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
    setIsSaving(true);
    const toastId = toast.loading("Menyimpan ke database...");
    try {
      await updateSection(activeTab, formData);
      toast.success(`${activeTab.toUpperCase()} berhasil diperbarui!`, {
        id: toastId,
      });
      setIsEditing(false);
    } catch {
      toast.error("Gagal menyimpan data.", { id: toastId });
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
      <div className="p-12 text-center text-slate-500 font-bold animate-pulse">
        Menyinkronkan dengan Database...
      </div>
    );
  }

  // --- 8. RENDER LAYOUT ---
  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500 pb-12">
      <SectionHeader
        activeTab={activeTab}
        isEditing={isEditing}
        setIsEditing={setIsEditing}
        isSaving={isSaving}
        onSave={handleSave}
        onDeleteClick={() => setIsDeleteModalOpen(true)}
      />

      <SectionTabs
        activeTab={activeTab}
        sections={sections}
        onChange={handleTabChange}
        isEditing={isEditing}
        onAddClick={() => setIsAddModalOpen(true)}
      />

      <main className="bg-white rounded-b-xl border border-t-0 border-slate-200 shadow-sm p-6 lg:p-8 min-h-[500px]">
        {activeTab === "categories" ? (
          <CategoryManager />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <BusinessEditor
              activeTab={activeTab}
              formData={formData}
              setFormData={setFormData}
              isEditing={isEditing}
            />
            {/* FIX: Props disalurkan dengan benar ke MapManager */}
            <MapManager
              formData={formData}
              setFormData={setFormData}
              isEditing={isEditing}
              categories={categories}
              categoryMap={categoryMap}
              onOpenMapPicker={() => setIsMapModalOpen(true)}
              updateMarker={updateMarker}
              removeMarker={removeMarker}
            />
          </div>
        )}
      </main>

      {/* MODALS */}
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

      {/* FIX: MapPickerModal dirender di root untuk menghindari Z-Index conflict */}
      <MapPickerModal
        isOpen={isMapModalOpen}
        onClose={() => setIsMapModalOpen(false)}
        onSelectLocation={handleSelectLocation}
        mapMarkers={formData.mapMarkers}
        categoryMap={categoryMap}
        isMobile={isMobile}
      />

      {isDiscardModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
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
                className="w-full py-2.5 bg-red-50 text-red-600 rounded-xl font-bold hover:bg-red-100 transition-colors"
              >
                Buang & Keluar
              </button>
              <button
                onClick={() => setIsDiscardModalOpen(false)}
                className="w-full py-2.5 bg-slate-100 text-slate-900 rounded-xl font-bold hover:bg-slate-200 transition-colors"
              >
                Tetap di Sini
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
