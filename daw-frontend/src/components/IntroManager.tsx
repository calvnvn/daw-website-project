import { useState, useEffect, useCallback, useRef } from "react";
import { useHome } from "@/contexts/HomeContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  Save,
  Lock,
  Unlock,
  AlertTriangle,
  RotateCcw,
  Send,
  ShieldAlert,
  Loader2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";

export default function IntroManager() {
  // 🚀 Identity Sync: Kasta Pengguna
  const { user } = useAuth();
  const isSuperadmin =
    user?.role?.toLowerCase() === "superadmin" ||
    user?.role?.toLowerCase() === "admin";
  const isEditor = user?.role?.toLowerCase() === "editor";

  // 🚀 Global Intelligence: Tarik rejectedIntro dari Context v1.2
  const { settings: initialSettings, rejectedIntro, refreshData } = useHome();
  // console.log("🔍 DEBUG INTRO MANAGER:");
  // console.log("- User Role:", user?.role);
  // console.log("- is_locked from Server:", initialSettings?.is_locked);
  // console.log("- Rejected Draft Found:", rejectedIntro);

  // --- State Utama Form ---
  const [settings, setSettings] = useState({
    introHeadline: "",
    introBody: "",
  });

  // 🚀 Sub-Langkah 2.1: Snapshotting (Jangkar Diff Engine)
  const [originalData, setOriginalData] = useState({
    introHeadline: "",
    introBody: "",
  });

  // State UI & Lifecycle
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isOptimisticallyLocked, setIsOptimisticallyLocked] = useState(false);

  // Controller untuk Memory Safety (Blueprint 8.2.C)
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const isServerLocked = !!initialSettings?.is_locked;
  const isDataLocked = isServerLocked || isOptimisticallyLocked;

  const shouldLockUI = isDataLocked && !isSuperadmin;
  const isOverrideMode = isDataLocked && isSuperadmin;

  const isFormLocked = !isEditing || shouldLockUI;
  const lockStyles = shouldLockUI
    ? "opacity-60 grayscale-[30%] pointer-events-none cursor-not-allowed select-none"
    : "";

  // --- 1. SINKRONISASI DATA & SNAPSHOTTING ---
  useEffect(() => {
    if (initialSettings && !isEditing) {
      // 🛡️ Sanitasi ketat: null/undefined WAJIB menjadi ""
      const cleanData = {
        introHeadline: initialSettings.introHeadline ?? "",
        introBody: initialSettings.introBody ?? "",
      };

      setSettings(cleanData);
      setOriginalData(cleanData);

      if (!initialSettings.is_locked) {
        setIsOptimisticallyLocked(false);
      }
    }
  }, [initialSettings, isEditing]);

  // --- 2. ROBUST DIFF ENGINE ---
  const hasDataChanged = useCallback(() => {
    return (
      settings.introHeadline.trim() !== originalData.introHeadline.trim() ||
      settings.introBody.trim() !== originalData.introBody.trim()
    );
  }, [settings, originalData]);

  // --- 3. RESTORE HANDLER (Anti-Corruption Guard) ---
  const handleRestoreDraft = useCallback(() => {
    if (!rejectedIntro?.payload) return;

    let payloadObj = rejectedIntro.payload;

    if (typeof payloadObj === "string") {
      try {
        payloadObj = JSON.parse(payloadObj);
      } catch (error) {
        console.error(
          "🚨 [Anti-Corruption] Gagal mem-parse payload draf:",
          error,
        );
        return toast.error("Data draf korup. Silakan abaikan notifikasi ini.");
      }
    }

    setSettings((prev) => ({
      introHeadline: payloadObj.introHeadline ?? prev.introHeadline,
      introBody: payloadObj.introBody ?? prev.introBody,
    }));

    setIsEditing(true);
    toast.info("Draf berhasil dipulihkan", {
      description: "Silakan perbaiki dan simpan kembali.",
    });
  }, [rejectedIntro]);

  // --- 4. GHOST CLEANUP (DISCARD) ---
  const handleDiscardDraft = async () => {
    if (!rejectedIntro?.notrans) return;

    toast("Abaikan Notifikasi?", {
      description: "Draf penolakan ini akan dihapus secara permanen.",
      action: {
        label: "Abaikan Draf",
        onClick: async () => {
          const toastId = toast.loading("Membersihkan draf...");
          try {
            await api.patch(
              `/approval/discard/${encodeURIComponent(rejectedIntro.notrans)}`,
            );
            toast.success("Notifikasi berhasil diabaikan.", { id: toastId });
            setIsEditing(false);
            await refreshData();
          } catch (error: any) {
            toast.error("Gagal mengabaikan draf.", {
              description: error.response?.data?.message || "Kesalahan server.",
              id: toastId,
            });
          }
        },
      },
      cancel: {
        label: "Batal",
        onClick: () => {},
      },
    });
  };

  // --- 5. ATOMIC SUBMISSION ---
  const handleSave = async () => {
    if (shouldLockUI) {
      return toast.error("Akses Dibatasi", {
        description: "Data ini sedang ditinjau.",
      });
    }

    if (!hasDataChanged()) {
      toast.info("Tidak ada perubahan terdeteksi.", {
        description: "Data intro masih sama dengan versi Live.",
      });
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    const loadingToast = toast.loading(
      isSuperadmin
        ? "Menerapkan pembaruan live..."
        : "Mengajukan persetujuan...",
    );

    abortControllerRef.current = new AbortController();

    try {
      const payload: any = {
        introHeadline: settings.introHeadline.trim(),
        introBody: settings.introBody.trim(),
        status: isSuperadmin ? "Active" : "Published",
      };

      if (rejectedIntro?.notrans && isEditor) {
        payload.previous_notrans = rejectedIntro.notrans;
      }

      await api.put("/homepage/settings", payload, {
        timeout: 60000,
        signal: abortControllerRef.current.signal,
      });

      if (isEditor) {
        setIsOptimisticallyLocked(true);
      }

      setIsEditing(false);
      await refreshData();

      toast.success(
        isSuperadmin
          ? "Intro berhasil diupdate secara live!"
          : "Revisi intro diajukan!",
        { id: loadingToast },
      );
    } catch (error: any) {
      if (error.name === "CanceledError") return;
      console.error(error);
      toast.error("Gagal menyimpan data", {
        description:
          error.response?.data?.message ||
          "Silakan periksa koneksi atau coba lagi.",
        id: loadingToast,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* --- SOVEREIGN BANNERS (Contextual Awareness) --- */}

      {/* 1. Amber Banner (Superadmin Override Warning) */}
      {isOverrideMode && (
        <div className="bg-amber-50 border border-amber-200 p-4 md:p-5 rounded-xl flex items-center gap-4 animate-in slide-in-from-top-4 shadow-sm">
          <div className="bg-amber-100 p-2 rounded-full text-amber-600 shrink-0">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs md:text-sm font-black text-amber-900 uppercase tracking-tight">
              Mode Override Aktif
            </h4>
            <p className="text-[11px] md:text-xs text-amber-700 leading-relaxed mt-0.5 max-w-2xl">
              Anda sedang mengedit pengaturan yang sedang dalam antrean
              peninjauan.{" "}
              <span className="font-bold underline">
                Direct Commit akan membatalkan draf Editor secara sepihak.
              </span>
            </p>
          </div>
        </div>
      )}

      {/* 2. Blue Banner (Editor Locked Warning) */}
      {shouldLockUI && (
        <div className="bg-blue-50 border border-blue-200 p-4 md:p-5 rounded-xl flex items-center gap-4 animate-pulse shadow-sm">
          <div className="bg-blue-100 p-2 rounded-full text-blue-600 shrink-0">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs md:text-sm font-black text-blue-900 uppercase tracking-tight">
              Akses Dibatasi
            </h4>
            <p className="text-[11px] md:text-xs text-blue-700 leading-relaxed mt-0.5 max-w-2xl">
              Pengaturan ini sedang ditinjau. Anda tidak dapat melakukan
              perubahan hingga proses selesai.
            </p>
          </div>
        </div>
      )}

      {/* 3. Rejection Ribbon (Draft Needs Fixing) - 🛡️ Diubah menjadi Merah sesuai Blueprint */}
      {rejectedIntro && !isSuperadmin && (
        <div className="bg-red-50 border border-red-200 rounded-xl overflow-hidden shadow-sm animate-in slide-in-from-top-4 duration-300">
          <div className="p-4 md:p-5 flex flex-col sm:flex-row items-start justify-between gap-4 relative">
            <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-red-500"></div>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center shrink-0 mt-0.5 animate-pulse">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h4 className="text-xs md:text-sm font-black text-red-900 uppercase tracking-tighter mb-0.5">
                  Revisi Welcome Intro Ditolak
                </h4>
                <p className="text-xs text-red-800 leading-relaxed max-w-2xl">
                  Catatan Peninjau:{" "}
                  <span className="font-bold italic">
                    "
                    {rejectedIntro.rejection_reason ||
                      "Mohon periksa kembali data yang diinput."}
                    "
                  </span>
                  <br className="hidden sm:block" />
                  Klik tombol di samping untuk memulihkan draf terakhir Anda ke
                  dalam form.
                </p>
              </div>
            </div>

            <div className="w-full sm:w-auto flex flex-col sm:flex-row items-center gap-2">
              <button
                onClick={handleRestoreDraft}
                disabled={shouldLockUI || !isEditing}
                className="w-full sm:w-auto shrink-0 flex items-center justify-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-red-300 disabled:cursor-not-allowed text-white rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95">
                <RotateCcw className="w-3.5 h-3.5" />
                PULIHKAN DRAF
              </button>

              <button
                onClick={handleDiscardDraft}
                disabled={shouldLockUI}
                className="w-full sm:w-auto shrink-0 flex items-center justify-center gap-2 px-5 py-2.5 bg-white border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95">
                <XCircle className="w-3.5 h-3.5" />
                ABAIKAN
              </button>

              {!isEditing && (
                <p className="text-[10px] text-red-600 font-medium italic animate-pulse text-center absolute -bottom-5 sm:static sm:mt-2 w-full">
                  * Aktifkan "Editing Mode" untuk memulihkan.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- HEADER (MATRIX BUTTONS) --- */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 border-b border-slate-100 pb-4 gap-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
          <div>
            <h3 className="text-lg font-bold text-slate-900">
              Welcome Introduction
            </h3>
            <p className="text-sm text-slate-500 mt-1">
              Teks sambutan utama yang muncul tepat di bawah spanduk (hero
              banner).
            </p>
          </div>

          {/* Indikator Gembok Agregat */}
          {isDataLocked && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-bold uppercase tracking-wider border border-blue-100 mt-1 sm:mt-0 animate-pulse">
              <Lock className="w-3 h-3" /> Pending Approval
            </span>
          )}
        </div>

        <div className="flex gap-2 w-full sm:w-auto">
          {/* Edit Toggle Button */}
          <button
            onClick={() => {
              if (shouldLockUI) {
                return toast.error("Akses Dibatasi", {
                  description: "Data ini sedang dalam proses peninjauan.",
                });
              }
              setIsEditing(!isEditing);
            }}
            disabled={isSaving || shouldLockUI}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-black text-[11px] uppercase tracking-widest transition-colors border shadow-sm ${
              shouldLockUI
                ? "bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed"
                : isEditing
                  ? "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 ring-2 ring-amber-500/10"
                  : "bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200"
            }`}>
            {shouldLockUI ? (
              <Lock className="w-4 h-4 text-slate-300" />
            ) : isEditing ? (
              <Unlock className="w-4 h-4 text-amber-500" />
            ) : (
              <Lock className="w-4 h-4 text-slate-400" />
            )}
            <span>
              {shouldLockUI
                ? "System Locked"
                : isOverrideMode && isEditing
                  ? "Override Mode"
                  : isEditing
                    ? "Editing Mode"
                    : "Locked"}
            </span>
          </button>

          {/* Matrix Action Button (Publish/Request) - 🛡️ Disable jika !hasDataChanged() */}
          <button
            onClick={handleSave}
            disabled={
              isSaving || !isEditing || shouldLockUI || !hasDataChanged()
            }
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg font-black text-[11px] uppercase tracking-widest transition-all shadow-lg active:scale-95 disabled:cursor-not-allowed disabled:shadow-none ${
              isSaving || !hasDataChanged()
                ? "bg-slate-300 text-slate-700"
                : shouldLockUI
                  ? "bg-slate-200 text-slate-500"
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
                  : !hasDataChanged() && isEditing
                    ? "No Changes"
                    : isSuperadmin
                      ? "Publish Live"
                      : "Request Approval"}
            </span>
          </button>
        </div>
      </div>

      {/* --- FORM AREA (Aggressive Visual Lockdown) --- */}
      <div
        className={`bg-slate-50 p-6 rounded-xl border border-slate-200 transition-all duration-500 ${lockStyles}`}>
        <div className="space-y-5">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
              Main Headline
            </label>
            <input
              type="text"
              value={settings.introHeadline}
              disabled={isFormLocked}
              onChange={(e) =>
                setSettings({ ...settings, introHeadline: e.target.value })
              }
              className={`w-full px-4 py-3 rounded-lg font-serif text-2xl transition-all ${
                isEditing && !isFormLocked
                  ? "bg-white border border-slate-300 focus:ring-2 focus:ring-daw-green/20 shadow-sm"
                  : "bg-slate-100/50 border-transparent text-slate-500 cursor-not-allowed"
              }`}
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
              Body Content
            </label>
            <textarea
              rows={5}
              value={settings.introBody}
              disabled={isFormLocked}
              onChange={(e) =>
                setSettings({ ...settings, introBody: e.target.value })
              }
              className={`w-full px-4 py-3 rounded-lg text-base transition-all resize-none ${
                isEditing && !isFormLocked
                  ? "bg-white border border-slate-300 focus:ring-2 focus:ring-daw-green/20 shadow-sm"
                  : "bg-slate-100/50 border-transparent text-slate-500 cursor-not-allowed"
              }`}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
