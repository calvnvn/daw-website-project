import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Edit2,
  Trash2,
  Link as LinkIcon,
  FileText,
  CornerDownRight,
  X,
  GripVertical,
} from "lucide-react";
import api from "@/lib/api";

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
  const [pages, setPages] = useState<any[]>([]); // To populate the dropdown
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

  const isCircularMove = (
    draggedId: string,
    targetParentId: string,
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
      toast.error("Failed to load navigation data.");
      console.error(error);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (editingId && formData.parentId) {
      if (isCircularMove(editingId, formData.parentId, flatMenus)) {
        toast.error(
          "Hierarchy Error: A child menu cannot be assigned as the parent of its own ancestor.",
        );
        return;
      }
    }
    setIsSaving(true);
    const toastId = toast.loading("Saving menu...");
    try {
      const payload = {
        ...formData,
        pageId: formData.type === "page" ? formData.pageId || null : null,
        externalLink:
          formData.type === "external" ? formData.externalLink || null : null,
        parentId: formData.parentId || null,
      };

      if (editingId) {
        await api.put(`/menus/${editingId}`, payload);
        toast.success("Menu updated!", { id: toastId });
      } else {
        await api.post("/menus", payload);
        toast.success("Menu added!", { id: toastId });
      }
      resetForm();
      fetchData();
    } catch (error) {
      console.error(error);
      toast.error("Failed to save", { id: toastId });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure? Sub-menus will also be deleted.")) return;
    const toastId = toast.loading("Deleting menu...");
    try {
      await api.delete(`/menus/${id}`);
      toast.success("Menu deleted", { id: toastId });
      fetchData();
      if (editingId === id) resetForm();
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete", { id: toastId });
    }
  };

  // Drag & Drop Logic
  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData("text/plain", id);
    setDraggedMenuId(id);
  };
  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    if (dragOverMenuId !== id) setDragOverMenuId(id);
  };
  const handleDrop = async (e: React.DragEvent, targetMenu: Menu) => {
    e.preventDefault();
    setDragOverMenuId(null);
    const sourceId = e.dataTransfer.getData("text/plain");
    if (!sourceId || sourceId === targetMenu.id) {
      setDraggedMenuId(null);
      return;
    }

    if (isCircularMove(sourceId, targetMenu.id, flatMenus)) {
      toast.error(
        "Invalid hierarchy: Cannot nest a parent menu within its own sub-menu.",
      );
      setDraggedMenuId(null);
      return;
    }

    const toastId = toast.loading("Updating navigation structure...");
    try {
      const sourceMenu = flatMenus.find((m) => m.id === sourceId);
      if (!sourceMenu) throw new Error("Source menu not found.");

      const newParentId = targetMenu.parentId;
      const siblings = flatMenus
        .filter((m) => m.parentId === newParentId && m.id !== sourceId)
        .sort((a, b) => a.orderIndex - b.orderIndex);

      const targetIndex = siblings.findIndex((m) => m.id === targetMenu.id);
      siblings.splice(targetIndex, 0, {
        ...sourceMenu,
        parentId: newParentId,
      });
      const updatedPayload = siblings.map((m, i) => ({
        id: m.id,
        parentId: newParentId,
        orderIndex: i,
      }));

      await api.put("/menus/reorder", { updatedMenus: updatedPayload });
      toast.success("Navigation structure updated successfully.", {
        id: toastId,
      });
      fetchData();
    } catch (error) {
      console.error(error);
      toast.error("System error: Failed to reorder navigation.", {
        id: toastId,
      });
    } finally {
      setDraggedMenuId(null);
    }
  };

  const renderMenuTree = (menuList: Menu[], depth = 0) => {
    return menuList.map((menu) => (
      <div key={menu.id} className="w-full">
        <div
          draggable
          onDragStart={(e) => handleDragStart(e, menu.id)}
          onDragOver={(e) => handleDragOver(e, menu.id)}
          onDragLeave={() => setDragOverMenuId(null)}
          onDrop={(e) => handleDrop(e, menu)}
          className={`group flex items-center justify-between p-3 mb-2 rounded-xl border transition-all duration-200
            ${editingId === menu.id ? "bg-daw-green/5 border-daw-green shadow-sm" : "bg-white border-slate-200"}
            ${draggedMenuId === menu.id ? "opacity-30 scale-95 border-dashed" : "opacity-100 scale-100"}
            ${dragOverMenuId === menu.id ? "border-b-4 border-b-daw-green bg-daw-green/10 translate-y-1 shadow-md" : ""}
          `}
          style={{ marginLeft: `${depth * 1.5}rem` }}
        >
          <div className="flex items-center gap-3">
            <div className="cursor-grab active:cursor-grabbing p-1 -ml-1">
              <GripVertical className="w-4 h-4 text-slate-400" />
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
              onClick={() => {
                setEditingId(menu.id);
                // 🚀 FIX: Konversi null menjadi empty string agar React form tidak crash
                setFormData({
                  label: menu.label,
                  type: menu.type,
                  pageId: menu.pageId || "",
                  externalLink: menu.externalLink || "",
                  parentId: menu.parentId || "",
                  isActive: menu.isActive,
                });
              }}
              className="p-1.5 text-slate-400 hover:text-daw-green rounded-md"
            >
              <Edit2 className="w-4 h-4" />
            </button>{" "}
            <button
              onClick={() => handleDelete(menu.id)}
              className="p-1.5 text-slate-400 hover:text-red-500 rounded-md"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
        {menu.children && menu.children.length > 0 && (
          <div className="border-l-2 border-slate-100 ml-5 pl-3">
            {renderMenuTree(menu.children, depth + 1)}
          </div>
        )}
      </div>
    ));
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-in fade-in duration-500">
      <div className="lg:col-span-7 bg-slate-50/50 p-6 rounded-2xl border border-slate-200 min-h-[500px]">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mb-6">
          Current Architecture
        </h3>
        {isLoading ? (
          <div className="text-center p-10 text-slate-400 font-bold animate-pulse">
            Loading...
          </div>
        ) : (
          <div className="space-y-1">{renderMenuTree(menus)}</div>
        )}
      </div>

      <div className="lg:col-span-5 bg-white rounded-3xl border border-slate-200 shadow-sm lg:sticky lg:top-24">
        <div className="flex justify-between items-center p-6 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest">
            {editingId ? "Edit Item" : "Add Item"}
          </h3>
          {editingId && (
            <button
              onClick={resetForm}
              className="text-xs text-slate-400 hover:text-red-500"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
              Navigation Label *
            </label>
            <input
              type="text"
              required
              value={formData.label}
              onChange={(e) =>
                setFormData({ ...formData, label: e.target.value })
              }
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-daw-green outline-none"
              placeholder="e.g. About Us"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
              Parent Menu (Optional)
            </label>
            <select
              value={formData.parentId}
              onChange={(e) =>
                setFormData({ ...formData, parentId: e.target.value })
              }
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-daw-green outline-none"
            >
              <option value="">-- Main Menu --</option>
              {flatMenus
                .filter((m) => {
                  const isSelf = m.id === editingId;
                  const isDescendant = editingId
                    ? isCircularMove(editingId, m.id, flatMenus)
                    : false;
                  return !isSelf && !isDescendant;
                })
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label
              className={`cursor-pointer border-2 rounded-xl p-3 flex flex-col items-center transition-all ${formData.type === "page" ? "border-daw-green bg-daw-green/5" : "border-slate-100 hover:border-slate-200"}`}
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
              <span className="text-xs font-bold">Internal Page</span>
            </label>
            <label
              className={`cursor-pointer border-2 rounded-xl p-3 flex flex-col items-center transition-all ${formData.type === "external" ? "border-orange-500 bg-orange-50" : "border-slate-100 hover:border-slate-200"}`}
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
              <span className="text-xs font-bold">External Link</span>
            </label>
          </div>
          {formData.type === "page" ? (
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                Select Page *
              </label>
              <select
                required
                value={formData.pageId}
                onChange={(e) =>
                  setFormData({ ...formData, pageId: e.target.value })
                }
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-daw-green outline-none"
              >
                <option value="" disabled>
                  -- Select --
                </option>
                {pages.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                Destination URL *
              </label>
              <input
                type="text"
                required
                value={formData.externalLink}
                onChange={(e) =>
                  setFormData({ ...formData, externalLink: e.target.value })
                }
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-orange-500 outline-none"
                placeholder="/route or https://"
              />
            </div>
          )}
          <button
            type="submit"
            disabled={isSaving}
            className="w-full flex justify-center bg-slate-900 hover:bg-black text-white py-4 rounded-xl font-bold mt-4"
          >
            {isSaving
              ? "Saving..."
              : editingId
                ? "Save Changes"
                : "Add to Menu"}
          </button>
        </form>
      </div>
    </div>
  );
}
