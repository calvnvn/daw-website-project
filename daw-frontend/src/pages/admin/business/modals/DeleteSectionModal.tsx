import { useState, useMemo } from "react";
import { Trash2, X, AlertTriangle, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
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
  const { user } = useAuth();
  const isSuperadmin = user?.role === "superadmin" || user?.role === "admin";
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
      isSuperadmin
        ? `Menghapus sektor ${currentSection?.category}...`
        : `Mengajukan penghapusan sektor...`,
    );

    try {
      const remainingSections = sections.filter((s) => s.id !== activeTab);
      const fallbackTab =
        remainingSections.length > 0 ? remainingSections[0].id : "categories";

      await deleteSection(activeTab);

      setActiveTab(fallbackTab);
      onClose();
    } catch (error: any) {
      const message =
        error.response?.data?.message || "Gagal memproses penghapusan.";
      toast.error(message, { id: toastId });
      console.error("[DELETION_FAILURE]:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-900/70 animate-in fade-in duration-200"
        onClick={() => !isDeleting && onClose()}
      />

      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md relative z-10 animate-in fade-in zoom-in-95 slide-in-from-bottom-4 duration-300 overflow-hidden border border-red-100">
        {/* Header */}
        <div className="px-6 py-5 border-b border-red-100 bg-red-50/50 flex justify-between items-center">
          <h3
            className={`font-serif font-bold text-xl flex items-center gap-2 ${isSuperadmin ? "text-red-600" : "text-amber-600"}`}>
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center shadow-inner ${isSuperadmin ? "bg-red-100" : "bg-amber-100"}`}>
              <Trash2 className="w-5 h-5" />
            </div>
            {isSuperadmin ? "Hapus Sektor Bisnis" : "Pengajuan Hapus Sektor"}
          </h3>
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="p-2 text-slate-400 hover:bg-slate-100 rounded-xl transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body  */}
        <div className="p-6 space-y-5">
          <div
            className={`border-l-4 p-4 rounded-r-xl flex gap-3 ${isSuperadmin ? "bg-red-50 border-red-500" : "bg-amber-50 border-amber-500"}`}>
            <AlertTriangle
              className={`w-12 h-12 shrink-0 ${isSuperadmin ? "text-red-500" : "text-amber-500"}`}
            />
            <p
              className={`text-xs leading-relaxed font-medium ${isSuperadmin ? "text-red-800" : "text-amber-800"}`}>
              {isSuperadmin
                ? `Peringatan: Seluruh konten dan titik lokasi untuk sektor ${currentSection?.category || activeTab} akan dimusnahkan secara permanen.`
                : `Perhatian: Aksi ini akan mengunci sektor ${currentSection?.category || activeTab} dan mengirimkan tiket penghapusan ke ERP untuk ditinjau.`}
            </p>
          </div>

          <div className="space-y-3">
            <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest">
              Konfirmasi Tindakan
            </label>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <p className="text-xs text-slate-500 mb-3">
                Ketik ID referensi berikut untuk melanjutkan:
                <span className="block mt-2 select-all bg-white w-fit px-3 py-1 rounded-md border border-slate-300 font-mono font-bold text-slate-800 shadow-sm">
                  {activeTab}
                </span>
              </p>
              <input
                type="text"
                autoFocus
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                className={`w-full px-4 py-2.5 rounded-lg border border-slate-300 text-slate-900 focus:outline-none focus:ring-4 font-mono text-sm transition-all ${isSuperadmin ? "focus:border-red-500 focus:ring-red-500/10" : "focus:border-amber-500 focus:ring-amber-500/10"}`}
                placeholder="Type the ID here..."
                disabled={isDeleting}
              />
            </div>
          </div>
        </div>

        {/* Footer  */}
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
            className={`flex items-center gap-2 text-white px-7 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg active:scale-95 disabled:bg-slate-200 disabled:text-slate-400 ${
              isSuperadmin
                ? "bg-red-600 hover:bg-red-700"
                : "bg-amber-600 hover:bg-amber-700"
            }`}>
            {isDeleting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isSuperadmin ? (
              <>
                <Trash2 className="w-4 h-4" /> Hapus Permanen
              </>
            ) : (
              <>
                <Send className="w-4 h-4" /> Ajukan Penghapusan
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
