import { useState } from "react";
import { Trash2, X } from "lucide-react";
import { type SectionData } from "@/contexts/BusinessContext";

interface DeleteSectionModalProps {
  activeTab: string;
  sections: SectionData[];
  onClose: () => void;
  deleteSection: (id: string) => Promise<void>;
  setActiveTab: (id: string) => void;
}

export default function DeleteSectionModal({
  activeTab,
  sections,
  onClose,
  deleteSection,
  setActiveTab,
}: DeleteSectionModalProps) {
  // --- LOCAL STATE ---
  const [confirmText, setConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    // 1. Double check: Pastikan teks konfirmasi sama dengan ID sektor
    if (confirmText !== activeTab) return;

    setIsDeleting(true);
    try {
      // 2. Tentukan tab tujuan sebelum data dihapus (Fallback logic)
      // Cari tab pertama yang bukan tab yang sedang dihapus
      const fallbackTab =
        sections.find((s) => s.id !== activeTab)?.id || "categories";

      // 3. Eksekusi hapus ke database
      await deleteSection(activeTab);

      // 4. Reset UI & Navigasi
      setConfirmText("");
      setActiveTab(fallbackTab);
      onClose();
    } catch (error) {
      console.error("Deletion failed:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/60 animate-in fade-in duration-200"
        onClick={() => !isDeleting && onClose()}
      />

      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md relative z-10 animate-in fade-in zoom-in-95 slide-in-from-bottom-4 duration-300 overflow-hidden border border-red-100">
        {/* Danger Header */}
        <div className="px-6 py-5 border-b border-red-100 bg-red-50/50 flex justify-between items-center">
          <h3 className="font-serif font-bold text-xl text-red-600 flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
              <Trash2 className="w-4 h-4 text-red-600" />
            </div>
            Hapus Sektor Bisnis
          </h3>
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="p-2 text-slate-400 hover:bg-red-100 hover:text-red-600 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4">
          <p className="text-sm text-slate-600 leading-relaxed">
            Tindakan ini tidak dapat dibatalkan. Menghapus sektor{" "}
            <strong className="text-slate-900">{activeTab}</strong> akan
            menghapus seluruh konten artikel dan titik peta yang terkait secara
            permanen.
          </p>

          {/* Type to confirm UX Pattern */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <label className="block text-xs text-slate-500 mb-2">
              Ketik kembali{" "}
              <strong className="text-slate-800 select-none bg-white px-1.5 py-0.5 rounded border border-slate-200 font-mono">
                {activeTab}
              </strong>{" "}
              untuk mengonfirmasi penghapusan.
            </label>
            <input
              type="text"
              autoFocus
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900 focus:outline-none focus:border-red-400 focus:ring-4 focus:ring-red-500/10 font-mono text-sm transition-all"
              placeholder={activeTab}
              disabled={isDeleting}
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="px-5 py-2.5 rounded-xl font-bold text-sm text-slate-500 hover:bg-slate-200 transition-colors"
          >
            Keep Sector
          </button>
          <button
            disabled={confirmText !== activeTab || isDeleting}
            onClick={handleDelete}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:bg-slate-200 disabled:text-slate-400 text-white px-6 py-2.5 rounded-xl font-bold text-sm transition-all shadow-sm"
          >
            {isDeleting ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
            I understand, delete
          </button>
        </div>
      </div>
    </div>
  );
}
