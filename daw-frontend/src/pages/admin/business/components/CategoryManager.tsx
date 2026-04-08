import { useState } from "react";
import { Plus, Save, Edit, Trash2, X, Map as MapIcon } from "lucide-react";
import { useBusiness } from "@/contexts/BusinessContext";

export default function CategoryManager() {
  const {
    categories,
    addCategory,
    updateCategory,
    deleteCategory,
    isProcessing,
  } = useBusiness();

  // --- LOCAL STATE (Hanya untuk keperluan form di sini) ---
  const [newCat, setNewCat] = useState({ id: "", name: "", color: "#004B23" });
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editCatData, setEditCatData] = useState({ name: "", color: "" });

  // Handler: Mulai Edit Row
  const startEdit = (cat: any) => {
    setEditingCatId(cat.id);
    setEditCatData({ name: cat.name, color: cat.color });
  };

  // Handler: Simpan Edit Row
  const handleUpdate = async (id: string) => {
    await updateCategory(id, editCatData);
    setEditingCatId(null);
  };

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
      {/* 1. Info Banner */}
      <div className="bg-daw-green/5 border border-daw-green/20 p-4 rounded-xl flex items-center gap-3">
        <MapIcon className="w-5 h-5 text-daw-green shrink-0" />
        <p className="text-sm text-daw-green font-medium">
          <strong>Informasi:</strong> Kategori di bawah ini akan menentukan
          label dan warna titik (pin) pada seluruh peta di website.
        </p>
      </div>

      {/* 2. Category Creation Form */}
      <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 space-y-4">
        <h3 className="font-bold text-slate-900 flex items-center gap-2 text-sm uppercase tracking-wider">
          <Plus className="w-4 h-4 text-daw-green" /> Tambah Kategori Baru
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block italic">
              ID Referensi
            </label>
            <input
              type="text"
              placeholder="e.g., office-loc"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-daw-green/20 outline-none"
              value={newCat.id}
              onChange={(e) =>
                setNewCat({
                  ...newCat,
                  id: e.target.value.toLowerCase().replace(/\s+/g, "-"),
                })
              }
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">
              Nama Label
            </label>
            <input
              type="text"
              placeholder="e.g., Kantor Pusat"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-daw-green/20 outline-none"
              value={newCat.name}
              onChange={(e) => setNewCat({ ...newCat, name: e.target.value })}
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
              <input
                type="text"
                maxLength={7}
                className="w-20 text-xs font-mono font-bold text-slate-600 bg-transparent outline-none border-b border-transparent focus:border-slate-300 transition-colors"
                value={newCat.color.toUpperCase()}
                onChange={(e) => {
                  const val = e.target.value;
                  // Allow typing, but only update state if it represents a valid hex sequence flow
                  if (/^#[0-9A-Fa-f]{0,6}$/.test(val)) {
                    setNewCat({ ...newCat, color: val });
                  }
                }}
              />
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

      {/* 3. List of Existing Categories Table */}
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
                  className="hover:bg-slate-50/50 transition-colors"
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
                        <>
                          {/* Visual Color Picker */}
                          <input
                            type="color"
                            className="w-6 h-6 rounded cursor-pointer border-none bg-transparent"
                            value={editCatData.color}
                            onChange={(e) =>
                              setEditCatData({
                                ...editCatData,
                                color: e.target.value.toUpperCase(),
                              })
                            }
                          />
                          {/* Manual Hex Input - Senior UX implementation */}
                          <input
                            type="text"
                            maxLength={7}
                            className="w-20 px-1 py-0.5 text-xs font-mono font-bold text-slate-700 bg-white border border-slate-200 rounded outline-none focus:border-daw-green transition-all"
                            value={editCatData.color.toUpperCase()}
                            spellCheck={false}
                            onChange={(e) => {
                              const val = e.target.value;
                              // REGEX: Allows '#' followed by up to 6 hex characters
                              if (/^#[0-9A-Fa-f]{0,6}$/.test(val)) {
                                setEditCatData({
                                  ...editCatData,
                                  color: val,
                                });
                              }
                            }}
                          />
                        </>
                      ) : (
                        <>
                          {/* Static View Mode */}
                          <div
                            className="w-5 h-5 rounded-full border border-black/10 shadow-sm"
                            style={{ backgroundColor: cat.color }}
                          />
                          <span className="text-xs font-mono font-bold text-slate-400">
                            {cat.color.toUpperCase()}
                          </span>
                        </>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      {isEditingThis ? (
                        <>
                          <button
                            onClick={() => handleUpdate(cat.id)}
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
                            onClick={() => startEdit(cat)}
                            className="p-1.5 text-slate-300 hover:text-daw-green rounded transition-colors"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() =>
                              confirm(`Delete "${cat.name}"?`) &&
                              deleteCategory(cat.id)
                            }
                            className="p-1.5 text-slate-300 hover:text-red-600 rounded transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
