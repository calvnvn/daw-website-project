import { useState } from "react";
import { Plus, X, Save } from "lucide-react";

interface AddSectionModalProps {
  onClose: () => void;
  addSection: (category: string, title: string) => Promise<void>;
}

export default function AddSectionModal({
  onClose,
  addSection,
}: AddSectionModalProps) {
  // --- LOCAL STATE ---
  // Kita pindahkan state input ke sini agar Orchestrator tidak re-render tiap detik
  const [newSectionName, setNewSectionName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Helper: Membuat ID otomatis dari Nama Sektor
  const generateSlug = (text: string) => {
    return text
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^\w-]+/g, "");
  };

  const handleSubmit = async () => {
    if (!newSectionName.trim()) return;

    setIsSubmitting(true);
    try {
      await addSection(
        newSectionName.trim(),
        `Explore Our ${newSectionName.trim()} Operations`,
      );
      onClose();
    } catch (error) {
      console.error("Failed to add section", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/60 animate-in fade-in duration-200"
        onClick={() => !isSubmitting && onClose()}
      />

      {/* Modal Card */}
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md relative z-10 animate-in fade-in zoom-in-95 slide-in-from-bottom-4 duration-300 overflow-hidden border border-slate-100">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
          <h3 className="font-serif font-bold text-xl text-slate-900 flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-daw-green/10 flex items-center justify-center">
              <Plus className="w-4 h-4 text-daw-green" />
            </div>
            Buat Sektor Bisnis Baru
          </h3>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              Nama Sektor Bisnis <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              autoFocus
              placeholder="e.g., Renewable Energy"
              value={newSectionName}
              onChange={(e) => setNewSectionName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:border-daw-green focus:ring-4 focus:ring-daw-green/10 transition-all font-medium"
            />

            {/* Real-time slug preview UX */}
            <div className="mt-2 flex items-center gap-2 text-[10px] font-mono text-slate-400">
              <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-500 font-bold">
                ID
              </span>
              {generateSlug(newSectionName) || "auto-generated-slug"}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="px-5 py-2.5 rounded-xl font-bold text-sm text-slate-500 hover:bg-slate-200 transition-colors"
          >
            Cancel
          </button>
          <button
            disabled={!newSectionName.trim() || isSubmitting}
            onClick={handleSubmit}
            className="flex items-center gap-2 bg-[#081C15] hover:bg-daw-green disabled:bg-slate-300 disabled:text-slate-500 text-white px-6 py-2.5 rounded-xl font-bold text-sm transition-colors shadow-sm"
          >
            {isSubmitting ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Create Sector
          </button>
        </div>
      </div>
    </div>
  );
}
