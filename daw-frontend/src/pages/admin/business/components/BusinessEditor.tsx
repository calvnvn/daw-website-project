import { useMemo } from "react";
import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";

interface BusinessEditorProps {
  activeTab: string;
  formData: {
    title: string;
    htmlContent: string;
  };
  setFormData: React.Dispatch<React.SetStateAction<any>>;
  isEditing: boolean;
}

export default function BusinessEditor({
  activeTab,
  formData,
  setFormData,
  isEditing,
}: BusinessEditorProps) {
  /**
   * Stabilized Quill Modules
   * Memoized di level komponen ini agar editor tidak kehilangan fokus (blur)
   * saat state formData berubah.
   */
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
      <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
        {/* Sub-Header Konten */}
        <h3 className="text-base font-bold text-slate-900 mb-4 border-b border-slate-200 pb-2 flex justify-between items-center uppercase tracking-widest text-[11px]">
          <span>Konten Artikel</span>
          <span className="text-daw-green bg-daw-green/10 px-2 py-0.5 rounded italic">
            ID Referensi: {activeTab}
          </span>
        </h3>

        <div className="space-y-4">
          {/* Input: Judul Pendek */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Judul Pendek
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) =>
                setFormData((prev: any) => ({ ...prev, title: e.target.value }))
              }
              disabled={!isEditing}
              className={`w-full px-3 py-2 rounded-lg font-serif text-lg transition-all ${
                isEditing
                  ? "bg-white border border-slate-300 shadow-sm focus:ring-2 focus:ring-daw-green/20 outline-none"
                  : "bg-transparent border-transparent text-slate-900"
              }`}
              placeholder="e.g., Sustainable Natural Resources"
            />
          </div>

          {/* Editor: ReactQuill */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Isi Konten Artikel
            </label>
            <div
              className={`rounded-xl overflow-hidden border transition-all ${
                isEditing
                  ? "bg-white border-slate-300 shadow-md"
                  : "opacity-70 pointer-events-none grayscale-[0.3]"
              }`}
            >
              <ReactQuill
                theme="snow"
                value={formData.htmlContent}
                onChange={(val) =>
                  setFormData((prev: any) => ({ ...prev, htmlContent: val }))
                }
                modules={quillModules}
                readOnly={!isEditing}
                className="h-64 mb-12"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
