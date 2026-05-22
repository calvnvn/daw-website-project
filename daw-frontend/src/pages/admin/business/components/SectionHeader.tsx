import {
  Trash2,
  Lock,
  Unlock,
  Save,
  Clock,
  Send,
  Loader2,
  ShieldAlert,
  FileEdit,
  Eye,
} from "lucide-react";

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
  activeSubTab?: "edit" | "preview";
  setActiveSubTab?: (val: "edit" | "preview") => void;
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
  activeSubTab = "edit",
  setActiveSubTab,
}: SectionHeaderProps) {
  const isCategoryTab = activeTab === "categories";

  // 🚀 THE FIX: Pisahkan logika kunci antara Editor dan Superadmin
  const shouldLockUI = isLocked && !isSuperadmin;
  const isOverrideMode = isLocked && isSuperadmin;

  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm top-0 z-20">
      {/* IDENTITAS & STATUS RADAR */}
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-serif font-black text-slate-900 tracking-tight">
            Businesses Manager
          </h1>

          {/* Lock Indicator */}
          {isLocked && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-600 border border-blue-100 rounded-full animate-pulse">
              <Clock className="w-3 h-3" />
              <span className="text-[10px] font-black uppercase tracking-widest">
                Pending Approval
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <p className="text-sm text-slate-500">
            Kelola divisi bisnis dan sebaran lokasi geografis perusahaan.
          </p>

          {/* Ticket Identifier */}
          {isLocked && lockTicket && (
            <p className="text-[10px] font-mono font-bold text-blue-500 bg-blue-50/50 w-fit px-2 py-0.5 rounded border border-blue-100/50 uppercase">
              TICKET: <span className="underline">{lockTicket}</span>
            </p>
          )}
        </div>
      </div>

      {/* ACTION COMMAND GROUP */}
      <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
        {/* DELETE ACTION */}
        {!isCategoryTab && isEditing && (
          <button
            onClick={onDeleteClick}
            disabled={shouldLockUI}
            className="flex items-center justify-center p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title={
              shouldLockUI
                ? "Hapus dinonaktifkan: Menunggu Approval"
                : "Ajukan Penghapusan"
            }>
            <Trash2 className="w-5 h-5" />
          </button>
        )}

        {/* VIEW MODE TOGGLE */}
        {!isCategoryTab && setActiveSubTab && (
          <div className="flex bg-slate-100 p-1 rounded-xl w-full sm:w-auto shadow-inner">
            <button
              onClick={() => setActiveSubTab("edit")}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all duration-300 ${
                activeSubTab === "edit"
                  ? "bg-white text-daw-green shadow-sm ring-1 ring-slate-200"
                  : "text-slate-500 hover:text-slate-700"
              }`}>
              <FileEdit className="w-3.5 h-3.5" />
              <span>Input Form</span>
            </button>
            <button
              onClick={() => setActiveSubTab("preview")}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all duration-300 ${
                activeSubTab === "preview"
                  ? "bg-daw-green text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}>
              <Eye className="w-3.5 h-3.5" />
              <span>Live Preview</span>
            </button>
          </div>
        )}

        {/* MODE TOGGLE (Sesuai Tipografi Blueprint) */}
        <button
          onClick={() => {
            if (shouldLockUI) return;
            setIsEditing(!isEditing);
          }}
          disabled={shouldLockUI}
          className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-black text-[11px] uppercase tracking-widest transition-all border shadow-sm ${
            shouldLockUI
              ? "bg-slate-50 text-slate-300 border-slate-200 cursor-not-allowed"
              : isEditing
                ? "bg-amber-50 text-amber-700 border-amber-200 ring-2 ring-amber-500/10 hover:bg-amber-100"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
          }`}>
          {shouldLockUI ? (
            <Lock className="w-4 h-4 text-slate-300" />
          ) : isEditing ? (
            isOverrideMode ? (
              <ShieldAlert className="w-4 h-4 text-amber-600" />
            ) : (
              <Unlock className="w-4 h-4 text-amber-500" />
            )
          ) : (
            <Lock className="w-4 h-4 text-slate-400" />
          )}
          <span>
            {shouldLockUI
              ? "Locked"
              : isOverrideMode && isEditing
                ? "Override Mode"
                : isEditing
                  ? "Editing Mode"
                  : "Locked"}
          </span>
        </button>

        {/* THE MATRIX ACTION BUTTON (Sesuai Tipografi Blueprint) */}
        {!isCategoryTab && (
          <button
            onClick={onSave}
            disabled={isSaving || !isEditing || shouldLockUI}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg font-black text-[11px] uppercase tracking-widest transition-all shadow-lg active:scale-95 disabled:cursor-not-allowed disabled:shadow-none min-w-[170px] ${
              isSaving
                ? "bg-slate-300 text-slate-700"
                : shouldLockUI
                  ? "bg-slate-200 text-slate-500"
                  : isOverrideMode
                    ? "bg-amber-600 hover:bg-amber-700 text-white shadow-amber-600/20"
                    : isSuperadmin
                      ? "bg-daw-green hover:bg-[#003b1c] text-white shadow-daw-green/20"
                      : "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20"
            }`}>
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : shouldLockUI ? (
              <Lock className="w-4 h-4" />
            ) : isSuperadmin ? (
              <Save className="w-4 h-4" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            <span>
              {isSaving
                ? "Memproses..."
                : shouldLockUI
                  ? "Akses Terbatas"
                  : isOverrideMode
                    ? "Override & Publish"
                    : isSuperadmin
                      ? "Publish Live"
                      : "Request Approval"}
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
