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
  ShieldAlert,
  LayoutTemplate,
  Code2,
  RotateCcw,
  Search,
  ChevronRight,
  AlertTriangle,
  ChevronLeft,
} from "lucide-react";
import api from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import ReactDiffViewer, { DiffMethod } from "react-diff-viewer-continued";
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
  _isGhost?: boolean;
}

// Helper: Memburu semua value gambar
const extractImagesFromPayload = (
  obj: any,
  images: string[] = [],
  depth: number = 0,
): string[] => {
  if (depth > 5) return images;
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
      extractImagesFromPayload(val, images, depth + 1);
    }
  });
  return [...new Set(images)];
};

const isHtmlString = (str: any): boolean => {
  if (typeof str !== "string") return false;
  return /<[a-z][\s\S]*>/i.test(str);
};

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

// Memisahkan Meta Data dan HTML secara Dinamis
const separateDataTypes = (sanitizedData: any) => {
  const meta: Record<string, any> = {};
  const html: Record<string, string> = {};

  Object.entries(sanitizedData).forEach(([key, value]) => {
    if (isHtmlString(value)) {
      html[key] = value as string;
    } else {
      meta[key] = value;
    }
  });

  return { meta, html };
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
  onApprove: (draft: ApprovalDraft) => void;
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

  const displayPayload = draft.payload;
  const previewImages = extractImagesFromPayload(displayPayload);

  // --- PEMISAHAN DATA: METADATA VS HTML CONTENT ---
  const { oldMeta, newMeta, oldHtml, newHtml } = useMemo(() => {
    const safeOldData = sanitizeForDiff(oldData);
    const safeNewData = sanitizeForDiff(displayPayload);

    const { meta: oMeta, html: oHtml } = separateDataTypes(safeOldData);
    const { meta: nMeta, html: nHtml } = separateDataTypes(safeNewData);

    return { oldMeta: oMeta, newMeta: nMeta, oldHtml: oHtml, newHtml: nHtml };
  }, [oldData, displayPayload]);

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
                newValue={JSON.stringify(
                  sanitizeForDiff(displayPayload),
                  null,
                  2,
                )}
                splitView={true}
                compareMethod={DiffMethod.WORDS}
                leftTitle="Versi Produksi"
                rightTitle="Usulan Draf"
              />
            </div>
          ) : (
            <div className="space-y-6">
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
                        {/* Render using the payload from the draft object */}
                        <PreviewComponent data={displayPayload} />
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

              {/* Optional: Add HTML Diff Table here if newHtml/oldHtml have keys */}
              {(Object.keys(oldHtml).length > 0 ||
                Object.keys(newHtml).length > 0) && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mt-6">
                  <div className="bg-slate-50 px-4 py-2 text-[10px] font-black text-slate-400 uppercase">
                    Rich Text (HTML) Analysis
                  </div>
                  <ReactDiffViewer
                    oldValue={JSON.stringify(oldHtml, null, 2)}
                    newValue={JSON.stringify(newHtml, null, 2)}
                    splitView={true}
                  />
                </div>
              )}
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
                  // 👈 UBAH INI: Hanya mengirim draft object.
                  onClick={() => onApprove(draft)}
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

const getInitials = (name: string) => {
  const cleanName = name?.trim();
  if (!cleanName) return "U";

  const parts = cleanName.split(/[\s.]+/);

  if (parts.length > 1 && parts[1].length > 0) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  return cleanName.substring(0, 2).toUpperCase();
};

