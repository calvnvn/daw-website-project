import { useState, useEffect, useMemo } from "react";
import {
  X,
  Check,
  Loader2,
  Eye,
  LayoutTemplate,
  Globe,
  FileText,
  Sparkles,
  Trash2,
  ShieldAlert,
  PenTool
} from "lucide-react";
import ReactDiffViewer, { DiffMethod } from "react-diff-viewer-continued";
import PREVIEW_REGISTRY from "../ModuleRegistry";
import api from "@/lib/api";
import type { ApprovalDraft } from "../utils/approvalHelpers";
import {
  isMeaningfulTextField,
  sanitizeForDiff,
  getFieldLabel,
  getModuleLabel,
  getActionInfo,
  cleanHtmlText
} from "../utils/approvalHelpers";
import ApprovalTracker from "./ApprovalTracker";

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
  const [previewLang, setPreviewLang] = useState<"en" | "id">("en");

  const getPreviewData = () => {
    const base = { ...displayPayload };
    if (previewLang === "id") {
      if (base._translations?.id) {
        Object.entries(base._translations.id).forEach(([key, val]) => {
          base[key] = val;
        });
      }
    }
    return base;
  };

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
      const val1 = safeOld[key];
      const val2 = safeNew[key];
      
      const norm1 = cleanHtmlText(val1);
      const norm2 = cleanHtmlText(val2);
      
      if (norm1 !== norm2) {
        if (isMeaningfulTextField(key, safeNew[key] ?? safeOld[key])) {
          changes.push(key);
        }
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
              Detail Draf: {getModuleLabel(draft.module_name)}
            </h2>
            <div className="flex items-center gap-2 mt-1.5 lg:mt-2">
              <span
                className={`px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-widest border shadow-sm
                ${getActionInfo(draft.action).bg} ${getActionInfo(draft.action).color}`}>
                {getActionInfo(draft.action).label}
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
        {draft.status !== "Orphaned" && <ApprovalTracker draft={draft} />}

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
                  className="px-2 py-0.5 bg-amber-200/50 text-amber-700 border border-amber-300 rounded text-[10px] font-bold shadow-sm whitespace-nowrap">
                  {getFieldLabel(field)}
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
                            <div className="flex items-center gap-3">
                              <span
                                className={`text-[10px] font-black uppercase tracking-widest ${isDeleteAction ? "text-rose-700" : "text-blue-700"}`}>
                                {isDeleteAction
                                  ? "Permintaan Hapus Data"
                                  : "Perubahan yang Diajukan"}
                              </span>
                              {!isDeleteAction &&
                                displayPayload?._translations?.id && (
                                  <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-[9px] font-bold shrink-0">
                                    <button
                                      onClick={() => setPreviewLang("en")}
                                      className={`px-2 py-0.5 rounded-md transition-all ${previewLang === "en" ? "bg-white text-slate-800 shadow-sm border border-slate-200/50" : "text-slate-500 hover:text-slate-700"}`}>
                                      EN (English)
                                    </button>
                                    <button
                                      onClick={() => setPreviewLang("id")}
                                      className={`px-2 py-0.5 rounded-md transition-all ${previewLang === "id" ? "bg-daw-green text-white shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                                      ID (Indonesia)
                                    </button>
                                  </div>
                                )}
                            </div>
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
                                <PreviewComponent data={getPreviewData()} />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* RINGKASAN PERUBAHAN BANNER */}
              {!isBrandNewData &&
                !isDeleteAction &&
                changedFields.length > 0 && (
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-5 mb-6 shadow-sm">
                    <h4 className="text-xs font-black text-blue-800 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-blue-500" /> Ringkasan
                      Perubahan Konten
                    </h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Pengaju konten mengajukan perubahan pada beberapa
                      informasi penting. Berikut adalah bagian yang diubah:
                    </p>
                    <ul className="mt-3 space-y-1.5">
                      {changedFields.map((field) => {
                        const isTrans = field.startsWith("terjemahan_id_");
                        return (
                          <li
                            key={field}
                            className="text-xs text-slate-700 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                            <span>
                              <strong>{getFieldLabel(field)}</strong>
                              {isTrans ? (
                                <span className="text-[9px] ml-2 px-1.5 py-0.5 bg-emerald-100 text-emerald-700 border border-emerald-200 font-bold rounded">
                                  Terjemahan Manual (Bahasa Indonesia)
                                </span>
                              ) : null}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                    <p className="text-[11px] text-slate-400 mt-4 italic">
                      💡 Silakan periksa perbandingan teks kata demi kata pada
                      bagian bawah halaman ini untuk melihat detail perubahan.
                    </p>
                  </div>
                )}

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
                          if (Array.isArray(val)) return val.join(", ");
                          if (val && typeof val === "object")
                            return "[Struktur Objek Berubah]";
                          const cleaned = cleanHtmlText(val);
                          if (cleaned === "") return "(Kosong)";
                          return cleaned;
                        };

                        const oldString = getVal(oldData);
                        const newString = getVal(displayPayload);

                        return (
                          <div key={field} className="p-4 overflow-x-auto">
                            <p className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide flex items-center gap-2">
                              Kolom:{" "}
                              <span className="text-daw-green">
                                {getFieldLabel(field)}
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
                        title="Konfirmasi penolakan draf ini"
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
                      <Loader2 className="w-5 h-5 animate-spin" /> Memproses
                      persetujuan...
                    </>
                  ) : (
                    <>
                      <Check className="w-5 h-5" /> Setujui & Terbitkan
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

export default DiffModal;
