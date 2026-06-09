import { useState, useEffect, useMemo } from "react";
import {
  AlertTriangle,
  RotateCcw,
  Plus,
  Trash2,
  Save,
  X,
  Send,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { useAbout } from "@/contexts/AboutContext";
import AboutLivePreview from "@/components/admin/about/AboutLivePreview";
import { getErrorMessage } from "@/lib/utils";
import MagicTranslationField from "@/components/admin/MagicTranslationField";
import LockedStateTracker from "@/components/admin/LockedStateTracker";

interface HistoryTabProps {
  isEditing: boolean;
  isSuperadmin: boolean;
  isEditor: boolean;
  mode?: "edit" | "preview";
}

interface LocalHistoryItem {
  id: string | number;
  year: string;
  text: string;
  is_locked?: boolean;
}

const generateUniqueId = () => {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `local-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

export default function HistoryTab({
  isEditing,
  isSuperadmin,
  isEditor,
  mode = "edit",
}: HistoryTabProps) {
  const { companyHistory, refreshData } = useAbout();

  const [historyItems, setHistoryItems] = useState<LocalHistoryItem[]>([]);
  const [originalItems, setOriginalItems] = useState<LocalHistoryItem[]>([]);
  const [historyTranslations, setHistoryTranslations] = useState<Record<string, any>>({});
  const [originalTranslations, setOriginalTranslations] = useState<Record<string, any>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isDiscarding, setIsDiscarding] = useState(false);
  const [optimisticLock, setOptimisticLock] = useState(false);
  const [rejectedDraft, setRejectedDraft] = useState<any | null>(null);

  // 1. DATA SYNCHRONIZATION
  useEffect(() => {
    const normalizedData = companyHistory.map((h) => ({
      id: h.id,
      year: h.year || "",
      text: h.description || "",
      is_locked: h.is_locked,
    }));

    setHistoryItems(normalizedData);
    setOriginalItems(JSON.parse(JSON.stringify(normalizedData)));

    // Jika server bilang sudah tidak locked, matikan optimistic lock lokal
    if (!companyHistory.some((h) => h.is_locked)) {
      setOptimisticLock(false);
    }

    api.get("/translation/manual?modelName=History&recordId=ALL").then(res => {
      if (res.data?.data?.id) {
        setHistoryTranslations(res.data.data.id);
        setOriginalTranslations(res.data.data.id);
      }
    }).catch(console.error);
  }, [companyHistory]);

  // 2. REJECTION RADAR (Gated by saving/optimistic states)
  const hasAnyRejected = companyHistory.some((h) => h.hasRejected);

  useEffect(() => {
    // 🚀 FIX A: Jangan narik draf kalau lagi saving atau baru aja disubmit (optimisticLock)
    if (
      hasAnyRejected &&
      !rejectedDraft &&
      isEditor &&
      !isSaving &&
      !optimisticLock
    ) {
      const controller = new AbortController();
      api
        .get("/approval/rejected/ALL_TIMELINE?module=History", {
          signal: controller.signal,
        })
        .then((res) => {
          if (res.data?.data) setRejectedDraft(res.data.data);
        })
        .catch(() => {});
      return () => controller.abort();
    }
  }, [hasAnyRejected, isEditor, rejectedDraft, isSaving, optimisticLock]);

  // 3. DIFF ENGINE
  const hasDataChanged = useMemo(() => {
    let isTransChanged = JSON.stringify(historyTranslations) !== JSON.stringify(originalTranslations);
    if (historyItems.length !== originalItems.length) return true || isTransChanged;
    const stripMeta = (items: LocalHistoryItem[]) =>
      items.map(({ year, text }) => ({ year, text }));
    return (
      JSON.stringify(stripMeta(historyItems)) !==
      JSON.stringify(stripMeta(originalItems)) || isTransChanged
    );
  }, [historyItems, originalItems, historyTranslations, originalTranslations]);

  // 4. MODULE-LEVEL LOCK ISOLATION
  // 🚀 FIX B: Logic gembok yang lebih agresif.
  // Jika sedang OptimisticLock (habis klik Send), WAJIB locked tanpa peduli status server.
  const isPendingLock =
    companyHistory.some((h) => h.is_locked) && !hasAnyRejected;
  const isModuleLocked = (optimisticLock || isPendingLock) && !isSuperadmin;

  // --- ACTIONS ---
  const addHistory = () => {
    setHistoryItems((prev) => [
      ...prev,
      { id: generateUniqueId(), year: "", text: "" },
    ]);
  };

  const removeHistory = (id: string | number) => {
    setHistoryItems((prev) => prev.filter((h) => h.id !== id));
  };

  const updateHistoryTranslation = (year: string, field: string, value: string) => {
    setHistoryTranslations(prev => ({
       ...prev,
       [year]: {
         ...(prev[year] || {}),
         [field]: value
       }
    }));
  };

  const updateHistory = (
    id: string | number,
    field: "year" | "text",
    value: string,
  ) => {
    setHistoryItems((prev) =>
      prev.map((h) => (h.id === id ? { ...h, [field]: value } : h)),
    );
  };

  const handleRestoreDraft = () => {
    if (!rejectedDraft?.payload) return;
    if (
      hasDataChanged &&
      !window.confirm("Data saat ini akan ditimpa draf lama. Lanjutkan?")
    )
      return;

    try {
      const payload =
        typeof rejectedDraft.payload === "string"
          ? JSON.parse(rejectedDraft.payload)
          : rejectedDraft.payload;
      const draftHistories = Array.isArray(payload?.histories)
        ? payload.histories
        : [];

      const restoredData = draftHistories.map((h: any) => ({
        id: generateUniqueId(),
        year: String(h.year || "").trim(),
        text: String(h.text || h.description || "").trim(),
      }));

      setHistoryItems(restoredData);
      if (payload._translations) setHistoryTranslations(payload._translations);
      toast.success("Timeline dipulihkan!");
    } catch {
      toast.error("Gagal memproses draf.");
    }
  };

  const handleDiscardDraft = async () => {
    if (!rejectedDraft?.notrans) return;
    setIsDiscarding(true);
    const loadingToast = toast.loading("Membersihkan notifikasi...");
    try {
      await api.patch("/approval/discard", { notrans: rejectedDraft.notrans });
      setRejectedDraft(null);
      await refreshData();
      toast.success("Notifikasi dibersihkan.", { id: loadingToast });
    } catch {
      toast.error("Gagal membersihkan.", { id: loadingToast });
    } finally {
      setIsDiscarding(false);
    }
  };

  const handleSave = async () => {
    if (!hasDataChanged) return;
    setIsSaving(true);
    const loadingToast = toast.loading(
      isEditor ? "Mengajukan persetujuan..." : "Menyimpan live...",
    );

    try {
      const payload: any = {
        histories: historyItems.map((h) => ({
          year: h.year.trim(),
          text: h.text.trim(),
        })),
        status: isSuperadmin ? "Active" : "Published",
        _translations: historyTranslations,
      };

      if (isEditor && rejectedDraft?.notrans)
        payload.previous_notrans = rejectedDraft.notrans;

      await api.put("/history", payload, { timeout: 60000 });

      // 🚀 URUTAN KRUSIAL:
      setRejectedDraft(null); // Hapus draf lokal instan
      if (isEditor) setOptimisticLock(true); // Gembok layar instan

      await refreshData();
      toast.success(isSuperadmin ? "Disimpan!" : "Draf diajukan!", {
        id: loadingToast,
      });
    } catch (error: unknown) {
      toast.error(getErrorMessage(error) || "Kesalahan jaringan", {
        id: loadingToast,
      });
    } finally {
      setIsSaving(false);
    }
  };

  // --- RENDER ---
  if (mode === "preview") {
    // Sort items by year conceptually? The public site usually displays them as provided or sorted by year? 
    // Public site renders them in order, so we just pass historyItems.
    return (
      <div className="animate-in fade-in zoom-in-95 duration-500">
        <AboutLivePreview type="history" data={historyItems} />
      </div>
    );
  }

  return (
    <div
      className={`space-y-6 animate-in fade-in duration-300 transition-all ${isModuleLocked ? "opacity-60 grayscale-[30%] pointer-events-none select-none" : ""}`}>
      {rejectedDraft && !isSaving && !optimisticLock && (
        <div className="p-5 rounded-xl bg-red-50 border border-red-200 flex items-start gap-4 text-red-700 shadow-sm mb-6 animate-in slide-in-from-top-4 duration-300">
          <div className="p-2 bg-red-100 rounded-lg shrink-0 h-fit">
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <div className="flex-1 space-y-3">
            <h4 className="text-sm font-black text-red-900 uppercase tracking-tighter">
              ⚠️ Revisi Ditolak
            </h4>
            <p className="text-xs text-red-800 leading-relaxed bg-white/60 p-3 rounded-md border border-red-200/50 shadow-inner italic">
              "
              {rejectedDraft.rejection_reason || "Perbaiki data sesuai arahan."}
              "
            </p>
            <div className="pt-2 flex flex-col sm:flex-row sm:items-center gap-3">
              <button
                onClick={handleRestoreDraft}
                disabled={!isEditing}
                className="flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white px-5 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all">
                <RotateCcw
                  className={`w-3.5 h-3.5 ${isEditing ? "" : "opacity-50"}`}
                />{" "}
                PULIHKAN DATA
              </button>
              <button
                onClick={handleDiscardDraft}
                disabled={isDiscarding}
                className="flex items-center justify-center gap-2 bg-white border border-red-200 text-red-600 hover:bg-red-50 disabled:bg-slate-50 px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all">
                {isDiscarding ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <X className="w-3.5 h-3.5" />
                )}{" "}
                ABAIKAN NOTIFIKASI
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HEADER & LIST (Sama seperti sebelumnya tapi menggunakan logic gembok baru) */}
      <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            Company Timeline
          </h3>
          <p className="text-sm text-slate-500 mt-1">
            Kelola sejarah perusahaan secara berurutan.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isEditing && !isModuleLocked && (
            <button
              onClick={addHistory}
              className="flex items-center gap-1.5 px-4 py-2 bg-daw-green/10 hover:bg-daw-green hover:text-white text-daw-green rounded-lg text-sm font-bold transition-all active:scale-95 shadow-sm">
              <Plus className="w-4 h-4" /> Tambah Jejak
            </button>
          )}
        </div>
      </div>

      <LockedStateTracker isLocked={isModuleLocked} lockTicket={companyHistory.find(h => h.is_locked)?.lock_ticket || null}>
      <div className="space-y-4">
        {historyItems.map((item) => {
          const isItemDisabled = !isEditing || isModuleLocked;
          return (
            <div
              key={item.id}
              className={`flex flex-col sm:flex-row gap-4 items-start bg-slate-50 p-5 rounded-xl border border-slate-200 group transition-all ${!isItemDisabled ? "hover:border-slate-300" : ""}`}>
              <div className="w-full sm:w-32 shrink-0">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Tahun
                </label>
                <input
                  type="text"
                  placeholder="2026"
                  value={item.year}
                  onChange={(e) =>
                    updateHistory(item.id, "year", e.target.value)
                  }
                  disabled={isItemDisabled}
                  className={`w-full px-3 py-2.5 rounded-lg font-bold transition-all text-sm ${!isItemDisabled ? "bg-white border-slate-300 focus:ring-2 focus:ring-daw-green/20" : "bg-slate-100/50 cursor-not-allowed"}`}
                />
              </div>
              <div className="flex-1 w-full">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Deskripsi
                </label>
                <textarea
                  rows={2}
                  value={item.text}
                  onChange={(e) =>
                    updateHistory(item.id, "text", e.target.value)
                  }
                  disabled={isItemDisabled}
                  className={`w-full px-3 py-2.5 rounded-lg resize-none transition-all text-sm ${!isItemDisabled ? "bg-white border-slate-300 focus:ring-2 focus:ring-daw-green/20" : "bg-slate-100/50 cursor-not-allowed"}`}
                />
                <div className="mt-2">
                  <MagicTranslationField
                    label="Description (Indonesian)"
                    originalText={item.text}
                    value={historyTranslations[item.year]?.description || ""}
                    onChange={(val) => updateHistoryTranslation(item.year, "description", val)}
                    disabled={isItemDisabled}
                  />
                </div>
              </div>
              {!isItemDisabled && (
                <button
                  onClick={() => removeHistory(item.id)}
                  className="mt-6 p-2 text-slate-400 hover:text-red-600 rounded-lg sm:opacity-0 sm:group-hover:opacity-100 transition-all">
                  <Trash2 className="w-5 h-5" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex justify-end pt-6">
        <button
          onClick={handleSave}
          disabled={!isEditing || isModuleLocked || isSaving || !hasDataChanged}
          className={`flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-black text-[11px] uppercase tracking-widest transition-all shadow-lg active:scale-95 disabled:cursor-not-allowed ${isSaving ? "bg-slate-300" : isModuleLocked ? "bg-slate-200 text-slate-500" : isSuperadmin ? "bg-daw-green text-white" : "bg-blue-600 text-white"}`}>
          {isSaving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : isSuperadmin ? (
            <Save className="w-4 h-4" />
          ) : (
            <Send className="w-4 h-4" />
          )}
          <span>
            {isSaving
              ? "Memproses..."
              : !hasDataChanged
                ? "Tersimpan"
                : isSuperadmin
                  ? "Publish Live"
                  : "Request Approval"}
          </span>
        </button>
      </div>
      </LockedStateTracker>
    </div>
  );
}
