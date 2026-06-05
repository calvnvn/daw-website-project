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
  Search,
  ChevronRight,
  AlertTriangle,
  ChevronLeft,
  Trash2,
  PenTool,
  Globe,
  Sparkles,
} from "lucide-react";
import api from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import ReactDiffViewer, { DiffMethod } from "react-diff-viewer-continued";
import PREVIEW_REGISTRY from "./ModuleRegistry";
import { getErrorMessage } from "@/lib/utils";

export interface ApprovalDraft {
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
  current_level?: number;
  approver_roadmap?: string | any[];
}

const isHtmlString = (str: any): boolean => {
  if (typeof str !== "string") return false;
  return /<[a-z][\s\S]*>/i.test(str);
};

const sanitizeForDiff = (data: any) => {
  if (!data || typeof data !== "object") return {};
  const cleanData = { ...data };

  const systemFields = [
    "id",
    "createdAt",
    "updatedAt",
    "is_locked",
    "lock_ticket",
    "_system_note",
    "_filesToDelete",
  ];

  systemFields.forEach((key) => delete cleanData[key]);

  // Flatten manual translations for word-level diffing
  if (cleanData._translations && typeof cleanData._translations === "object") {
    if (cleanData._translations.id) {
      for (const [key, val] of Object.entries(cleanData._translations.id)) {
        cleanData[`terjemahan_id_${key}`] = val;
      }
    } else {
      for (const [recKey, fields] of Object.entries(cleanData._translations)) {
        if (fields && typeof fields === "object") {
          for (const [fKey, val] of Object.entries(fields)) {
            cleanData[`terjemahan_${recKey}_${fKey}`] = val;
          }
        }
      }
    }
  }
  delete cleanData._translations;

  return cleanData;
};

