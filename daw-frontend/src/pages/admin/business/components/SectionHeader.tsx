import { Trash2, Lock, Unlock, Save, Clock, Send, Loader2 } from "lucide-react";

interface SectionHeaderProps {
  activeTab: string;
  isEditing: boolean;
  setIsEditing: (val: boolean) => void;
  isSaving: boolean;
  onSave: () => void;
  onDeleteClick: () => void;
  isLocked: boolean;
  lockTicket?: string;
  isSuperadmin: boolean;
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
  isSuperadmin,
}: SectionHeaderProps) {
  const isCategoryTab = activeTab === "categories";

  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm top-0 z-20">
      {/* IDENTITAS & STATUS RADAR */}
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-serif font-bold text-slate-900">
            Businesses Manager
          </h1>

          {/* Lock Indicator */}
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

          {/* Ticket Identifier */}
          {isLocked && lockTicket && (
            <p className="text-[11px] font-mono text-blue-500 bg-blue-50/50 w-fit px-2 py-0.5 rounded border border-blue-100/50">
              Reference Ticket:{" "}
              <span className="font-bold underline">{lockTicket}</span>
            </p>
          )}
        </div>
      </div>

      {/* ACTION COMMAND GROUP */}
      <div className="flex flex-wrap items-center gap-3">
        {/* DELETE ACTION */}
        {!isCategoryTab && isEditing && (
          <button
            onClick={onDeleteClick}
            disabled={isLocked}
            className="flex items-center justify-center p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title={
              isLocked
                ? "Hapus dinonaktifkan: Menunggu Approval"
                : "Hapus Sektor Ini"
            }>
            <Trash2 className="w-5 h-5" />
          </button>
        )}

        {/* MODE TOGGLE */}
        <button
          onClick={() => !isLocked && setIsEditing(!isEditing)}
          disabled={isLocked}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-bold text-sm transition-all border ${
            isLocked
              ? "bg-slate-50 text-slate-300 border-slate-200 cursor-not-allowed"
              : isEditing
                ? "bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-200 shadow-sm"
                : "bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200"
          }`}>
          {isLocked ? (
            <Lock className="w-4 h-4" />
          ) : isEditing ? (
            <Unlock className="w-4 h-4" />
          ) : (
            <Lock className="w-4 h-4" />
          )}
          <span>
            {isLocked ? "System Locked" : isEditing ? "Editing Mode" : "Locked"}
          </span>
        </button>

        {/* THE MATRIX ACTION BUTTON */}
        {!isCategoryTab && (
          <button
            onClick={onSave}
            disabled={isSaving || !isEditing || isLocked}
            className={`flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg font-bold text-sm transition-all shadow-sm active:scale-95 disabled:cursor-not-allowed min-w-[160px] ${
              isSaving
                ? "bg-slate-300 text-slate-700"
                : isLocked
                  ? "bg-slate-200 text-slate-500 border border-slate-300"
                  : isSuperadmin
                    ? "bg-daw-green hover:bg-[#003b1c] text-white"
                    : "bg-blue-600 hover:bg-blue-700 text-white"
            }`}>
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Memproses...
              </>
            ) : isLocked ? (
              <>
                <Lock className="w-4 h-4" /> Akses Terbatas
              </>
            ) : isSuperadmin ? (
              <>
                <Save className="w-4 h-4" /> Publish Live
              </>
            ) : (
              <>
                <Send className="w-4 h-4" /> Request Approval
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
