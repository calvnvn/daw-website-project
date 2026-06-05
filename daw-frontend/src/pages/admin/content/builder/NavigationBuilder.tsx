import { useState, useMemo } from "react";
import { toast } from "sonner";
import {
  Edit2,
  Trash2,
  Link as LinkIcon,
  FileText,
  X,
  GripVertical,
  Plus,
  Settings2,
  Globe,
  LayoutGrid,
  Folder,
  ExternalLink,
} from "lucide-react";
import api from "@/lib/api";
import { useContent } from "@/contexts/ContentContext";
import MagicTranslationField from "@/components/admin/MagicTranslationField";
import { HelpTooltip } from "@/components/ui/HelpTooltip";

interface Menu {
  id: string;
  label: string;
  parentId: string | null;
  orderIndex: number;
  type: "page" | "external" | "folder";
  pageId: string | null;
  externalLink: string | null;
  isActive: boolean;
  children?: Menu[];
}

export default function NavigationBuilder() {
  const {
    pages,
    treeMenus: menus,
    flatMenus,
    isLoading,
    refreshData,
  } = useContent();

  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draggedMenuId, setDraggedMenuId] = useState<string | null>(null);
  const [dragOverMenuId, setDragOverMenuId] = useState<string | null>(null);
  const MAX_ALLOWED_DEPTH = 1;

  const [formData, setFormData] = useState({
    label: "",
    type: "page" as "page" | "external" | "folder",
    pageId: "",
    externalLink: "",
    parentId: "",
    isActive: true,
  });

  // Translation States
  const [terjemahanLabel, setTerjemahanLabel] = useState("");

  const getMaxDepth = (menu: Menu): number => {
    if (!menu.children || menu.children.length === 0) return 0;
    return 1 + Math.max(0, ...menu.children.map(getMaxDepth));
  };

  const getCurrentDepth = (
    parentId: string | null,
    allMenus: Menu[],
  ): number => {
    let depth = 0;
    let currentId = parentId;
    while (currentId !== null) {
      depth++;
      const parent = allMenus.find((m) => m.id === currentId);
      currentId = parent ? parent.parentId : null;
    }
    return depth;
  };

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
    setTerjemahanLabel("");
  };

  const isCircularMove = (
    draggedId: string,
    targetParentId: string | null,
    allMenus: Menu[],
  ) => {
    let currentId: string | null = targetParentId;
    while (currentId !== null) {
      if (currentId === draggedId) return true;
      const parent = allMenus.find((m) => m.id === currentId);
      currentId = parent ? parent.parentId : null;
    }
    return false;
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

    api.get("/translation/manual", {
      params: { modelName: "MENU", recordId: menu.id },
    }).then((transRes) => {
      const transData = transRes.data?.data?.id || {};
      setTerjemahanLabel(transData.label || "");
    }).catch(() => {});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (
      editingId &&
      formData.parentId &&
      isCircularMove(editingId, formData.parentId, flatMenus)
    ) {
      return toast.error(
        "Struktur Ilegal: Menu tidak bisa diletakkan di dalam cabangnya sendiri.",
      );
    }

    const finalParentId =
      formData.type === "folder" ? null : formData.parentId || null;

    setIsSaving(true);
    const toastId = toast.loading("Mempublikasikan navigasi...");

    try {
      const payload: Record<string, unknown> = {
        label: formData.label,
        type: formData.type,
        parentId: finalParentId,
        isActive: formData.isActive,
        pageId: formData.type === "page" ? formData.pageId || null : null,
        externalLink:
          formData.type === "external" ? formData.externalLink || null : null,
      };

      if (terjemahanLabel.trim()) {
        payload._translations = { id: { label: terjemahanLabel.trim() } };
      }

      if (editingId) await api.put(`/menus/${editingId}`, payload);
      else await api.post("/menus", payload);

      toast.success("Menu berhasil dipublikasikan!", { id: toastId });
      resetForm();
      refreshData();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(
        err.response?.data?.message || "Gagal mempublikasikan menu.",
        { id: toastId },
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (
      !confirm(`Tindakan ini akan menghapus "${title}" secara live. Lanjutkan?`)
    )
      return;
    const toastId = toast.loading("Menghapus secara live...");
    try {
      await api.delete(`/menus/${id}`);
      toast.success("Menu berhasil dihapus dari website.", { id: toastId });
      refreshData();
      if (editingId === id) resetForm();
    } catch {
      toast.error("Gagal menghapus menu.", { id: toastId });
    }
  };

  // DRAG LOGIC (Tetap sama, karena secara UI sudah jalan dengan baik)
  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData("text/plain", id);
    setDraggedMenuId(id);
  };

  const handleDrop = async (
    e: React.DragEvent,
    targetMenu: Menu,
    mode: "sibling" | "child",
  ) => {
    e.preventDefault();
    setDragOverMenuId(null);

    const sourceId = e.dataTransfer.getData("text/plain");
    if (!sourceId || sourceId === targetMenu.id) {
      setDraggedMenuId(null);
      return;
    }

    const newParentId = mode === "child" ? targetMenu.id : targetMenu.parentId;
    const sourceMenu = flatMenus.find((m) => m.id === sourceId);

    if (sourceMenu?.type === "folder" && newParentId !== null) {
      setDraggedMenuId(null);
      return toast.error(
        "Menu Folder hanya bisa diletakkan di posisi paling luar (Root).",
      );
    }

    if (isCircularMove(sourceId, newParentId, flatMenus)) {
      setDraggedMenuId(null);
      return toast.error(
        "Struktur Ilegal: Menu tidak bisa digeser ke dalam cabangnya sendiri.",
      );
    }

    const movingSubtreeDepth = sourceMenu ? getMaxDepth(sourceMenu) : 0;
    const newTargetDepth = getCurrentDepth(newParentId, flatMenus);

    if (newTargetDepth + movingSubtreeDepth > MAX_ALLOWED_DEPTH) {
      setDraggedMenuId(null);
      return toast.error(
        `Maksimal kedalaman sub-menu adalah ${MAX_ALLOWED_DEPTH} tingkat.`,
      );
    }

    const toastId = toast.loading("Menyimpan urutan live...");
    try {
      if (!sourceMenu) throw new Error("Source missing.");
      const siblings = flatMenus
        .filter((m) => m.parentId === newParentId && m.id !== sourceId)
        .sort((a, b) => a.orderIndex - b.orderIndex);

      if (mode === "child")
        siblings.push({ ...sourceMenu, parentId: newParentId });
      else {
        const targetIndex = siblings.findIndex((m) => m.id === targetMenu.id);
        if (targetIndex === -1)
          siblings.push({ ...sourceMenu, parentId: newParentId });
        else
          siblings.splice(targetIndex, 0, {
            ...sourceMenu,
            parentId: newParentId,
          });
      }

      const updatedPayload = siblings.map((m, i) => ({
        id: m.id,
        parentId: newParentId,
        orderIndex: i,
      }));
      await api.put("/menus/reorder", { updatedMenus: updatedPayload });
      toast.success("Urutan menu diperbarui secara live!", { id: toastId });
      refreshData();
    } catch (error) {
      toast.error("Gagal menyimpan urutan.", { id: toastId });
    } finally {
      setDraggedMenuId(null);
    }
  };

  const validParentOptions = useMemo(() => {
    return flatMenus.filter((m) => {
      if (!editingId)
        return getCurrentDepth(m.id, flatMenus) < MAX_ALLOWED_DEPTH + 1;
      const movingMenu = flatMenus.find((f) => f.id === editingId);
      const movingMenuSubtreeDepth = movingMenu ? getMaxDepth(movingMenu) : 0;
      const targetDepth = getCurrentDepth(m.id, flatMenus);
      return (
        m.id !== editingId &&
        !isCircularMove(editingId, m.id, flatMenus) &&
        targetDepth + 1 + movingMenuSubtreeDepth <= MAX_ALLOWED_DEPTH + 1
      );
    });
  }, [flatMenus, editingId]);

  const renderMenuTree = (menuList: Menu[], depth = 0) => {
    return menuList.map((menu) => (
      <div key={menu.id} className="relative">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOverMenuId(`${menu.id}-top`);
          }}
          onDragLeave={() => setDragOverMenuId(null)}
          onDrop={(e) => handleDrop(e, menu, "sibling")}
          className={`h-1.5 mx-4 rounded-full ${dragOverMenuId === `${menu.id}-top` ? "bg-emerald-500 my-2" : "bg-transparent"}`}
        />

        <div
          draggable
          onDragStart={(e) => handleDragStart(e, menu.id)}
          onDragEnd={() => {
            setDraggedMenuId(null);
            setDragOverMenuId(null);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOverMenuId(`${menu.id}-child`);
          }}
          onDragLeave={() => setDragOverMenuId(null)}
          onDrop={(e) => handleDrop(e, menu, "child")}
          className={`group relative flex items-center justify-between p-4 rounded-2xl border transition-all duration-300
              ${dragOverMenuId === `${menu.id}-child` ? "border-emerald-500 bg-emerald-50/50 shadow-inner" : "border-slate-200 bg-white shadow-sm hover:shadow-md"}
              ${draggedMenuId === menu.id ? "opacity-30 scale-95" : "opacity-100"}
            `}
          style={{ marginLeft: `${depth * 1.5}rem` }}>
          <div className="flex items-center gap-4">
            <GripVertical className="w-4 h-4 text-slate-300 cursor-grab active:cursor-grabbing group-hover:text-slate-400" />
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center ${menu.type === "page" ? "bg-blue-50 text-blue-500" : menu.type === "folder" ? "bg-emerald-50 text-emerald-500" : "bg-amber-50 text-amber-500"}`}>
              {menu.type === "page" && <FileText className="w-5 h-5" />}
              {menu.type === "external" && <LinkIcon className="w-5 h-5" />}
              {menu.type === "folder" && (
                <Folder className="w-5 h-5 fill-emerald-500/20" />
              )}
            </div>
            <div>
              <h4
                className={`text-sm font-bold ${!menu.isActive && "line-through text-slate-400"}`}>
                {menu.label}
              </h4>
              <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                {menu.type}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1 lg:opacity-0 lg:group-hover:opacity-100 transition-all">
            <button
              onClick={() => {
                setEditingId(null);
                setFormData({ ...formData, parentId: menu.id });
              }}
              className="p-2 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-lg"
              title="Tambah Sub-menu">
              <Plus className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleEdit(menu)}
              className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg"
              title="Edit Live">
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleDelete(menu.id, menu.label)}
              className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
              title="Hapus Live">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {menu.children && menu.children.length > 0 && (
          <div className="border-l-2 border-slate-100 ml-6 mt-1">
            {renderMenuTree(menu.children, depth + 1)}
          </div>
        )}
      </div>
    ));
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start p-2">
      {/* LEFT: NAVIGATION TREE */}
      <div className="lg:col-span-7">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-serif font-black text-slate-900 tracking-tight">
              Navigation Architect
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-1">
              Kelola struktur menu secara <b>Live</b> (Tanpa Approval).
            </p>
          </div>
          <div className="flex gap-2">
            <div className="px-3 py-1.5 bg-slate-100 rounded-lg text-[10px] font-bold text-slate-500 uppercase flex items-center gap-2">
              <LayoutGrid className="w-3 h-3" /> {flatMenus.length} Item Menu
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="p-20 text-center">
            <div className="w-12 h-12 border-4 border-t-emerald-500 rounded-full animate-spin mx-auto mb-4" />
          </div>
        ) : (
          <div className="space-y-1 pb-20">{renderMenuTree(menus)}</div>
        )}
      </div>

      {/* RIGHT: PROPERTY PANEL */}
      <div className="lg:col-span-5 sticky top-24">
        <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl shadow-slate-200/50 overflow-hidden transition-all">
          <div className="p-8 border-b border-slate-50 bg-slate-50/30">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center bg-slate-900 text-white">
                <Settings2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 leading-none">
                  {editingId ? "Edit Menu Live" : "Navigasi Menu Baru"}
                </h3>
                <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mt-1">
                  Perubahan langsung tampil di website
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-8 space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                Nama Label
              </label>
              <input
                type="text"
                required
                value={formData.label}
                onChange={(e) =>
                  setFormData({ ...formData, label: e.target.value })
                }
                className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-100 focus:bg-white focus:border-emerald-500 outline-none transition-all font-bold text-slate-700"
                placeholder="e.g. Services / Layanan"
              />
              <MagicTranslationField
                label="Nama Label (Indonesian)"
                value={terjemahanLabel}
                onChange={setTerjemahanLabel}
                originalText={formData.label}
              />
            </div>

            {/* TYPE SELECTION */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center">
                Pilih Tipe Menu Navigasi
                <HelpTooltip content="Tipe menu menentukan fungsi dari tombol menu di website. Apakah membuka halaman yang Anda buat (Internal), membuka website lain (External), atau hanya sebagai induk dropdown (Folder)." />
              </label>
              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setFormData({ ...formData, type: "page", externalLink: "" })
                  }
                  className={`relative p-3 rounded-xl border-2 flex flex-col items-center gap-1.5 transition-all text-center
                        ${formData.type === "page" ? "border-blue-500 bg-blue-50/30" : "border-slate-100 hover:border-slate-200"}`}>
                  <FileText
                    className={`w-5 h-5 ${formData.type === "page" ? "text-blue-500" : "text-slate-400"}`}
                  />
                  <div className="flex items-center gap-1">
                    <span
                      className={`text-[9px] font-black uppercase ${formData.type === "page" ? "text-blue-700" : "text-slate-400"}`}>
                      Internal Page
                    </span>
                    <HelpTooltip content="Pilih ini untuk menautkan menu ke halaman (Page) yang sudah Anda buat di menu Page Builder." position="bottom" />
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setFormData({ ...formData, type: "external", pageId: "" })
                  }
                  className={`relative p-3 rounded-xl border-2 flex flex-col items-center gap-1.5 transition-all text-center
                        ${formData.type === "external" ? "border-amber-500 bg-amber-50/30" : "border-slate-100 hover:border-slate-200"}`}>
                  <Globe
                    className={`w-5 h-5 ${formData.type === "external" ? "text-amber-500" : "text-slate-400"}`}
                  />
                  <div className="flex items-center gap-1">
                    <span
                      className={`text-[9px] font-black uppercase ${formData.type === "external" ? "text-amber-700" : "text-slate-400"}`}>
                      External Link
                    </span>
                    <HelpTooltip content="Pilih ini jika menu akan mengarahkan pengunjung ke website di luar sistem (misal: Youtube, Google)." position="bottom" />
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setFormData({
                      ...formData,
                      type: "folder",
                      pageId: "",
                      externalLink: "",
                      parentId: "",
                    })
                  }
                  className={`relative p-3 rounded-xl border-2 flex flex-col items-center gap-1.5 transition-all text-center
                        ${formData.type === "folder" ? "border-emerald-500 bg-emerald-50/30" : "border-slate-100 hover:border-slate-200"}`}>
                  <Folder
                    className={`w-5 h-5 ${formData.type === "folder" ? "text-emerald-500 fill-emerald-500/20" : "text-slate-400"}`}
                  />
                  <div className="flex items-center gap-1">
                    <span
                      className={`text-[9px] font-black uppercase ${formData.type === "folder" ? "text-emerald-700" : "text-slate-400"}`}>
                      Dropdown Folder
                    </span>
                    <HelpTooltip content="Menu ini tidak bisa di-klik. Fungsinya murni sebagai induk (dropdown) untuk menampung sub-menu di bawahnya." position="bottom" />
                  </div>
                </button>
              </div>
            </div>

            {/* CONDITIONAL INPUTS */}
            {formData.type === "page" && (
              <div className="space-y-2 animate-in slide-in-from-top-2 duration-300">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                  Konten Terhubung
                </label>
                <select
                  required
                  value={formData.pageId || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, pageId: e.target.value })
                  }
                  className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-100 outline-none font-bold text-slate-700 appearance-none">
                  <option value="">-- Pilih Halaman --</option>
                  {pages.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {formData.type === "external" && (
              <div className="space-y-2 animate-in slide-in-from-top-2 duration-300">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                  URL Tujuan (Luar Situs)
                </label>
                <div className="relative">
                  <ExternalLink className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                  <input
                    type="url"
                    required
                    value={formData.externalLink || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, externalLink: e.target.value })
                    }
                    className="w-full pl-12 pr-5 py-4 rounded-2xl bg-slate-50 border border-slate-100 outline-none font-mono text-xs text-slate-600"
                    placeholder="https://example.com"
                  />
                </div>
              </div>
            )}

            {formData.type === "folder" && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl animate-in fade-in">
                <p className="text-xs text-emerald-700 font-medium leading-relaxed">
                  💡 <strong>Info:</strong> Menu Folder berfungsi sebagai wadah
                  untuk sub-menu.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                Posisi Hirarki
              </label>
              <select
                value={formData.parentId || ""}
                disabled={formData.type === "folder"}
                onChange={(e) =>
                  setFormData({ ...formData, parentId: e.target.value })
                }
                className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-100 outline-none text-sm font-bold text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed">
                <option value=""> Atur sebagai Menu Utama (Root) </option>
                {validParentOptions.map((m) => (
                  <option key={m.id} value={m.id}>
                    Sub dari: {m.label}
                  </option>
                ))}
              </select>
            </div>

            {/* ACTION BUTTONS (Sovereign Style) */}
            <div className="pt-4 flex flex-col gap-3">
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-4 rounded-2xl font-bold shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                  {editingId ? (
                    <Edit2 className="w-5 h-5" />
                  ) : (
                    <Plus className="w-5 h-5" />
                  )}
                  {editingId ? "Simpan & Publish" : "Publish Menu Baru"}
                </button>

                {editingId && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-6 bg-slate-100 text-slate-500 py-4 rounded-2xl font-bold hover:bg-slate-200 transition-all"
                    title="Batalkan Edit">
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>

              {!editingId && formData.label && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:text-red-500 transition-colors">
                  Bersihkan Formulir
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
