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

  // AI-STYLE HEURISTIC DIFF ENGINE
  const aiInsights = useMemo(() => {
    if (!oldData || !displayPayload || draft.action !== "UPDATE") return null;
    const safeOld = sanitizeForDiff(oldData);
    const safeNew = sanitizeForDiff(displayPayload || {});
    
    interface InsightItem {
      icon: string;
      text: string;
      subtext?: string;
    }

    const categories: Record<string, InsightItem[]> = {
      main: [],
      translation: [],
      media: [],
      settings: []
    };

    // 1. Text Fields analysis
    changedFields.forEach((key) => {
      const val1 = safeOld[key];
      const val2 = safeNew[key];
      
      const cleanOld = cleanHtmlText(val1);
      const cleanNew = cleanHtmlText(val2);
      const label = getFieldLabel(key);

      let icon = "📝";
      let text = "";
      let subtext = "";

      const isTrans = key.startsWith("terjemahan_id_") || key.startsWith("terjemahan_");
      const categoryKey = isTrans 
        ? "translation" 
        : (["seo_title", "meta_description", "slug", "status", "category", "category_id"].includes(key) ? "settings" : "main");

      if (!cleanOld && cleanNew) {
        icon = "➕";
        text = `Mengisi bagian ${label} yang sebelumnya kosong`;
        subtext = `Menambahkan tulisan: "${cleanNew.slice(0, 60)}${cleanNew.length > 60 ? '...' : ''}"`;
      } else if (cleanOld && !cleanNew) {
        icon = "➖";
        text = `Menghapus seluruh tulisan di ${label}`;
        subtext = `Tulisan lama: "${cleanOld.slice(0, 60)}${cleanOld.length > 60 ? '...' : ''}"`;
      } else {
        icon = "🔄";
        if (cleanOld.length > 80 || cleanNew.length > 80) {
          const wOld = cleanOld.split(/\s+/).filter(Boolean);
          const wNew = cleanNew.split(/\s+/).filter(Boolean);
          const added = wNew.filter(w => !wOld.includes(w)).slice(0, 3);
          const removed = wOld.filter(w => !wNew.includes(w)).slice(0, 3); // Typo correction check
          
          if (added.length > 0 && removed.length > 0) {
            text = `Mengubah kata di bagian ${label}`;
            subtext = `Mengganti kata "${removed.join(', ')}" menjadi "${added.join(', ')}"`;
          } else if (added.length > 0) {
            text = `Menambah kata baru di bagian ${label}`;
            subtext = `Menambahkan kata "${added.join(', ')}"`;
          } else {
            text = `Merapikan tulisan di bagian ${label}`;
            subtext = `Ada perbaikan kata atau ejaan kalimat agar lebih rapi.`;
          }
        } else {
          text = `Mengubah ${label}`;
          subtext = `Mengganti dari "${cleanOld}" menjadi "${cleanNew}"`;
        }
      }

      categories[categoryKey].push({ icon, text, subtext });
    });

    // 2. Media changes check
    const coverOld = oldData.cover_image;
    const coverNew = displayPayload.cover_image;
    if (coverOld !== coverNew && (coverOld || coverNew)) {
      categories.media.push({
        icon: "🖼️",
        text: "Mengganti Gambar Sampul Utama",
        subtext: coverNew ? "Memasang gambar sampul baru" : "Menghapus gambar sampul"
      });
    }

    const parseGallery = (g: any) => {
      if (!g) return [];
      if (Array.isArray(g)) return g;
      try {
        return typeof g === "string" ? JSON.parse(g) : g;
      } catch {
        return [];
      }
    };
    const galOld = parseGallery(oldData.gallery);
    const galNew = parseGallery(displayPayload.gallery);
    if (JSON.stringify(galOld) !== JSON.stringify(galNew)) {
      categories.media.push({
        icon: "📸",
        text: "Mengubah Galeri Foto",
        subtext: `Jumlah foto diganti dari ${galOld.length} foto menjadi ${galNew.length} foto`
      });
    }

    return categories;
  }, [oldData, displayPayload, changedFields, draft.action]);

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

        {/* BODY KONTEN */}
        <div className="flex-1 overflow-y-auto bg-slate-100/50 relative custom-scrollbar">
          {/* APPROVAL TRACKER (PANTAU) - Dipindahkan ke dalam scroll area agar tidak memakan ruang vertikal permanen */}
          <div className="bg-white">
            {draft.status !== "Orphaned" && <ApprovalTracker draft={draft} />}
          </div>

          {/* INSIGHT BANNER - Dipindahkan ke dalam scroll area */}
          {!loadingOld && changedFields.length > 0 && (
            <div className="bg-amber-50/80 border-y border-amber-100 px-6 lg:px-8 py-3 flex items-center gap-3 overflow-x-auto custom-scrollbar">
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

          <div className="p-4 lg:p-6">
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
                            Tampilan Sebelahan
                          </button>
                          <button
                            onClick={() => setPreviewLayout("stacked")}
                            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${previewLayout === "stacked" ? "bg-slate-900 text-white shadow" : "text-slate-500 hover:bg-slate-50"}`}>
                            Tampilan Atas-Bawah
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
                                Tampilan di Website Sekarang
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
                                    ? "Belum ada data (karena baru dibuat)"
                                    : "Data tayang tidak ditemukan"}
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
                                    : "Usulan Perubahan Baru"}
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
                                    Data Ini Akan Dihapus Dari Website
                                  </p>
                                  <p className="text-xs mt-2 opacity-80">
                                    Kalau Anda menyetujui usulan ini, data yang ada di website sekarang akan langsung terhapus selamanya.
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

                {/* AI INSIGHT CARD (RINGKASAN PERUBAHAN) */}
                {!isBrandNewData &&
                  !isDeleteAction &&
                  changedFields.length > 0 &&
                  aiInsights && (
                    <div className="bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-600 p-[1.5px] rounded-3xl shadow-xl shadow-indigo-100/30 mb-6 overflow-hidden">
                      <div className="bg-white/95 backdrop-blur-md p-6 rounded-[22.5px] flex flex-col gap-5">
                        
                        {/* Header Area */}
                        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-gradient-to-tr from-violet-500 to-indigo-500 rounded-xl text-white shadow-md shadow-indigo-200">
                              <Sparkles className="w-5 h-5 animate-pulse" />
                            </div>
                            <div>
                              <h4 className="text-sm font-black text-slate-800 tracking-tight">
                                Ringkasan Usulan Perubahan
                              </h4>
                              <p className="text-[10px] text-slate-400 font-mono flex items-center gap-1.5 mt-0.5 font-bold">
                                <span className="relative flex h-1.5 w-1.5">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-violet-500"></span>
                                </span>
                                PENDETEKSI PERUBAHAN OTOMATIS AKTIF
                              </p>
                            </div>
                          </div>
                          <span className="px-2.5 py-1 bg-violet-50 text-violet-600 border border-violet-100 rounded-full text-[9px] font-black uppercase tracking-wider">
                            Hasil Deteksi
                          </span>
                        </div>

                        {/* Content Categories */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {/* Left Column: Konten Utama & Terjemahan */}
                          <div className="space-y-5">
                            {/* Konten Utama */}
                            {aiInsights.main.length > 0 && (
                              <div className="space-y-3">
                                <h5 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-1.5">
                                  <FileText className="w-3.5 h-3.5" /> Tulisan Utama (Bahasa Inggris)
                                </h5>
                                <div className="space-y-2">
                                  {aiInsights.main.map((item, idx) => (
                                    <div key={idx} className="flex items-start gap-2.5 bg-slate-50/50 p-2.5 rounded-xl border border-slate-100 shadow-sm">
                                      <span className="text-sm shrink-0">{item.icon}</span>
                                      <div>
                                        <p className="text-xs font-bold text-slate-800 leading-tight">{item.text}</p>
                                        {item.subtext && <p className="text-[10px] text-slate-500 mt-0.5 leading-normal">{item.subtext}</p>}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Terjemahan */}
                            {aiInsights.translation.length > 0 && (
                              <div className="space-y-3">
                                <h5 className="text-[10px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-1.5">
                                  <Globe className="w-3.5 h-3.5" /> Terjemahan (Bahasa Indonesia)
                                </h5>
                                <div className="space-y-2">
                                  {aiInsights.translation.map((item, idx) => (
                                    <div key={idx} className="flex items-start gap-2.5 bg-emerald-50/20 p-2.5 rounded-xl border border-emerald-100/30 shadow-sm">
                                      <span className="text-sm shrink-0">{item.icon}</span>
                                      <div>
                                        <p className="text-xs font-bold text-slate-800 leading-tight">{item.text}</p>
                                        {item.subtext && <p className="text-[10px] text-slate-500 mt-0.5 leading-normal">{item.subtext}</p>}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Right Column: Media & Pengaturan */}
                          <div className="space-y-5">
                            {/* Media */}
                            {aiInsights.media.length > 0 && (
                              <div className="space-y-3">
                                <h5 className="text-[10px] font-black text-rose-600 uppercase tracking-widest flex items-center gap-1.5">
                                  <LayoutTemplate className="w-3.5 h-3.5" /> Gambar & Foto
                                </h5>
                                <div className="space-y-2">
                                  {aiInsights.media.map((item, idx) => (
                                    <div key={idx} className="flex items-start gap-2.5 bg-rose-50/20 p-2.5 rounded-xl border border-rose-100/30 shadow-sm">
                                      <span className="text-sm shrink-0">{item.icon}</span>
                                      <div>
                                        <p className="text-xs font-bold text-slate-800 leading-tight">{item.text}</p>
                                        {item.subtext && <p className="text-[10px] text-slate-500 mt-0.5 leading-normal">{item.subtext}</p>}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Pengaturan */}
                            {aiInsights.settings.length > 0 && (
                              <div className="space-y-3">
                                <h5 className="text-[10px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-1.5">
                                  <PenTool className="w-3.5 h-3.5" /> Pengaturan Web & Google (SEO)
                                </h5>
                                <div className="space-y-2">
                                  {aiInsights.settings.map((item, idx) => (
                                    <div key={idx} className="flex items-start gap-2.5 bg-slate-50/50 p-2.5 rounded-xl border border-slate-100 shadow-sm">
                                      <span className="text-sm shrink-0">{item.icon}</span>
                                      <div>
                                        <p className="text-xs font-bold text-slate-800 leading-tight">{item.text}</p>
                                        {item.subtext && <p className="text-[10px] text-slate-500 mt-0.5 leading-normal">{item.subtext}</p>}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Footer Hint */}
                        <div className="text-[10px] text-slate-400 mt-2 italic bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-center gap-2">
                          <span>💡</span>
                          <span>Lihat bagian <strong>Perbandingan Tulisan</strong> di bawah untuk mengecek kata mana saja yang dicoret atau ditambah.</span>
                        </div>

                      </div>
                    </div>
                  )}

                {/* TEXT DIFF PROTECTOR (WORD-LEVEL HIGHLIGHTING) */}
                {!isBrandNewData &&
                  !isDeleteAction &&
                  changedFields.length > 0 && (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mt-6 relative diff-cleaner-container">
                      {/* CSS Injection to hide technical hunk headers (@@ -x,x +x,x @@) */}
                      <style>{`
                        .diff-cleaner-container tr:has(> td[class*="-titleBlock"]) {
                          display: none !important;
                        }
                      `}</style>
                      <div className="bg-slate-50 px-6 py-3 border-b border-slate-200 text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                        <PenTool className="w-4 h-4" /> Perbandingan Tulisan
                      </div>
                      <div className="flex flex-col divide-y divide-slate-100">
                        {changedFields.map((field) => {
                          const safeOld = sanitizeForDiff(oldData);
                          const safeNew = sanitizeForDiff(displayPayload || {});

                          const getFormattedVal = (source: any) => {
                            const val = source?.[field];
                            if (Array.isArray(val)) return val.join(", ");
                            if (val && typeof val === "object")
                              return "[Data Diperbarui]";
                            const cleaned = cleanHtmlText(val);
                            if (cleaned === "") return "(Kosong/Belum Diisi)";
                            
                            // SMART SENTENCE SPLITTING
                            // Memecah paragraf panjang menjadi baris per kalimat berdasarkan titik.
                            // Ini memungkinkan showDiffOnly menyenyembunyikan kalimat yang tidak berubah!
                            return cleaned.replace(/(?<=[.!?])\s+/g, "\n");
                          };

                          const oldString = getFormattedVal(safeOld);
                          const newString = getFormattedVal(safeNew);

                          return (
                            <div key={field} className="p-4 overflow-x-auto">
                              <p className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide flex items-center gap-2">
                                Bagian:{" "}
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
                                showDiffOnly={true}
                                leftTitle="Tulisan Lama (Saat Ini)"
                                rightTitle="Tulisan Baru (Usulan)"
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
        </div>

        {/* FOOTER ACTIONS (HARDENED REJECT ENGINE) */}
        <div className="px-6 py-4 lg:px-8 lg:py-5 bg-white border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4 shrink-0">
          {isReadOnly ? (
            <div className="w-full flex items-center justify-center p-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-600 text-xs lg:text-sm font-bold gap-3">
              <Eye className="w-5 h-5 text-slate-400 shrink-0" />
              Mode Lihat Saja (Anda hanya bisa memantau draf ini karena tugas ini ada di antrean pengguna lain).
            </div>
          ) : (
            <>
              <div className="flex-1 flex gap-3 w-full sm:w-auto">
                {isRejecting ? (
                  <div className="flex flex-col sm:flex-row w-full gap-3 animate-in slide-in-from-left-4 bg-red-50 p-2 rounded-2xl border border-red-100">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        placeholder="Tulis alasan draf ini ditolak (minimal 5 huruf)..."
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
                        title="Tolak usulan ini"
                        disabled={
                          rejectReason.trim().length < minRejectChars ||
                          isSubmitting
                        }
                        className="flex-1 sm:flex-none px-6 py-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:bg-slate-300 text-white text-sm font-bold rounded-xl transition-all flex justify-center items-center gap-2 shadow-sm whitespace-nowrap">
                        {isSubmitting ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          "Tolak Draf"
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
                    <X className="w-5 h-5" /> Tolak Usulan
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
                      <Loader2 className="w-5 h-5 animate-spin" /> Sedang memproses...
                    </>
                  ) : (
                    <>
                      <Check className="w-5 h-5" /> Setujui & Tayangkan ke Web
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
