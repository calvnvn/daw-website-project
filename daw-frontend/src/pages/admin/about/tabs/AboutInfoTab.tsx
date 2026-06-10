import { useState, useEffect, useMemo } from "react";
import { AlertTriangle, RotateCcw, Save, X, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { useAbout } from "@/contexts/AboutContext";
import AboutLivePreview from "@/components/admin/about/AboutLivePreview";
import { getErrorMessage } from "@/lib/utils";
import MagicTranslationField from "@/components/admin/MagicTranslationField";
import LockedStateTracker from "@/components/admin/LockedStateTracker";

interface AboutInfoTabProps {
  isEditing: boolean;
  isSuperadmin: boolean;
  isEditor: boolean;
  mode?: "edit" | "preview";
}

interface InfoFormData {
  spiritText: string;
  missionText: string;
  visionText: string;
}

export default function AboutInfoTab({
  isEditing,
  isSuperadmin,
  isEditor,
  mode = "edit",
}: AboutInfoTabProps) {
  const { aboutData, refreshData } = useAbout();

  const [formData, setFormData] = useState<InfoFormData>({
    spiritText: "",
    missionText: "",
    visionText: "",
  });
  const [originalData, setOriginalData] = useState<InfoFormData | null>(null);

  const [originalTranslations, setOriginalTranslations] = useState<
    Record<string, string>
  >({});
  const [terjemahanSpirit, setTerjemahanSpirit] = useState("");
  const [terjemahanMission, setTerjemahanMission] = useState("");
  const [terjemahanVision, setTerjemahanVision] = useState("");

  const [isSaving, setIsSaving] = useState(false);
  const [isDiscarding, setIsDiscarding] = useState(false);
  const [optimisticLock, setOptimisticLock] = useState(false);
  const [rejectedDraft, setRejectedDraft] = useState<any | null>(null);

  useEffect(() => {
    if (aboutData) {
      const data: InfoFormData = {
        spiritText: String(aboutData.spiritText || "").trim(),
        missionText: String(aboutData.missionText || "").trim(),
        visionText: String(aboutData.visionText || "").trim(),
      };
      setFormData(data);
      setOriginalData(data);

      if (!aboutData.is_locked) {
        setOptimisticLock(false);
      }

      api
        .get("/translation/manual?modelName=AboutInfo&recordId=1")
        .then((res) => {
          if (res.data?.data?.id) {
            const trans = res.data.data.id;
            setTerjemahanSpirit(trans.spiritText || "");
            setTerjemahanMission(trans.missionText || "");
            setTerjemahanVision(trans.visionText || "");
            setOriginalTranslations(trans);
          }
        })
        .catch(console.error);
    }
  }, [aboutData]);
  useEffect(() => {
    if (
      aboutData?.hasRejected &&
      !rejectedDraft &&
      isEditor &&
      !isSaving &&
      !optimisticLock
    ) {
      const controller = new AbortController();

      api
        .get("/approval/rejected/1?module=AboutInfo", {
          signal: controller.signal,
        })
        .then((res) => {
          if (res.data?.data) setRejectedDraft(res.data.data);
        })
        .catch((err) => {
          if (err.name !== "CanceledError") {
            toast.error("Gagal menarik catatan revisi dari server.");
          }
        });

      return () => controller.abort();
    }
  }, [
    aboutData?.hasRejected,
    isEditor,
    rejectedDraft,
    isSaving,
    optimisticLock,
  ]);

  const hasDataChanged = useMemo(() => {
    if (!originalData) return false;

    const isTransChanged =
      terjemahanSpirit.trim() !== (originalTranslations.spiritText || "") ||
      terjemahanMission.trim() !== (originalTranslations.missionText || "") ||
      terjemahanVision.trim() !== (originalTranslations.visionText || "");

    return (
      formData.spiritText.trim() !== originalData.spiritText ||
      formData.missionText.trim() !== originalData.missionText ||
      formData.visionText.trim() !== originalData.visionText ||
      isTransChanged
    );
  }, [
    formData,
    originalData,
    terjemahanSpirit,
    terjemahanMission,
    terjemahanVision,
    originalTranslations,
  ]);

  const isPendingLock = aboutData?.is_locked && !aboutData?.hasRejected;
  const isItemLocked = (isPendingLock || optimisticLock) && !isSuperadmin;

  const handleRestoreDraft = () => {
    if (!rejectedDraft?.payload) return;

    if (hasDataChanged) {
      if (
        !window.confirm(
          "Ada perubahan yang belum disimpan. Yakin ingin menimpa dengan data draf lama?",
        )
      )
        return;
    }

    try {
      const payload =
        typeof rejectedDraft.payload === "string"
          ? JSON.parse(rejectedDraft.payload)
          : rejectedDraft.payload;

      setFormData({
        spiritText: String(payload.spiritText || "").trim(),
        missionText: String(payload.missionText || "").trim(),
        visionText: String(payload.visionText || "").trim(),
      });

      if (payload._translations?.id) {
        setTerjemahanSpirit(payload._translations.id.spiritText || "");
        setTerjemahanMission(payload._translations.id.missionText || "");
        setTerjemahanVision(payload._translations.id.visionText || "");
      }

      toast.success("Teks Visi, Misi, & Spirit dipulihkan!");
    } catch (err) {
      toast.error("Gagal membaca format draf.");
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
      toast.success("Notifikasi penolakan berhasil dibersihkan.", {
        id: loadingToast,
      });
    } catch (error) {
      toast.error("Gagal membersihkan notifikasi.", { id: loadingToast });
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
        spiritText: formData.spiritText.trim(),
        missionText: formData.missionText.trim(),
        visionText: formData.visionText.trim(),
        status: isSuperadmin ? "Active" : "Published",
        _translations: {
          id: {
            spiritText: terjemahanSpirit,
            missionText: terjemahanMission,
            visionText: terjemahanVision,
          },
        },
      };

      if (isEditor && rejectedDraft?.notrans) {
        payload.previous_notrans = rejectedDraft.notrans;
      }

      await api.put("/about", payload, { timeout: 60000 });

      setRejectedDraft(null);
      if (isEditor) setOptimisticLock(true);

      await refreshData();

      toast.success(
        isSuperadmin
          ? "Perubahan berhasil disimpan!"
          : "Draf berhasil diajukan!",
        { id: loadingToast },
      );
    } catch (error: unknown) {
      toast.error(getErrorMessage(error) || "Kesalahan jaringan", {
        id: loadingToast,
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (mode === "preview") {
    return (
      <div className="animate-in fade-in zoom-in-95 duration-500">
        <AboutLivePreview type="info" data={formData} />
      </div>
    );
  }

  return (
    <div
      className={`space-y-6 animate-in fade-in duration-300 transition-all ${
        isItemLocked
          ? "opacity-60 grayscale-[30%] pointer-events-none select-none"
          : ""
      }`}>
      {rejectedDraft && !isSaving && !optimisticLock && (
        <div className="p-5 rounded-xl bg-red-50 border border-red-200 flex items-start gap-4 text-red-700 shadow-sm mb-6 animate-in slide-in-from-top-4 duration-300">
          <div className="p-2 bg-red-100 rounded-lg shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <div className="flex-1 space-y-3">
            <div className="flex justify-between items-center">
              <h4 className="text-sm font-black text-red-900 uppercase tracking-tighter">
                ⚠️ Revisi Ditolak: Catatan Peninjau
              </h4>
            </div>
            <p className="text-xs text-red-800 leading-relaxed font-medium bg-white/60 p-3 rounded-md border border-red-200/50 shadow-inner">
              "
              {rejectedDraft.rejection_reason ||
                "Silakan perbaiki data sesuai arahan."}
              "
            </p>

            <div className="pt-2 flex flex-col sm:flex-row sm:items-center gap-3">
              <button
                onClick={handleRestoreDraft}
                disabled={!isEditing}
                title={
                  !isEditing
                    ? "Buka mode edit untuk memulihkan data"
                    : "Pulihkan draf yang ditolak"
                }
                className="flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 disabled:bg-red-300 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95">
                <RotateCcw
                  className={`w-3.5 h-3.5 ${isEditing ? "" : "opacity-50"}`}
                />
                PULIHKAN DATA
              </button>

              <button
                onClick={handleDiscardDraft}
                disabled={isDiscarding}
                className="flex items-center justify-center gap-2 bg-white border border-red-200 text-red-600 hover:bg-red-50 disabled:bg-slate-50 disabled:text-slate-400 px-4 py-2.5 rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95">
                {isDiscarding ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <X className="w-3.5 h-3.5" />
                )}
                ABAIKAN NOTIFIKASI
              </button>

              {!isEditing && (
                <p className="text-[10px] text-red-500 font-medium italic animate-pulse ml-2">
                  * Aktifkan "Editing Mode" untuk memulihkan.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-2">
        <h3 className="text-lg font-bold text-slate-900">Identitas Utama</h3>
      </div>

      <LockedStateTracker
        isLocked={isItemLocked}
        lockTicket={aboutData?.lock_ticket || null}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2 bg-slate-50 p-5 rounded-xl border border-slate-200">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              Spirit Title (Locked)
            </label>
            <input
              type="text"
              value="Founders' Spirit"
              disabled
              className="w-full mb-4 px-3 py-2.5 bg-slate-200/50 border-transparent rounded-lg text-slate-400 cursor-not-allowed font-medium text-sm"
            />
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              Spirit Text
            </label>
            <textarea
              rows={2}
              value={formData.spiritText}
              onChange={(e) =>
                setFormData({ ...formData, spiritText: e.target.value })
              }
              disabled={!isEditing || isItemLocked}
              className={`w-full px-3 py-2.5 rounded-lg resize-none font-serif text-sm transition-all duration-300 ${
                isEditing && !isItemLocked
                  ? "bg-white border border-slate-300 text-slate-900 focus:ring-2 focus:ring-daw-green/20 shadow-inner"
                  : "bg-slate-100/50 border-transparent text-slate-500 cursor-not-allowed"
              }`}
            />
            <div className="mt-4">
              <MagicTranslationField
                label="Spirit Text (Indonesian)"
                originalText={formData.spiritText}
                value={terjemahanSpirit}
                onChange={setTerjemahanSpirit}
                disabled={!isEditing || isItemLocked}
              />
            </div>
          </div>

          <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              Mission Title (Locked)
            </label>
            <input
              type="text"
              value="Mission"
              disabled
              className="w-full mb-4 px-3 py-2.5 bg-slate-200/50 border-transparent rounded-lg text-slate-400 cursor-not-allowed font-medium text-sm"
            />
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              Mission Text
            </label>
            <textarea
              rows={4}
              value={formData.missionText}
              onChange={(e) =>
                setFormData({ ...formData, missionText: e.target.value })
              }
              disabled={!isEditing || isItemLocked}
              className={`w-full px-3 py-2.5 rounded-lg resize-none font-serif text-sm transition-all duration-300 ${
                isEditing && !isItemLocked
                  ? "bg-white border border-slate-300 text-slate-900 focus:ring-2 focus:ring-daw-green/20 shadow-inner"
                  : "bg-slate-100/50 border-transparent text-slate-500 cursor-not-allowed"
              }`}
            />
            <div className="mt-4">
              <MagicTranslationField
                label="Mission Text (Indonesian)"
                originalText={formData.missionText}
                value={terjemahanMission}
                onChange={setTerjemahanMission}
                disabled={!isEditing || isItemLocked}
              />
            </div>
          </div>

          <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              Vision Title (Locked)
            </label>
            <input
              type="text"
              value="Vision"
              disabled
              className="w-full mb-4 px-3 py-2.5 bg-slate-200/50 border-transparent rounded-lg text-slate-400 cursor-not-allowed font-medium text-sm"
            />
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              Vision Text
            </label>
            <textarea
              rows={4}
              value={formData.visionText}
              onChange={(e) =>
                setFormData({ ...formData, visionText: e.target.value })
              }
              disabled={!isEditing || isItemLocked}
              className={`w-full px-3 py-2.5 rounded-lg resize-none font-serif text-sm transition-all duration-300 ${
                isEditing && !isItemLocked
                  ? "bg-white border border-slate-300 text-slate-900 focus:ring-2 focus:ring-daw-green/20 shadow-inner"
                  : "bg-slate-100/50 border-transparent text-slate-500 cursor-not-allowed"
              }`}
            />
            <div className="mt-4">
              <MagicTranslationField
                label="Vision Text (Indonesian)"
                originalText={formData.visionText}
                value={terjemahanVision}
                onChange={setTerjemahanVision}
                disabled={!isEditing || isItemLocked}
              />
            </div>
          </div>
        </div>
      </LockedStateTracker>

      <div className="flex justify-end pt-6">
        <button
          onClick={handleSave}
          disabled={!isEditing || isItemLocked || isSaving || !hasDataChanged}
          className={`flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-black text-[11px] uppercase tracking-widest transition-all shadow-lg active:scale-95 disabled:cursor-not-allowed disabled:shadow-none ${
            isSaving
              ? "bg-slate-300 text-slate-700"
              : isItemLocked
                ? "bg-slate-200 text-slate-500"
                : isSuperadmin
                  ? "bg-daw-green hover:bg-[#003b1c] text-white shadow-daw-green/20"
                  : "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20"
          }`}>
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
    </div>
  );
}
