import { useState, useMemo } from "react";
import { Trash2, X, AlertTriangle } from "lucide-react";
import { toast } from "sonner"; // Asumsi menggunakan Sonner untuk feedback
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
  const [confirmText, setConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const currentSection = useMemo(
    () => sections.find((s) => s.id === activeTab),
    [sections, activeTab],
  );

  const handleDelete = async () => {
    if (confirmText !== activeTab) return;

    setIsDeleting(true);
    const toastId = toast.loading(
      `Menghapus sektor ${currentSection?.category || activeTab}...`,
    );

    try {
      const remainingSections = sections.filter((s) => s.id !== activeTab);
      const fallbackTab =
        remainingSections.length > 0 ? remainingSections[0].id : "categories";

      await deleteSection(activeTab);

      setActiveTab(fallbackTab);
      toast.success("Sektor berhasil dihapus permanen.", { id: toastId });
      onClose();
    } catch (error: any) {
      const message =
        error.response?.data?.message || "Gagal menghapus sektor.";
      toast.error(message, { id: toastId });
      console.error("[DELETION_FAILURE]:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-900/70  animate-in fade-in duration-200"
        onClick={() => !isDeleting && onClose()}
      />

      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md relative z-10 animate-in fade-in zoom-in-95 slide-in-from-bottom-4 duration-300 overflow-hidden border border-red-100">
        <div className="px-6 py-5 border-b border-red-100 bg-red-50/50 flex justify-between items-center">
          <h3 className="font-serif font-bold text-xl text-red-600 flex items-center gap-2">
            <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center shadow-inner">
              <Trash2 className="w-5 h-5 text-red-600" />
            </div>
            Hapus Sektor Bisnis
          </h3>
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="p-2 text-slate-400 hover:bg-red-100 hover:text-red-500 rounded-xl transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-xl flex gap-3">
            <AlertTriangle className="w-12 h-12 text-red-500 shrink-0" />
            <p className="text-xs text-red-800 leading-relaxed font-medium">
              Peringatan: Seluruh konten artikel, konfigurasi peta, dan titik
              lokasi untuk
              <strong className="mx-1 underline italic">
                {currentSection?.category || activeTab}
              </strong>
              akan dimusnahkan. Data ini tidak dapat dipulihkan.
            </p>
          </div>

          <div className="space-y-3">
            <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest">
              Konfirmasi Penghapusan
            </label>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <p className="text-xs text-slate-500 mb-3">
                Ketik ID referensi berikut untuk melanjutkan:
                <br />
                <span className="inline-block mt-2 select-all bg-white px-3 py-1 rounded-md border border-slate-300 font-mono font-bold text-slate-800 shadow-sm">
                  {activeTab}
                </span>
              </p>
              <input
                type="text"
                autoFocus
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-slate-900 focus:outline-none focus:border-red-500 focus:ring-4 focus:ring-red-500/10 font-mono text-sm transition-all"
                placeholder="Type the ID here..."
                disabled={isDeleting}
              />
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="px-5 py-2.5 rounded-xl font-bold text-sm text-slate-500 hover:bg-slate-200 transition-colors">
            Batalkan
          </button>
          <button
            disabled={confirmText !== activeTab || isDeleting}
            onClick={handleDelete}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:bg-slate-200 disabled:text-slate-400 text-white px-7 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg active:scale-95">
            {isDeleting ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                Hapus Permanen
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
