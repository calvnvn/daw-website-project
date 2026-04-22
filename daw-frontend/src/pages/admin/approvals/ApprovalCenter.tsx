/**
 * MODULE: Approval Center (Execution Machine)
 * PATH: /src/pages/admin/ApprovalCenter.tsx
 * VERSION: 3.0 (Ultimate Visual UX - Senior Dev Edition)
 */

import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import {
  Check,
  X,
  Eye,
  Clock,
  FileText,
  Loader2,
  Image as ImageIcon,
  ShieldAlert,
  LayoutTemplate,
  Code2,
  RotateCcw,
} from "lucide-react";
import api, { BASE_UPLOAD_URL } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import ReactDiffViewer, { DiffMethod } from "react-diff-viewer-continued";
import DOMPurify from "dompurify";
import PREVIEW_REGISTRY from "./ModuleRegistry";

interface ApprovalDraft {
  notrans: string;
  nourut: string;
  module_name: string;
  action: string;
  target_id: string;
  payload: any;
  created_by: string;
  status: string;
  createdAt: string;
  rejection_reason?: string | null;
  kodeapp: string;
  level: number | string;
  nextApp?: string;
  jenispersetujuan?: string;
  currentHolderName?: string;
  currentHolderNik?: string;
  isMyQueue: boolean;
  owlStatus?: string | null;
}

// Helper: Memburu semua value gambar
const extractImagesFromPayload = (
  obj: any,
  images: string[] = [],
): string[] => {
  if (!obj || typeof obj !== "object") return images;

  Object.values(obj).forEach((val) => {
    if (typeof val === "string") {
      if (
        val.startsWith("TEMP_") ||
        val.match(/\.(jpeg|jpg|gif|png|webp|svg)$/i) ||
        val.startsWith("data:image/")
      ) {
        images.push(val);
      }
    } else if (typeof val === "object") {
      extractImagesFromPayload(val, images);
    }
  });
  return [...new Set(images)];
};

// Helper: Daftar field yang mengandung HTML/Artikel Panjang
const HTML_FIELDS = [
  "content",
  "htmlContent",
  "description",
  "excerpt",
  "introBody",
  "teaserBody",
  "missionText",
  "visionText",
  "meta_description",
];

// Helper: Membuang field bawaan DB agar tidak menjadi "Noise"
const sanitizeForDiff = (data: any) => {
  if (!data || typeof data !== "object") return {};
  const cleanData = { ...data };
  [
    "id",
    "createdAt",
    "updatedAt",
    "is_locked",
    "lock_ticket",
    "_system_note",
  ].forEach((key) => delete cleanData[key]);
  return cleanData;
};

