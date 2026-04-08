import { Maximize2, Copy, Trash2, Map as MapIcon } from "lucide-react";
import { toast } from "sonner";
import mapBase from "@/assets/map-indonesia-base.svg";
import { type MapMarker, type MapCategory } from "@/contexts/BusinessContext";

interface MapManagerProps {
  formData: any;
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
  isEditing,
  categories,
  categoryMap,
  onOpenMapPicker,
  updateMarker,
  removeMarker,
}: MapManagerProps) {
  return (
    <div className="lg:col-span-5 space-y-6">
      <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
        {/* Header & Toggle Peta */}
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
                checked={Boolean(formData.hasMap)}
                disabled={!isEditing}
                onChange={(e) =>
                  setFormData((prev: any) => ({
                    ...prev,
                    hasMap: e.target.checked,
                  }))
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
            {/* 1. Mini Map Preview */}
            <div
              className={`relative group ${isEditing ? "cursor-crosshair" : "cursor-default"}`}
              onClick={() => isEditing && onOpenMapPicker()}
            >
              <div className="w-full aspect-video bg-white rounded-xl border border-slate-200 overflow-hidden relative shadow-inner">
                <img
                  src={mapBase}
                  className="absolute inset-0 w-full h-full object-contain opacity-50"
                  alt="map base"
                />

                {/* Looping Marker di Atas Peta */}
                {formData.mapMarkers.map((m: MapMarker, idx: number) => (
                  <div
                    key={m.id || idx}
                    className="absolute w-2.5 h-2.5 rounded-full border border-white shadow-sm -translate-x-1/2 -translate-y-1/2 transition-transform hover:scale-150"
                    style={{
                      left: m.dotX,
                      top: m.dotY,
                      backgroundColor: categoryMap[m.categoryId] || "#94a3b8",
                    }}
                  />
                ))}
              </div>

              {/* Overlay Hover (Hanya saat Editing) */}
              {isEditing && (
                <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-xl">
                  <span className="text-white text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">
                    <Maximize2 className="w-4 h-4" /> Atur Titik Lokasi
                  </span>
                </div>
              )}
            </div>

            {/* 2. Marker List Manager */}
            <div className="space-y-3 mt-4 max-h-[400px] overflow-y-auto custom-scrollbar pr-1">
              {formData.mapMarkers.map((marker: MapMarker, index: number) => (
                <div
                  key={marker.id || index}
                  className="p-4 bg-white border border-slate-200 rounded-xl relative shadow-sm group hover:border-daw-green/30 transition-all"
                >
                  {/* Action Buttons */}
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(
                          `${marker.dotX}, ${marker.dotY}`,
                        );
                        toast.success("Koordinat disalin!");
                      }}
                      className="p-1 text-slate-400 hover:text-daw-green"
                      title="Copy coordinates"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    {isEditing && (
                      <button
                        onClick={() => removeMarker(index)}
                        className="p-1 text-slate-400 hover:text-red-500"
                        title="Remove marker"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Input Detail Marker */}
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
                        updateMarker(index, "categoryId", e.target.value)
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
                    placeholder="Keterangan/Kapasitas (Contoh: 10 MW)"
                  />
                  <div className="flex items-center gap-1 mt-2 text-[9px] font-mono text-slate-400">
                    <MapIcon className="w-3 h-3" />
                    <input
                      className="flex-1 bg-transparent outline-none truncate"
                      value={marker.mapUrl || ""}
                      onChange={(e) =>
                        updateMarker(index, "mapUrl", e.target.value)
                      }
                      placeholder="Link Google Maps (Opsional)"
                      disabled={!isEditing}
                    />
                  </div>
                </div>
              ))}

              {/* Empty State */}
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
  );
}
