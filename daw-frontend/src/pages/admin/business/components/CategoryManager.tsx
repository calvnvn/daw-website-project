import { useState } from "react";
import {
  Plus,
  Save,
  Edit,
  Trash2,
  X,
  Map as MapIcon,
  Lock,
  Clock,
  ShieldAlert,
} from "lucide-react";
import { useBusiness } from "@/contexts/BusinessContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/utils";
export default function CategoryManager() {
  const { user } = useAuth();

  const canManageCategories =
    user?.role === "superadmin" ||
    user?.role === "admin" ||
    user?.role === "owner" ||
    user?.role === "editor";

  const {
    categories,
    addCategory,
    updateCategory,
    deleteCategory,
    isProcessing,
  } = useBusiness();

  // LOCAL STATE
  const [newCat, setNewCat] = useState({ id: "", name: "", color: "#004B23" });
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editCatData, setEditCatData] = useState({ name: "", color: "" });

  // HELPERS
  const validateHex = (hex: string) => /^#[0-9A-Fa-f]{6}$/.test(hex);

  const slugify = (text: string) =>
    text
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^\w-]/g, "")
      .replace(/--+/g, "-");

  // HANDLERS
  const handleAdd = async () => {
    if (!validateHex(newCat.color)) {
      return toast.error("Warna Hex harus lengkap (contoh: #004B23)");
    }
    try {
      await addCategory({ ...newCat }, "Published");
      setNewCat({ id: "", name: "", color: "#004B23" });
    } catch (err: unknown) {
      toast.error(getErrorMessage(err) || "Gagal menambah kategori");
    }
  };

  const handleUpdate = async (id: string) => {
    if (!validateHex(editCatData.color)) {
      return toast.error("Warna Hex tidak valid");
    }
    await updateCategory(id, editCatData, "Published");
    setEditingCatId(null);
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Info Banner & Restriction Warning */}
      <div className="bg-daw-green/5 border border-daw-green/20 p-4 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <MapIcon className="w-5 h-5 text-daw-green shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-daw-green font-bold">
              Pengaturan Kategori Peta
            </p>
            <p className="text-xs text-daw-green/80 leading-relaxed">
              Perubahan nama atau warna akan berdampak pada seluruh titik lokasi
              yang menggunakan kategori tersebut.
            </p>
          </div>
        </div>

        {!canManageCategories && (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg text-amber-700 shrink-0 shadow-sm">
            <ShieldAlert className="w-4 h-4" />
            <span className="text-[10px] font-bold uppercase tracking-widest">
              Akses Terkunci (Read-Only)
            </span>
          </div>
        )}
      </div>

      {/* Category Creation Form */}
      {canManageCategories && (
        <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
          <h3 className="font-bold text-slate-900 flex items-center gap-2 text-xs uppercase tracking-widest mb-4">
            <Plus className="w-4 h-4 text-daw-green" /> Tambah Kategori Baru
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase mb-1.5 block">
                ID Referensi
              </label>
              <input
                type="text"
                placeholder="e.g., office-loc"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-4 focus:ring-daw-green/10 focus:border-daw-green outline-none font-mono"
                value={newCat.id}
                onChange={(e) =>
                  setNewCat({ ...newCat, id: slugify(e.target.value) })
                }
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase mb-1.5 block">
                Nama Label
              </label>
              <input
                type="text"
                placeholder="e.g., Kantor Pusat"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-4 focus:ring-daw-green/10 focus:border-daw-green outline-none"
                value={newCat.name}
                onChange={(e) => setNewCat({ ...newCat, name: e.target.value })}
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase mb-1.5 block">
                Warna Pin
              </label>
              <div className="flex items-center gap-2 bg-white px-2 py-1 rounded-lg border border-slate-300">
                <input
                  type="color"
                  className="w-8 h-8 rounded cursor-pointer border-none bg-transparent"
                  value={newCat.color}
                  onChange={(e) =>
                    setNewCat({
                      ...newCat,
                      color: e.target.value.toUpperCase(),
                    })
                  }
                />
                <input
                  type="text"
                  maxLength={7}
                  className="flex-1 text-xs font-mono font-bold text-slate-600 outline-none"
                  value={newCat.color}
                  onChange={(e) => {
                    const val = e.target.value.toUpperCase();
                    if (/^#[0-9A-F]{0,6}$/.test(val))
                      setNewCat({ ...newCat, color: val });
                  }}
                />
              </div>
            </div>
            <button
              disabled={
                isProcessing ||
                !newCat.id ||
                !newCat.name ||
                newCat.color.length < 7
              }
              onClick={handleAdd}
              className="bg-daw-green text-white h-[40px] px-6 rounded-lg font-bold text-xs hover:bg-[#003b1c] disabled:bg-slate-300 transition-all flex items-center justify-center gap-2 shadow-sm">
              {isProcessing ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              CREATE
            </button>
          </div>
        </div>
      )}

      {/*Table List */}
      <div className="overflow-hidden border border-slate-200 rounded-xl shadow-sm bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] font-black">
            <tr>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">ID / Label</th>
              <th className="px-6 py-4">Visual Color</th>
              {canManageCategories && (
                <th className="px-6 py-4 text-right">Actions</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {categories.map((cat) => {
              const isEditingThis = editingCatId === cat.id;
              const isPending = cat.is_locked;

              return (
                <tr
                  key={cat.id}
                  className={`transition-all duration-300 group ${
                    isPending
                      ? "bg-slate-50/50 opacity-70 grayscale-[20%]"
                      : "hover:bg-slate-50/80"
                  }`}>
                  {/* KOLOM STATUS */}
                  <td className="px-6 py-4">
                    {isPending ? (
                      <div className="flex items-center gap-1.5 text-blue-600 font-bold text-[10px] bg-blue-50 px-2 py-1 rounded-full w-fit border border-blue-100 shadow-sm">
                        <Clock className="w-3 h-3 animate-pulse" /> PENDING
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-daw-green font-bold text-[10px] bg-green-50 px-2 py-1 rounded-full w-fit border border-green-100">
                        <div className="w-1 h-1 bg-daw-green rounded-full" />{" "}
                        LIVE
                      </div>
                    )}
                  </td>

                  {/* KOLOM IDENTITAS */}
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="font-mono text-[10px] text-slate-400">
                        {cat.id}
                      </span>
                      {isEditingThis ? (
                        <input
                          className="mt-1 w-full px-2 py-1 border rounded text-sm focus:ring-2 focus:ring-daw-green/20 outline-none"
                          value={editCatData.name}
                          onChange={(e) =>
                            setEditCatData({
                              ...editCatData,
                              name: e.target.value,
                            })
                          }
                          autoFocus
                        />
                      ) : (
                        <span
                          className={`font-bold ${
                            isPending ? "text-slate-400" : "text-slate-700"
                          }`}>
                          {cat.name}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* KOLOM VISUAL WARNA */}
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {isEditingThis ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            className="w-6 h-6 rounded cursor-pointer"
                            value={editCatData.color}
                            onChange={(e) =>
                              setEditCatData({
                                ...editCatData,
                                color: e.target.value.toUpperCase(),
                              })
                            }
                          />
                          <input
                            type="text"
                            className="w-20 px-1 py-0.5 text-xs font-mono font-bold border rounded outline-none"
                            value={editCatData.color}
                            onChange={(e) =>
                              setEditCatData({
                                ...editCatData,
                                color: e.target.value.toUpperCase(),
                              })
                            }
                          />
                        </div>
                      ) : (
                        <>
                          <div
                            className={`w-4 h-4 rounded-full border border-black/10 shadow-sm ${isPending ? "opacity-50" : ""}`}
                            style={{ backgroundColor: cat.color }}
                          />
                          <span className="text-xs font-mono text-slate-400">
                            {cat.color}
                          </span>
                        </>
                      )}
                    </div>
                  </td>

                  {/* KOLOM ACTION */}
                  {canManageCategories && (
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        {isEditingThis ? (
                          <>
                            <button
                              onClick={() => handleUpdate(cat.id)}
                              className="p-1.5 text-daw-green hover:bg-green-50 rounded shadow-sm border border-green-100">
                              <Save className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setEditingCatId(null)}
                              className="p-1.5 text-slate-400 hover:bg-slate-50 rounded">
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              disabled={isPending}
                              onClick={() => {
                                setEditingCatId(cat.id);
                                setEditCatData({
                                  name: cat.name,
                                  color: cat.color,
                                });
                              }}
                              className="p-1.5 text-slate-400 hover:text-daw-green disabled:opacity-30 transition-colors">
                              {isPending ? (
                                <Lock className="w-4 h-4" />
                              ) : (
                                <Edit className="w-4 h-4" />
                              )}
                            </button>
                            <button
                              disabled={isPending}
                              onClick={() =>
                                confirm(`Hapus kategori "${cat.name}"?`) &&
                                deleteCategory(cat.id)
                              }
                              className="p-1.5 text-slate-300 hover:text-red-600 disabled:opacity-30 transition-colors">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
