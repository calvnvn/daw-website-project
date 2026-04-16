import { Trash2, Lock, Unlock, Save, ShieldAlert, Clock } from "lucide-react";

interface SectionHeaderProps {
  activeTab: string;
  isEditing: boolean;
  setIsEditing: (val: boolean) => void;
  isSaving: boolean;
  onSave: () => void;
  onDeleteClick: () => void;
  isLocked: boolean;
  lockTicket?: string;
}

export default function SectionHeader({
  activeTab,
  isEditing,
  setIsEditing,
  isSaving,
  onSave,
  onDeleteClick,
  isLocked,
  lockTicket,
}: SectionHeaderProps) {
  const isCategoryTab = activeTab === "categories";

  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm top-0 z-20">
      {/* JUDUL HALAMAN & STATUS BADGE */}
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-serif font-bold text-slate-900">
            Businesses Manager
          </h1>

          {/* 🚀 System Lock Indicator */}
          {isLocked && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-100 rounded-full animate-pulse">
              <Clock className="w-3.5 h-3.5" />
              <span className="text-[10px] font-black uppercase tracking-tighter">
                Pending Approval
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <p className="text-sm text-slate-500">
            Kelola divisi bisnis dan sebaran lokasi geografis perusahaan.
          </p>
          {/* Info Tiket jika sedang dikunci */}
          {isLocked && lockTicket && (
            <p className="text-[11px] font-mono text-blue-500 bg-blue-50/50 w-fit px-2 py-0.5 rounded border border-blue-100/50">
              Reference Ticket:{" "}
              <span className="font-bold underline">{lockTicket}</span>
            </p>
          )}
        </div>
      </div>

      {/* KELOMPOK TOMBOL AKSI */}
      <div className="flex items-center gap-3">
        {/* 1. Tombol Hapus (Disabled if Locked) */}
        {!isCategoryTab && isEditing && (
          <button
            onClick={onDeleteClick}
            disabled={isLocked}
            className="flex items-center justify-center p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title={
              isLocked
                ? "Cannot delete: Pending Approval"
                : "Delete this section"
            }>
            <Trash2 className="w-5 h-5" />
          </button>
        )}

        {/* 2. Tombol Kunci/Buka Mode Edit (The Gatekeeper Logic) */}
        <button
          onClick={() => !isLocked && setIsEditing(!isEditing)}
          disabled={isLocked}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-bold text-sm transition-all border ${
            isLocked
              ? "bg-slate-50 text-slate-300 border-slate-200 cursor-not-allowed"
              : isEditing
                ? "bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-200"
                : "bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200"
          }`}>
          {isLocked ? (
            <Lock className="w-4 h-4 text-slate-400" />
          ) : isEditing ? (
            <Unlock className="w-4 h-4" />
          ) : (
            <Lock className="w-4 h-4" />
          )}
          <span>
            {isLocked ? "System Locked" : isEditing ? "Editing Mode" : "Locked"}
          </span>
        </button>

        {/* 3. Tombol Save ke Database */}
        {!isCategoryTab && (
          <button
            onClick={onSave}
            disabled={isSaving || !isEditing || isLocked}
            className="flex items-center gap-2 bg-daw-green hover:bg-[#003b1c] disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-lg font-bold text-sm transition-all shadow-sm active:scale-95">
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
