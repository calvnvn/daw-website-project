import React, { useState, useEffect } from "react";
import api from "@/lib/api";
import { ApprovalTracker } from "@/pages/admin/approvals/components/ApprovalTracker";
import type { ApprovalDraft } from "@/pages/admin/approvals/utils/approvalHelpers";
import { Lock, Loader2 } from "lucide-react";

interface LockedStateTrackerProps {
  isLocked: boolean;
  lockTicket: string | null;
  children: React.ReactNode;
}

export default function LockedStateTracker({
  isLocked,
  lockTicket,
  children,
}: LockedStateTrackerProps) {
  const [draft, setDraft] = useState<ApprovalDraft | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    console.log("[LockedStateTracker] Effect triggered:", { isLocked, lockTicket });

    // Guard: only fetch if truly locked and has a non-empty ticket
    if (!isLocked || !lockTicket || lockTicket.trim() === "") {
      console.log("[LockedStateTracker] Guard triggered — skipping fetch.", { isLocked, lockTicket });
      return;
    }

    const fetchStatus = async () => {
      setIsLoading(true);
      console.log("[LockedStateTracker] Fetching:", `/approval/status/${encodeURIComponent(lockTicket)}`);
      try {
        const res = await api.get(`/approval/status/${encodeURIComponent(lockTicket)}`);
        console.log("[LockedStateTracker] API Response:", res.data);
        if (res.data?.success && res.data.data) {
          const raw = res.data.data;
          console.log("[LockedStateTracker] Raw roadmap:", raw.approver_roadmap);
          const shaped: ApprovalDraft = {
            notrans: raw.notrans,
            nourut: "",
            module_name: raw.module_name,
            action: raw.action,
            target_id: "",
            payload: null,
            created_by: raw.created_by,
            status: raw.status,
            createdAt: "",
            kodeapp: "",
            level: raw.current_level ?? 1,
            isMyQueue: false,
            rejection_reason: raw.rejection_reason ?? null,
            current_level: raw.current_level ?? 1,
            approver_roadmap: raw.approver_roadmap ?? [],
          };
          console.log("[LockedStateTracker] Shaped draft set to state:", shaped);
          setDraft(shaped);
        } else {
          console.warn("[LockedStateTracker] API returned success=false or empty data:", res.data);
        }
      } catch (err) {
        console.error("[LockedStateTracker] Gagal mengambil status persetujuan:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchStatus();
  }, [isLocked, lockTicket]);

  return (
    <div className="space-y-6 w-full">
      {isLocked && (
        <div className="space-y-4 mb-6">
          <div className="p-4 rounded-xl flex items-center gap-4 bg-blue-50 border border-blue-200 shadow-sm animate-in fade-in duration-300">
            <div className="p-2 rounded-full bg-blue-100 text-blue-600 shrink-0">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-black uppercase tracking-tight text-blue-900">
                Akses Dibatasi (Sedang Ditinjau)
              </h4>
              <p className="text-xs text-blue-700 leading-relaxed mt-0.5">
                Revisi sedang dalam proses persetujuan. Anda dapat melihat progres Baton Pass di bawah ini.
              </p>
            </div>
          </div>

          {isLoading ? (
            <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-center gap-2 text-xs text-slate-500 font-medium">
              <Loader2 className="w-4 h-4 animate-spin text-daw-green" />
              Menghubungkan ke sistem persetujuan...
            </div>
          ) : draft ? (
            <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm">
              <ApprovalTracker draft={draft} />
            </div>
          ) : (
            <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs text-slate-500">
              <p className="font-semibold text-slate-600 mb-1">Data urutan approver tidak tersedia</p>
              <p className="leading-relaxed">Tiket persetujuan mungkin belum tersinkron dengan ERP OWL, atau koneksi ke sistem OWL sedang bermasalah. Coba refresh halaman, atau hubungi administrator.</p>
            </div>
          )}
        </div>
      )}

      {/* 
        <fieldset disabled> will automatically disable ALL interactive elements 
        (inputs, selects, buttons, textareas) inside it natively.
      */}
      <fieldset disabled={isLocked} className="contents">
        {children}
      </fieldset>
    </div>
  );
}
