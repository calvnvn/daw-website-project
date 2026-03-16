import { useState, useEffect } from "react";
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
} from "lucide-react";
import api from "@/lib/api";

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
  type: "page" | "external";
  pageId: string | null;
  externalLink: string | null;
  isActive: boolean;
  children?: Menu[];
}

export default function NavigationBuilder() {
  const [menus, setMenus] = useState<Menu[]>([]);
  const [flatMenus, setFlatMenus] = useState<Menu[]>([]);
  const [pages, setPages] = useState<PageOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draggedMenuId, setDraggedMenuId] = useState<string | null>(null);
  const [dragOverMenuId, setDragOverMenuId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    label: "",
    type: "page",
    pageId: "",
    externalLink: "",
    parentId: "",
    isActive: true,
  });

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [treeRes, flatRes, pagesRes] = await Promise.all([
        api.get("/menus/tree"),
        api.get("/menus/flat"),
        api.get("/pages"),
      ]);
      setMenus(treeRes.data);
      setFlatMenus(flatRes.data);
      setPages(pagesRes.data);
    } catch (error) {
      toast.error("Failed to sync navigation data.");
      console.error("Error: ", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

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
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      editingId &&
      formData.parentId &&
      isCircularMove(editingId, formData.parentId, flatMenus)
    ) {
      return toast.error("Hierarchy error: Infinite loop detected.");
    }
    setIsSaving(true);
    const toastId = toast.loading("Saving configuration...");
    try {
      const payload = {
        ...formData,
        pageId: formData.type === "page" ? formData.pageId || null : null,
        externalLink:
          formData.type === "external" ? formData.externalLink || null : null,
        parentId: formData.parentId || null,
      };
      if (editingId) await api.put(`/menus/${editingId}`, payload);
      else await api.post("/menus", payload);
      toast.success("Structure updated!", { id: toastId });
      resetForm();
      fetchData();
    } catch (error) {
      toast.error("Failed to save changes", { id: toastId });
      console.error("Error: ", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure? All child menus will be detached or deleted."))
      return;
    const toastId = toast.loading("Processing...");
    try {
      await api.delete(`/menus/${id}`);
      toast.success("Node removed", { id: toastId });
      fetchData();
      if (editingId === id) resetForm();
    } catch (error) {
      toast.error("System failure");
      console.error("Error: ", error);
    }
  };

  // 🚀 DRAG LOGIC (Simplified for UX)
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
    if (isCircularMove(sourceId, newParentId, flatMenus)) {
      setDraggedMenuId(null);
      return toast.error(
        "Hierarchy violation: Cannot move ancestor to its child.",
      );
    }

    const toastId = toast.loading("Reordering structure...");
    try {
      const sourceMenu = flatMenus.find((m) => m.id === sourceId);
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
      toast.success("Order synchronized.", { id: toastId });
      fetchData();
    } catch (error) {
      toast.error("Reorder failed.");
      console.error("Error: ", error);
    } finally {
      setDraggedMenuId(null);
    }
  };

  const renderMenuTree = (menuList: Menu[], depth = 0) => {
    return menuList.map((menu) => (
      <div key={menu.id} className="relative">
        {/* Drop Zone for Sibling (Top) */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOverMenuId(`${menu.id}-top`);
          }}
          onDrop={(e) => handleDrop(e, menu, "sibling")}
          className={`h-1.5 transition-all mx-4 rounded-full ${dragOverMenuId === `${menu.id}-top` ? "bg-emerald-500 my-2" : "bg-transparent"}`}
        />

        <div
          draggable
          onDragStart={(e) => handleDragStart(e, menu.id)}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOverMenuId(`${menu.id}-child`);
          }}
          onDrop={(e) => handleDrop(e, menu, "child")}
          className={`group relative flex items-center justify-between p-4 rounded-2xl border transition-all duration-300
            ${dragOverMenuId === `${menu.id}-child` ? "border-emerald-500 bg-emerald-50/50 shadow-inner" : "border-slate-200 bg-white"}
            ${draggedMenuId === menu.id ? "opacity-30 scale-95" : "opacity-100 shadow-sm hover:shadow-md"}
          `}
          style={{ marginLeft: `${depth * 1.5}rem` }}
        >
          {/* Branch Lines Visual */}
          {depth > 0 && (
            <div className="absolute -left-4 top-1/2 -translate-y-1/2 w-4 h-[2px] bg-slate-200" />
          )}

          <div className="flex items-center gap-4">
            <GripVertical className="w-4 h-4 text-slate-300 cursor-grab active:cursor-grabbing group-hover:text-slate-400" />

            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors
              ${menu.type === "page" ? "bg-blue-50 text-blue-500" : "bg-amber-50 text-amber-500"}`}
            >
              {menu.type === "page" ? (
                <FileText className="w-5 h-5" />
              ) : (
                <LinkIcon className="w-5 h-5" />
              )}
            </div>

            <div>
              <h4
                className={`text-sm font-bold tracking-tight ${!menu.isActive ? "text-slate-400 line-through" : "text-slate-900"}`}
              >
                {menu.label}
              </h4>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                  {menu.type}
                </span>
                <span className="text-[10px] text-slate-400 font-medium italic">
                  {menu.type === "page"
                    ? "Internal link / Terhubung halaman"
                    : "Outbound link / Tautan luar"}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
            <button
              onClick={() => {
                setFormData({ ...formData, parentId: menu.id });
                setEditingId(null);
              }}
              className="p-2 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-lg transition-all"
              title="Add Sub-menu"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleEdit(menu)}
              className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleDelete(menu.id)}
              className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
            >
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
      {/* 🚀 LEFT: NAVIGATION TREE */}
      <div className="lg:col-span-7">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-serif font-black text-slate-900 tracking-tight">
              Navigation Architect
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-1">
              Organize your site's structural integrity / Atur struktur menu
              navigasi Anda.
            </p>
          </div>
          <div className="flex gap-2">
            <div className="px-3 py-1.5 bg-slate-100 rounded-lg text-[10px] font-bold text-slate-500 uppercase flex items-center gap-2">
              <LayoutGrid className="w-3 h-3" /> {flatMenus.length} Nodes
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="bg-white border border-slate-200 rounded-3xl p-20 text-center">
            <div className="w-12 h-12 border-4 border-slate-200 border-t-emerald-500 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">
              Synchronizing Database...
            </p>
          </div>
        ) : (
          <div className="space-y-1 pb-20">{renderMenuTree(menus)}</div>
        )}
      </div>

      {/* 🚀 RIGHT: PROPERTY PANEL */}
      <div className="lg:col-span-5 sticky top-24">
        <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl shadow-slate-200/50 overflow-hidden">
          <div className="p-8 border-b border-slate-50 bg-slate-50/30">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-slate-900 rounded-2xl flex items-center justify-center text-white">
                <Settings2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 leading-none">
                  {editingId ? "Node Properties" : "New Navigation Node"}
                </h3>
                <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mt-1">
                  {editingId
                    ? "Modify existing entry / Ubah data"
                    : "Create new entry / Buat baru"}
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-8 space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                Label Name
              </label>
              <input
                type="text"
                required
                value={formData.label}
                onChange={(e) =>
                  setFormData({ ...formData, label: e.target.value })
                }
                className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-100 focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/5 outline-none transition-all font-bold text-slate-700"
                placeholder="e.g. Services / Layanan"
              />
              <p className="text-[10px] text-slate-400 italic ml-1">
                Appearance text in navbar / Teks yang muncul di menu.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() =>
                  setFormData({ ...formData, type: "page", externalLink: "" })
                }
                className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all
                    ${formData.type === "page" ? "border-emerald-500 bg-emerald-50/30" : "border-slate-100 hover:border-slate-200"}`}
              >
                <FileText
                  className={`w-5 h-5 ${formData.type === "page" ? "text-emerald-500" : "text-slate-400"}`}
                />
                <span
                  className={`text-[10px] font-black uppercase ${formData.type === "page" ? "text-emerald-700" : "text-slate-400"}`}
                >
                  Internal Page
                </span>
              </button>
              <button
                type="button"
                onClick={() =>
                  setFormData({ ...formData, type: "external", pageId: "" })
                }
                className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all
                    ${formData.type === "external" ? "border-emerald-500 bg-emerald-50/30" : "border-slate-100 hover:border-slate-200"}`}
              >
                <Globe
                  className={`w-5 h-5 ${formData.type === "external" ? "text-emerald-500" : "text-slate-400"}`}
                />
                <span
                  className={`text-[10px] font-black uppercase ${formData.type === "external" ? "text-emerald-700" : "text-slate-400"}`}
                >
                  External Link
                </span>
              </button>
            </div>

            {formData.type === "page" ? (
              <div className="space-y-2 animate-in slide-in-from-top-2 duration-300">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                  Linked Content
                </label>
                <select
                  required
                  value={formData.pageId}
                  onChange={(e) =>
                    setFormData({ ...formData, pageId: e.target.value })
                  }
                  className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-100 outline-none font-bold text-slate-700 appearance-none"
                >
                  <option value="">-- Choose Page / Pilih Halaman --</option>
                  {pages.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="space-y-2 animate-in slide-in-from-top-2 duration-300">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                  Destination URL
                </label>
                <div className="relative">
                  <ExternalLink className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                  <input
                    type="text"
                    required
                    value={formData.externalLink}
                    onChange={(e) =>
                      setFormData({ ...formData, externalLink: e.target.value })
                    }
                    className="w-full pl-12 pr-5 py-4 rounded-2xl bg-slate-50 border border-slate-100 outline-none font-mono text-xs text-slate-600"
                    placeholder="https://example.com"
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                Placement Hierarchy
              </label>
              <select
                value={formData.parentId}
                onChange={(e) =>
                  setFormData({ ...formData, parentId: e.target.value })
                }
                className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-100 outline-none text-sm font-bold text-slate-600"
              >
                <option value="">-- Set as Root (Main Menu) --</option>
                {flatMenus
                  .filter((m) => {
                    if (!editingId) return true;
                    return (
                      m.id !== editingId &&
                      !isCircularMove(editingId, m.id, flatMenus)
                    );
                  })
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      Sub of: {m.label}
                    </option>
                  ))}
              </select>
              <p className="text-[10px] text-slate-400 italic ml-1">
                Nest this item under a parent / Letakkan di bawah menu lain.
              </p>
            </div>

            <div className="pt-4 flex gap-3">
              <button
                type="submit"
                disabled={isSaving}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-4 rounded-2xl font-bold shadow-lg shadow-emerald-200 transition-all flex items-center justify-center gap-2"
              >
                <Plus className="w-5 h-5" />{" "}
                {editingId ? "Update Configuration" : "Deploy to Navbar"}
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-6 bg-slate-100 text-slate-500 py-4 rounded-2xl font-bold hover:bg-slate-200 transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
