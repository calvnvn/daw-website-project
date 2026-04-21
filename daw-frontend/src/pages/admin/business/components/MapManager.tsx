import {
  Maximize2,
  Copy,
  Trash2,
  Map as MapIcon,
  Link as LinkIcon,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import mapBase from "@/assets/map-indonesia-base.svg";
import {
  type MapMarker,
  type MapCategory,
  type SectionData,
} from "@/contexts/BusinessContext";

// Definisi Interface yang ketat
interface MapManagerProps {
  formData: Omit<SectionData, "id">;
  setFormData: React.Dispatch<React.SetStateAction<any>>;
  isEditing: boolean;
  categories: MapCategory[];
  categoryMap: Record<string, string>;
  onOpenMapPicker: () => void;
  updateMarker: (index: number, field: keyof MapMarker, value: string) => void;
  removeMarker: (index: number) => void;
}

export default function MapManager({
  formData,
  setFormData,
  isEditing, // 🚀 SEKARANG 100% TUNDUK PADA PARENT (Sovereign Gatekeeper)
  categories,
  categoryMap,
  onOpenMapPicker,
  updateMarker,
  removeMarker,
}: MapManagerProps) {
  // Helper untuk menyalin koordinat dengan proteksi SSL
  const handleCopyCoords = (coords: string) => {
    if (!navigator.clipboard) {
      return toast.error(
        "Browser tidak mendukung fitur salin otomatis (Membutuhkan HTTPS).",
      );
    }
    navigator.clipboard.writeText(coords);
    toast.success("Koordinat berhasil disalin ke clipboard!");
  };

  // 🚀 DIHAPUS: const isLocked = formData.is_locked;
  // 🚀 DIHAPUS: const canInteract = isEditing && !isLocked;
  // Kita langsung menggunakan prop `isEditing` di seluruh interaksi.

  return (
    <div className="lg:col-span-5 space-y-6">
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
        {/* Dekorasi Background */}
        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
          <MapIcon size={80} />
        </div>

        {/* Header & Toggle Peta */}
        <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
          <div className="space-y-0.5">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">
              Visualisasi Peta
            </h3>
            <p className="text-[10px] text-slate-400 font-medium italic">
              {formData.hasMap ? "Peta Aktif" : "Peta Dinonaktifkan"}
            </p>
          </div>

          <label
            className={`relative inline-flex items-center ${isEditing ? "cursor-pointer" : "cursor-not-allowed"}`}>
            <input
              type="checkbox"
              className="sr-only peer"
              checked={Boolean(formData.hasMap)}
              disabled={!isEditing}
              onChange={(e) =>
                setFormData((prev: any) => ({
                  ...prev,
                  hasMap: e.target.checked,
                }))
              }
            />
            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-daw-green"></div>
          </label>
        </div>

        {formData.hasMap && (
          <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
            {/* 1. Mini Map Preview */}
            <div
              className={`relative group rounded-xl border-2 transition-all overflow-hidden ${
                isEditing
                  ? "cursor-crosshair border-daw-green/20 hover:border-daw-green/50"
                  : "cursor-default border-slate-100 grayscale-[0.5]"
              }`}
              onClick={() => isEditing && onOpenMapPicker()}>
              <div className="w-full aspect-video bg-slate-50 relative shadow-inner flex items-center justify-center">
                <img
                  src={mapBase}
                  className="w-full h-full object-contain opacity-40"
                  alt="indonesia base map"
                />

                {/* Looping Marker di Atas Peta */}
                {formData.mapMarkers.map((m: MapMarker, idx: number) => (
                  <div
                    key={m.id || `marker-${idx}`}
                    className="absolute w-3 h-3 rounded-full border-2 border-white shadow-md -translate-x-1/2 -translate-y-1/2 transition-transform hover:scale-150 z-10"
                    style={{
                      left: m.dotX,
                      top: m.dotY,
                      backgroundColor: categoryMap[m.categoryId] || "#94a3b8",
                    }}
                  />
                ))}
              </div>

              {isEditing && (
                <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="text-white text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 bg-slate-800/80 px-4 py-2 rounded-full border border-white/20">
                    <Maximize2 className="w-3 h-3 text-daw-green" /> Atur Titik
                    Lokasi
                  </span>
                </div>
              )}
            </div>

            {/* 2. Marker List Manager */}
            <div className="space-y-3 max-h-[450px] overflow-y-auto pr-2 custom-scrollbar">
              {formData.mapMarkers.map((marker: MapMarker, index: number) => (
                <div
                  key={marker.id || `list-${index}`}
                  className="p-4 bg-slate-50/50 border border-slate-200 rounded-xl relative group hover:border-daw-green/40 hover:bg-white transition-all duration-300">
                  {/* Action Buttons Floating */}
                  <div className="absolute top-3 right-3 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-all transform translate-y-[-2px] group-hover:translate-y-0">
                    <button
                      onClick={() =>
                        handleCopyCoords(`${marker.dotX}, ${marker.dotY}`)
                      }
                      className="p-1.5 bg-white text-slate-400 hover:text-daw-green rounded-lg shadow-sm border border-slate-100"
                      title="Copy coordinates">
                      <Copy className="w-3 h-3" />
                    </button>
                    {isEditing && (
                      <button
                        onClick={() => removeMarker(index)}
                        className="p-1.5 bg-white text-slate-300 hover:text-red-500 rounded-lg shadow-sm border border-slate-100"
                        title="Remove marker">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {/* Input Detail Marker */}
                  <div className="grid grid-cols-1 gap-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-2 h-2 rounded-full shrink-0 shadow-sm"
                        style={{
                          backgroundColor: categoryMap[marker.categoryId],
                        }}
                      />
                      <input
                        className="flex-1 text-xs font-bold bg-transparent border-b border-transparent focus:border-slate-300 outline-none transition-colors disabled:opacity-70"
                        value={marker.title || ""}
                        onChange={(e) =>
                          updateMarker(index, "title", e.target.value)
                        }
                        disabled={!isEditing}
                        placeholder="Nama Lokasi (e.g. Site Muara Enim)"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">
                          Kategori
                        </span>
                        <select
                          className="w-full text-[10px] bg-white border border-slate-200 rounded-lg px-2 py-1.5 outline-none appearance-none cursor-pointer focus:ring-2 focus:ring-daw-green/10 disabled:bg-slate-50 disabled:cursor-not-allowed"
                          value={marker.categoryId}
                          onChange={(e) =>
                            updateMarker(index, "categoryId", e.target.value)
                          }
                          disabled={!isEditing}>
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">
                          Kapasitas/Ket
                        </span>
                        <input
                          className="w-full text-[10px] bg-white border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-daw-green/10 disabled:bg-slate-50 disabled:cursor-not-allowed"
                          value={marker.desc || ""}
                          onChange={(e) =>
                            updateMarker(index, "desc", e.target.value)
                          }
                          disabled={!isEditing}
                          placeholder="Contoh: 15.4 MW"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-[10px] bg-slate-100/50 p-2 rounded-lg border border-dashed border-slate-200 group-hover:bg-daw-green/5 group-hover:border-daw-green/20 transition-colors">
                      <LinkIcon className="w-3 h-3 text-slate-400" />
                      <input
                        className="flex-1 bg-transparent outline-none truncate font-mono text-[9px] text-slate-500 italic disabled:opacity-70"
                        value={marker.mapUrl || ""}
                        onChange={(e) =>
                          updateMarker(index, "mapUrl", e.target.value)
                        }
                        placeholder="Google Maps URL"
                        disabled={!isEditing}
                      />
                    </div>
                  </div>
                </div>
              ))}

              {/* Empty State */}
              {formData.mapMarkers.length === 0 && (
                <div className="text-center py-12 px-4 border-2 border-dashed border-slate-100 rounded-2xl bg-slate-50/30">
                  <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm border border-slate-100 text-slate-300">
                    <MapIcon size={20} />
                  </div>
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">
                    Belum Ada Titik Lokasi
                  </h4>
                  <p className="text-[10px] text-slate-400 leading-relaxed max-w-[200px] mx-auto">
                    Klik pada peta di atas untuk menandai sebaran lokasi
                    geografis bisnis Anda.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Legend Card */}
      {formData.hasMap && categories.length > 0 && (
        <div className="bg-slate-900 p-5 rounded-xl shadow-xl border border-slate-800 animate-in slide-in-from-bottom-2 duration-500">
          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
            <Info size={12} className="text-daw-green" /> Warna Pin
          </h4>
          <div className="grid grid-cols-2 gap-3">
            {categories.map((cat) => (
              <div key={cat.id} className="flex items-center gap-2">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: cat.color }}
                />
                <span className="text-[10px] font-bold text-slate-300 truncate">
                  {cat.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