// COMPONENT: MODAL DIFF VIEWER
const DiffModal = ({
  draft,
  isReadOnly,
  onClose,
  onApprove,
  onReject,
  isSubmitting,
}: {
  draft: ApprovalDraft;
  isReadOnly: boolean;
  onClose: () => void;
  onApprove: (draft: ApprovalDraft, finalPayload: any) => void;
  onReject: (draft: ApprovalDraft, reason: string) => void;
  isSubmitting: boolean;
}) => {
  const [rejectReason, setRejectReason] = useState("");
  const [isRejecting, setIsRejecting] = useState(false);
  const [oldData, setOldData] = useState<any>(null);
  const [loadingOld, setLoadingOld] = useState(true);
  const [activeTab, setActiveTab] = useState<"visual" | "code">("visual");

  // Fetch Live Data
  useEffect(() => {
    const abortController = new AbortController();
    setLoadingOld(true);

    const fetchOriginal = async () => {
      try {
        const response = await api.get("/approval/original-data", {
          params: {
            module: draft.module_name,
            targetId: draft.target_id,
            action: draft.action,
          },
          signal: abortController.signal,
        });
        setOldData(response.data);
      } catch (error: any) {
        if (error.name !== "CanceledError") {
          setOldData({ _system_note: "Gagal menarik data Live dari Server." });
        }
      } finally {
        setLoadingOld(false);
      }
    };
    fetchOriginal();
    return () => abortController.abort();
  }, [draft]);

  const finalPayload = draft.payload;
  const previewImages = extractImagesFromPayload(finalPayload);

  // --- PEMISAHAN DATA: METADATA VS HTML CONTENT ---
  const { oldMeta, newMeta, oldHtml, newHtml } = useMemo(() => {
    const safeOldData = sanitizeForDiff(oldData);
    const oMeta = { ...safeOldData };
    const nMeta = { ...finalPayload };
    const oHtml: Record<string, string> = {};
    const nHtml: Record<string, string> = {};

    HTML_FIELDS.forEach((key) => {
      if (oMeta[key] !== undefined) {
        oHtml[key] = oMeta[key];
        delete oMeta[key];
      }
      if (nMeta[key] !== undefined) {
        nHtml[key] = nMeta[key];
        delete nMeta[key];
      }
    });

    return { oldMeta: oMeta, newMeta: nMeta, oldHtml: oHtml, newHtml: nHtml };
  }, [oldData, finalPayload]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[95vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        {/* HEADER MODAL */}
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <div>
            <h2 className="text-xl font-black text-slate-900 flex items-center gap-2 tracking-tight">
              <FileText className="w-6 h-6 text-daw-green" />
              Tinjauan Perubahan: {draft.module_name}
            </h2>
            <p className="text-xs text-slate-500 mt-1.5 font-mono">
              <span
                className={`px-2 py-0.5 rounded font-bold mr-2 text-white ${
                  draft.action === "CREATE"
                    ? "bg-green-500"
                    : draft.action === "DELETE"
                      ? "bg-red-500"
                      : "bg-blue-500"
                }`}>
                {draft.action}
              </span>
              Tiket: {draft.notrans} | Level ERP: {draft.level}
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex bg-slate-200 p-1 rounded-lg">
              <button
                onClick={() => setActiveTab("visual")}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-bold transition-all ${
                  activeTab === "visual"
                    ? "bg-white text-daw-green shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}>
                <LayoutTemplate className="w-4 h-4" /> Visual & Meta
              </button>
              <button
                onClick={() => setActiveTab("code")}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-bold transition-all ${
                  activeTab === "code"
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}>
                <Code2 className="w-4 h-4" /> Raw JSON
              </button>
            </div>

            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="p-2 bg-white hover:bg-red-50 hover:text-red-600 border border-slate-200 rounded-full transition-all shadow-sm disabled:opacity-50">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* BODY KONTEN */}
        <div className="flex-1 overflow-y-auto bg-slate-100/50 p-6 relative">
          {loadingOld ? (
            <div className="absolute inset-0 bg-white/70 z-10 flex flex-col items-center justify-center">
              <Loader2 className="w-10 h-10 animate-spin text-daw-green mb-3" />
              <p className="text-sm font-bold text-slate-600 tracking-wide">
                Menarik Data Live dari Server...
              </p>
            </div>
          ) : activeTab === "code" ? (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <ReactDiffViewer
                oldValue={JSON.stringify(sanitizeForDiff(oldData), null, 2)}
                newValue={JSON.stringify(finalPayload, null, 2)}
                splitView={true}
                compareMethod={DiffMethod.WORDS}
                leftTitle="Versi Produksi"
                rightTitle="Usulan Draf"
              />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Custom Preview Registry logic tetap sama seperti sebelumnya */}
              {(() => {
                const PreviewComponent = PREVIEW_REGISTRY[draft.module_name];
                if (!PreviewComponent) return null;
                return (
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="grid grid-cols-1 md:grid-cols-2 divide-x divide-slate-100 bg-slate-50/30">
                      <div className="p-6">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">
                          Live Version
                        </p>
                        {oldData ? (
                          <PreviewComponent data={oldData} />
                        ) : (
                          <div className="h-20 flex items-center justify-center border-2 border-dashed rounded-xl text-slate-400 text-xs">
                            Data Baru (Create Mode)
                          </div>
                        )}
                      </div>
                      <div className="p-6 bg-white">
                        <p className="text-[10px] font-black text-daw-green uppercase tracking-widest mb-4">
                          Proposed Draft
                        </p>
                        <PreviewComponent data={finalPayload} />
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Metadata Diff Table */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="bg-slate-50 px-4 py-2 text-[10px] font-black text-slate-400 uppercase">
                  Metadata Analysis
                </div>
                <ReactDiffViewer
                  oldValue={JSON.stringify(oldMeta, null, 2)}
                  newValue={JSON.stringify(newMeta, null, 2)}
                  splitView={true}
                />
              </div>
            </div>
          )}
        </div>

        {/* FOOTER ACTIONS */}
        <div className="px-6 py-4 bg-white border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4">
          {isReadOnly ? (
            <div className="w-full flex items-center justify-center p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm font-bold gap-2">
              <ShieldAlert className="w-5 h-5 text-amber-600" />
              Hanya Approver yang berhak melakukan eksekusi pada tiket ini.
            </div>
          ) : (
            <>
              <div className="flex-1 flex gap-2 w-full sm:w-auto">
                {isRejecting ? (
                  <div className="flex w-full gap-2 animate-in slide-in-from-left-2">
                    <input
                      type="text"
                      placeholder="Alasan penolakan (min. 5 karakter)..."
                      className="flex-1 text-sm border-2 border-red-200 rounded-lg px-3 py-2 outline-none focus:border-red-500"
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      disabled={isSubmitting}
                      autoFocus
                    />
                    <button
                      onClick={() => onReject(draft, rejectReason)}
                      disabled={
                        !rejectReason.trim() ||
                        rejectReason.length < 5 ||
                        isSubmitting
                      }
                      className="px-6 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-bold rounded-lg transition-all">
                      {isSubmitting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        "Konfirmasi Tolak"
                      )}
                    </button>
                    <button
                      onClick={() => setIsRejecting(false)}
                      disabled={isSubmitting}
                      className="px-4 py-2 bg-slate-100 text-slate-600 text-sm font-bold rounded-lg">
                      Batal
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setIsRejecting(true)}
                    disabled={isSubmitting}
                    className="px-6 py-2.5 bg-white border-2 border-red-100 text-red-600 hover:bg-red-50 text-sm font-bold rounded-lg transition-all flex items-center gap-2">
                    <X className="w-4 h-4" /> Tolak Revisi
                  </button>
                )}
              </div>

              {!isRejecting && (
                <button
                  onClick={() => onApprove(draft, finalPayload)}
                  disabled={loadingOld || isSubmitting}
                  className="px-8 py-2.5 bg-daw-green hover:bg-[#003b1c] disabled:opacity-50 text-white text-sm font-bold rounded-lg transition-all flex items-center gap-2 shadow-md">
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Memproses...
                    </>
                  ) : (
                    <>
                      <Check className="w-5 h-5" />
                      Setujui & Sinkronkan
                    </>
                  )}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// Helper: Format Waktu Relatif (Contoh: "2 jam yang lalu")
const timeAgo = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return "Baru saja";
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes} menit yang lalu`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours} jam yang lalu`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return `${diffInDays} hari yang lalu`;

  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

// Helper: Ekstraksi Inisial untuk Avatar (Misal: "bcs.dev" -> "BD")
const getInitials = (name: string) => {
  if (!name) return "U";
  const parts = name.split(/[\s.]+/); // Split by space or dot
  if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
};

// MAIN COMPONENT: APPROVAL CENTER
export default function ApprovalCenter() {
  const { can, user } = useAuth();
  const [drafts, setDrafts] = useState<ApprovalDraft[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDraft, setSelectedDraft] = useState<ApprovalDraft | null>(
    null,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isSuperadmin = user?.role === "superadmin" || user?.role === "admin";

  const fetchApprovals = async () => {
    setIsLoading(true);
    try {
      const response = await api.get("/approval/list");
      console.log(
        ">>> [DEBUG FRONTEND] Raw Drafts from Server:",
        response.data,
      );
      const data = response.data;
      setDrafts(Array.isArray(data) ? data : []);
    } catch {
      setDrafts([]);
      toast.error("Gagal menarik data antrean dari server DAW.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (can("manage_approvals")) {
      fetchApprovals();
    }
  }, [can]);

  const handleApprove = async (draft: ApprovalDraft, finalPayload: any) => {
    // Validasi esensial ERP RPP
    if (!draft.nourut || !draft.kodeapp) {
      return toast.error(
        "Identitas baris ERP (nourut/kodeapp) hilang. Coba refresh antrean.",
      );
    }

    setIsSubmitting(true);
    const toastId = toast.loading(
      "Mengeksekusi persetujuan & sinkronisasi server ERP...",
    );

    try {
      await api.post("/approval/decide", {
        status: "1",
        notrans: draft.notrans,
        kodeapp: draft.kodeapp,
        level: draft.level,
        nextApp: draft.nextApp,
        jenisApp: draft.jenispersetujuan,
        nourut: draft.nourut,

        module: draft.module_name,
        targetId: draft.target_id,
        payload: finalPayload,
        action: draft.action,
      });

      toast.success(`Draf ${draft.module_name} berhasil disetujui!`, {
        id: toastId,
      });

      setSelectedDraft(null);
      fetchApprovals();
    } catch (error: any) {
      toast.error("Eksekusi gagal", {
        description:
          error.response?.data?.message || "Kesalahan internal server.",
        id: toastId,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async (draft: ApprovalDraft, reason: string) => {
    if (!reason.trim() || reason.length < 5) {
      return toast.error("Wajib isi alasan penolakan yang jelas.");
    }

    setIsSubmitting(true);
    const toastId = toast.loading("Mengirim keputusan penolakan...");

    try {
      await api.post("/approval/decide", {
        status: "2",
        notrans: draft.notrans,
        kodeapp: draft.kodeapp,
        level: draft.level,
        komentar: reason,
        nextApp: "",
        jenisApp: draft.jenispersetujuan,
        nourut: draft.nourut,

        module: draft.module_name,
        targetId: draft.target_id,
        action: draft.action,
      });
      toast.success("Revisi ditolak. Data telah dikembalikan ke Editor.", {
        id: toastId,
      });

      setSelectedDraft(null);
      fetchApprovals();
    } catch (err: any) {
      toast.error("Gagal mengirim penolakan", {
        description: err.response?.data?.message || "Kesalahan internal.",
        id: toastId,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!can("manage_approvals")) {
    return (
      <div className="p-8 flex flex-col items-center justify-center text-red-500 min-h-[50vh]">
        <ShieldAlert className="w-16 h-16 mb-4 opacity-50" />
        <h2 className="text-xl font-black uppercase tracking-widest">
          Akses Terlarang
        </h2>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-500 max-w-6xl mx-auto space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm top-0 z-20">
        <div className="absolute top-0 right-0 w-32 h-32 bg-daw-green/5 rounded-bl-full -z-0"></div>
        <div className="z-10">
          <h1 className="text-2xl font-serif font-black text-slate-900 flex items-center gap-3">
            Approval Center
            <span className="bg-daw-green/10 text-daw-green text-xs px-2.5 py-1 rounded-md font-sans border border-daw-green/20">
              {drafts.length} Menunggu
            </span>
          </h1>
          <p className="text-sm text-slate-500 mt-1.5 font-medium">
            {isSuperadmin
              ? "Mode Pemantau Aktif."
              : "Tinjau dan eksekusi revisi."}
          </p>
        </div>
        <button
          onClick={fetchApprovals}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-white border border-slate-200 text-slate-700 hover:border-daw-green hover:bg-daw-green/5 hover:text-daw-green text-sm font-bold rounded-xl transition-all shadow-sm active:scale-95 group-hover:shadow-md ring-1 ring-transparent hover:ring-daw-green/20">
          <Clock
            className={`w-4 h-4 ${isLoading ? "animate-spin text-daw-green" : ""}`}
          />
          Refresh
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        {isLoading ? (
          // SKELETON LOADER STATE
          <div className="p-6">
            <div className="animate-pulse space-y-6">
              <div className="h-4 bg-slate-100 rounded w-1/4 mb-8"></div>
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                  <div className="flex gap-4 items-center w-1/3">
                    <div className="w-20 h-8 bg-slate-100 rounded-md"></div>
                    <div className="w-24 h-3 bg-slate-100 rounded"></div>
                  </div>
                  <div className="flex gap-3 items-center w-1/3">
                    <div className="w-8 h-8 bg-slate-100 rounded-lg"></div>
                    <div className="space-y-2">
                      <div className="w-20 h-4 bg-slate-100 rounded"></div>
                      <div className="w-32 h-3 bg-slate-100 rounded"></div>
                    </div>
                  </div>
                  <div className="w-24 h-10 bg-slate-100 rounded-xl"></div>
                </div>
              ))}
            </div>
          </div>
        ) : drafts.length === 0 ? (
          <div className="p-24 text-center flex flex-col items-center">
            <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mb-5 ring-8 ring-green-50/50">
              <Check className="w-10 h-10 text-daw-green" />
            </div>
            <h3 className="text-xl font-black text-slate-800">
              Antrean Bersih!
            </h3>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl">
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[10px] uppercase tracking-widest font-black text-slate-500">
                  <th className="px-6 py-4 rounded-tl-xl">
                    Detail Tiket & Waktu
                  </th>
                  <th className="px-6 py-4">Konteks Modul</th>
                  <th className="px-6 py-4">Diajukan Oleh</th>
                  <th className="px-6 py-4 text-right rounded-tr-xl">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/80">
                {drafts.map((draft) => {
                  const draftDate = new Date(draft.createdAt);
                  const isAged =
                    new Date().getTime() - draftDate.getTime() >
                    3 * 24 * 60 * 60 * 1000;

                  return (
                    <tr
                      key={draft.notrans}
                      className="hover:bg-slate-50 transition-colors group">
                      {/* KOLOM 1: TIKET & STATUS DINAMIS (The Gatekeeper UI) */}
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-bold text-slate-700 bg-slate-100/80 ring-1 ring-slate-200/50 px-2.5 py-1 rounded-md shadow-sm">
                              {draft.notrans}
                            </span>

                            {/* Indikator Level */}
                            {draft.level && (
                              <span className="text-[9px] font-black bg-blue-50 text-blue-600 px-2 py-0.5 rounded border border-blue-100">
                                LVL {draft.level}
                              </span>
                            )}

                            {draft.rejection_reason && (
                              <span className="inline-flex items-center gap-1 text-[9px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-black border border-amber-200 animate-pulse">
                                <RotateCcw className="w-2.5 h-2.5" />{" "}
                                RESUBMISSION
                              </span>
                            )}

                            {isAged && (
                              <span
                                title="Draf ini sudah tertunda lebih dari 3 hari"
                                className="flex h-2 w-2 relative">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                              </span>
                            )}
                          </div>

                          <div
                            className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500"
                            title={draftDate.toLocaleString("id-ID")}>
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            {timeAgo(draft.createdAt)}
                          </div>

                          {/* 🔥 VISUAL STATE MAPPING (Pembeda Lvl 1 & Lvl 2) */}
                          <div className="mt-1">
                            {draft.isMyQueue ? (
                              // STATUS 0: Lampu Hijau
                              <div className="flex items-center gap-1.5 text-[9px] font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded border border-emerald-100 w-fit shadow-sm">
                                <Check className="w-3 h-3" />
                                TUGAS ANDA SEKARANG
                              </div>
                            ) : draft.owlStatus === "9" ? (
                              // STATUS 9: Lampu Kuning (Waiting)
                              <div className="flex items-center gap-1.5 text-[9px] font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded border border-amber-100 w-fit">
                                <Clock className="w-3 h-3" />
                                MENUNGGU LEVEL SEBELUMNYA
                              </div>
                            ) : draft.owlStatus === "1" ||
                              draft.owlStatus === "2" ? (
                              // STATUS 1/2: Lampu Biru (Done)
                              <div className="flex items-center gap-1.5 text-[9px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded border border-blue-100 w-fit">
                                <FileText className="w-3 h-3" />
                                SUDAH ANDA PROSES
                              </div>
                            ) : (
                              // FALLBACK: Untuk Admin atau tiket yang belum di-inject ke OWL
                              <div className="text-[9px] font-bold text-slate-400 italic">
                                {user?.role === "superadmin"
                                  ? "Sedang menunggu approver..."
                                  : "Dalam antrean pihak lain..."}
                              </div>
                            )}
                          </div>

                          {draft.rejection_reason && (
                            <p
                              className="text-[10px] text-amber-600 italic font-medium line-clamp-1 max-w-[200px] mt-1"
                              title={draft.rejection_reason}>
                              Note: "{draft.rejection_reason}"
                            </p>
                          )}
                        </div>
                      </td>

                      {/* KOLOM 2: MODUL & TINDAKAN */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <span
                            className={`flex items-center justify-center w-8 h-8 rounded-lg border shadow-sm ${
                              draft.action === "CREATE"
                                ? "bg-green-50 border-green-100 text-green-600"
                                : draft.action === "DELETE"
                                  ? "bg-red-50 border-red-100 text-red-600"
                                  : "bg-amber-50 border-amber-100 text-amber-600"
                            }`}>
                            {draft.action === "CREATE" ? (
                              <div className="font-black text-lg">+</div>
                            ) : draft.action === "DELETE" ? (
                              <X className="w-4 h-4" />
                            ) : (
                              <FileText className="w-4 h-4" />
                            )}
                          </span>
                          <div>
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wider bg-slate-100 text-slate-600 border border-slate-200/60 uppercase">
                              {draft.module_name}
                            </span>
                            <p className="text-xs font-bold text-slate-800 mt-1 uppercase tracking-wide">
                              {draft.action}{" "}
                              <span className="text-slate-400 font-mono font-medium normal-case">
                                #{draft.target_id.slice(0, 8)}...
                              </span>
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* KOLOM 3: SUBMITTER */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-daw-green to-emerald-600 flex items-center justify-center text-white text-[10px] font-bold shadow-sm ring-2 ring-white">
                            {getInitials(draft.created_by)}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-slate-700">
                              {draft.created_by || "Editor Unknown"}
                            </span>
                            <span className="text-[10px] text-slate-400 font-medium">
                              Divisi Konten
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* KOLOM 4: TOMBOL AKSI DINAMIS */}
                      <td className="px-6 py-4 text-right">
                        {draft.isMyQueue ? (
                          <button
                            onClick={() => setSelectedDraft(draft)}
                            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-daw-green text-white hover:bg-[#003b1c] text-sm font-bold rounded-xl transition-all shadow-md active:scale-95 group-hover:scale-105 ring-1 ring-transparent hover:ring-emerald-200">
                            <Check className="w-4 h-4" />
                            <span>Eksekusi</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => setSelectedDraft(draft)}
                            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-white border border-slate-200 text-slate-400 hover:text-slate-700 text-sm font-bold rounded-xl transition-all shadow-sm active:scale-95">
                            <Eye className="w-4 h-4" />
                            <span>Pantau Revisi</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedDraft && (
        <DiffModal
          draft={selectedDraft}
          isReadOnly={!selectedDraft.isMyQueue}
          onClose={() => setSelectedDraft(null)}
          onApprove={handleApprove}
          onReject={handleReject}
          isSubmitting={isSubmitting}
        />
      )}
    </div>
  );
}