// COMPONENT: APPROVAL TRACKER (SISTEM PANTAU)
const ApprovalTracker = ({ draft }: { draft: ApprovalDraft }) => {
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
      <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
        <Clock className="w-4 h-4" /> Sistem Pantau (Jejak Persetujuan)
      </h3>
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
          };

          if (draft.status === "Rejected" && stepLevel === currentLevel) {
            statusConfig = {
              color: "text-rose-600",
              bg: "bg-rose-50 border-rose-200",
              icon: <X className="w-4 h-4" />,
              label: "Ditolak (Berhenti Di Sini)",
            };
          } else if (stepLevel < currentLevel || draft.status === "Approved") {
            statusConfig = {
              color: "text-daw-green",
              bg: "bg-emerald-50 border-emerald-200",
              icon: <Check className="w-4 h-4" />,
              label: "Telah Disetujui",
            };
          } else if (stepLevel === currentLevel && draft.status === "Pending") {
            statusConfig = {
              color: "text-blue-600",
              bg: "bg-blue-50 border-blue-200 ring-2 ring-blue-500/20",
              icon: <Loader2 className="w-4 h-4 animate-spin" />,
              label: "Posisi Saat Ini",
            };
          }

          return (
            <div key={index} className="flex-1 flex flex-col relative z-10">
              <div className="flex flex-row sm:flex-col items-center gap-3 sm:gap-2">
                <div
                  className={`w-8 h-8 rounded-full border flex items-center justify-center shrink-0 shadow-sm transition-all ${statusConfig.bg} ${statusConfig.color}`}>
                  {statusConfig.icon}
                </div>
                <div className="flex flex-col sm:items-center text-left sm:text-center">
                  <p className="text-[10px] font-black uppercase text-slate-400">
                    Level {stepLevel}
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

  // 🚀 FITUR BARU: Layout Controller untuk mencegah layout terpotong
  const [previewLayout, setPreviewLayout] = useState<"split" | "stacked">(
    "split",
  );

  const minRejectChars = 5;

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
      } catch (error: unknown) {
        if (
          !(
            typeof error === "object" &&
            error !== null &&
            "name" in error &&
            (error as { name?: string }).name === "CanceledError"
          )
        ) {
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

  // CHANGE HIGHLIGHT LOGIC
  const changedFields = useMemo(() => {
    if (!oldData || draft.action !== "UPDATE") return [];
    const safeOld = sanitizeForDiff(oldData);
    const safeNew = sanitizeForDiff(displayPayload || {});
    const changes: string[] = [];

    const allKeys = new Set([...Object.keys(safeOld), ...Object.keys(safeNew)]);
    allKeys.forEach((key) => {
      if (JSON.stringify(safeOld[key]) !== JSON.stringify(safeNew[key])) {
        changes.push(key);
      }
    });
    return changes;
  }, [oldData, displayPayload, draft.action]);

  const isBrandNewData = draft.action === "CREATE";
  const isDeleteAction = draft.action === "DELETE";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 lg:p-6 bg-slate-900/80  animate-in fade-in duration-200 whitespace-normal break-words text-left">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-7xl max-h-[95vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200">
        {/* HEADER MODAL */}
        <div className="px-6 py-4 lg:px-8 lg:py-5 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50 shrink-0">
          <div>
            <h2 className="text-lg lg:text-xl font-black text-slate-900 flex items-center gap-2 tracking-tight">
              <FileText className="w-5 h-5 lg:w-6 lg:h-6 text-daw-green" />
              Detail Draf: {draft.module_name}
            </h2>
            <div className="flex items-center gap-2 mt-1.5 lg:mt-2">
              <span
                className={`px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-widest text-white shadow-sm
                ${isBrandNewData ? "bg-emerald-500" : isDeleteAction ? "bg-rose-500" : "bg-blue-500"}`}>
                {draft.action}
              </span>
              <span className="text-[11px] lg:text-xs text-slate-500 font-mono">
                Tiket: <strong>{draft.notrans}</strong>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4 w-full sm:w-auto">
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="p-2.5 bg-white hover:bg-red-50 hover:text-red-600 border border-slate-200 rounded-xl transition-all shadow-sm disabled:opacity-50">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* APPROVAL TRACKER (PANTAU) */}
        {draft.status !== "Orphaned" && (
          <ApprovalTracker draft={draft} />
        )}

        {/* INSIGHT BANNER */}
        {!loadingOld && changedFields.length > 0 && (
          <div className="bg-amber-50/80 border-b border-amber-100 px-6 lg:px-8 py-3 shrink-0 flex items-center gap-3 overflow-x-auto custom-scrollbar">
            <Sparkles className="w-4 h-4 text-amber-500 animate-pulse shrink-0" />
            <span className="text-xs font-bold text-amber-800 shrink-0">
              Perubahan Data Terdeteksi:
            </span>
            <div className="flex gap-1.5 flex-nowrap">
              {changedFields.map((field) => (
                <span
                  key={field}
                  className="px-2 py-0.5 bg-amber-200/50 text-amber-700 border border-amber-300 rounded text-[10px] font-bold font-mono shadow-sm whitespace-nowrap">
                  {field.replace(/_/g, " ")}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* BODY KONTEN */}
        <div className="flex-1 overflow-y-auto bg-slate-100/50 p-4 lg:p-6 relative custom-scrollbar">
          {(draft.status === "Approved" || draft.status === "Rejected") && (
            <div className="mb-6 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center justify-center text-center">
              <Check className="w-10 h-10 text-daw-green mb-2" />
              <h3 className="font-bold text-slate-800">
                Tiket Ini Sudah Diselesaikan ({draft.status})
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Data dan visualisasi di bawah ini hanya untuk keperluan arsip
                atau melihat riwayat.
              </p>
            </div>
          )}
          {loadingOld ? (
            <div className="absolute inset-0 bg-white/70 z-10 flex flex-col items-center justify-center ">
              <Loader2 className="w-10 h-10 animate-spin text-daw-green mb-3" />
              <p className="text-sm font-bold text-slate-600 tracking-wide">
                Mengambil data dari server...
              </p>
            </div>
          ) : (
            // VISUAL & META TAB
            <div className="space-y-8">
              {(() => {
                const PreviewComponent = PREVIEW_REGISTRY[draft.module_name];
                if (!PreviewComponent)
                  return (
                    <div className="p-6 bg-amber-50 text-amber-700 border border-amber-200 rounded-2xl text-sm font-bold text-center flex flex-col items-center gap-2">
                      <LayoutTemplate className="w-8 h-8 opacity-50" />
                      Modul "{draft.module_name}" tidak memiliki Visual
                      Registry. Gunakan tab "Raw JSON".
                    </div>
                  );

                return (
                  <div className="space-y-3">
                    {/* LAYOUT CONTROLLER */}
                    <div className="flex justify-end">
                      <div className="flex bg-white border border-slate-200 rounded-lg p-1 shadow-sm">
                        <button
                          onClick={() => setPreviewLayout("split")}
                          className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${previewLayout === "split" ? "bg-slate-900 text-white shadow" : "text-slate-500 hover:bg-slate-50"}`}>
                          Kiri Kanan (Side-by-Side)
                        </button>
                        <button
                          onClick={() => setPreviewLayout("stacked")}
                          className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${previewLayout === "stacked" ? "bg-slate-900 text-white shadow" : "text-slate-500 hover:bg-slate-50"}`}>
                          Atas Bawah (Stacked)
                        </button>
                      </div>
                    </div>

                    {/* 🚀 THE RESPONSIVE DIFF CANVAS (Strict 50/50 Grid) */}
                    <div className="w-full overflow-x-auto custom-scrollbar pb-2 rounded-3xl">
                      <div
                        className={`bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden 
                        ${previewLayout === "split" ? "grid grid-cols-2 min-w-[1200px] divide-x divide-slate-200" : "flex flex-col divide-y divide-slate-200"}`}>
                        {/* LEFT PANEL: LIVE VERSION */}
                        <div className="bg-slate-50/50 flex flex-col w-full overflow-hidden">
                          <div className="px-6 py-3 bg-slate-100 border-b border-slate-200 flex items-center justify-between sticky top-0 z-10 shadow-sm shrink-0">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                              Data Saat Ini (Live Website)
                            </span>
                            {!isBrandNewData && (
                              <Globe className="w-3 h-3 text-slate-400" />
                            )}
                          </div>
                          <div className="p-6 flex-1 opacity-70 hover:opacity-100 transition-opacity overflow-hidden">
                            {!isBrandNewData &&
                            oldData &&
                            !oldData._system_note ? (
                              <div className="pointer-events-none select-none w-full">
                                <PreviewComponent data={oldData} />
                              </div>
                            ) : (
                              <div className="h-full min-h-[300px] flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 text-xs bg-white w-full">
                                <Check className="w-8 h-8 mb-3 text-emerald-300" />
                                {isBrandNewData
                                  ? "Area Kosong (Data Baru)"
                                  : "Data Live tidak ditemukan"}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* RIGHT PANEL: PROPOSED DRAFT */}
                        <div className="bg-white flex flex-col w-full overflow-hidden">
                          <div
                            className={`px-6 py-3 border-b flex items-center justify-between sticky top-0 z-10 shadow-sm shrink-0 ${isDeleteAction ? "bg-rose-100 border-rose-200" : "bg-blue-50 border-blue-100"}`}>
                            <span
                              className={`text-[10px] font-black uppercase tracking-widest ${isDeleteAction ? "text-rose-700" : "text-blue-700"}`}>
                              {isDeleteAction
                                ? "Permintaan Hapus Data"
                                : "Perubahan yang Diajukan"}
                            </span>
                            {isDeleteAction ? (
                              <Trash2 className="w-3 h-3 text-rose-500" />
                            ) : (
                              <PenTool className="w-3 h-3 text-blue-500" />
                            )}
                          </div>
                          <div className="p-6 flex-1 overflow-hidden">
                            {isDeleteAction ? (
                              <div className="h-full min-h-[300px] flex flex-col items-center justify-center border-2 border-dashed border-rose-200 rounded-2xl text-rose-600 bg-rose-50 text-center px-4 w-full">
                                <ShieldAlert className="w-10 h-10 mb-3 opacity-50" />
                                <p className="font-bold text-sm uppercase tracking-tight">
                                  Data Ini Akan Dihapus
                                </p>
                                <p className="text-xs mt-2 opacity-80">
                                  Jika Anda setuju, data saat ini di website
                                  akan dihapus secara permanen.
                                </p>
                              </div>
                            ) : (
                              <div className="ring-4 ring-blue-50/50 rounded-xl p-2 bg-white w-full">
                                <PreviewComponent data={displayPayload} />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* TEXT DIFF PROTECTOR (WORD-LEVEL HIGHLIGHTING) */}
              {!isBrandNewData &&
                !isDeleteAction &&
                changedFields.length > 0 && (
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mt-6">
                    <div className="bg-slate-50 px-6 py-3 border-b border-slate-200 text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                      <PenTool className="w-4 h-4" /> Detail Perubahan Teks
                    </div>
                    <div className="flex flex-col divide-y divide-slate-100">
                      {changedFields.map((field) => {
                        const getVal = (source: any) => {
                          const val = source?.[field];
                          if (val === null || val === undefined || val === "")
                            return "(Kosong)";
                          if (Array.isArray(val)) return val.join(", ");
                          if (typeof val === "object")
                            return "[Struktur Objek Berubah]";
                          if (typeof val === "string") {
                            let text = val;
                            if (isHtmlString(val)) {
                              text = text.replace(/<[^>]*>?/gm, ""); // Hapus tag HTML
                            }
                            // Ganti HTML Entity umum (terutama &nbsp;) menjadi spasi biasa
                            text = text
                              .replace(/&nbsp;/g, " ")
                              .replace(/&amp;/g, "&")
                              .replace(/&lt;/g, "<")
                              .replace(/&gt;/g, ">")
                              .replace(/&quot;/g, '"')
                              .replace(/&#39;/g, "'");
                            return text;
                          }
                          return String(val);
                        };

                        const oldString = getVal(oldData);
                        const newString = getVal(displayPayload);

                        return (
                          <div key={field} className="p-4 overflow-x-auto">
                            <p className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide flex items-center gap-2">
                              Kolom:{" "}
                              <span className="text-daw-green">
                                {field.replace(/_/g, " ")}
                              </span>
                            </p>
                            <ReactDiffViewer
                              oldValue={oldString}
                              newValue={newString}
                              splitView={true}
                              compareMethod={DiffMethod.WORDS}
                              hideLineNumbers={true}
                              leftTitle="Data Saat Ini"
                              rightTitle="Perubahan"
                              styles={{
                                variables: {
                                  light: {
                                    addedBackground: "#e6ffed",
                                    removedBackground: "#ffeef0",
                                    wordAddedBackground: "#acf2bd",
                                    wordRemovedBackground: "#fdb8c0",
                                  },
                                },
                                line: {
                                  fontSize: "13px",
                                  fontFamily: "inherit",
                                },
                                wordDiff: {
                                  padding: "2px",
                                  borderRadius: "3px",
                                },
                              }}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
            </div>
          )}
        </div>

        {/* FOOTER ACTIONS (HARDENED REJECT ENGINE) */}
        <div className="px-6 py-4 lg:px-8 lg:py-5 bg-white border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4 shrink-0">
          {isReadOnly ? (
            <div className="w-full flex items-center justify-center p-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-600 text-xs lg:text-sm font-bold gap-3">
              <Eye className="w-5 h-5 text-slate-400 shrink-0" />
              Mode Pantau (Anda hanya bisa melihat karena tiket tidak berada di
              antrean Anda).
            </div>
          ) : (
            <>
              <div className="flex-1 flex gap-3 w-full sm:w-auto">
                {isRejecting ? (
                  <div className="flex flex-col sm:flex-row w-full gap-3 animate-in slide-in-from-left-4 bg-red-50 p-2 rounded-2xl border border-red-100">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        placeholder="Alasan penolakan (Min 5 char)..."
                        className={`w-full text-sm border-2 rounded-xl px-4 py-3 outline-none transition-colors pr-16
                          ${rejectReason.length < minRejectChars ? "border-red-300 focus:border-red-500 bg-white" : "border-emerald-300 focus:border-emerald-500 bg-white"}`}
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        disabled={isSubmitting}
                        autoFocus
                      />
                      <span
                        className={`absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black ${rejectReason.length < minRejectChars ? "text-red-500" : "text-emerald-500"}`}>
                        {rejectReason.length}/{minRejectChars}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => onReject(draft, rejectReason)}
                        disabled={
                          rejectReason.trim().length < minRejectChars ||
                          isSubmitting
                        }
                        className="flex-1 sm:flex-none px-6 py-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:bg-slate-300 text-white text-sm font-bold rounded-xl transition-all flex justify-center items-center gap-2 shadow-sm whitespace-nowrap">
                        {isSubmitting ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          "Eksekusi Tolak"
                        )}
                      </button>
                      <button
                        onClick={() => {
                          setIsRejecting(false);
                          setRejectReason("");
                        }}
                        disabled={isSubmitting}
                        className="px-5 py-3 bg-white text-slate-600 border border-slate-200 hover:bg-slate-100 text-sm font-bold rounded-xl transition-all">
                        Batal
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setIsRejecting(true)}
                    disabled={isSubmitting}
                    className="w-full sm:w-auto px-8 py-3.5 bg-white border-2 border-red-100 text-red-600 hover:bg-red-50 hover:border-red-200 text-sm font-black tracking-tight rounded-2xl transition-all flex justify-center items-center gap-2 shadow-sm active:scale-95">
                    <X className="w-5 h-5" /> Tolak Draf
                  </button>
                )}
              </div>

              {!isRejecting && (
                <button
                  onClick={() => onApprove(draft)}
                  disabled={loadingOld || isSubmitting}
                  className="w-full sm:w-auto px-8 lg:px-10 py-3.5 bg-daw-green hover:bg-[#003b1c] disabled:opacity-50 text-white text-sm font-black tracking-tight uppercase rounded-2xl transition-all flex justify-center items-center gap-2 shadow-xl shadow-daw-green/20 active:scale-95 transform hover:-translate-y-0.5">
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" /> Meneruskan ke
                      ERP...
                    </>
                  ) : (
                    <>
                      <Check className="w-5 h-5" /> Setujui & Sinkronkan
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

  // SYSTEM STATES (Data Fetching & Modals)
  const [drafts, setDrafts] = useState<ApprovalDraft[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDraft, setSelectedDraft] = useState<ApprovalDraft | null>(
    null,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  // POWER STATES
  const [selectedTickets, setSelectedTickets] = useState<Set<string>>(
    new Set(),
  );
  const [isBulkApproving, setIsBulkApproving] = useState(false);
  // const [isPurging, setIsPurging] = useState<string | null>(null); // Menyimpan notrans yang sedang di-purge

  // ENGINE STATES (Search, Filter, Pagination)
  const [activeTab, setActiveTab] = useState<"my_queue" | "history" | "all">(
    "all",
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    setCurrentPage(1);
    setSelectedTickets(new Set());
  }, [activeTab, searchQuery]);

  // 3. API FETCHING
  const fetchApprovals = async () => {
    setIsLoading(true);
    try {
      const response = await api.get("/approval/list");
      // console.log(
      //   ">>> [DEBUG FRONTEND] Raw Drafts from Server:",
      //   response.data,
      // );
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

  useEffect(() => {
    if (!isLoading && drafts.length > 0) {
      const searchParams = new URLSearchParams(window.location.search);
      const ticketQuery = searchParams.get("ticket");

      if (ticketQuery) {
        const targetDraft = drafts.find(
          (d) => d.notrans.toLowerCase() === ticketQuery.toLowerCase(),
        );

        if (targetDraft) {
          setSelectedDraft(targetDraft);

          toast.success("Tiket Ditemukan!", {
            description: `Membuka draf ${targetDraft.notrans} secara otomatis.`,
          });
        } else {
          toast.error("Tiket Tidak Ditemukan", {
            description: `Draf ${ticketQuery} tidak ada di antrean Anda saat ini.`,
          });
        }

        const newUrl =
          window.location.protocol +
          "//" +
          window.location.host +
          window.location.pathname;
        window.history.replaceState({ path: newUrl }, "", newUrl);
      }
    }
  }, [isLoading, drafts]);

  // THE STATISTICS PROCESSOR (Bento Metrics)
  const stats = useMemo(() => {
    let urgent = 0;
    let aging = 0;
    let ghosts = 0;
    let myTurn = 0;
    const now = new Date().getTime();

    drafts.forEach((d) => {
      if (d.action === "DELETE") urgent++;
      if (d._isGhost) ghosts++;
      if (d.isMyQueue) myTurn++;

      const draftDate = new Date(d.createdAt || Date.now()).getTime();
      if (now - draftDate > 3 * 24 * 60 * 60 * 1000) aging++;
    });

    return { total: drafts.length, urgent, aging, ghosts, myTurn };
  }, [drafts]);

  // SELECTION TOGGLE (Untuk Bulk Action)
  const toggleTicketSelection = (notrans: string) => {
    setSelectedTickets((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(notrans)) newSet.delete(notrans);
      else newSet.add(notrans);
      return newSet;
    });
  };

  // 4. ACTION HANDLERS (Secure Execution)
  const handleApprove = async (draft: ApprovalDraft) => {
    if (!draft.nourut || !draft.kodeapp) {
      return toast.error(
        "Identitas baris ERP (nourut/kodeapp) hilang. Coba refresh antrean.",
      );
    }

    setIsSubmitting(true);
    const toastId = toast.loading("Mengeksekusi persetujuan & sinkronisasi...");

    try {
      await api.post("/approval/decide", {
        status: "1",
        notrans: draft.notrans,
        kodeapp: draft.kodeapp,
        nourut: draft.nourut,
        level: draft.level,
      });

      toast.success(`Draf ${draft.module_name} berhasil disetujui!`, {
        id: toastId,
      });
      setSelectedDraft(null);
      fetchApprovals();
    } catch (error: unknown) {
      toast.error("Eksekusi gagal", {
        description: getErrorMessage(error) || "Kesalahan internal server.",
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

    // Ghost Ticket Protector
    if (draft._isGhost) {
      return toast.error("Tiket Missmatch Terdeteksi", {
        description:
          "Data lokal telah terhapus. Hubungi Tim IT untuk membersihkan antrean ini.",
      });
    }

    setIsSubmitting(true);
    const toastId = toast.loading("Mengirim keputusan penolakan...");

    try {
      await api.post("/approval/decide", {
        status: "2",
        notrans: draft.notrans,
        kodeapp: draft.kodeapp,
        nourut: draft.nourut,
        level: draft.level,
        komentar: reason,
      });

      toast.success("Revisi ditolak. Data telah dikembalikan ke Editor.", {
        id: toastId,
      });
      setSelectedDraft(null);
      fetchApprovals();
    } catch (err: unknown) {
      toast.error("Gagal mengirim penolakan", {
        description: getErrorMessage(err) || "Kesalahan internal.",
        id: toastId,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // const handleDiscard = async (notrans: string) => {
  //   const toastId = toast.loading("Membersihkan notifikasi draf...");
  //   try {
  //     await api.patch('/approval/discard', { notrans });
  //     toast.success("Notifikasi draf berhasil diabaikan.", { id: toastId });
  //     fetchApprovals(); // Refresh UI
  //   } catch (error: unknown) {
  //     toast.error("Gagal mengabaikan draf", {
  //       description: getErrorMessage(error) || "Kesalahan server.",
  //       id: toastId,
  //     });
  //   }
  // };

  const handleBulkApprove = async () => {
    if (selectedTickets.size === 0) return;

    setIsBulkApproving(true);
    const toastId = toast.loading(
      `Mengeksekusi ${selectedTickets.size} persetujuan massal...`,
    );

    const targets = drafts.filter((d) => selectedTickets.has(d.notrans));
    let successCount = 0;
    let failCount = 0;

    // Menggunakan Promise.allSettled agar satu kegagalan tidak menghentikan yang lain
    const promises = targets.map((draft) =>
      api.post("/approval/decide", {
        status: "1",
        notrans: draft.notrans,
        kodeapp: draft.kodeapp,
        nourut: draft.nourut,
        level: draft.level,
      }),
    );

    const results = await Promise.allSettled(promises);

    results.forEach((result) => {
      if (result.status === "fulfilled") successCount++;
      else failCount++;
    });

    if (failCount === 0) {
      toast.success(`${successCount} draf berhasil disetujui massal!`, {
        id: toastId,
      });
    } else {
      toast.warning(
        `${successCount} berhasil, ${failCount} gagal dieksekusi.`,
        { id: toastId },
      );
    }

    setSelectedTickets(new Set()); // Bersihkan pilihan
    setIsBulkApproving(false);
    fetchApprovals();
  };

  // const handleForcePurge = async (draft: ApprovalDraft) => {
  //   if (!isSuperadmin) return toast.error("Akses ditolak.");
  //
  //   setIsPurging(draft.notrans);
  //   const toastId = toast.loading("Membersihkan antrean ERP (Force Purge)...");
  //
  //   try {
  //     await api.post("/approval/force-purge", {
  //       notrans: draft.notrans,
  //       kodeapp: draft.kodeapp,
  //       nourut: draft.nourut,
  //       level: draft.level,
  //       komentar: "SYSTEM OVERRIDE: Purging Orphaned Ticket",
  //     });
  //
  //     toast.success("Tiket berhasil dihapus!", { id: toastId });
  //     fetchApprovals();
  //   } catch (error: unknown) {
  //     toast.error("Gagal melakukan Purge", {
  //       description: getErrorMessage(error) || "ERP OWL menolak permintaan.",
  //       id: toastId,
  //     });
  //   } finally {
  //     setIsPurging(null);
  //   }
  // };

  // 5. DERIVED DATA PIPELINE
  const { filteredDrafts, paginatedDrafts, totalPages } = useMemo(() => {
    let result = drafts.filter((d) => {
      if (activeTab === "my_queue") return d.isMyQueue;
      if (activeTab === "history")
        return d.owlStatus === "1" || d.owlStatus === "2";
      if (activeTab === "all" && isSuperadmin) return true;
      return d.isMyQueue;
    });

    if (searchQuery.trim()) {
      const lowerQuery = searchQuery.toLowerCase();
      result = result.filter(
        (d) =>
          d.notrans.toLowerCase().includes(lowerQuery) ||
          d.module_name.toLowerCase().includes(lowerQuery) ||
          (d.created_by && d.created_by.toLowerCase().includes(lowerQuery)),
      );
    }

    const now = new Date().getTime();
    result.sort((a, b) => {
      // 1. Ghost Tickets turun ke paling bawah (biar nggak ganggu kerjaan utama)
      if (a._isGhost !== b._isGhost) return a._isGhost ? 1 : -1;

      // 2. Aksi DELETE naik ke paling atas (Urgency level tinggi)
      if (a.action === "DELETE" && b.action !== "DELETE") return -1;
      if (b.action === "DELETE" && a.action !== "DELETE") return 1;

      // 3. Aging Tickets (> 3 hari) naik ke atas
      const aAge = now - new Date(a.createdAt || now).getTime();
      const bAge = now - new Date(b.createdAt || now).getTime();
      const aIsAging = aAge > 3 * 24 * 60 * 60 * 1000;
      const bIsAging = bAge > 3 * 24 * 60 * 60 * 1000;
      if (aIsAging !== bIsAging) return aIsAging ? -1 : 1;

      // 4. Sisanya urutkan berdasarkan yang paling baru
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    const total = Math.ceil(result.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const slicedData = result.slice(startIndex, startIndex + itemsPerPage);

    return {
      filteredDrafts: result,
      paginatedDrafts: slicedData,
      totalPages: total > 0 ? total : 1,
    };
  }, [drafts, activeTab, searchQuery, currentPage, isSuperadmin]);

  const groupedDrafts = useMemo(() => {
    const groups: Record<string, ApprovalDraft[]> = {};
    paginatedDrafts.forEach((draft) => {
      const modName = draft.module_name || "UNKNOWN_MODULE";
      if (!groups[modName]) groups[modName] = [];
      groups[modName].push(draft);
    });
    return groups;
  }, [paginatedDrafts]);

  // EARLY RETURN (Auth Gate)
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* CARD 1: TOTAL TICKETS */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-bl-full -z-0 transition-transform group-hover:scale-110"></div>
          <div className="relative z-10 flex justify-between items-start">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                Total Antrean
              </p>
              <h3 className="text-4xl font-serif font-black text-slate-800">
                {stats.total}
              </h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-500 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-4 font-medium flex items-center gap-1">
            <span className="text-blue-500 font-bold">{stats.myTurn}</span>{" "}
            tiket menunggu Anda
          </p>
        </div>

        {/* CARD 2: URGENT (DELETE) */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-rose-50 rounded-bl-full -z-0 transition-transform group-hover:scale-110"></div>
          <div className="relative z-10 flex justify-between items-start">
            <div>
              <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-1">
                Urgent (Hapus)
              </p>
              <h3 className="text-4xl font-serif font-black text-rose-600">
                {stats.urgent}
              </h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-500 flex items-center justify-center">
              <Trash2 className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-4 font-medium">
            Aksi permanen. Butuh review.
          </p>
        </div>

        {/* CARD 3: AGING TICKETS */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-50 rounded-bl-full -z-0 transition-transform group-hover:scale-110"></div>
          <div className="relative z-10 flex justify-between items-start">
            <div>
              <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-1">
                Tiket Tertunda
              </p>
              <h3 className="text-4xl font-serif font-black text-amber-600">
                {stats.aging}
              </h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-500 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-4 font-medium">
            Mengendap lebih dari 3 hari.
          </p>
        </div>

        {/* CARD 4: GHOST TICKETS (Hanya Admin) */}
        {isSuperadmin && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-slate-100 rounded-bl-full -z-0 transition-transform group-hover:scale-110"></div>
            <div className="relative z-10 flex justify-between items-start">
              <div>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                  Ghost Tickets
                </p>
                <h3 className="text-4xl font-serif font-black text-slate-700">
                  {stats.ghosts}
                </h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-slate-200 text-slate-600 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
            </div>
            <p className="text-xs text-red-500 mt-4 font-bold flex items-center gap-1">
              Data Desync. Butuh Dibersihkan IT.
            </p>
          </div>
        )}
      </div>

      {/* --- ACTION BAR (Tab & Search) --- */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
        {/* TAB NAVIGATION */}
        <div className="flex space-x-1 bg-slate-100 p-1 rounded-xl w-full md:w-fit">
          {[
            { id: "my_queue", label: "Tugas Anda" },
            { id: "history", label: "Riwayat" },
            ...(isSuperadmin ? [{ id: "all", label: "Semua Jalur" }] : []),
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 md:flex-none px-6 py-2 text-sm font-bold rounded-lg transition-all ${
                activeTab === tab.id
                  ? "bg-white text-daw-green shadow-sm ring-1 ring-slate-200"
                  : "text-slate-500 hover:text-slate-700"
              }`}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* SEARCH & REFRESH */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Cari No. Tiket atau Editor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-daw-green/20 focus:border-daw-green transition-all outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <button
            onClick={fetchApprovals}
            disabled={isLoading}
            className="p-2.5 bg-slate-100 border border-slate-200 text-slate-600 hover:bg-daw-green hover:text-white hover:border-daw-green rounded-xl transition-all shadow-sm active:scale-95 disabled:opacity-50"
            title="Refresh Data">
            <Clock
              className={`w-5 h-5 ${isLoading ? "animate-spin text-daw-green" : ""}`}
            />
          </button>
        </div>
      </div>

      <div className="space-y-8">
        {isLoading ? (
          // SKELETON LOADER STATE
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-6">
            <div className="h-4 bg-slate-100 rounded w-1/4 mb-8 animate-pulse"></div>
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex gap-4 items-center animate-pulse border-b border-slate-50 pb-4 last:border-0">
                <div className="w-20 h-8 bg-slate-100 rounded-md"></div>
                <div className="w-64 h-4 bg-slate-100 rounded"></div>
              </div>
            ))}
          </div>
        ) : paginatedDrafts.length === 0 ? (
          // EMPTY STATE
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-24 text-center flex flex-col items-center justify-center min-h-[400px]">
            <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-5 ring-8 ring-slate-50/50 border border-slate-100 shadow-inner">
              {searchQuery ? (
                <Search className="w-10 h-10 text-slate-300" />
              ) : (
                <Check className="w-12 h-12 text-slate-300" />
              )}
            </div>
            <h3 className="text-xl font-black text-slate-800 tracking-tight">
              {searchQuery ? "Tidak Ada Hasil" : "Antrean Bersih, Manajer!"}
            </h3>
            <p className="text-sm text-slate-500 mt-2 font-medium">
              {searchQuery
                ? `Pencarian "${searchQuery}" tidak ditemukan.`
                : "Semua draf telah dieksekusi. Nikmati kopi Anda."}
            </p>
          </div>
        ) : (
          // 🚀 THE CLUSTER RENDERER (Render per Modul)
          Object.entries(groupedDrafts).map(([moduleName, moduleDrafts]) => (
            <div
              key={moduleName}
              className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden animate-in slide-in-from-bottom-4">
              {/* CLUSTER HEADER */}
              <div className="bg-slate-50/80 border-b border-slate-200 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded-lg shadow-sm border border-slate-200">
                    <LayoutTemplate className="w-4 h-4 text-slate-500" />
                  </div>
                  <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest">
                    MODUL: <span className="text-daw-green">{moduleName}</span>
                  </h3>
                </div>
                <span className="bg-white border border-slate-200 text-slate-500 text-[10px] font-bold px-3 py-1 rounded-full shadow-sm">
                  {moduleDrafts.length} Draf
                </span>
              </div>

              {/* CLUSTER TABLE */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse whitespace-nowrap">
                  <tbody className="divide-y divide-slate-100">
                    {moduleDrafts.map((draft) => {
                      const isGhost = draft._isGhost;
                      // const isRejected = draft.status === "Rejected";
                      const isSelected = selectedTickets.has(draft.notrans);
                      const isActionable =
                        draft.isMyQueue &&
                        !isGhost &&
                        draft.action !== "DELETE"; // Delete gak boleh bulk

                      // 🎨 SEMANTIC ROW AURA (Visual Hierarchy)
                      const rowAura = isGhost
                        ? "border-l-4 border-l-slate-300 bg-slate-50/50 grayscale-[50%]"
                        : draft.action === "DELETE"
                          ? "border-l-4 border-l-rose-500 bg-rose-50/20"
                          : draft.action === "CREATE"
                            ? "border-l-4 border-l-emerald-500 hover:bg-slate-50"
                            : "border-l-4 border-l-blue-500 hover:bg-slate-50";

                      return (
                        <tr
                          key={draft.notrans}
                          className={`transition-all group ${rowAura} ${isSelected ? "bg-daw-green/5" : ""}`}>
                          {/* CHECKBOX UNTUK BULK ACTION */}
                          <td className="pl-6 py-4 w-10">
                            {isActionable ? (
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() =>
                                  toggleTicketSelection(draft.notrans)
                                }
                                className="w-5 h-5 rounded border-slate-300 text-daw-green focus:ring-daw-green/20 cursor-pointer transition-all"
                              />
                            ) : (
                              <div
                                className="w-5 h-5 rounded border-2 border-slate-200 bg-slate-100 cursor-not-allowed opacity-50"
                                title="Tidak dapat dibulk"></div>
                            )}
                          </td>

                          {/* KOLOM 1: TIKET & BATON PASS HUD */}
                          <td className="px-4 py-4 w-1/3">
                            <div className="flex flex-col gap-2">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-md shadow-sm ring-1 ring-slate-200/50 bg-white text-slate-700">
                                  {draft.notrans}
                                </span>
                                <span
                                  className={`text-[9px] font-black px-2 py-0.5 rounded border uppercase tracking-widest ${
                                    draft.action === "DELETE"
                                      ? "bg-rose-100 text-rose-700 border-rose-200"
                                      : draft.action === "CREATE"
                                        ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                                        : "bg-blue-100 text-blue-700 border-blue-200"
                                  }`}>
                                  {draft.action}
                                </span>
                              </div>

                              {/* 🚀 THE BATON-PASS VISUALIZER */}
                              <div className="flex items-center gap-1.5 mt-1 text-[10px] font-bold font-mono">
                                <span className="text-slate-400">EDITOR</span>
                                <ChevronRight className="w-3 h-3 text-slate-300" />
                                {isGhost ? (
                                  <span className="text-red-500 bg-red-50 px-1.5 py-0.5 rounded border border-red-200 animate-pulse">
                                    DESYNC
                                  </span>
                                ) : draft.isMyQueue ? (
                                  <span className="text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-200 shadow-sm animate-pulse">
                                    YOU (ACT)
                                  </span>
                                ) : draft.owlStatus === "1" ||
                                  draft.owlStatus === "2" ? (
                                  <span className="text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                    YOU (DONE)
                                  </span>
                                ) : (
                                  <span className="text-slate-400">WAIT</span>
                                )}
                                <ChevronRight className="w-3 h-3 text-slate-300" />
                                <span className="text-slate-400">ERP LIVE</span>
                              </div>
                            </div>
                          </td>

                          {/* KOLOM 2: TARGET IDENTIFIER */}
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className="text-sm font-bold text-slate-700">
                                {isGhost
                                  ? "Orphaned Data"
                                  : `Target ID: #${draft.target_id?.slice(0, 8)}`}
                              </span>
                              <span className="text-[11px] font-medium text-slate-500 mt-1 flex items-center gap-1">
                                <Clock className="w-3 h-3" />{" "}
                                {isGhost
                                  ? "Waktu Hilang"
                                  : timeAgo(draft.createdAt)}
                              </span>
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
                                    ? "System"
                                    : draft.created_by || "Editor Unknown"}
                                </span>
                                <span className="text-[10px] text-slate-400 font-medium">
                                  Divisi Konten
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* KOLOM 4: AKSI EKSKLUSIF */}
                          <td className="px-6 py-4 text-right pr-8">
                            {draft.isMyQueue ? (
                              <button
                                onClick={() => setSelectedDraft(draft)}
                                className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-daw-green text-white hover:bg-[#003b1c] text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-md shadow-daw-green/20 active:scale-95 transform hover:-translate-y-0.5">
                                Review & Decide{" "}
                                <ChevronRight className="w-4 h-4" />
                              </button>
                            ) : (
                              <button
                                onClick={() => setSelectedDraft(draft)}
                                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-white border border-slate-200 text-slate-500 hover:text-daw-green hover:border-daw-green hover:bg-daw-green/5 text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-sm active:scale-95">
                                <Eye className="w-4 h-4" /> Pantau
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
      </div>

      {/* SMART PAGINATION CONTROLS */}
      {!isLoading && filteredDrafts.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs font-medium text-slate-500">
            Menampilkan{" "}
            <span className="font-bold text-slate-700">
              {(currentPage - 1) * itemsPerPage + 1}
            </span>{" "}
            hingga{" "}
            <span className="font-bold text-slate-700">
              {Math.min(currentPage * itemsPerPage, filteredDrafts.length)}
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
              className="p-2 rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(
                  (page) =>
                    Math.abs(page - currentPage) <= 2 ||
                    page === 1 ||
                    page === totalPages,
                )
                .map((page, index, array) => {
                  const showEllipsis = index > 0 && page - array[index - 1] > 1;
                  return (
                    <div key={page} className="flex items-center">
                      {showEllipsis && (
                        <span className="px-2 text-slate-400 font-bold">
                          ...
                        </span>
                      )}
                      <button
                        onClick={() => setCurrentPage(page)}
                        className={`w-9 h-9 rounded-xl text-xs font-bold transition-all ${currentPage === page ? "bg-daw-green text-white shadow-md" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
                        {page}
                      </button>
                    </div>
                  );
                })}
            </div>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-2 rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 🚀 FASE 3.3: FLOATING ACTION BAR (Untuk Bulk Action)         */}
      {/* ============================================================ */}
      {selectedTickets.size > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40 animate-in slide-in-from-bottom-10 fade-in duration-300">
          <div className="bg-slate-900 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-6 border border-slate-700">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                <Check className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-bold">
                  {selectedTickets.size} Tiket Terpilih
                </p>
                <p className="text-[10px] text-slate-400 font-medium">
                  Siap untuk dieksekusi massal
                </p>
              </div>
            </div>
            <div className="h-8 w-px bg-slate-700"></div>
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedTickets(new Set())}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition-all">
                Batal
              </button>
              <button
                onClick={handleBulkApprove}
                disabled={isBulkApproving}
                className="px-6 py-2 bg-daw-green hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-daw-green/20 flex items-center gap-2 disabled:opacity-50">
                {isBulkApproving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                Approve All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DIFF MODAL RENDERER */}
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
