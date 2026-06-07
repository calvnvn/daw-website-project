import { Clock, Check, X, Loader2 } from "lucide-react";
import type { ApprovalDraft } from "../utils/approvalHelpers";

// COMPONENT: APPROVAL TRACKER (SISTEM PANTAU)
export const ApprovalTracker = ({ draft }: { draft: ApprovalDraft }) => {
  if (!draft.approver_roadmap) return null;

  let roadmap = [];
  try {
    roadmap =
      typeof draft.approver_roadmap === "string"
        ? JSON.parse(draft.approver_roadmap)
        : draft.approver_roadmap;
  } catch (e) {
    return null;
  }

  if (!Array.isArray(roadmap) || roadmap.length === 0) return null;

  const currentLevel = draft.current_level || 1;

  return (
    <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 lg:px-8">
      <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 flex items-center gap-2">
        <Clock className="w-4 h-4" /> Jejak Persetujuan (PANTAU)
      </h3>
      <p className="text-[10px] text-slate-400 mb-4 leading-relaxed">
        Menunjukkan siapa saja yang harus menyetujui dan sudah sampai tahap
        mana.
      </p>
      <div className="flex flex-col sm:flex-row gap-4 justify-between relative">
        {/* Connector Line for Desktop */}
        <div className="hidden sm:block absolute top-4 left-[10%] right-[10%] h-[2px] bg-slate-200 z-0" />

        {roadmap.map((step: any, index: number) => {
          const stepLevel = Number(step.level);

          let statusConfig = {
            color: "text-slate-400",
            bg: "bg-slate-100 border-slate-200",
            icon: <Clock className="w-4 h-4" />,
            label: "Menunggu Giliran",
            tooltip: `Tahap ${stepLevel}: Menunggu giliran persetujuan dari ${step.namakaryawan || `NIK ${step.karyawanid}`}`,
          };

          if (draft.status === "Rejected" && stepLevel === currentLevel) {
            statusConfig = {
              color: "text-rose-600",
              bg: "bg-rose-50 border-rose-200",
              icon: <X className="w-4 h-4" />,
              label: "Ditolak (Berhenti Di Sini)",
              tooltip: `Tahap ${stepLevel}: Ditolak oleh ${step.namakaryawan || `NIK ${step.karyawanid}`}. Proses persetujuan dihentikan.`,
            };
          } else if (stepLevel < currentLevel || draft.status === "Approved") {
            statusConfig = {
              color: "text-daw-green",
              bg: "bg-emerald-50 border-emerald-200",
              icon: <Check className="w-4 h-4" />,
              label: "Telah Disetujui",
              tooltip: `Tahap ${stepLevel}: Telah disetujui oleh ${step.namakaryawan || `NIK ${step.karyawanid}`}.`,
            };
          } else if (stepLevel === currentLevel && draft.status === "Pending") {
            statusConfig = {
              color: "text-blue-600",
              bg: "bg-blue-50 border-blue-200 ring-2 ring-blue-500/20",
              icon: <Loader2 className="w-4 h-4 animate-spin" />,
              label: "Sedang Ditinjau",
              tooltip: `Tahap ${stepLevel}: Saat ini sedang menunggu keputusan dari ${step.namakaryawan || `NIK ${step.karyawanid}`}.`,
            };
          }

          return (
            <div
              key={index}
              className="flex-1 flex flex-col relative z-10"
              title={statusConfig.tooltip}>
              <div className="flex flex-row sm:flex-col items-center gap-3 sm:gap-2">
                <div
                  className={`w-8 h-8 rounded-full border flex items-center justify-center shrink-0 shadow-sm transition-all ${statusConfig.bg} ${statusConfig.color}`}>
                  {statusConfig.icon}
                </div>
                <div className="flex flex-col sm:items-center text-left sm:text-center">
                  <p className="text-[10px] font-black uppercase text-slate-400">
                    Tahap {stepLevel}
                  </p>
                  <p className="text-xs font-bold text-slate-800">
                    {step.namakaryawan || `NIK: ${step.karyawanid}`}
                  </p>
                  <p
                    className={`text-[10px] font-bold mt-0.5 ${statusConfig.color}`}>
                    {statusConfig.label}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ApprovalTracker;
