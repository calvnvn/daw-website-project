import { useState, useEffect, useRef } from "react";
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

  const [isMobile, setIsMobile] = useState(false);
  const [isHoveringMap, setIsHoveringMap] = useState(false);
  const [isTouching, setIsTouching] = useState(false);

  // 1. REFS UNTUK DOM MANIPULATION (BYPASS REACT RENDER)
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const crosshairRef = useRef<HTMLDivElement>(null);
  const loupeRef = useRef<HTMLDivElement>(null);
  const radarRef = useRef<HTMLDivElement>(null);

  // Ref untuk "mengingat" titik terakhir tanpa memicu re-render
  const lastMousePos = useRef({ xPercent: 0, yPercent: 0 });

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // 2. FUNGSI TRACKER (SANGAT RINGAN & CEPAT)
  const updatePointerPos = (clientX: number, clientY: number) => {
    if (!mapContainerRef.current) return;
    const rect = mapContainerRef.current.getBoundingClientRect();
    const xPixel = clientX - rect.left;
    const yPixel = clientY - rect.top;

    const xP = Math.max(0, Math.min(100, (xPixel / rect.width) * 100));
    const yP = Math.max(0, Math.min(100, (yPixel / rect.height) * 100));

    // Simpan ke memori diam
    lastMousePos.current = { xPercent: xP, yPercent: yP };

    // MANIPULASI DOM LANGSUNG SECARA KILAT!
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
    } else {
      if (radarRef.current) {
        radarRef.current.style.backgroundPosition = `${xP}% ${yP}%`;
        // Fix TypeScript: Cast ke HTMLSpanElement
        const textNode = radarRef.current.querySelector(
          ".radar-coord",
        ) as HTMLSpanElement | null;
        if (textNode)
          textNode.innerHTML = `X:${xP.toFixed(0)} Y:${yP.toFixed(0)}`;
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isMobile) return;
    updatePointerPos(e.clientX, e.clientY);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!isMobile) return;
    updatePointerPos(e.touches[0].clientX, e.touches[0].clientY);
  };

  // Logika Klik Peta
  const handleMapClick = () => {
    if (!isEditing) return;

    // Ambil data dari memori diam kita
    const finalX = lastMousePos.current.xPercent;
    const finalY = lastMousePos.current.yPercent;

    const xPercentStr = finalX.toFixed(2) + "%";
    const yPercentStr = finalY.toFixed(2) + "%";
    const boxYPercentStr = Math.max(0, finalY - 15).toFixed(2) + "%";

    const newMarker: MapMarker = {
      id: Date.now().toString(),
      title: "New Location",
      desc: "Capacity / Details",
      type: "direct",
      dotX: xPercentStr,
      dotY: yPercentStr,
      boxX: xPercentStr,
      boxY: boxYPercentStr,
      mapUrl: "", // Jangan lupa mapUrl!
    };

    setFormData((prev) => ({
      ...prev,
      mapMarkers: [...prev.mapMarkers, newMarker],
    }));

    toast.success("Presisi terkunci! Marker berhasil ditambahkan.");
    if (isMapModalOpen) setIsMapModalOpen(false);
  };

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
          hasMap:
            currentSection.hasMap === true ||
            Number(currentSection.hasMap) === 1,
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

  // --- Mencegah Tab Ditutup Tanpa Save ---
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isEditing) {
        e.preventDefault();
        e.returnValue = ""; // Standar browser modern untuk memunculkan pop-up warning
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isEditing]);

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
      {/* --- HEADER --- */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm top-0 z-20">
        <div>
          <h1 className="text-2xl font-serif font-bold text-slate-900">
            Businesses Manager
          </h1>
          <p className="text-sm text-slate-500 mt-1"> Kelola Halaman Bisnis.</p>
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
                    <div className="w-full aspect-[16/9] bg-white rounded-xl border border-slate-200 overflow-hidden relative">
                      <img
                        src={mapBase}
                        alt="Map"
                        className="absolute inset-0 w-full h-full object-contain opacity-70"
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
                        {/* 👇 TAMBAHKAN KOTAK INPUT INI DI BAWAHNYA 👇 */}
                        <div className="relative mt-2">
                          <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                            <MapIcon className="w-3.5 h-3.5 text-slate-400" />
                          </div>
                          <input
                            type="url"
                            value={marker.mapUrl || ""}
                            onChange={(e) =>
                              updateMarker(index, "mapUrl", e.target.value)
                            }
                            disabled={!isEditing}
                            className={`w-full pl-8 pr-2 py-1.5 text-xs rounded-md transition-all font-mono ${
                              isEditing
                                ? "bg-white border border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-500/20"
                                : "bg-slate-100/50 border-transparent text-slate-400"
                            }`}
                            placeholder="https://maps.app.goo.gl/... (Optional)"
                          />
                        </div>
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
        <div className="fixed inset-0 z-[100] bg-slate-900/80  flex items-center justify-center p-4 md:p-10 animate-in fade-in zoom-in-95 duration-200">
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

            {/* --- THE LOUPE & CROSSHAIR UI --- */}
            <div className="flex-1 overflow-auto bg-[#e5e7eb] flex items-center justify-center p-4">
              <div
                ref={mapContainerRef}
                onClick={handleMapClick}
                onMouseMove={handleMouseMove}
                onMouseEnter={() => !isMobile && setIsHoveringMap(true)}
                onMouseLeave={() => !isMobile && setIsHoveringMap(false)}
                // Event Khusus Mobile
                onTouchStart={(e) => {
                  if (!isMobile) return;
                  setIsTouching(true);
                  updatePointerPos(e.touches[0].clientX, e.touches[0].clientY);
                }}
                onTouchMove={handleTouchMove}
                onTouchEnd={() => setIsTouching(false)}
                // CSS Dinamis: touch-none wajib agar layar tidak ikut ke-scroll saat menggeser radar!
                className={`relative w-full max-w-4xl aspect-[16/9] bg-white shadow-xl border-2 border-transparent hover:border-daw-green transition-colors rounded-xl overflow-hidden ${
                  isMobile ? "touch-none cursor-crosshair" : "cursor-none"
                }`}
              >
                {/* Peta Dasar */}
                <img
                  src={mapBase}
                  alt="Map of Indonesia"
                  className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                />

                {/* Marker yang sudah ada (Ukurannya dikecilkan biar elegan) */}
                {formData.mapMarkers.map((m, idx) => (
                  <div
                    key={idx}
                    className="absolute -translate-x-1/2 -translate-y-1/2 group pointer-events-none z-20"
                    style={{ left: m.dotX, top: m.dotY }}
                  >
                    {/* Core Dot (Super Kecil & Presisi) */}
                    <div
                      className={`w-2.5 h-2.5 md:w-3 md:h-3 rounded-full border-[1.5px] border-white shadow-md ${m.type === "direct" ? "bg-[#004B23]" : "bg-[#D97706]"}`}
                    ></div>
                    {/* Ghost Ring (Penanda area klik) */}
                    <div
                      className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full opacity-20 ${m.type === "direct" ? "bg-[#004B23]" : "bg-[#D97706]"}`}
                    ></div>
                  </div>
                ))}

                {/* EFEK KACA PEMBESAR & CROSSHAIR (Muncul saat Hover) */}
                {!isMobile && isHoveringMap && isEditing && (
                  <>
                    {/* The Crosshair Desktop */}
                    <div
                      ref={crosshairRef}
                      className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none z-40 flex items-center justify-center transition-opacity duration-75"
                      // Style awal diambil dari lastMousePos agar tidak kedip di pojok saat baru muncul
                      style={{
                        left: `${lastMousePos.current.xPercent}%`,
                        top: `${lastMousePos.current.yPercent}%`,
                      }}
                    >
                      <div className="absolute w-6 h-[1px] bg-slate-900/80"></div>
                      <div className="absolute h-6 w-[1px] bg-slate-900/80"></div>
                      <div className="absolute w-1.5 h-1.5 bg-red-500 rounded-full shadow-[0_0_4px_rgba(0,0,0,0.5)]"></div>
                    </div>

                    {/* The Magnifier Loupe Desktop */}
                    <div
                      ref={loupeRef}
                      className="absolute pointer-events-none z-50 w-32 h-32 md:w-40 md:h-40 rounded-full border-[3px] border-white shadow-[0_10px_25px_rgba(0,0,0,0.3)] bg-white overflow-hidden transform -translate-y-[120%] -translate-x-1/2 transition-opacity duration-75"
                      style={{
                        left: `${lastMousePos.current.xPercent}%`,
                        top: `${lastMousePos.current.yPercent}%`,
                        backgroundImage: `url(${mapBase})`,
                        backgroundSize: "400%",
                        backgroundPosition: `${lastMousePos.current.xPercent}% ${lastMousePos.current.yPercent}%`,
                        backgroundRepeat: "no-repeat",
                      }}
                    >
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-red-500/80 rounded-full"></div>
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1px] h-full bg-slate-900/10"></div>
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[1px] w-full bg-slate-900/10"></div>
                    </div>
                  </>
                )}

                {/* 2. MOBILE MODE: THE "FIXED SATELLITE RADAR" */}
                {isMobile && isTouching && isEditing && (
                  <div
                    ref={radarRef}
                    // Posisi Fixed (Pojok Kiri Atas Peta) agar tidak tertutup jempol
                    className="absolute top-4 left-4 pointer-events-none z-[100] w-28 h-28 rounded-full border-4 border-daw-green shadow-[0_15px_35px_rgba(0,0,0,0.4)] bg-white overflow-hidden animate-in zoom-in-90 duration-150"
                    style={{
                      backgroundImage: `url(${mapBase})`,
                      backgroundSize: "600%", // Zoom ekstra brutal khusus mobile!
                      backgroundPosition: `${lastMousePos.current.xPercent}% ${lastMousePos.current.yPercent}%`,
                      backgroundRepeat: "no-repeat",
                    }}
                  >
                    {/* Visual UI Radar */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-red-500 rounded-full shadow-[0_0_10px_rgba(255,0,0,0.8)] animate-pulse"></div>
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1px] h-full bg-daw-green/40"></div>
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[1px] w-full bg-daw-green/40"></div>

                    {/* Live Coordinate Display (Diberi class "radar-coord" agar bisa dimanipulasi dari logic Ref) */}
                    <div className="radar-coord absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/60  text-white text-[8px] font-mono px-2 py-0.5 rounded-full border border-white/20 whitespace-nowrap">
                      X:{lastMousePos.current.xPercent.toFixed(0)} Y:
                      {lastMousePos.current.yPercent.toFixed(0)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
