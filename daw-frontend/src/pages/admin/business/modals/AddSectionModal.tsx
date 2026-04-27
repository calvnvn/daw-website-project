import { useState, useMemo } from "react";
import { Plus, X, Save, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

interface AddSectionModalProps {
  onClose: () => void;
  addSection: (category: string, title: string) => Promise<void>;
}

export default function AddSectionModal({
  onClose,
  addSection,
}: AddSectionModalProps) {
  const { user } = useAuth();
  const isSuperadmin = user?.role === "superadmin" || user?.role === "admin";
  const [newSectionName, setNewSectionName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const previewSlug = useMemo(() => {
    return newSectionName
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "");
  }, [newSectionName]);

  const handleSubmit = async () => {
    const trimmedName = newSectionName.trim();
    if (trimmedName.length < 3) {
      return toast.error("Nama sektor minimal 3 karakter");
    }

    setIsSubmitting(true);
    try {
      await addSection(trimmedName, `Explore Our ${trimmedName} Operations`);
      onClose();
    } catch (error: any) {
      const errMsg =
        error.response?.data?.message || "Gagal membuat sektor baru";
      toast.error(errMsg);
      console.error("[ADD_SECTION_MODAL_ERROR]:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 outline-none">
      <div
        className="absolute inset-0 bg-slate-900/60 animate-in fade-in duration-200"
        onClick={() => !isSubmitting && onClose()}
      />

      {/* Modal Card */}
      <div
        role="dialog"
        aria-modal="true"
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md relative z-10 animate-in fade-in zoom-in-95 slide-in-from-bottom-4 duration-300 overflow-hidden border border-slate-100">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-daw-green/10 flex items-center justify-center">
              <Plus className="w-5 h-5 text-daw-green" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-lg text-slate-900 leading-tight">
                New Business Sector
              </h3>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">
                Initialize Data & Ticket
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            disabled={isSubmitting}
            className="p-2 text-slate-400 hover:bg-red-50 hover:text-red-500 rounded-xl transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          <div className="space-y-2">
            <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider">
              Sector Category Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              autoFocus
              placeholder="e.g., Renewable Energy"
              value={newSectionName}
              onChange={(e) => setNewSectionName(e.target.value)}
              disabled={isSubmitting}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:border-daw-green focus:ring-4 focus:ring-daw-green/10 transition-all font-medium placeholder:text-slate-300"
            />
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg border border-slate-100">
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-black text-slate-400 uppercase">
                  System ID:
                </span>
                <code className="text-[11px] font-mono text-daw-green font-bold">
                  {previewSlug || "waiting-for-input..."}
                </code>
              </div>
            </div>
            <p className="text-[10px] text-slate-400 italic">
              * ID ini akan digunakan untuk routing URL (e.g. /business/
              {previewSlug || "..."}).
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="px-5 py-2.5 rounded-xl font-bold text-sm text-slate-500 hover:bg-slate-200 transition-colors">
            Cancel
          </button>
          <button
            disabled={
              !newSectionName.trim() ||
              isSubmitting ||
              newSectionName.trim().length < 3
            }
            onClick={handleSubmit}
            className={`flex items-center gap-2 px-7 py-2.5 rounded-xl font-bold text-sm transition-all shadow-md active:scale-95 text-white disabled:bg-slate-200 disabled:text-slate-400 ${
              isSuperadmin
                ? "bg-daw-green hover:bg-[#003b1c]"
                : "bg-blue-600 hover:bg-blue-700"
            }`}>
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isSuperadmin ? (
              <Save className="w-4 h-4" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            {isSuperadmin ? "CREATE SECTOR" : "REQUEST CREATION"}
          </button>
        </div>
      </div>
    </div>
  );
}
