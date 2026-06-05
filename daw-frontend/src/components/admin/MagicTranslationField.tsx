import React, { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
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
  const [isTranslating, setIsTranslating] = useState(false);

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

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between">
        <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
          🇮🇩 {label}
        </label>
        <button
          type="button"
          onClick={handleMagicTranslate}
          disabled={disabled || isTranslating}
          className="px-3 py-1 bg-amber-50 text-amber-700 hover:bg-amber-100 hover:text-amber-800 border border-amber-200 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isTranslating ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Sparkles className="w-3.5 h-3.5" />
          )}
          {isTranslating ? "Menerjemahkan..." : "Magic Translate"}
        </button>
      </div>

      {isRichText ? (
        <div className={`bg-white rounded-xl overflow-hidden border ${disabled ? "opacity-70 pointer-events-none" : "border-slate-300"}`}>
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
          className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-daw-green/20 focus:border-daw-green transition-all disabled:bg-slate-50 disabled:text-slate-500"
        />
      )}
      <p className="text-[10px] text-slate-400 font-medium">
        Gunakan tombol Magic Translate 🪄 untuk meminta bantuan AI, lalu sesuaikan isinya secara manual.
      </p>
    </div>
  );
};

export default MagicTranslationField;
