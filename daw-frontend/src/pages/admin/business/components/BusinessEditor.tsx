import { useCallback, useMemo } from "react";
import ReactQuill from "react-quill-new";
import {
  AlertTriangle,
  RotateCcw,
  Info,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { useBusiness, type SectionData } from "@/contexts/BusinessContext";
import "react-quill-new/dist/quill.snow.css";
import { toast } from "sonner";

type BusinessFormState = Omit<SectionData, "id">;

interface BusinessEditorProps {
  activeTab: string;
  formData: BusinessFormState;
  setFormData: React.Dispatch<React.SetStateAction<BusinessFormState>>;
  isEditing: boolean;
}

export default function BusinessEditor({
  activeTab,
  formData,
  setFormData,
  isEditing,
}: BusinessEditorProps) {
  const { rejectedDraft } = useBusiness();

  const handleRestoreDraft = useCallback(() => {
    if (!rejectedDraft?.payload) return;

    try {
      const payload = rejectedDraft.payload;

      setFormData((prev) => ({
        ...prev,
        title: payload.title ?? prev.title,
        htmlContent: payload.htmlContent ?? prev.htmlContent,
        hasMap: payload.hasMap ?? prev.hasMap,
        mapMarkers: payload.mapMarkers ?? prev.mapMarkers,
      }));

      toast.success("Draf revisi dipulihkan", {
        description: "Konten kini berada di editor. Silakan diperbaiki.",
        icon: <CheckCircle2 className="w-4 h-4 text-green-500" />,
      });
    } catch (error) {
      toast.error("Gagal memulihkan draf");
      console.error("[RESTORE_ERROR]:", error);
    }
  }, [rejectedDraft, setFormData]);

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
      {/* 🚀 THE REJECTION RIBBON (Blueprint IV.B) */}
      {rejectedDraft && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl overflow-hidden shadow-sm animate-in slide-in-from-top-4 duration-300">
          <div className="p-4 flex gap-4 items-start">
            <div className="bg-amber-100 p-2 rounded-lg h-fit shrink-0">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <div className="flex-1 space-y-2">
              <div className="flex justify-between items-center">
                <h4 className="text-xs font-black text-amber-900 uppercase tracking-tighter">
                  ⚠️ Catatan Peninjau
                </h4>
                <span className="text-[9px] flex items-center gap-1 bg-amber-200 px-1.5 py-0.5 rounded text-amber-800 font-bold tracking-widest">
                  <Clock className="w-3 h-3" />
                  DITOLAK
                </span>
              </div>
              <p className="text-xs text-amber-800 leading-relaxed font-bold italic bg-white/60 p-2.5 rounded border border-amber-200/50">
                "
                {rejectedDraft.rejection_reason ||
                  "Silakan hubungi peninjau terkait alasan penolakan."}
                "
              </p>
              <div className="pt-2 flex flex-col sm:flex-row sm:items-center gap-3">
                <button
                  onClick={handleRestoreDraft}
                  disabled={!isEditing}
                  title={
                    !isEditing
                      ? "Buka mode edit untuk memulihkan data"
                      : "Pulihkan draf yang ditolak"
                  }
                  className="flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-300 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95">
                  <RotateCcw
                    className={`w-3.5 h-3.5 ${isEditing ? "" : "opacity-50"}`}
                  />
                  PULIHKAN DATA
                </button>
                {!isEditing && (
                  <p className="text-[10px] text-amber-600 font-medium italic animate-pulse">
                    * Aktifkan "Editing Mode" untuk memulihkan draf.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MAIN CONTENT CARD */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm relative ">
        <div className="absolute top-0 right-0 p-2 opacity-[0.03] pointer-events-none select-none uppercase font-black text-4xl">
          {activeTab}
        </div>

        <div className="p-2">
          <header className="flex items-center gap-2 border-b border-slate-50 pb-4">
            <div className="p-1.5 bg-slate-50 rounded-md">
              <Info className="w-4 h-4 text-slate-400" />
            </div>
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
              Informasi & Konten Artikel
            </h3>
          </header>

          <div className="space-y-8 mt-4">
            {/* Input: Judul Pendek */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                Judul Utama Sektor
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) =>
                  setFormData((prev: any) => ({
                    ...prev,
                    title: e.target.value,
                  }))
                }
                disabled={!isEditing}
                className={`w-full px-4 py-3 rounded-xl font-serif text-xl transition-all ${
                  isEditing
                    ? "bg-white border border-slate-300 shadow-sm focus:ring-4 focus:ring-daw-green/10 focus:border-daw-green outline-none"
                    : "bg-slate-50 border-transparent text-slate-400 disabled:cursor-not-allowed"
                }`}
                placeholder="e.g., Sustainable Natural Resources"
              />
            </div>

            {/* Editor: ReactQuill */}
            <div className="space-y-2">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                Narasi Konten (Rich Text)
              </label>
              {/* 🚀 Aggressive visual lockdown logic (already correct) */}
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
    </div>
  );
}
