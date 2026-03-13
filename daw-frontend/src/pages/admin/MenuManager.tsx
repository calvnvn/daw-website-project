import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Plus,
  Edit2,
  Trash2,
  Link as LinkIcon,
  FileText,
  CornerDownRight,
  Save,
  X,
  AlertCircle,
  GripVertical,
} from "lucide-react";
import api from "@/lib/api"; // Sesuaikan path axios instance Anda

// --- BENTUK DATA ---
interface Page {
  id: string;
  title: string;
  slug: string;
}

interface Menu {
  id: string;
  label: string;
  parentId: string | null;
  orderIndex: number;
  type: "page" | "external";
  pageId: string | null;
  externalLink: string | null;
  isActive: boolean;
  children?: Menu[]; // Untuk Tree View
}

export default function MenuManager() {
  const [menus, setMenus] = useState<Menu[]>([]); // Untuk Tree Display
  const [flatMenus, setFlatMenus] = useState<Menu[]>([]); // Untuk Dropdown Parent
  const [pages, setPages] = useState<Page[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [draggedMenuId, setDraggedMenuId] = useState<string | null>(null);
  const [dragOverMenuId, setDragOverMenuId] = useState<string | null>(null);

  // State Formulir
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    label: "",
    type: "page",
    pageId: "",
    externalLink: "",
    parentId: "",
    isActive: true,
  });

  // --- FETCH DATA AWAL ---
  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Jalankan 3 request secara paralel agar super cepat!
      const [treeRes, flatRes, pagesRes] = await Promise.all([
        api.get("/menus/tree"),
        api.get("/menus/flat"),
        api.get("/pages"), // Pastikan rute ini ada di backend Anda
      ]);
      setMenus(treeRes.data);
      setFlatMenus(flatRes.data);
      setPages(pagesRes.data);
    } catch (error) {
      toast.error("Gagal mengambil data menu & halaman");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // --- LOGIKA FORMULIR ---
  const resetForm = () => {
    setEditingId(null);
    setFormData({
      label: "",
      type: "page",
      pageId: "",
      externalLink: "",
      parentId: "",
      isActive: true,
    });
  };

  const handleEdit = (menu: Menu) => {
    setEditingId(menu.id);
    setFormData({
      label: menu.label,
      type: menu.type,
      pageId: menu.pageId || "",
      externalLink: menu.externalLink || "",
      parentId: menu.parentId || "",
      isActive: menu.isActive,
    });
  };

  const handleDelete = async (id: string) => {
    if (
      !confirm("Yakin ingin menghapus menu ini? (Sub-menu juga akan terhapus)")
    )
      return;

    const toastId = toast.loading("Menghapus menu...");
    try {
      await api.delete(`/menus/${id}`);
      toast.success("Menu berhasil dihapus", { id: toastId });
      fetchData(); // Refresh data
      if (editingId === id) resetForm();
    } catch (error) {
      toast.error("Gagal menghapus menu", { id: toastId });
      console.log(error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    const toastId = toast.loading(
      editingId ? "Memperbarui menu..." : "Menyimpan menu baru...",
    );

    try {
      // Payload preparation (ubah string kosong jadi null untuk DB)
      const payload = {
        ...formData,
        pageId: formData.type === "page" ? formData.pageId || null : null,
        externalLink:
          formData.type === "external" ? formData.externalLink || null : null,
        parentId: formData.parentId || null,
      };

      if (editingId) {
        await api.put(`/menus/${editingId}`, payload);
        toast.success("Menu berhasil diperbarui!", { id: toastId });
      } else {
        await api.post("/menus", payload);
        toast.success("Menu baru berhasil ditambahkan!", { id: toastId });
      }
      resetForm();
      fetchData();
    } catch (error) {
      toast.error("Gagal menyimpan menu", { id: toastId });
      console.log(error);
    } finally {
      setIsSaving(false);
    }
  };

  // Drag & Drop Native
  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData("text/plain", id);
    setDraggedMenuId(id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverMenuId !== id) setDragOverMenuId(id);
  };

  const handleDragLeave = () => {
    setDragOverMenuId(null);
  };

  const handleDrop = async (e: React.DragEvent, targetMenu: Menu) => {
    e.preventDefault();
    setDragOverMenuId(null);
    const sourceId = e.dataTransfer.getData("text/plain");

    if (!sourceId || sourceId === targetMenu.id) {
      setDraggedMenuId(null);
      return;
    }

    const toastId = toast.loading("Menyusun ulang urutan menu...");

    try {
      // 1. Cari data menu yang ditarik dari flatMenus
      const sourceMenu = flatMenus.find((m) => m.id === sourceId);
      if (!sourceMenu) throw new Error("Menu tidak ditemukan");

      const newParentId = targetMenu.parentId;

      let siblings = flatMenus.filter(
        (m) => m.parentId === newParentId && m.id !== sourceId,
      );

      siblings.sort((a, b) => a.orderIndex - b.orderIndex);

      const targetIndex = siblings.findIndex((m) => m.id === targetMenu.id);

      siblings.splice(targetIndex + 1, 0, {
        ...sourceMenu,
        parentId: newParentId,
      });

      const updatedMenusPayload = siblings.map((menu, index) => ({
        id: menu.id,
        parentId: newParentId,
        orderIndex: index,
      }));

      await api.put("/menus/reorder", { updatedMenus: updatedMenusPayload });

      toast.success("Urutan berhasil diperbarui!", { id: toastId });
      fetchData(); // Refresh UI untuk melihat hasil akhirnya
    } catch (error) {
      toast.error("Gagal menyusun ulang menu", { id: toastId });
      console.error(error);
    } finally {
      setDraggedMenuId(null);
    }
  };

  // --- RECURSIVE RENDERER UNTUK TREE VIEW ---
  const renderMenuTree = (menuList: Menu[], depth = 0) => {
    return menuList.map((menu) => {
      const isDragging = draggedMenuId === menu.id;
      const isDragOver = dragOverMenuId === menu.id;

      return (
        <div key={menu.id} className="w-full">
          <div
            // Tambahkan event listener Drag & Drop HTML5
            draggable
            onDragStart={(e) => handleDragStart(e, menu.id)}
            onDragOver={(e) => handleDragOver(e, menu.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, menu)}
            // Animasi Visual saat diseret dan ditimpa
            className={`group flex items-center justify-between p-3 mb-2 rounded-xl border transition-all duration-200
              ${editingId === menu.id ? "bg-daw-green/5 border-daw-green shadow-sm" : "bg-white border-slate-200 hover:border-daw-green/50"}
              ${isDragging ? "opacity-30 scale-95 border-dashed" : "opacity-100 scale-100"}
              ${isDragOver ? "border-b-4 border-b-daw-green bg-daw-green/10 translate-y-1 shadow-md" : ""}
            `}
            style={{ marginLeft: `${depth * 1.5}rem` }}
          >
            <div className="flex items-center gap-3">
              {/* IKON GRIP UNTUK MENUNJUKKAN BISA DI-DRAG */}
              <div className="cursor-grab active:cursor-grabbing hover:bg-slate-100 p-1 rounded transition-colors -ml-1">
                <GripVertical className="w-4 h-4 text-slate-400 hover:text-daw-green" />
              </div>

              {depth > 0 && (
                <CornerDownRight className="w-4 h-4 text-slate-300" />
              )}

              <div
                className={`p-2 rounded-lg ${menu.type === "page" ? "bg-blue-50 text-blue-600" : "bg-orange-50 text-orange-600"}`}
              >
                {menu.type === "page" ? (
                  <FileText className="w-4 h-4" />
                ) : (
                  <LinkIcon className="w-4 h-4" />
                )}
              </div>
              <div>
                <h4
                  className={`font-bold text-sm ${!menu.isActive && "text-slate-400 line-through"}`}
                >
                  {menu.label}
                </h4>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mt-0.5">
                  {menu.type === "page" ? "Internal Page" : "External Link"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => handleEdit(menu)}
                className="p-1.5 text-slate-400 hover:text-daw-green hover:bg-daw-green/10 rounded-md"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleDelete(menu.id)}
                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Render Anaknya (Rekursif) */}
          {menu.children && menu.children.length > 0 && (
            <div className="border-l-2 border-slate-100 ml-5 pl-3">
              {renderMenuTree(menu.children, depth + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500 pb-12">
      {/* HEADER */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-serif font-bold text-slate-900">
            Menu Manager
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Atur struktur navigasi website Anda
          </p>
        </div>
        {!editingId && (
          <button
            onClick={resetForm}
            className="flex items-center gap-2 bg-daw-green hover:bg-[#003b1c] text-white px-5 py-2.5 rounded-lg font-medium transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" /> Tambah Menu
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* KIRI: TREE VIEW DISPLAY */}
        <div className="lg:col-span-7 bg-slate-50/50 p-6 rounded-xl border border-slate-200 min-h-[500px]">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-6 flex items-center gap-2">
            Struktur Menu Saat Ini
          </h3>

          {isLoading ? (
            <div className="text-center p-10 text-slate-400 animate-pulse font-bold">
              Memuat Struktur...
            </div>
          ) : menus.length === 0 ? (
            <div className="text-center p-12 bg-white border border-dashed border-slate-300 rounded-xl text-slate-500">
              Belum ada menu. Silakan tambah di sebelah kanan.
            </div>
          ) : (
            <div className="space-y-1">{renderMenuTree(menus)}</div>
          )}
        </div>

        {/* KANAN: SMART FORM */}
        <div className="lg:col-span-5 bg-white p-6 rounded-xl border border-slate-200 shadow-sm lg:sticky lg:top-24">
          <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-100">
            <h3 className="text-base font-bold text-slate-900">
              {editingId ? "Edit Menu" : "Tambah Menu Baru"}
            </h3>
            {editingId && (
              <button
                onClick={resetForm}
                className="text-xs flex items-center gap-1 text-slate-400 hover:text-red-500"
              >
                <X className="w-3 h-3" /> Batal Edit
              </button>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* 1. NAMA MENU */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                Label Menu *
              </label>
              <input
                type="text"
                required
                value={formData.label}
                onChange={(e) =>
                  setFormData({ ...formData, label: e.target.value })
                }
                placeholder="Contoh: Tentang Kami"
                className="w-full px-4 py-2.5 rounded-lg bg-slate-50 border border-slate-200 focus:bg-white focus:border-daw-green focus:ring-2 focus:ring-daw-green/20 transition-all outline-none"
              />
            </div>

            {/* 2. PARENT MENU (HIERARKI) */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                Induk Menu (Opsional)
              </label>
              <select
                value={formData.parentId}
                onChange={(e) =>
                  setFormData({ ...formData, parentId: e.target.value })
                }
                className="w-full px-4 py-2.5 rounded-lg bg-slate-50 border border-slate-200 focus:bg-white focus:border-daw-green focus:ring-2 focus:ring-daw-green/20 outline-none"
              >
                <option value="">-- Jadikan Menu Utama --</option>
                {flatMenus.map(
                  (m) =>
                    // Cegah menu menjadikan dirinya sendiri sebagai parent
                    m.id !== editingId && (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ),
                )}
              </select>
              <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> Pilih induk jika ini adalah
                sub-menu (dropdown).
              </p>
            </div>

            {/* 3. TIPE KONTEN */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <label
                className={`cursor-pointer border-2 rounded-xl p-3 flex flex-col items-center gap-2 transition-all ${formData.type === "page" ? "border-daw-green bg-daw-green/5" : "border-slate-100 hover:border-slate-200"}`}
              >
                <input
                  type="radio"
                  name="type"
                  value="page"
                  className="sr-only"
                  checked={formData.type === "page"}
                  onChange={() =>
                    setFormData({ ...formData, type: "page", externalLink: "" })
                  }
                />
                <FileText
                  className={`w-5 h-5 ${formData.type === "page" ? "text-daw-green" : "text-slate-400"}`}
                />
                <span
                  className={`text-xs font-bold ${formData.type === "page" ? "text-daw-green" : "text-slate-500"}`}
                >
                  Internal Page
                </span>
              </label>
              <label
                className={`cursor-pointer border-2 rounded-xl p-3 flex flex-col items-center gap-2 transition-all ${formData.type === "external" ? "border-orange-500 bg-orange-50" : "border-slate-100 hover:border-slate-200"}`}
              >
                <input
                  type="radio"
                  name="type"
                  value="external"
                  className="sr-only"
                  checked={formData.type === "external"}
                  onChange={() =>
                    setFormData({ ...formData, type: "external", pageId: "" })
                  }
                />
                <LinkIcon
                  className={`w-5 h-5 ${formData.type === "external" ? "text-orange-500" : "text-slate-400"}`}
                />
                <span
                  className={`text-xs font-bold ${formData.type === "external" ? "text-orange-500" : "text-slate-500"}`}
                >
                  External Link
                </span>
              </label>
            </div>

            {/* 4. DYNAMIC FIELD: PAGE vs LINK */}
            {formData.type === "page" ? (
              <div className="animate-in slide-in-from-top-2 duration-300">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Pilih Halaman Terhubung *
                </label>
                <select
                  required={formData.type === "page"}
                  value={formData.pageId}
                  onChange={(e) =>
                    setFormData({ ...formData, pageId: e.target.value })
                  }
                  className="w-full px-4 py-2.5 rounded-lg bg-slate-50 border border-slate-200 focus:bg-white focus:border-daw-green focus:ring-2 focus:ring-daw-green/20 outline-none"
                >
                  <option value="" disabled>
                    -- Pilih Halaman --
                  </option>
                  {pages.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title} (/page/{p.slug})
                    </option>
                  ))}
                </select>
                {/* Opsional: Tombol pintasan ke pembuat halaman */}
                <p className="text-[10px] text-right mt-2">
                  <span className="text-daw-green hover:underline cursor-pointer">
                    Atau buat halaman baru &rarr;
                  </span>
                </p>
              </div>
            ) : (
              <div className="animate-in slide-in-from-top-2 duration-300">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  URL Tujuan (External) *
                </label>
                <input
                  type="url"
                  required={formData.type === "external"}
                  value={formData.externalLink}
                  onChange={(e) =>
                    setFormData({ ...formData, externalLink: e.target.value })
                  }
                  placeholder="https://..."
                  className="w-full px-4 py-2.5 rounded-lg bg-slate-50 border border-slate-200 focus:bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none"
                />
              </div>
            )}

            {/* 5. TOGGLE AKTIF */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <div>
                <span className="block text-sm font-bold text-slate-900">
                  Status Menu
                </span>
                <span className="text-[10px] text-slate-500">
                  Menu tidak aktif akan disembunyikan dari Navbar publik.
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={formData.isActive}
                  onChange={(e) =>
                    setFormData({ ...formData, isActive: e.target.checked })
                  }
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-daw-green"></div>
              </label>
            </div>

            {/* TOMBOL SIMPAN */}
            <button
              type="submit"
              disabled={isSaving}
              className="w-full flex justify-center items-center gap-2 bg-daw-green hover:bg-[#003b1c] disabled:bg-slate-300 disabled:cursor-not-allowed text-white py-3 rounded-xl font-bold transition-all shadow-md mt-6"
            >
              <Save className="w-5 h-5" />
              {isSaving
                ? "Menyimpan..."
                : editingId
                  ? "Simpan Perubahan"
                  : "Simpan Menu Baru"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
