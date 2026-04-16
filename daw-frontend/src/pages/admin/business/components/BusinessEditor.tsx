import { useMemo } from "react";
import ReactQuill from "react-quill-new";
import { AlertCircle, RotateCcw, Info } from "lucide-react";
import { useBusiness, type SectionData } from "@/contexts/BusinessContext";
import "react-quill-new/dist/quill.snow.css";
import { toast } from "sonner";

interface BusinessEditorProps {
  activeTab: string;
  formData: Omit<SectionData, "id">; // Menghilangkan any, gunakan type asli
  setFormData: React.Dispatch<React.SetStateAction<any>>;
  isEditing: boolean;
}

export default function BusinessEditor({
  activeTab,
  formData,
  setFormData,
  isEditing,
}: BusinessEditorProps) {
  const { rejectedDraft, clearRejectedDraft } = useBusiness();

  // 1. RESTORE LOGIC: Sinkronisasi Payload ke Form
  const handleRestoreDraft = () => {
    if (!rejectedDraft?.payload) return;

    try {
      const payload = rejectedDraft.payload;

      // Senior Approach: Kita hanya merestorasi field yang relevan untuk Editor ini
      // untuk menghindari kontaminasi state is_locked atau orderIndex yang mungkin berbeda di draf
      setFormData((prev: any) => ({
        ...prev,
        title: payload.title || prev.title,
        htmlContent: payload.htmlContent || prev.htmlContent,
        // Jika draf membawa data peta, kita ikut restorasi
        hasMap: payload.hasMap !== undefined ? payload.hasMap : prev.hasMap,
        mapMarkers: payload.mapMarkers || prev.mapMarkers,
      }));

      toast.success("Konten draf yang ditolak telah dipulihkan ke form.", {
        description: "Silakan perbaiki berdasarkan catatan revisi di atas.",
        icon: <RotateCcw className="w-4 h-4" />,
      });

      // Opsional: Kita biarkan banner tetap ada sampai user Save,
      // atau langsung hapus banner setelah restore. Di sini kita biarkan user sadar mereka sedang memperbaiki draf.
    } catch (error) {
      toast.error("Gagal memulihkan draf.");
      console.error("[RESTORE_ERROR]:", error);
    }
  };

  const quillModules = useMemo(
    () => ({
      toolbar: [
        [{ header: [1, 2, 3, false] }],
        ["bold", "italic", "underline", "strike", "blockquote"],
        [{ list: "ordered" }, { list: "bullet" }],
        ["link", "image", "video"],
        ["clean"],
      ],
      clipboard: { matchVisual: false },
    }),
    [],
  );

  return (
    <div className="lg:col-span-7 space-y-6">
      {/* 2. REJECTION BANNER (SOP DAW CMS) */}
      {rejectedDraft && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl overflow-hidden shadow-sm animate-in slide-in-from-top-4 duration-300">
          <div className="p-4 flex gap-4">
            <div className="bg-amber-100 p-2 rounded-lg h-fit">
              <AlertCircle className="w-5 h-5 text-amber-600" />
            </div>
            <div className="flex-1 space-y-1">
              <h4 className="text-sm font-bold text-amber-900 flex items-center gap-2">
                Revisi Ditolak oleh Approver
                <span className="text-[10px] bg-amber-200 px-1.5 py-0.5 rounded text-amber-700 font-mono uppercase">
                  Ticket: {rejectedDraft.notrans}
                </span>
              </h4>
              <p className="text-xs text-amber-800 leading-relaxed italic bg-white/50 p-2 rounded border border-amber-100">
                "
                {rejectedDraft.rejection_reason || "Tidak ada alasan spesifik."}
                "
              </p>
              <div className="pt-3 flex items-center gap-3">
                <button
                  onClick={handleRestoreDraft}
                  disabled={!isEditing}
                  className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-300 text-white px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-sm">
                  <RotateCcw className="w-3.5 h-3.5" />
                  PULIHKAN DATA DRAF
                </button>
                {!isEditing && (
                  <p className="text-[10px] text-amber-600 font-medium italic">
                    * Aktifkan "Editing Mode" untuk memulihkan draf.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
        {/* Dekorasi: Watermark ID */}
        <div className="absolute top-0 right-0 p-2 opacity-[0.03] pointer-events-none select-none uppercase font-black text-4xl">
          {activeTab}
        </div>

        <h3 className="text-base font-bold text-slate-900 mb-6 border-b border-slate-100 pb-4 flex items-center gap-2 uppercase tracking-widest text-[11px]">
          <Info className="w-4 h-4 text-slate-400" />
          <span>Informasi & Konten Artikel</span>
        </h3>

        <div className="space-y-6">
          {/* Input: Judul Pendek */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
              Judul Utama Sektor
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) =>
                setFormData((prev: any) => ({ ...prev, title: e.target.value }))
              }
              disabled={!isEditing}
              className={`w-full px-4 py-3 rounded-xl font-serif text-xl transition-all ${
                isEditing
                  ? "bg-white border border-slate-300 shadow-sm focus:ring-4 focus:ring-daw-green/10 focus:border-daw-green outline-none"
                  : "bg-slate-50 border-transparent text-slate-400"
              }`}
              placeholder="e.g., Sustainable Natural Resources"
            />
          </div>

          {/* Editor: ReactQuill */}
          <div className="space-y-2">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
              Narasi Konten (Rich Text)
            </label>
            <div
              className={`rounded-xl overflow-hidden border transition-all duration-300 ${
                isEditing
                  ? "bg-white border-slate-300 shadow-md ring-1 ring-slate-200"
                  : "opacity-60 grayscale-[0.5] pointer-events-none bg-slate-50 border-slate-200"
              }`}>
              <ReactQuill
                theme="snow"
                value={formData.htmlContent}
                onChange={(val) =>
                  setFormData((prev: any) => ({ ...prev, htmlContent: val }))
                }
                modules={quillModules}
                readOnly={!isEditing}
                className="h-72 mb-12"
              />
            </div>
            {isEditing && (
              <p className="text-[9px] text-slate-400 italic">
                Tips: Gunakan shortcut toolbar untuk mengatur format teks dan
                media.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
