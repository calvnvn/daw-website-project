import { useState, useEffect, useRef, useMemo } from "react";
import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";
import { toast } from "sonner";
import {
  Trash2,
  Save,
  MousePointerClick,
  Lock,
  Unlock,
  Map as MapIcon,
  Zap,
  Maximize2,
  X,
  Copy,
  Edit,
  Plus,
} from "lucide-react";
import mapBase from "@/assets/map-indonesia-base.svg";

// Import Context
import {
  useBusiness,
  type SectionData,
  type MapMarker,
} from "@/contexts/BusinessContext";

export default function ManageBusinesses() {
  // Context & State Management
  const {
    sections,
    categories,
    isLoading,
    isProcessing,
    updateSection,
    addSection,
    deleteSection,
    addCategory,
    updateCategory,
    deleteCategory,
  } = useBusiness();

  // Primary state to track the current active view (Section ID or "categories")
  const [activeTab, setActiveTab] = useState<string>("");

  // Local state for the category creation form
  const [newCat, setNewCat] = useState({ id: "", name: "", color: "#004B23" });

  // State for managing category inline editing
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editCatData, setEditCatData] = useState({ name: "", color: "" });

  // Persistence and UI state toggles
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isMapModalOpen, setIsMapModalOpen] = useState(false);

  // Responsive and interaction states
  const [isMobile, setIsMobile] = useState(false);
  const [isHoveringMap, setIsHoveringMap] = useState(false);
  const [isTouching, setIsTouching] = useState(false);

  // New UX States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newSectionName, setNewSectionName] = useState("");

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  const quillModules = {
    toolbar: [
      [{ header: [1, 2, 3, false] }],
      ["bold", "italic", "underline", "strike"],
      [{ list: "ordered" }, { list: "bullet" }],
      ["link", "image", "video"],
      ["clean"],
    ],
    clipboard: {
      matchVisual: false,
    },
  };

  // MEMOIZED UTILITIES
  /**
   * @constant categoryMap
   * Optimized dictionary for O(1) color lookup based on Category ID.
   * Prevents repeated array searching during marker rendering.
   */
  const categoryMap = useMemo(() => {
    return categories.reduce(
      (acc, cat) => ({ ...acc, [cat.id]: cat.color }),
      {} as Record<string, string>,
    );
  }, [categories]);

  /**
   * --- DOM REFERENCES ---
   * Used to bypass React's render cycle for smooth 60fps UI interactions.
   */
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const crosshairRef = useRef<HTMLDivElement>(null);
  const loupeRef = useRef<HTMLDivElement>(null);
  const radarRef = useRef<HTMLDivElement>(null);
  const lastMousePos = useRef({ xPercent: 0, yPercent: 0 });

  /**
   * --- SIDE EFFECTS & INITIALIZATION ---
   */
  useEffect(() => {
    // Jika activeTab belum ada tapi sections sudah ada, jangan reset, tunggu efek inisialisasi tab
    if (!activeTab && sections.length > 0) return;

    const currentSection = sections.find((sec) => sec.id === activeTab);

    if (currentSection) {
      setFormData({
        category: currentSection.category || "",
        title: currentSection.title || "",
        htmlContent: currentSection.htmlContent || "",
        hasMap:
          Boolean(currentSection.hasMap) || Number(currentSection.hasMap) === 1,
        orderIndex: currentSection.orderIndex || 0,
        mapMarkers: currentSection.mapMarkers || [],
      });
    } else if (activeTab && activeTab !== "categories") {
      // Hanya reset jika activeTab memang sudah terisi tapi section tidak ditemukan
      setFormData({
        category: "",
        title: "",
        htmlContent: "",
        hasMap: false,
        orderIndex: 0,
        mapMarkers: [],
      });
    }
  }, [activeTab, sections]);
  // Window resize listener to toggle mobile/desktop UI modes
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Auto-select the first available business section on initial load
  useEffect(() => {
    if (sections.length > 0 && !activeTab) {
      setActiveTab(sections[0].id);
    }
  }, [sections, activeTab]);

  /**
   * @desc Synchronizes the local form buffer with the global section data
   * whenever the user switches tabs or the dataset updates.
   */
  useEffect(() => {
    const currentSection = sections.find((sec) => sec.id === activeTab);

    if (currentSection) {
      setFormData({
        category: currentSection.category || "",
        title: currentSection.title || "",
        htmlContent: currentSection.htmlContent || "",
        // Normalizes database tinyint (1/0) or booleans to strict boolean type
        hasMap:
          Boolean(currentSection.hasMap) || Number(currentSection.hasMap) === 1,
        orderIndex: currentSection.orderIndex || 0,
        mapMarkers: currentSection.mapMarkers || [],
      });
    } else if (activeTab !== "categories") {
      // Revert to initial state structure if no matching section is found
      setFormData({
        category: "",
        title: "",
        htmlContent: "",
        hasMap: false,
        orderIndex: 0,
        mapMarkers: [],
      });
    }
  }, [activeTab, sections]);

  // Prevents data loss by warning the user before they leave with unsaved changes
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

  // Reset editing states when locking the form
  useEffect(() => {
    if (!isEditing) setEditingCatId(null);
  }, [isEditing]);

  /**
   * --- HANDLERS & LOGIC ---
   */

  /**
   * @method updatePointerPos
   * Directly manipulates the DOM elements for the magnifier and radar tools.
   * Calculates coordinates as percentage values relative to the map container.
   */
  const updatePointerPos = (clientX: number, clientY: number) => {
    if (!mapContainerRef.current) return;
    const rect = mapContainerRef.current.getBoundingClientRect();
    const xP = Math.max(
      0,
      Math.min(100, ((clientX - rect.left) / rect.width) * 100),
    );
    const yP = Math.max(
      0,
      Math.min(100, ((clientY - rect.top) / rect.height) * 100),
    );

    lastMousePos.current = { xPercent: xP, yPercent: yP };

    if (!isMobile) {
      if (crosshairRef.current) {
        crosshairRef.current.style.left = `${xP}%`;
        crosshairRef.current.style.top = `${yP}%`;
      }
      if (loupeRef.current) {
        loupeRef.current.style.left = `${xP}%`;
        loupeRef.current.style.top = `${yP}%`;
        loupeRef.current.style.backgroundPosition = `${xP}% ${yP}%`;
      }
    } else if (radarRef.current) {
      radarRef.current.style.backgroundPosition = `${xP}% ${yP}%`;
      const textNode = radarRef.current.querySelector(
        ".radar-coord",
      ) as HTMLSpanElement | null;
      if (textNode)
        textNode.innerHTML = `X:${xP.toFixed(0)} Y:${yP.toFixed(0)}`;
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isMobile) updatePointerPos(e.clientX, e.clientY);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (isMobile) updatePointerPos(e.touches[0].clientX, e.touches[0].clientY);
  };

  /**
   * @method handleMapClick
   * Commits the current pointer coordinates as a new Map Marker.
   */
  const handleMapClick = () => {
    if (!isEditing) return;

    const { xPercent, yPercent } = lastMousePos.current;
    const xStr = xPercent.toFixed(2) + "%";
    const yStr = yPercent.toFixed(2) + "%";

    const newMarker: MapMarker = {
      id: Date.now().toString(),
      title: "New Location",
      desc: "Capacity / Details",
      categoryId: categories.length > 0 ? categories[0].id : "",
      dotX: xStr,
      dotY: yStr,
      boxX: xStr,
      boxY: Math.max(0, yPercent - 15).toFixed(2) + "%",
      mapUrl: "",
    };

    setFormData((prev) => ({
      ...prev,
      mapMarkers: [...prev.mapMarkers, newMarker],
    }));

    toast.success("Marker dropped at precision point.");
    if (isMapModalOpen) setIsMapModalOpen(false);
  };

  const [formData, setFormData] = useState<Omit<SectionData, "id">>({
    category: "",
    title: "",
    htmlContent: "",
    hasMap: false,
    orderIndex: 0,
    mapMarkers: [],
  });

  /**
   * @method handleTabChange
   * Guarded navigation to prevent data loss across dynamic tabs.
   */
  const handleTabChange = (targetTab: string) => {
    if (isEditing) {
      setPendingTab(targetTab); // Simpan tujuan tab yang diklik
      setIsDiscardModalOpen(true); // Buka modal konfirmasi buang data
      return;
    }
    setActiveTab(targetTab);
  };

  const updateMarker = (
    index: number,
    field: keyof MapMarker,
    value: string,
  ) => {
    const updatedMarkers = [...formData.mapMarkers];
    updatedMarkers[index] = { ...updatedMarkers[index], [field]: value };
    setFormData({ ...formData, mapMarkers: updatedMarkers });
  };

  const removeMarker = (index: number) => {
    setFormData({
      ...formData,
      mapMarkers: formData.mapMarkers.filter((_, i) => i !== index),
    });
  };

  /**
   * @method handleSave
   * Triggers the Global Context Update for the selected business unit.
   */
  const handleSave = async () => {
    if (activeTab === "categories") return;
    setIsSaving(true);
    const toastId = toast.loading("Persisting changes to database...");
    try {
      await updateSection(activeTab, formData);
      toast.success(`${activeTab.toUpperCase()} Section Sync Complete`, {
        id: toastId,
      });
      setIsEditing(false);
    } catch (error: unknown) {
      console.error("[SAVE_ACTION_FAILED]:", error);
      toast.error("Critical: Database sync failed.", { id: toastId });
    } finally {
      setIsSaving(false);
    }
  };

  // 1. Tambahkan state modal baru di kumpulan state atas
  const [isDiscardModalOpen, setIsDiscardModalOpen] = useState(false);
  const [pendingTab, setPendingTab] = useState<string | null>(null);

  // 3. Fungsi untuk mengeksekusi "Buang Perubahan"
  const confirmDiscard = () => {
    setIsEditing(false);
    if (pendingTab) setActiveTab(pendingTab);
    setIsDiscardModalOpen(false);
    setPendingTab(null);
    toast.info("Changes discarded.");
  };
  if (isLoading && sections.length === 0)
    return (
      <div className="p-12 text-center text-slate-500 font-bold animate-pulse flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-4 border-daw-green border-t-transparent rounded-full animate-spin"></div>
        Syncing with Content Memory...
      </div>
    );

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500 pb-12">
      {/* --- HEADER: Control Panel --- */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm top-0 z-20">
        <div>
          <h1 className="text-2xl font-serif font-bold text-slate-900">
            Businesses Manager
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Kelola divisi bisnis dan sebaran lokasi geografis perusahaan.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Action: Delete Current Section (Trigger Modal) */}
          {/* Sesuai standar desain: Icon button flat dengan hover memadai untuk secondary/destructive action */}
          {activeTab !== "categories" && isEditing && (
            <button
              onClick={() => setIsDeleteModalOpen(true)}
              className="flex items-center justify-center p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Delete this section"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          )}

          {/* Toggle: Lock/Unlock Editing */}
          {/* Konsisten menggunakan palet alert (amber) yang sudah menjadi standar di CMS ini */}
          <button
            onClick={() => setIsEditing(!isEditing)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-bold text-sm transition-colors border ${
              isEditing
                ? "bg-amber-100 text-amber-700 border-amber-200"
                : "bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200"
            }`}
          >
            {isEditing ? (
              <Unlock className="w-4 h-4" />
            ) : (
              <Lock className="w-4 h-4" />
            )}
            <span>{isEditing ? "Editing Mode" : "Locked"}</span>
          </button>

          {/* Action: Save Changes to Backend */}
          {/* Kembali menggunakan standar global primary button (bg-daw-green solid) tanpa efek shimmer */}
          {activeTab !== "categories" && (
            <button
              onClick={handleSave}
              disabled={isSaving || !isEditing}
              className="flex items-center gap-2 bg-daw-green hover:bg-[#003b1c] disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-lg font-medium transition-colors shadow-sm"
            >
              {isSaving ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Save className="w-5 h-5" />
              )}
              <span>
                {isSaving ? "Saving..." : `Update ${activeTab.toUpperCase()}`}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* --- TABS NAVIGATION: Full Dynamic Loop --- */}
      {/* Menggunakan struktur tab flat-design yang konsisten dengan halaman Manajemen lainnya */}
      <div className="flex items-end overflow-x-auto border border-slate-200 border-b-0 shadow-sm bg-white rounded-t-xl px-2 pt-2 hide-scrollbar">
        {/* Render Tabs from Database Sections */}
        {sections.map((section) => (
          <button
            key={section.id}
            onClick={() => handleTabChange(section.id)}
            className={`flex items-center gap-2 px-6 py-3 font-bold text-sm uppercase tracking-wider border-b-2 transition-colors whitespace-nowrap ${
              activeTab === section.id
                ? "border-daw-green text-daw-green"
                : "border-transparent text-slate-400 hover:text-slate-700 hover:bg-slate-50"
            }`}
          >
            {section.id.includes("energy") ? (
              <Zap className="w-4 h-4" />
            ) : (
              <MapIcon className="w-4 h-4" />
            )}
            {section.category}
          </button>
        ))}

        {/* Action: Add New Section Trigger */}
        {/* Didesain layaknya tab in-active agar terasa natural (Consistency) */}
        {isEditing && (
          <button
            onClick={() => {
              setNewSectionName("");
              setIsAddModalOpen(true);
            }}
            className="flex items-center gap-2 px-6 py-3 text-slate-400  hover:text-daw-green hover:bg-slate-50 transition-colors group border-b-2 border-transparent"
            title="Create New Section"
          >
            <Plus className="w-4 h-4 transition-transform duration-300 group-hover:scale-110" />
            <span className="text-sm font-bold uppercase tracking-wider hidden md:block">
              Tambah Sektor
            </span>
          </button>
        )}

        {/* System Tab: Setup Categories (Fixed at the end) */}
        {/* Menggunakan background pill untuk membedakan tab "System" dan tab "Content" */}
        <div className="ml-auto pr-4 pb-2">
          <button
            onClick={() => handleTabChange("categories")}
            className={`flex items-center gap-2 px-4 py-2 font-bold text-xs uppercase tracking-widest rounded-lg transition-colors ${
              activeTab === "categories"
                ? "bg-slate-100 text-slate-900 border border-slate-200"
                : "text-slate-400 hover:bg-slate-50"
            }`}
          >
            <Lock className="w-3.5 h-3.5" /> Pengaturan Pin Peta
          </button>
        </div>
      </div>

      {/* --- MAIN CONTENT AREA --- */}
      <div
        key={activeTab}
        className="bg-white rounded-b-xl border border-t-0 border-slate-200 shadow-sm p-6 lg:p-8 min-h-[500px]"
      >
        {activeTab === "categories" ? (
          /* MASTER CATEGORY MANAGER UI */
          <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
            <div className="bg-daw-green/5 border border-daw-green/20 p-4 rounded-xl flex items-center gap-3">
              <MapIcon className="w-5 h-5 text-daw-green shrink-0" />
              <p className="text-sm text-daw-green font-medium">
                <strong>Informasi:</strong> Kategori di bawah ini akan
                menentukan label dan warna titik (pin) pada seluruh peta di
                website.
              </p>
            </div>

            {/* Category Creation Form */}
            <div
              className={`bg-slate-50 p-6 rounded-xl border border-slate-200 space-y-4 transition-all ${!isEditing ? "opacity-60 grayscale-[0.5] pointer-events-none" : ""}`}
            >
              <h3 className="font-bold text-slate-900 flex items-center gap-2 text-sm uppercase tracking-wider">
                <Plus className="w-4 h-4 text-daw-green" /> Tambah Kategori Baru
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div className="md:col-span-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block italic">
                    ID Referensi
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., office-loc"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-daw-green/20 outline-none"
                    value={newCat.id || ""}
                    onChange={(e) =>
                      setNewCat({
                        ...newCat,
                        id: e.target.value.toLowerCase().replace(/\s+/g, "-"),
                      })
                    }
                  />
                </div>
                <div className="md:col-span-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">
                    Nama Label di Peta
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., Kantor Pusat"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-daw-green/20 outline-none"
                    value={newCat.name || ""}
                    onChange={(e) =>
                      setNewCat({ ...newCat, name: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">
                    Warna Pin
                  </label>
                  <div className="flex items-center gap-3 bg-white px-3 py-1.5 rounded-lg border border-slate-300">
                    <input
                      type="color"
                      className="w-6 h-6 rounded-md cursor-pointer border-none bg-transparent"
                      value={newCat.color}
                      onChange={(e) =>
                        setNewCat({ ...newCat, color: e.target.value })
                      }
                    />
                    <span className="text-xs font-mono font-bold text-slate-600">
                      {newCat.color.toUpperCase()}
                    </span>
                  </div>
                </div>
                <button
                  disabled={isProcessing || !newCat.id || !newCat.name}
                  onClick={async () => {
                    await addCategory(newCat);
                    setNewCat({ id: "", name: "", color: "#004B23" });
                  }}
                  className="bg-daw-green text-white h-[38px] px-6 rounded-lg font-bold text-xs hover:bg-[#003b1c] disabled:bg-slate-300 transition-all flex items-center justify-center gap-2"
                >
                  {isProcessing ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  CREATE CATEGORY
                </button>
              </div>
            </div>

            {/* List of Existing Categories */}
            <div className="overflow-hidden border border-slate-200 rounded-xl shadow-sm bg-white">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] font-bold">
                  <tr>
                    <th className="px-6 py-4">ID</th>
                    <th className="px-6 py-4">Label</th>
                    <th className="px-6 py-4">Hex Color</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {categories.map((cat) => {
                    const isEditingThis = editingCatId === cat.id;
                    return (
                      <tr
                        key={cat.id}
                        className="hover:bg-slate-50/50 transition-colors group"
                      >
                        <td className="px-6 py-4 font-mono text-xs text-slate-400">
                          {cat.id}
                        </td>
                        <td className="px-6 py-4">
                          {isEditingThis ? (
                            <input
                              className="w-full px-2 py-1 border rounded text-sm focus:ring-2 focus:ring-daw-green/20"
                              value={editCatData.name}
                              onChange={(e) =>
                                setEditCatData({
                                  ...editCatData,
                                  name: e.target.value,
                                })
                              }
                            />
                          ) : (
                            <span className="font-bold text-slate-700">
                              {cat.name}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            {isEditingThis ? (
                              <input
                                type="color"
                                value={editCatData.color}
                                onChange={(e) =>
                                  setEditCatData({
                                    ...editCatData,
                                    color: e.target.value,
                                  })
                                }
                              />
                            ) : (
                              <div
                                className="w-5 h-5 rounded-full border border-black/10 shadow-sm"
                                style={{ backgroundColor: cat.color }}
                              />
                            )}
                            <span className="text-xs font-mono text-slate-400">
                              {isEditingThis ? editCatData.color : cat.color}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          {isEditing ? (
                            <div className="flex justify-end gap-2">
                              {isEditingThis ? (
                                <>
                                  <button
                                    onClick={async () => {
                                      await updateCategory(cat.id, editCatData);
                                      setEditingCatId(null);
                                    }}
                                    className="p-1.5 text-daw-green hover:bg-green-50 rounded"
                                  >
                                    <Save className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => setEditingCatId(null)}
                                    className="p-1.5 text-slate-400 hover:bg-slate-50 rounded"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    onClick={() => {
                                      setEditingCatId(cat.id);
                                      setEditCatData({
                                        name: cat.name,
                                        color: cat.color,
                                      });
                                    }}
                                    className="p-1.5 text-slate-300 hover:text-daw-green rounded transition-colors"
                                  >
                                    <Edit className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => {
                                      if (confirm(`Delete "${cat.name}"?`))
                                        deleteCategory(cat.id);
                                    }}
                                    className="p-1.5 text-slate-300 hover:text-red-600 rounded transition-colors"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </>
                              )}
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-300 italic">
                              Locked
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* DYNAMIC SECTION EDITOR (CONTENT & MAP) */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Column: Content Editor */}
            <div className="lg:col-span-7 space-y-6">
              <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
                <h3 className="text-base font-bold text-slate-900 mb-4 border-b border-slate-200 pb-2 flex justify-between items-center uppercase tracking-widest text-[11px]">
                  <span>Konten Artikel</span>
                  <span className="text-daw-green bg-daw-green/10 px-2 py-0.5 rounded italic">
                    ID Referensi: {activeTab}
                  </span>
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                      Judul Pendek
                    </label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) =>
                        setFormData({ ...formData, title: e.target.value })
                      }
                      disabled={!isEditing}
                      className={`w-full px-3 py-2 rounded-lg font-serif text-lg transition-all ${isEditing ? "bg-white border border-slate-300 shadow-sm" : "bg-transparent border-transparent text-slate-400"}`}
                      placeholder="e.g., Sustainable Natural Resources"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                      Isi Konten Artikel
                    </label>
                    <div
                      className={`rounded-xl overflow-hidden border transition-all ${isEditing ? "bg-white border-slate-300 shadow-md" : "opacity-70 pointer-events-none grayscale-[0.3]"}`}
                    >
                      <ReactQuill
                        theme="snow"
                        value={formData.htmlContent}
                        onChange={(val) =>
                          setFormData({ ...formData, htmlContent: val })
                        }
                        modules={quillModules}
                        readOnly={!isEditing}
                        className="h-64 mb-12"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Geographical Data */}
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
                <div className="flex justify-between items-center mb-4 border-b border-slate-200 pb-2">
                  <h3 className="text-base font-bold text-slate-900 uppercase tracking-widest text-[11px]">
                    Tampilkan Peta Lokasi
                  </h3>
                  <label
                    className={`flex items-center ${isEditing ? "cursor-pointer" : "cursor-not-allowed opacity-60"}`}
                  >
                    <div className="relative">
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={!!formData.hasMap}
                        disabled={!isEditing}
                        onChange={(e) =>
                          setFormData({ ...formData, hasMap: e.target.checked })
                        }
                      />
                      <div
                        className={`block w-10 h-5 rounded-full transition-colors ${formData.hasMap ? "bg-daw-green" : "bg-slate-300"}`}
                      ></div>
                      <div
                        className={`absolute left-1 top-1 bg-white w-3 h-3 rounded-full transition-transform ${formData.hasMap ? "translate-x-5" : ""}`}
                      ></div>
                    </div>
                  </label>
                </div>

                {formData.hasMap && (
                  <div className="space-y-4">
                    {/* Mini Map Preview */}
                    <div
                      className="relative group cursor-crosshair"
                      onClick={() => isEditing && setIsMapModalOpen(true)}
                    >
                      <div className="w-full aspect-video bg-white rounded-xl border border-slate-200 overflow-hidden relative shadow-inner">
                        <img
                          src={mapBase}
                          className="absolute inset-0 w-full h-full object-contain opacity-50"
                          alt="map"
                        />
                        {formData.mapMarkers.map((m, idx) => (
                          <div
                            key={idx}
                            className="absolute w-2 h-2 rounded-full border border-white shadow-sm -translate-x-1/2 -translate-y-1/2 transition-transform hover:scale-150"
                            style={{
                              left: m.dotX,
                              top: m.dotY,
                              backgroundColor:
                                categoryMap[m.categoryId] || "#94a3b8",
                            }}
                          />
                        ))}
                      </div>
                      {isEditing && (
                        <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-xl">
                          <span className="text-white text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">
                            <Maximize2 className="w-4 h-4" /> Atur Titik Lokasi
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Marker List Manager */}
                    <div className="space-y-3 mt-4 max-h-[400px] overflow-y-auto custom-scrollbar pr-1">
                      {formData.mapMarkers.map((marker, index) => (
                        <div
                          key={marker.id}
                          className="p-4 bg-white border border-slate-200 rounded-xl relative shadow-sm group hover:border-daw-green/30 transition-all"
                        >
                          <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(
                                  `${marker.dotX}, ${marker.dotY}`,
                                );
                                toast.success("Coords copied!");
                              }}
                              className="p-1 text-slate-400 hover:text-daw-green"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            {isEditing && (
                              <button
                                onClick={() => removeMarker(index)}
                                className="p-1 text-slate-400 hover:text-red-500"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-3 mb-2">
                            <input
                              className="text-xs font-bold border-b border-transparent focus:border-slate-200 outline-none"
                              value={marker.title || ""}
                              onChange={(e) =>
                                updateMarker(index, "title", e.target.value)
                              }
                              disabled={!isEditing}
                              placeholder="Nama Lokasi"
                            />
                            <select
                              className="text-[10px] bg-slate-50 rounded px-1 outline-none appearance-none"
                              value={marker.categoryId}
                              onChange={(e) =>
                                updateMarker(
                                  index,
                                  "categoryId",
                                  e.target.value,
                                )
                              }
                              disabled={!isEditing}
                            >
                              {categories.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <input
                            className="w-full text-[10px] text-slate-500 outline-none"
                            value={marker.desc || ""}
                            onChange={(e) =>
                              updateMarker(index, "desc", e.target.value)
                            }
                            disabled={!isEditing}
                            placeholder="Keterangan/Kapasitas"
                          />
                          <div className="flex items-center gap-1 mt-2 text-[9px] font-mono text-slate-400">
                            <MapIcon className="w-3 h-3" />
                            <input
                              className="flex-1 bg-transparent outline-none truncate"
                              value={marker.mapUrl || ""}
                              onChange={(e) =>
                                updateMarker(index, "mapUrl", e.target.value)
                              }
                              placeholder="Link Google Maps(Optional)"
                              disabled={!isEditing}
                            />
                          </div>
                        </div>
                      ))}
                      {formData.mapMarkers.length === 0 && (
                        <div className="text-center p-8 border-2 border-dashed border-slate-200 rounded-xl">
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-relaxed">
                            Belum ada lokasi yang ditandai.
                            <br />
                            Gunakan alat pemeta di atas untuk menambah titik.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* --- FULLSCREEN MODAL: High-Precision Map Picker --- */}
      {isMapModalOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-900/90 flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-full max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center gap-3 text-slate-900">
                <div className="w-10 h-10 rounded-full bg-daw-green/10 flex items-center justify-center">
                  <MousePointerClick className="w-5 h-5 text-daw-green" />
                </div>
                <div>
                  <h3 className="font-bold">Precision Map Picker</h3>
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest">
                    Click to drop a location pin
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsMapModalOpen(false)}
                className="p-2 hover:bg-red-50 hover:text-red-500 rounded-xl transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 bg-slate-200 flex items-center justify-center p-4 relative overflow-hidden">
              <div
                ref={mapContainerRef}
                onClick={handleMapClick}
                onMouseMove={handleMouseMove}
                onMouseEnter={() => !isMobile && setIsHoveringMap(true)}
                onMouseLeave={() => !isMobile && setIsHoveringMap(false)}
                onTouchStart={(e) => {
                  if (isMobile) {
                    setIsTouching(true);
                    updatePointerPos(
                      e.touches[0].clientX,
                      e.touches[0].clientY,
                    );
                  }
                }}
                onTouchMove={handleTouchMove}
                onTouchEnd={() => setIsTouching(false)}
                className={`relative w-full max-w-4xl aspect-video bg-white shadow-2xl rounded-xl overflow-hidden ${isMobile ? "touch-none" : "cursor-none"}`}
              >
                <img
                  src={mapBase}
                  className="absolute inset-0 w-full h-full object-contain opacity-70 pointer-events-none"
                  alt="indonesia"
                />

                {/* Existing Markers */}
                {formData.mapMarkers.map((m) => (
                  <div
                    key={m.id}
                    className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none z-20"
                    style={{ left: m.dotX, top: m.dotY }}
                  >
                    <div
                      className="w-3 h-3 rounded-full border-2 border-white shadow-lg animate-in zoom-in duration-300"
                      style={{
                        backgroundColor: categoryMap[m.categoryId] || "#94a3b8",
                      }}
                    />
                    <div
                      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full opacity-20 animate-pulse"
                      style={{
                        backgroundColor: categoryMap[m.categoryId] || "#94a3b8",
                      }}
                    />
                  </div>
                ))}

                {/* Magnifier / Loupe (Desktop Only) */}
                {!isMobile && isHoveringMap && (
                  <>
                    <div
                      ref={crosshairRef}
                      className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none z-40 flex items-center justify-center"
                    >
                      <div className="absolute w-8 h-[1.5px] bg-slate-900/60"></div>
                      <div className="absolute h-8 w-[1.5px] bg-slate-900/60"></div>
                      <div className="w-2 h-2 bg-red-600 rounded-full shadow-lg"></div>
                    </div>
                    <div
                      ref={loupeRef}
                      className="absolute pointer-events-none z-50 w-40 h-40 rounded-full border-4 border-white shadow-2xl bg-white overflow-hidden -translate-y-[130%] -translate-x-1/2"
                      style={{
                        backgroundImage: `url(${mapBase})`,
                        backgroundSize: "400%",
                        backgroundRepeat: "no-repeat",
                      }}
                    >
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-red-600 rounded-full" />
                    </div>
                  </>
                )}

                {/* Mobile Radar Display */}
                {isMobile && isTouching && (
                  <div
                    ref={radarRef}
                    className="absolute top-4 left-4 pointer-events-none z-[100] w-32 h-32 rounded-2xl border-4 border-daw-green shadow-2xl bg-white overflow-hidden"
                    style={{
                      backgroundImage: `url(${mapBase})`,
                      backgroundSize: "600%",
                      backgroundRepeat: "no-repeat",
                    }}
                  >
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-red-600 rounded-full shadow-[0_0_10px_red]" />
                    <div className="radar-coord absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/80 text-white text-[9px] px-2 py-0.5 rounded-full font-mono">
                      X:0 Y:0
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {/* ========================================= */}
      {/* TIER-S UX: ADD NEW SECTION MODAL          */}
      {/* ========================================= */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-slate-900/60 animate-in fade-in duration-200"
            onClick={() => !isProcessing && setIsAddModalOpen(false)}
          />

          {/* Modal Card */}
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md relative z-10 animate-in fade-in zoom-in-95 slide-in-from-bottom-4 duration-300 overflow-hidden border border-slate-100">
            {/* Header */}
            <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <h3 className="font-serif font-bold text-xl text-slate-900 flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-daw-green/10 flex items-center justify-center">
                  <Plus className="w-4 h-4 text-daw-green" />
                </div>
                Buat Sektor Bisnis Baru
              </h3>
              <button
                onClick={() => !isProcessing && setIsAddModalOpen(false)}
                className="p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Nama Sektor Bisnis <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  autoFocus
                  placeholder="e.g., Renewable Energy"
                  value={newSectionName}
                  onChange={(e) => setNewSectionName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:border-daw-green focus:ring-4 focus:ring-daw-green/10 transition-all font-medium"
                />
                {/* Real-time slug preview UX */}
                <div className="mt-2 flex items-center gap-2 text-[10px] font-mono text-slate-400">
                  <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-500 font-bold">
                    ID
                  </span>
                  {newSectionName
                    .toLowerCase()
                    .replace(/\s+/g, "-")
                    .replace(/[^\w-]+/g, "") || "auto-generated-slug"}
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <button
                onClick={() => setIsAddModalOpen(false)}
                disabled={isProcessing}
                className="px-5 py-2.5 rounded-xl font-bold text-sm text-slate-500 hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                disabled={!newSectionName.trim() || isProcessing}
                onClick={async () => {
                  await addSection(
                    newSectionName.trim(),
                    `Explore Our ${newSectionName.trim()} Operations`,
                  );
                  setIsAddModalOpen(false);
                }}
                className="flex items-center gap-2 bg-[#081C15] hover:bg-daw-green disabled:bg-slate-300 disabled:text-slate-500 text-white px-6 py-2.5 rounded-xl font-bold text-sm transition-colors shadow-sm"
              >
                {isProcessing ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Create Sector
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================= */}
      {/* TIER-S UX: DESTRUCTIVE DELETE MODAL       */}
      {/* ========================================= */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/60 animate-in fade-in duration-200"
            onClick={() => !isProcessing && setIsDeleteModalOpen(false)}
          />

          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md relative z-10 animate-in fade-in zoom-in-95 slide-in-from-bottom-4 duration-300 overflow-hidden border border-red-100">
            {/* Danger Header */}
            <div className="px-6 py-5 border-b border-red-100 bg-red-50/50 flex justify-between items-center">
              <h3 className="font-serif font-bold text-xl text-red-600 flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
                  <Trash2 className="w-4 h-4 text-red-600" />
                </div>
                Hapus Sektor Bisnis
              </h3>
              <button
                onClick={() => !isProcessing && setIsDeleteModalOpen(false)}
                className="p-2 text-slate-400 hover:bg-red-100 hover:text-red-600 rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-600 leading-relaxed">
                Tindakan ini tidak dapat dibatalkan. Menghapus sektor{" "}
                <strong className="text-slate-900">{activeTab}</strong> akan
                menghapus seluruh konten artikel dan titik peta yang terkait
                secara permanen.
              </p>

              {/* Type to confirm UX Pattern */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <label className="block text-xs text-slate-500 mb-2">
                  Ketik kembali{" "}
                  <strong className="text-slate-800 select-none bg-white px-1.5 py-0.5 rounded border border-slate-200 font-mono">
                    {activeTab}
                  </strong>{" "}
                  untuk mengonfirmasi penghapusan.
                </label>
                <input
                  type="text"
                  autoFocus
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900 focus:outline-none focus:border-red-400 focus:ring-4 focus:ring-red-500/10 font-mono text-sm transition-all"
                  placeholder={activeTab}
                />
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <button
                onClick={() => {
                  setDeleteConfirmText("");
                  setIsDeleteModalOpen(false);
                }}
                disabled={isProcessing}
                className="px-5 py-2.5 rounded-xl font-bold text-sm text-slate-500 hover:bg-slate-200 transition-colors"
              >
                Keep Sector
              </button>
              <button
                disabled={deleteConfirmText !== activeTab || isProcessing}
                onClick={async () => {
                  await deleteSection(activeTab);
                  setDeleteConfirmText("");
                  setIsDeleteModalOpen(false);
                  setActiveTab(sections[0]?.id || "categories");
                }}
                className="flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:bg-slate-200 disabled:text-slate-400 text-white px-6 py-2.5 rounded-xl font-bold text-sm transition-all shadow-sm"
              >
                {isProcessing ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                I understand, delete
              </button>
            </div>
          </div>
        </div>
      )}
      {isDiscardModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-serif font-bold text-slate-900 mb-2">
              Perubahan Belum Disimpan
            </h3>
            <p className="text-sm text-slate-500 mb-6">
              Anda memiliki perubahan yang belum disimpan. Keluar dari tab ini
              akan membatalkan semua perubahan Anda secara permanen.
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={confirmDiscard}
                className="w-full py-2.5 bg-red-50 text-red-600 rounded-xl font-bold text-sm hover:bg-red-100 transition-colors"
              >
                Buang & Keluar
              </button>
              <button
                onClick={() => setIsDiscardModalOpen(false)}
                className="w-full py-2.5 bg-slate-100 text-slate-900 rounded-xl font-bold text-sm hover:bg-slate-200 transition-colors"
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
