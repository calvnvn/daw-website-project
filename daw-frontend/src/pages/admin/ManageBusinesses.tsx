import { useState, useEffect } from "react";
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
} from "lucide-react";
import mapBase from "@/assets/map-indonesia-base.svg";

// KUNCI PERUBAHAN: Import Context Kita
import {
  useBusiness,
  type SectionData,
  type MapMarker,
} from "@/contexts/BusinessContext";

export default function ManageBusinesses() {
  // Panggil data global dari Context
  const { sections, isLoading, updateSection } = useBusiness();

  const [activeTab, setActiveTab] = useState<"resources" | "energy">(
    "resources",
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isMapModalOpen, setIsMapModalOpen] = useState(false);

  // Local state untuk menyimpan ketikan Admin sebelum di-save
  const [formData, setFormData] = useState<Omit<SectionData, "id">>({
    title: "",
    htmlContent: "",
    hasMap: false,
    mapMarkers: [],
  });

  // Sinkronisasi data dari Context ke Form Lokal setiap kali pindah Tab
  // Kecepatan Sinkronisasi: INSTAN (Tidak ada loading skeleton karena data sudah di memory!)
  useEffect(() => {
    if (sections.length > 0) {
      const currentSection = sections.find((sec) => sec.id === activeTab);
      if (currentSection) {
        setFormData({
          title: currentSection.title || "",
          htmlContent: currentSection.htmlContent || "",
          // KUNCI 1: Paksa konversi angka 1/0 jadi boolean true/false
          hasMap: currentSection.hasMap === true || currentSection.hasMap === 1,
          mapMarkers: currentSection.mapMarkers || [],
        });
      } else {
        setFormData({
          title: "",
          htmlContent: "",
          hasMap: false,
          mapMarkers: [],
        });
      }
    }
  }, [activeTab, sections]);

  // --- THE UX GUARD (Limit Break Fitur) ---
  const handleTabChange = (targetTab: "resources" | "energy") => {
    if (isEditing) {
      // Tolak perpindahan tab jika admin belum nge-save!
      toast.error(
        "LOCKED: Please Save or Lock your changes first before switching tabs!",
        {
          description: "This prevents accidental data loss.",
        },
      );
      return;
    }
    setActiveTab(targetTab);
  };

  // Logika Klik Peta
  const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isEditing) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const xPixel = e.clientX - rect.left;
    const yPixel = e.clientY - rect.top;

    const xPercent = ((xPixel / rect.width) * 100).toFixed(2) + "%";
    const yPercent = ((yPixel / rect.height) * 100).toFixed(2) + "%";
    const boxYPercent = (((yPixel - 60) / rect.height) * 100).toFixed(2) + "%";

    const newMarker: MapMarker = {
      id: Date.now().toString(),
      title: "New Location",
      desc: "Capacity / Details",
      type: "direct",
      dotX: xPercent,
      dotY: yPercent,
      boxX: xPercent,
      boxY: boxYPercent,
    };

    setFormData((prev) => ({
      ...prev,
      mapMarkers: [...prev.mapMarkers, newMarker],
    }));

    toast.success("Marker pinned! Edit details in the list.");
    if (isMapModalOpen) setIsMapModalOpen(false);
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
    const updatedMarkers = formData.mapMarkers.filter((_, i) => i !== index);
    setFormData({ ...formData, mapMarkers: updatedMarkers });
  };

  // Eksekusi Save via Context
  const handleSave = async () => {
    setIsSaving(true);
    const toastId = toast.loading("Saving changes...");
    try {
      // Panggil fungsi global dari Context
      await updateSection(activeTab, formData);
      toast.success(`${activeTab.toUpperCase()} updated successfully!`, {
        id: toastId,
      });
      setIsEditing(false); // Otomatis lock setelah save
    } catch (error: any) {
      toast.error("Failed to save changes", { id: toastId });
      console.log(error);
    } finally {
      setIsSaving(false);
    }
  };

  // Hanya loading saat pertama kali buka web (bukan saat pindah tab)
  if (isLoading && sections.length === 0)
    return (
      <div className="p-8 text-center text-slate-500 font-bold animate-pulse">
        Loading Context Memory...
      </div>
    );

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500 pb-12">
      {/* --- STICKY HEADER --- */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm sticky top-0 z-20">
        <div>
          <h1 className="text-2xl font-serif font-bold text-slate-900">
            Businesses Manager
          </h1>
          <p className="text-sm text-slate-500 mt-1"> Manage Businesses Page</p>
        </div>
        <div className="flex items-center gap-3">
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

          <button
            onClick={handleSave}
            disabled={isSaving || !isEditing}
            className="flex items-center gap-2 bg-daw-green hover:bg-[#003b1c] disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-lg font-medium transition-colors shadow-sm"
          >
            <Save className="w-5 h-5" />
            <span>{isSaving ? "Saving..." : "Save Changes"}</span>
          </button>
        </div>
      </div>

      {/* --- TABS NAVIGATION (WITH UX GUARD) --- */}
      <div className="flex items-end overflow-x-auto border border-slate-200 border-b-0 shadow-sm bg-white rounded-t-xl px-2 pt-2 hide-scrollbar">
        <button
          onClick={() => handleTabChange("resources")}
          className={`flex items-center gap-2 px-6 py-3 font-bold text-sm uppercase tracking-wider border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "resources"
              ? "border-daw-green text-daw-green"
              : "border-transparent text-slate-400 hover:text-slate-700"
          }`}
        >
          <MapIcon className="w-4 h-4" /> Resources
        </button>
        <button
          onClick={() => handleTabChange("energy")}
          className={`flex items-center gap-2 px-6 py-3 font-bold text-sm uppercase tracking-wider border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "energy"
              ? "border-daw-green text-daw-green"
              : "border-transparent text-slate-400 hover:text-slate-700"
          }`}
        >
          <Zap className="w-4 h-4" /> Energy
        </button>
      </div>

      {/* --- TAB CONTENT AREA --- */}
      {/* Isi bagian konten dan map sama persis dengan yang sebelumnya... */}
      {/* KODE FORM DI BAWAH SINI TIDAK ADA YANG BERUBAH DARI VERSI SEBELUMNYA */}
      <div
        key={activeTab}
        className="bg-white rounded-b-xl border border-t-0 border-slate-200 shadow-sm p-6 lg:p-8 min-h-[500px]"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
              <h3 className="text-base font-bold text-slate-900 mb-4 border-b border-slate-200 pb-2 flex justify-between items-center">
                <span>Page Content</span>
                <span className="text-xs text-daw-green uppercase tracking-wider bg-daw-green/10 px-2 py-1 rounded">
                  {activeTab} SECTION
                </span>
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    {activeTab === "resources"
                      ? "Resources Eyebrow Title"
                      : "Energy Eyebrow Title"}
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) =>
                      setFormData({ ...formData, title: e.target.value })
                    }
                    disabled={!isEditing}
                    className={`w-full px-3 py-2 rounded-lg font-serif text-lg transition-all duration-300 ${isEditing ? "bg-white border border-slate-300 text-slate-900 focus:ring-2 focus:ring-daw-green/20 shadow-inner" : "bg-slate-100/50 border-transparent text-slate-500 cursor-not-allowed"}`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Main Article (Rich Text)
                  </label>
                  <div
                    className={`rounded-xl overflow-hidden border transition-colors ${isEditing ? "bg-white border-slate-300" : "bg-slate-100/50 border-transparent opacity-70 pointer-events-none"}`}
                  >
                    <ReactQuill
                      theme="snow"
                      value={formData.htmlContent}
                      onChange={(val) =>
                        setFormData({ ...formData, htmlContent: val })
                      }
                      readOnly={!isEditing}
                      className="h-64 mb-12"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 space-y-6">
            <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
              <div className="flex justify-between items-center mb-4 border-b border-slate-200 pb-2">
                <h3 className="text-base font-bold text-slate-900">
                  Interactive Map
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
                      className={`block w-12 h-6 rounded-full transition-colors ${formData.hasMap ? "bg-daw-green" : "bg-slate-300"}`}
                    ></div>
                    <div
                      className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${formData.hasMap ? "transform translate-x-6" : ""}`}
                    ></div>
                  </div>
                </label>
              </div>

              {formData.hasMap && (
                <div className="space-y-4">
                  <div className="relative">
                    <div className="w-full bg-white rounded-xl border border-slate-200 overflow-hidden relative">
                      <img
                        src={mapBase}
                        alt="Map"
                        className="w-full h-auto opacity-70"
                      />
                      {formData.mapMarkers.map((m, idx) => (
                        <div
                          key={idx}
                          className="absolute w-2.5 h-2.5 rounded-full border-2 border-white -translate-x-1/2 -translate-y-1/2 shadow-sm"
                          style={{
                            left: m.dotX,
                            top: m.dotY,
                            backgroundColor:
                              m.type === "direct" ? "#004B23" : "#D97706",
                          }}
                        ></div>
                      ))}
                    </div>
                    {isEditing && (
                      <button
                        onClick={() => setIsMapModalOpen(true)}
                        className="w-full mt-3 flex items-center justify-center gap-2 bg-daw-green/10 text-daw-green hover:bg-daw-green hover:text-white py-2.5 rounded-lg font-bold text-sm transition-colors border border-daw-green/20"
                      >
                        <Maximize2 className="w-4 h-4" /> Open Fullscreen Map
                        Picker
                      </button>
                    )}
                  </div>

                  <div className="space-y-3 mt-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                    {formData.mapMarkers.map((marker, index) => (
                      <div
                        key={index}
                        className="p-4 bg-white border border-slate-200 rounded-xl relative group shadow-sm"
                      >
                        {isEditing && (
                          <button
                            onClick={() => removeMarker(index)}
                            className="absolute top-2 right-2 p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                        <div className="grid grid-cols-2 gap-3 mb-3">
                          <input
                            type="text"
                            value={marker.title}
                            onChange={(e) =>
                              updateMarker(index, "title", e.target.value)
                            }
                            disabled={!isEditing}
                            className={`w-full px-2 py-1.5 text-sm font-bold rounded-md transition-all ${isEditing ? "bg-white border border-slate-300 text-slate-900 focus:ring-2 focus:ring-daw-green/20" : "bg-slate-100/50 border-transparent text-slate-500"}`}
                            placeholder="Location Name"
                          />
                          <select
                            value={marker.type}
                            onChange={(e) =>
                              updateMarker(index, "type", e.target.value)
                            }
                            disabled={!isEditing}
                            className={`w-full px-2 py-1.5 text-xs rounded-md transition-all ${isEditing ? "bg-white border border-slate-300 text-slate-900 focus:ring-2 focus:ring-daw-green/20" : "bg-slate-100/50 border-transparent text-slate-500 appearance-none"}`}
                          >
                            <option value="direct">Direct (Green)</option>
                            <option value="tudung">Tudung (Orange)</option>
                          </select>
                        </div>
                        <input
                          type="text"
                          value={marker.desc}
                          onChange={(e) =>
                            updateMarker(index, "desc", e.target.value)
                          }
                          disabled={!isEditing}
                          className={`w-full px-2 py-1.5 text-xs rounded-md transition-all mb-2 ${isEditing ? "bg-white border border-slate-300 text-slate-900 focus:ring-2 focus:ring-daw-green/20" : "bg-slate-100/50 border-transparent text-slate-500"}`}
                          placeholder="Capacity (e.g. 45 ton/hour)"
                        />
                      </div>
                    ))}
                    {formData.mapMarkers.length === 0 && (
                      <div className="text-center p-6 text-slate-400 border border-dashed border-slate-300 rounded-xl bg-white">
                        No markers added. Open fullscreen map to pin.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* --- FULLSCREEN MAP MODAL --- */}
      {isMapModalOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 md:p-10 animate-in fade-in zoom-in-95 duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-full max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex justify-between items-center p-4 md:p-6 border-b border-slate-100 bg-slate-50">
              <div>
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <MousePointerClick className="w-5 h-5 text-daw-green" /> Click
                  anywhere to drop a pin
                </h3>
                <p className="text-xs text-slate-500">
                  Crosshair indicates active pinpointing area.
                </p>
              </div>
              <button
                onClick={() => setIsMapModalOpen(false)}
                className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-auto bg-[#e5e7eb] flex items-center justify-center p-4">
              <div
                onClick={handleMapClick}
                className="relative w-full max-w-4xl bg-white shadow-xl cursor-crosshair border-2 border-transparent hover:border-daw-green transition-colors rounded-xl overflow-hidden"
              >
                <img
                  src={mapBase}
                  alt="Map of Indonesia"
                  className="w-full h-auto pointer-events-none"
                />
                {formData.mapMarkers.map((m, idx) => (
                  <div
                    key={idx}
                    className="absolute -translate-x-1/2 -translate-y-1/2 group pointer-events-none"
                    style={{ left: m.dotX, top: m.dotY }}
                  >
                    <div
                      className={`w-4 h-4 md:w-6 md:h-6 rounded-full border-[3px] border-white shadow-lg ${m.type === "direct" ? "bg-[#004B23]" : "bg-[#D97706]"}`}
                    ></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