// MAIN COMPONENT: APPROVAL CENTER
export default function ApprovalCenter() {
  const { can, user } = useAuth();
  const isSuperadmin = user?.role === "superadmin" || user?.role === "admin";

  // 1. SYSTEM STATES (Data Fetching & Modals)
  const [drafts, setDrafts] = useState<ApprovalDraft[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDraft, setSelectedDraft] = useState<ApprovalDraft | null>(
    null,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 2. ENGINE STATES (Search, Filter, Pagination)
  const [activeTab, setActiveTab] = useState<"my_queue" | "history" | "all">(
    "all",
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10; // 👈 Limit client-side per halaman

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchQuery]);

  // 3. API FETCHING
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 4. ACTION HANDLERS (Secure Execution)
  const handleApprove = async (draft: ApprovalDraft) => {
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
        action: draft.action,
      });

      toast.success(`Draf ${draft.module_name} berhasil disetujui!`, {
        id: toastId,
      });
      setSelectedDraft(null);
      fetchApprovals(); // Refresh antrean setelah sukses
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

  // 5. DERIVED DATA PIPELINE (The Heart of the Engine)
  // Memproses data berdasarkan filter, search, dan pagination secara efisien (O(n)).
  const { filteredDrafts, paginatedDrafts, totalPages } = useMemo(() => {
    // Filter by Active Tab
    let result = drafts.filter((d) => {
      if (activeTab === "my_queue") return d.isMyQueue;
      if (activeTab === "history")
        return d.owlStatus === "1" || d.owlStatus === "2";
      if (activeTab === "all" && isSuperadmin) return true;
      return d.isMyQueue; // Fallback aman
    });

    // Filter by Search Query
    if (searchQuery.trim()) {
      const lowerQuery = searchQuery.toLowerCase();
      result = result.filter(
        (d) =>
          d.notrans.toLowerCase().includes(lowerQuery) ||
          d.module_name.toLowerCase().includes(lowerQuery) ||
          (d.created_by && d.created_by.toLowerCase().includes(lowerQuery)),
      );
    }

    // Hitung Metrik Paginasi
    const total = Math.ceil(result.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const slicedData = result.slice(startIndex, startIndex + itemsPerPage);

    return {
      filteredDrafts: result, // Berguna jika mau liat total badge (e.g., "Menunggu: 12")
      paginatedDrafts: slicedData, // Array yang akan di-render di tabel (Maks 10)
      totalPages: total > 0 ? total : 1, // Mencegah UI Pagination jadi "Page 1 of 0"
    };
  }, [drafts, activeTab, searchQuery, currentPage, isSuperadmin]);

  // 6. EARLY RETURN (Auth Gate)
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
      {/* --- HEADER SECTION --- */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm top-0 z-20">
        <div className="absolute top-0 right-0 w-32 h-32 bg-daw-green/5 rounded-bl-full -z-0 pointer-events-none"></div>
        <div className="z-10">
          <h1 className="text-2xl font-serif font-black text-slate-900 flex items-center gap-3">
            Approval Center
            <span className="bg-daw-green/10 text-daw-green text-xs px-2.5 py-1 rounded-md font-sans border border-daw-green/20">
              {filteredDrafts.length} Menunggu
            </span>
          </h1>
          <p className="text-sm text-slate-500 mt-1.5 font-medium">
            {isSuperadmin
              ? "Mode Pemantau Aktif."
              : "Tinjau dan eksekusi revisi."}
          </p>
        </div>

        {/* ACTION BAR: Search & Refresh */}
        <div className="flex items-center gap-3 w-full sm:w-auto z-10">
          <div className="relative w-full sm:w-64">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-slate-400" />
            </div>
            <input
              type="text"
              placeholder="Cari tiket, modul, editor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daw-green/20 focus:border-daw-green/50 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <button
            onClick={fetchApprovals}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 hover:border-daw-green hover:bg-daw-green/5 hover:text-daw-green text-sm font-bold rounded-xl transition-all shadow-sm active:scale-95 group-hover:shadow-md ring-1 ring-transparent hover:ring-daw-green/20 shrink-0">
            <Clock
              className={`w-4 h-4 ${isLoading ? "animate-spin text-daw-green" : ""}`}
            />
            Refresh
          </button>
        </div>
      </div>

      {/* --- TAB NAVIGATION --- */}
      <div className="flex space-x-1 bg-slate-100/50 p-1 rounded-lg border border-slate-200 w-fit">
        <button
          onClick={() => setActiveTab("my_queue")}
          className={`px-4 py-2 text-sm font-bold rounded-md transition-all ${
            activeTab === "my_queue"
              ? "bg-white text-daw-green shadow-sm ring-1 ring-slate-200"
              : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
          }`}>
          Tugas Anda
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`px-4 py-2 text-sm font-bold rounded-md transition-all ${
            activeTab === "history"
              ? "bg-white text-daw-green shadow-sm ring-1 ring-slate-200"
              : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
          }`}>
          Riwayat Diproses
        </button>
        {isSuperadmin && (
          <button
            onClick={() => setActiveTab("all")}
            className={`px-4 py-2 text-sm font-bold rounded-md transition-all ${
              activeTab === "all"
                ? "bg-white text-daw-green shadow-sm ring-1 ring-slate-200"
                : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
            }`}>
            Semua Tiket
          </button>
        )}
      </div>

      {/* --- DATA TABLE --- */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col min-h-[400px]">
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
        ) : paginatedDrafts.length === 0 ? (
          // EMPTY STATE (Handles both truly empty and "no search results")
          <div className="p-24 text-center flex flex-col items-center flex-1 justify-center">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-5 ring-8 ring-slate-50/50 border border-slate-100">
              {searchQuery ? (
                <Search className="w-8 h-8 text-slate-400" />
              ) : (
                <Check className="w-10 h-10 text-daw-green" />
              )}
            </div>
            <h3 className="text-xl font-black text-slate-800">
              {searchQuery ? "Tidak Ada Hasil" : "Antrean Bersih!"}
            </h3>
            <p className="text-sm text-slate-500 mt-2">
              {searchQuery
                ? `Tidak ada tiket yang cocok dengan "${searchQuery}"`
                : "Tidak ada data yang perlu diproses saat ini."}
            </p>
          </div>
        ) : (
          // MAIN TABLE
          <div className="overflow-x-auto rounded-t-xl flex-1">
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
                {/* 👈 UBAH INI: Iterate over paginatedDrafts, NOT drafts */}
                {paginatedDrafts.map((draft) => {
                  const draftDate = new Date(draft.createdAt || Date.now());
                  const isAged =
                    new Date().getTime() - draftDate.getTime() >
                    3 * 24 * 60 * 60 * 1000;
                  const isGhost = draft._isGhost; // 👈 Check if it's a deleted local draft

                  return (
                    <tr
                      key={draft.notrans}
                      className={`transition-colors group ${isGhost ? "bg-red-50/30" : "hover:bg-slate-50"}`}>
                      {/* KOLOM 1: TIKET & STATUS */}
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-2">
                            <span
                              className={`font-mono text-sm font-bold px-2.5 py-1 rounded-md shadow-sm ring-1 ${isGhost ? "text-red-700 bg-red-100/80 ring-red-200/50" : "text-slate-700 bg-slate-100/80 ring-slate-200/50"}`}>
                              {draft.notrans}
                            </span>

                            {draft.level && !isGhost && (
                              <span className="text-[9px] font-black bg-blue-50 text-blue-600 px-2 py-0.5 rounded border border-blue-100">
                                LVL {draft.level}
                              </span>
                            )}

                            {isGhost && (
                              <span className="text-[9px] font-black bg-red-100 text-red-600 px-2 py-0.5 rounded border border-red-200 flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" /> YATIM
                                PIATU
                              </span>
                            )}

                            {draft.rejection_reason && !isGhost && (
                              <span className="inline-flex items-center gap-1 text-[9px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-black border border-amber-200 animate-pulse">
                                <RotateCcw className="w-2.5 h-2.5" />{" "}
                                RESUBMISSION
                              </span>
                            )}

                            {isAged && !isGhost && (
                              <span
                                title="Draf ini sudah tertunda lebih dari 3 hari"
                                className="flex h-2 w-2 relative">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                              </span>
                            )}
                          </div>

                          <div
                            className={`flex items-center gap-1.5 text-[11px] font-medium ${isGhost ? "text-red-400" : "text-slate-500"}`}
                            title={draftDate.toLocaleString("id-ID")}>
                            <Clock
                              className={`w-3.5 h-3.5 ${isGhost ? "text-red-300" : "text-slate-400"}`}
                            />
                            {isGhost
                              ? "Waktu Pengajuan Hilang"
                              : timeAgo(draft.createdAt)}
                          </div>

                          {/* VISUAL STATE MAPPING */}
                          <div className="mt-1">
                            {isGhost ? (
                              <div className="flex items-center gap-1.5 text-[9px] font-black text-red-600 bg-red-50 px-2 py-1 rounded border border-red-100 w-fit shadow-sm">
                                <ShieldAlert className="w-3 h-3" />
                                DRAF LOKAL TERHAPUS
                              </div>
                            ) : draft.isMyQueue ? (
                              <div className="flex items-center gap-1.5 text-[9px] font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded border border-emerald-100 w-fit shadow-sm">
                                <Check className="w-3 h-3" />
                                TUGAS ANDA SEKARANG
                              </div>
                            ) : draft.owlStatus === "9" ? (
                              <div className="flex items-center gap-1.5 text-[9px] font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded border border-amber-100 w-fit">
                                <Clock className="w-3 h-3" />
                                MENUNGGU LEVEL SEBELUMNYA
                              </div>
                            ) : draft.owlStatus === "1" ||
                              draft.owlStatus === "2" ? (
                              <div className="flex items-center gap-1.5 text-[9px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded border border-blue-100 w-fit">
                                <FileText className="w-3 h-3" />
                                SUDAH ANDA PROSES
                              </div>
                            ) : (
                              <div className="text-[9px] font-bold text-slate-400 italic">
                                {isSuperadmin
                                  ? "Sedang menunggu approver..."
                                  : "Dalam antrean pihak lain..."}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* KOLOM 2: MODUL & TINDAKAN */}
                      <td className="px-6 py-4">
                        <div
                          className={`flex items-center gap-3 ${isGhost ? "opacity-50" : ""}`}>
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
                              {draft.target_id && (
                                <span className="text-slate-400 font-mono font-medium normal-case">
                                  #{draft.target_id.slice(0, 8)}...
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* KOLOM 3: SUBMITTER */}
                      <td className="px-6 py-4">
                        <div
                          className={`flex items-center gap-3 ${isGhost ? "opacity-50" : ""}`}>
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-bold shadow-sm ring-2 ring-white ${isGhost ? "bg-slate-300" : "bg-gradient-to-br from-daw-green to-emerald-600"}`}>
                            {isGhost ? "?" : getInitials(draft.created_by)}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-slate-700">
                              {isGhost
                                ? "Sistem"
                                : draft.created_by || "Editor Unknown"}
                            </span>
                            <span className="text-[10px] text-slate-400 font-medium">
                              Divisi Konten
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* KOLOM 4: TOMBOL AKSI DINAMIS */}
                      <td className="px-6 py-4 text-right">
                        {isGhost ? (
                          <button
                            onClick={() =>
                              handleReject(
                                draft,
                                "Force Reject: Draf lokal tidak ditemukan.",
                              )
                            }
                            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 text-sm font-bold rounded-xl transition-all shadow-sm active:scale-95">
                            <RotateCcw className="w-4 h-4" />
                            <span>Force Reject</span>
                          </button>
                        ) : draft.isMyQueue ? (
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

        {/* --- PAGINATION CONTROLS --- */}
        {!isLoading && filteredDrafts.length > 0 && (
          <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between mt-auto">
            <p className="text-xs font-medium text-slate-500">
              Menampilkan{" "}
              <span className="font-bold text-slate-700">
                {(currentPage - 1) * 10 + 1}
              </span>{" "}
              hingga{" "}
              <span className="font-bold text-slate-700">
                {Math.min(currentPage * 10, filteredDrafts.length)}
              </span>{" "}
              dari{" "}
              <span className="font-bold text-slate-700">
                {filteredDrafts.length}
              </span>{" "}
              tiket
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                  (page) => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                        currentPage === page
                          ? "bg-daw-green text-white shadow-sm"
                          : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}>
                      {page}
                    </button>
                  ),
                )}
              </div>
              <button
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {selectedDraft && !selectedDraft._isGhost && (
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
