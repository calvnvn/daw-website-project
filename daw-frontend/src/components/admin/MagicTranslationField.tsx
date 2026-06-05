import React, { useState } from "react";
import { Sparkles, Loader2, ChevronDown, ChevronUp, Languages, CheckCircle2, AlertCircle } from "lucide-react";
import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";
import api from "@/lib/api";
import { toast } from "sonner";

interface MagicTranslationFieldProps {
  label: string;
  originalText: string;
  value: string;
  onChange: (value: string) => void;
  isRichText?: boolean;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}

const MagicTranslationField: React.FC<MagicTranslationFieldProps> = ({
  label,
  originalText,
  value,
  onChange,
  isRichText = false,
  disabled = false,
  className = "",
  placeholder = "Terjemahan Indonesia...",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);

  const hasContent = value && value.trim() !== "" && value !== "<p><br></p>";

  const handleMagicTranslate = async () => {
    if (!originalText || originalText.trim() === "" || originalText === "<p><br></p>") {
      toast.warning("Teks asli (Inggris) masih kosong. Tidak ada yang bisa diterjemahkan.");
      return;
    }

    setIsTranslating(true);
    try {
      const res = await api.post("/translation/auto", {
        text: originalText,
        targetLanguage: "id",
      });
      
      const translated = res.data?.data || "";
      onChange(translated);
      toast.success("Berhasil menggunakan Magic Translate!");
    } catch (error) {
      console.error("Magic Translate Error:", error);
      toast.error("Gagal melakukan translasi otomatis. Server AI sibuk atau terjadi kesalahan.");
    } finally {
      setIsTranslating(false);
    }
  };

  const quillModules = {
    toolbar: [
      [{ header: [1, 2, 3, false] }],
      ["bold", "italic", "underline", "strike"],
      [{ list: "ordered" }, { list: "bullet" }],
      ["link"],
      ["clean"],
    ],
  };

  // 1. COLLAPSED ACCORDION BAR (UX Option 3)
  if (!isOpen) {
    return (
      <div className={`mt-2 flex items-center justify-between p-2 bg-slate-50 border border-slate-200 rounded-lg transition-all ${className}`}>
        <div className="flex items-center gap-2">
          <Languages className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-semibold text-slate-600">Terjemahan Indonesia:</span>
          {hasContent ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full text-[10px] font-bold">
              <CheckCircle2 className="w-3 h-3" /> Ready
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-100 rounded-full text-[10px] font-bold">
              <AlertCircle className="w-3 h-3" /> Belum Diisi
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-md text-xs font-bold transition-all shadow-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {disabled ? null : <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-pulse" />}
          <span>{disabled ? "Lihat Terjemahan" : "Edit Terjemahan"}</span>
          <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
        </button>
      </div>
    );
  }

  // 2. EXPANDED AI ASSISTANT PANEL
  return (
    <div className={`mt-2 bg-gradient-to-br from-amber-50/10 to-slate-50/50 p-4 border border-dashed border-slate-300 rounded-xl space-y-3 shadow-inner transition-all ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Languages className="w-4 h-4 text-amber-600" />
          <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            🇮🇩 {label}
          </label>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleMagicTranslate}
            disabled={disabled || isTranslating}
            className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 hover:text-amber-800 border border-amber-200 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            {isTranslating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            )}
            {isTranslating ? "Menerjemahkan..." : "Magic Translate"}
          </button>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-lg text-xs font-bold transition-all shadow-sm"
          >
            <span>Sembunyikan</span>
            <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
          </button>
        </div>
      </div>

      {isRichText ? (
        <div className={`bg-white rounded-xl overflow-hidden border ${disabled ? "opacity-70 pointer-events-none" : "border-slate-300 focus-within:ring-2 focus-within:ring-daw-green/20 focus-within:border-daw-green"}`}>
          <ReactQuill
            theme="snow"
            value={value}
            onChange={onChange}
            modules={quillModules}
            className="h-full min-h-[150px]"
            readOnly={disabled}
            placeholder={placeholder}
          />
        </div>
      ) : (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder={placeholder}
          rows={3}
          className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-daw-green/20 focus:border-daw-green transition-all disabled:bg-slate-50 disabled:text-slate-500 shadow-sm"
        />
      )}
      <p className="text-[10px] text-slate-400 font-medium">
        Gunakan tombol Magic Translate 🪄 untuk meminta bantuan AI menerjemahkan teks Inggris di atas secara otomatis.
      </p>
    </div>
  );
};

export default MagicTranslationField;
