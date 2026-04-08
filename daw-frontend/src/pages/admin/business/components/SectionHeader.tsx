import { Trash2, Lock, Unlock, Save } from "lucide-react";

// 1. KONTRAK DATA (PROPS)
interface SectionHeaderProps {
  activeTab: string;
  isEditing: boolean;
  setIsEditing: (val: boolean) => void;
  isSaving: boolean;
  onSave: () => void;
  onDeleteClick: () => void;
}

export default function SectionHeader({
  activeTab,
  isEditing,
  setIsEditing,
  isSaving,
  onSave,
  onDeleteClick,
}: SectionHeaderProps) {
  const isCategoryTab = activeTab === "categories";

  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm top-0 z-20">
      {/* JUDUL HALAMAN */}
      <div>
        <h1 className="text-2xl font-serif font-bold text-slate-900">
          Businesses Manager
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Kelola divisi bisnis dan sebaran lokasi geografis perusahaan.
        </p>
      </div>

      {/* KELOMPOK TOMBOL AKSI */}
      <div className="flex items-center gap-3">
        {/* 1. Tombol Hapus Sektor (Hanya muncul jika mode edit & BUKAN tab kategori) */}
        {!isCategoryTab && isEditing && (
          <button
            onClick={onDeleteClick}
            className="flex items-center justify-center p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Delete this section"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        )}

        {/* 2. Tombol Kunci/Buka Mode Edit */}
        <button
          onClick={() => setIsEditing(!isEditing)}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-bold text-sm transition-colors border ${
            isEditing
              ? "bg-amber-100 text-amber-700 border-amber-200"
              : "bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200"
          }`}
        >
          {isEditing ? (
            <Unlock className="w-4 h-4" />
          ) : (
            <Lock className="w-4 h-4" />
          )}
          <span>{isEditing ? "Editing Mode" : "Locked"}</span>
        </button>

        {/* 3. Tombol Save ke Database */}
        {!isCategoryTab && (
          <button
            onClick={onSave}
            disabled={isSaving || !isEditing}
            className="flex items-center gap-2 bg-daw-green hover:bg-[#003b1c] disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-lg font-medium transition-colors shadow-sm"
          >
            {isSaving ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Save className="w-5 h-5" />
            )}
            <span>
              {isSaving ? "Saving..." : `Update ${activeTab.toUpperCase()}`}
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
