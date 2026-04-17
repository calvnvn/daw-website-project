import { useState, useEffect, useMemo } from "react";
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
  ExternalLink,
  LayoutGrid,
  Folder,
  Lock,
} from "lucide-react";
import api from "@/lib/api";
import { useContent } from "@/contexts/ContentContext";

interface PageOption {
  id: string;
  title: string;
  slug?: string;
}

interface Menu {
  id: string;
  label: string;
  parentId: string | null;
  orderIndex: number;
  type: "page" | "external" | "folder";
  pageId: string | null;
  externalLink: string | null;
  isActive: boolean;
  is_locked?: boolean;
  lock_ticket?: string | null;
  children?: Menu[];
}

export default function NavigationBuilder() {
  const {
    pages,
    treeMenus: menus,
    flatMenus,
    isLoading,
    isNavigationLocked,
    navigationLockTicket,
    refreshData,
  } = useContent();

  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draggedMenuId, setDraggedMenuId] = useState<string | null>(null);
  const [dragOverMenuId, setDragOverMenuId] = useState<string | null>(null);
  const MAX_ALLOWED_DEPTH = 1; // 0 = Root only, 1 = Root + 1 Level Dropdown

  const [formData, setFormData] = useState({
    label: "",
    type: "page" as "page" | "external" | "folder",
    pageId: "",
    externalLink: "",
    parentId: "",
    isActive: true,
    status: "Published",
  });

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
      status: "Published",
    });
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
    if (isNavigationLocked || menu.is_locked) {
      return toast.error("Menu sedang terkunci dan tidak dapat diedit.");
    }

    setEditingId(menu.id);
    setFormData({
      label: menu.label,
      type: menu.type,
      pageId: menu.pageId || "",
      externalLink: menu.externalLink || "",
      parentId: menu.parentId || "",
      isActive: menu.isActive,
      status: "Published",
    });
  };

  const handleSubmit = async (
    e: React.FormEvent,
    submitStatus: "Draft" | "Published" = "Published",
  ) => {
    e.preventDefault();

    // 🛡️ BLUEPRINT: Guard Lock Global
    if (isNavigationLocked) {
      return toast.error(
        "Struktur navigasi sedang dikunci oleh proses approval.",
      );
    }

    if (
      editingId &&
      formData.parentId &&
      isCircularMove(editingId, formData.parentId, flatMenus)
    ) {
      return toast.error(
        "Kesalahan Hirarki: Menu tidak bisa diletakkan di dalam anak menunya sendiri.",
      );
    }

    const finalParentId =
      formData.type === "folder" ? null : formData.parentId || null;

    setIsSaving(true);
    const toastId = toast.loading(
      submitStatus === "Published"
        ? "Mengirim pengajuan..."
        : "Menyimpan draf lokal...",
    );

    try {
      const payload: Record<string, unknown> = {
        label: formData.label,
        type: formData.type,
        parentId: finalParentId,
        isActive: formData.isActive,
        pageId: formData.type === "page" ? formData.pageId || null : null,
        externalLink:
          formData.type === "external" ? formData.externalLink || null : null,
        status: submitStatus,
      };

      if (editingId) await api.put(`/menus/${editingId}`, payload);
      else await api.post("/menus", payload);

      toast.success("Permintaan menu berhasil dikirim!", { id: toastId });
      resetForm();

      refreshData();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(
        err.response?.data?.message || "Gagal menyimpan konfigurasi menu.",
        { id: toastId },
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string, title: string, isLocked: boolean) => {
    // 🛡️ BLUEPRINT: Guard
    if (isNavigationLocked || isLocked) {
      return toast.error(
        "Aksi ditolak. Data sedang terkunci oleh proses approval.",
      );
    }

    if (
      !confirm(
        `Hapus "${title}"? Semua sub-menu di bawahnya juga akan ikut terhapus.`,
      )
    )
      return;

    const toastId = toast.loading("Sedang memproses...");
    try {
      await api.delete(`/menus/${id}`);
      toast.success("Permintaan hapus menu berhasil.", { id: toastId });
      refreshData(); // Sync context
      if (editingId === id) resetForm();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Gagal menghapus menu.", {
        id: toastId,
      });
    }
  };

  // DRAG LOGIC
  const handleDragStart = (e: React.DragEvent, id: string) => {
    if (isNavigationLocked) {
      e.preventDefault();
      return;
    }
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

    if (isNavigationLocked)
      return toast.error("Susunan sedang dikunci oleh admin.");

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
        "Menu Folder hanya bisa diletakkan di posisi paling luar (Menu Utama).",
      );
    }

    if (isCircularMove(sourceId, newParentId, flatMenus)) {
      setDraggedMenuId(null);
      return toast.error(
        "Kesalahan struktur: Menu tidak bisa digeser ke dalam cabangnya sendiri.",
      );
    }

    const movingSubtreeDepth = sourceMenu ? getMaxDepth(sourceMenu) : 0;
    const newTargetDepth = getCurrentDepth(newParentId, flatMenus);

    if (newTargetDepth + movingSubtreeDepth > MAX_ALLOWED_DEPTH) {
      setDraggedMenuId(null);
      return toast.error(
        `Struktur terlalu dalam. Maksimal sub-menu adalah ${MAX_ALLOWED_DEPTH} tingkat.`,
      );
    }

    const toastId = toast.loading("Sedang mengatur ulang urutan menu...");
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
      toast.success("Permintaan urutan berhasil diajukan.", { id: toastId });
      refreshData();
    } catch (error) {
      toast.error("Gagal mengatur ulang urutan.");
      console.error("Error: ", error);
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
    return menuList.map((menu) => {
      const isLocked = menu.is_locked;

      return (
        <div key={menu.id} className="relative">
          <div
            onDragOver={(e) => {
              if (isNavigationLocked) return; // Guard
              e.preventDefault();
              setDragOverMenuId(`${menu.id}-top`);
            }}
            onDragLeave={() => setDragOverMenuId(null)}
            onDrop={(e) =>
              !isNavigationLocked && handleDrop(e, menu, "sibling")
            }
            className={`h-1.5 transition-all mx-4 rounded-full ${
              dragOverMenuId === `${menu.id}-top`
                ? "bg-emerald-500 my-2"
                : "bg-transparent"
            }`}
          />

          <div
            draggable={!isNavigationLocked && !isLocked}
            onDragStart={(e) => handleDragStart(e, menu.id)}
            onDragEnd={() => {
              setDraggedMenuId(null);
              setDragOverMenuId(null);
            }}
            onDragOver={(e) => {
              if (isNavigationLocked) return; // Guard
              e.preventDefault();
              setDragOverMenuId(`${menu.id}-child`);
            }}
            onDragLeave={() => setDragOverMenuId(null)}
            onDrop={(e) => !isNavigationLocked && handleDrop(e, menu, "child")}
            className={`group relative flex items-center justify-between p-4 rounded-2xl border transition-all duration-300
              ${
                dragOverMenuId === `${menu.id}-child`
                  ? "border-emerald-500 bg-emerald-50/50 shadow-inner"
                  : isLocked || isNavigationLocked
                    ? "border-slate-200 bg-slate-50/50 cursor-not-allowed" // Visual Lockdown
                    : "border-slate-200 bg-white shadow-sm hover:shadow-md"
              }
              ${draggedMenuId === menu.id ? "opacity-30 scale-95" : "opacity-100"}
            `}
            style={{ marginLeft: `${depth * 1.5}rem` }}>
            {depth > 0 && (
              <div className="absolute -left-4 top-1/2 -translate-y-1/2 w-4 h-[2px] bg-slate-200" />
            )}

            <div className="flex items-center gap-4">
              {/* Grip hanya muncul/berfungsi jika tidak dikunci */}
              {!isNavigationLocked && !isLocked ? (
                <GripVertical className="w-4 h-4 text-slate-300 cursor-grab active:cursor-grabbing group-hover:text-slate-400" />
              ) : (
                <Lock className="w-4 h-4 text-blue-400 opacity-50" />
              )}

              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors
                ${
                  menu.type === "page"
                    ? "bg-blue-50 text-blue-500"
                    : menu.type === "folder"
                      ? "bg-daw-green/10 text-daw-green"
                      : "bg-amber-50 text-amber-500"
                }`}>
                {menu.type === "page" && <FileText className="w-5 h-5" />}
                {menu.type === "external" && <LinkIcon className="w-5 h-5" />}
                {menu.type === "folder" && (
                  <Folder className="w-5 h-5 fill-daw-green/20" />
                )}
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h4
                    className={`text-sm font-bold tracking-tight ${
                      isLocked || isNavigationLocked
                        ? "text-slate-500"
                        : "text-slate-900"
                    } ${!menu.isActive && "line-through opacity-50"}`}>
                    {menu.label}
                  </h4>

                  {isLocked && (
                    <span className="bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter flex items-center gap-1">
                      <Lock className="w-2 h-2" /> Pending
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                    {menu.type}
                  </span>
                </div>
              </div>
            </div>

            {/* Action Buttons: Disabled jika dikunci */}
            <div
              className={`flex items-center gap-1 transition-all duration-300 
              ${isNavigationLocked || isLocked ? "opacity-50" : "lg:opacity-0 lg:group-hover:opacity-100"}`}>
              <button
                onClick={() => {
                  if (depth >= MAX_ALLOWED_DEPTH)
                    return toast.error("Maksimal sub-menu tercapai.");
                  setEditingId(null);
                  setFormData({
                    label: "",
                    type: "page",
                    pageId: "",
                    externalLink: "",
                    parentId: menu.id,
                    isActive: true,
                    status: "Published",
                  });
                  toast.info(`Menambahkan sub-menu di bawah "${menu.label}"`);
                }}
                disabled={
                  depth >= MAX_ALLOWED_DEPTH || isNavigationLocked || isLocked
                }
                className="p-2 text-slate-400 hover:text-daw-green hover:bg-daw-green/10 rounded-lg disabled:cursor-not-allowed"
                title="Tambah Sub-menu">
                <Plus className="w-4 h-4" />
              </button>

              <button
                onClick={() => handleEdit(menu)}
                disabled={isNavigationLocked || isLocked}
                className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg disabled:cursor-not-allowed"
                title="Edit Menu">
                <Edit2 className="w-4 h-4" />
              </button>

              <button
                onClick={() => handleDelete(menu.id, menu.label, !!isLocked)}
                disabled={isNavigationLocked || isLocked}
                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg disabled:cursor-not-allowed"
                title="Hapus Menu">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Recursive Call */}
          {menu.children && menu.children.length > 0 && (
            <div className="border-l-2 border-slate-100 ml-6 mt-1">
              {renderMenuTree(menu.children, depth + 1)}
            </div>
          )}
        </div>
      );
    });
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
              Kelola susunan dan hirarki menu navigasi situs Anda.
            </p>
          </div>
          <div className="flex gap-2">
            <div className="px-3 py-1.5 bg-slate-100 rounded-lg text-[10px] font-bold text-slate-500 uppercase flex items-center gap-2">
              <LayoutGrid className="w-3 h-3" /> {flatMenus.length} Item Menu
            </div>
          </div>
        </div>

        {isNavigationLocked && (
          <div className="mb-6 flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-2xl animate-in fade-in shadow-sm">
            <div className="p-2 bg-blue-100 text-blue-600 rounded-xl shrink-0">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-blue-900">
                Struktur Terkunci
              </h4>
              <p className="text-[11px] text-blue-700 mt-0.5 leading-relaxed">
                Susunan menu sedang dalam peninjauan Admin (Tiket:{" "}
                <strong>{navigationLockTicket}</strong>). Fungsi Drag & Drop dan
                perubahan struktur dinonaktifkan sementara.
              </p>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="bg-white border border-slate-200 rounded-3xl p-20 text-center">
            <div className="w-12 h-12 border-4 border-slate-200 border-t-daw-green rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">
              Menyelaraskan struktur...
            </p>
          </div>
        ) : (
          <div
            className={`space-y-1 pb-20 transition-opacity ${isNavigationLocked ? "opacity-80" : ""}`}>
            {renderMenuTree(menus)}
          </div>
        )}
      </div>

      {/* RIGHT: PROPERTY PANEL */}
      <div className="lg:col-span-5 sticky top-24">
        <div
          className={`bg-white rounded-[2.5rem] border border-slate-200 shadow-xl shadow-slate-200/50 overflow-hidden transition-all ${isNavigationLocked ? "ring-4 ring-blue-500/5 opacity-90" : ""}`}>
          <div className="p-8 border-b border-slate-50 bg-slate-50/30">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-2xl flex items-center justify-center text-white transition-colors ${isNavigationLocked ? "bg-blue-500" : "bg-slate-900"}`}>
                {isNavigationLocked ? (
                  <Lock className="w-5 h-5" />
                ) : (
                  <Settings2 className="w-5 h-5" />
                )}
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 leading-none">
                  {isNavigationLocked
                    ? "Detail (Read-Only)"
                    : editingId
                      ? "Detail Item Menu"
                      : "Navigasi Menu Baru"}
                </h3>
                <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mt-1">
                  {isNavigationLocked
                    ? "Perubahan dinonaktifkan sementara"
                    : editingId
                      ? "Perbarui detail menu yang ada"
                      : "Membuat menu baru"}
                </p>
              </div>
            </div>
          </div>

          <form className="p-8 space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                Nama Label
              </label>
              <input
                type="text"
                required
                value={formData.label}
                readOnly={isNavigationLocked} // 🛡️ Visual Lockdown
                onChange={(e) =>
                  setFormData({ ...formData, label: e.target.value })
                }
                className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-100 focus:bg-white focus:border-daw-green outline-none transition-all font-bold text-slate-700 read-only:opacity-60 read-only:cursor-not-allowed"
                placeholder="e.g. Services / Layanan"
              />
            </div>

            {/*  TYPE SELECTION */}
            <div
              className={`grid grid-cols-3 gap-3 ${isNavigationLocked ? "pointer-events-none opacity-60" : ""}`}>
              <button
                type="button"
                onClick={() =>
                  setFormData({ ...formData, type: "page", externalLink: "" })
                }
                className={`p-3 rounded-xl border-2 flex flex-col items-center gap-1.5 transition-all text-center
                    ${formData.type === "page" ? "border-blue-500 bg-blue-50/30" : "border-slate-100 hover:border-slate-200"}`}>
                <FileText
                  className={`w-5 h-5 ${formData.type === "page" ? "text-blue-500" : "text-slate-400"}`}
                />
                <span
                  className={`text-[9px] font-black uppercase ${formData.type === "page" ? "text-blue-700" : "text-slate-400"}`}>
                  Internal Page
                </span>
              </button>
              <button
                type="button"
                onClick={() =>
                  setFormData({ ...formData, type: "external", pageId: "" })
                }
                className={`p-3 rounded-xl border-2 flex flex-col items-center gap-1.5 transition-all text-center
                    ${formData.type === "external" ? "border-amber-500 bg-amber-50/30" : "border-slate-100 hover:border-slate-200"}`}>
                <Globe
                  className={`w-5 h-5 ${formData.type === "external" ? "text-amber-500" : "text-slate-400"}`}
                />
                <span
                  className={`text-[9px] font-black uppercase ${formData.type === "external" ? "text-amber-700" : "text-slate-400"}`}>
                  External Link
                </span>
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
                className={`p-3 rounded-xl border-2 flex flex-col items-center gap-1.5 transition-all text-center
                    ${formData.type === "folder" ? "border-daw-green bg-daw-green/5" : "border-slate-100 hover:border-slate-200"}`}>
                <Folder
                  className={`w-5 h-5 ${formData.type === "folder" ? "text-daw-green fill-daw-green/20" : "text-slate-400"}`}
                />
                <span
                  className={`text-[9px] font-black uppercase ${formData.type === "folder" ? "text-daw-green" : "text-slate-400"}`}>
                  Dropdown Folder
                </span>
              </button>
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
                  disabled={isNavigationLocked}
                  onChange={(e) =>
                    setFormData({ ...formData, pageId: e.target.value })
                  }
                  className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-100 outline-none font-bold text-slate-700 appearance-none disabled:opacity-60 disabled:cursor-not-allowed">
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
                    readOnly={isNavigationLocked}
                    onChange={(e) =>
                      setFormData({ ...formData, externalLink: e.target.value })
                    }
                    className="w-full pl-12 pr-5 py-4 rounded-2xl bg-slate-50 border border-slate-100 outline-none font-mono text-xs text-slate-600 read-only:opacity-60 read-only:cursor-not-allowed"
                    placeholder="https://example.com"
                  />
                </div>
              </div>
            )}

            {formData.type === "folder" && (
              <div className="p-4 bg-daw-green/5 border border-daw-green/20 rounded-2xl animate-in fade-in">
                <p className="text-xs text-daw-green font-medium leading-relaxed">
                  💡 <strong>Info:</strong> Menu tipe Folder tidak dapat diklik
                  oleh pengunjung. Tipe ini hanya berfungsi sebagai wadah
                  (Dropdown) untuk membuka sub-menu di bawahnya.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                Posisi Hirarki
              </label>
              <select
                value={formData.parentId || ""}
                disabled={formData.type === "folder" || isNavigationLocked} // 🛡️ Visual Lockdown
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

            <div className="pt-4 flex flex-col gap-3">
              {isNavigationLocked ? (
                <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl font-bold flex items-center justify-center gap-2 border border-blue-200">
                  <Lock className="w-5 h-5" /> Formulir Terkunci Sementara
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <button
                    type="button"
                    onClick={(e) => handleSubmit(e, "Draft")}
                    disabled={isSaving}
                    className="w-full bg-slate-100 text-slate-600 hover:bg-slate-200 py-4 rounded-2xl font-bold transition-all disabled:opacity-50">
                    {isSaving ? "Menyimpan..." : "Simpan Draf Menu"}
                  </button>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={(e) => handleSubmit(e, "Published")}
                      disabled={isSaving}
                      className="flex-1 bg-daw-green hover:bg-[#003b1c] text-white py-4 rounded-2xl font-bold shadow-lg shadow-daw-green/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                      <Plus className="w-5 h-5" />
                      {editingId ? "Request Revisi Menu" : "Request Menu Baru"}
                    </button>

                    {/* Tombol Cancel/Reset selalu muncul selama tidak terkunci */}
                    <button
                      type="button"
                      onClick={resetForm}
                      className="px-6 bg-slate-100 text-slate-500 py-4 rounded-2xl font-bold hover:bg-red-50 hover:text-red-500 transition-all"
                      title="Bersihkan Form">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
