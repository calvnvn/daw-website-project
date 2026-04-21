import { useState, useEffect, useCallback } from "react";
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

  // --- State Utama Form ---
  const [settings, setSettings] = useState({
    introHeadline: "",
    introBody: "",
  });

  // 🚀 Sub-Langkah 2.1: Snapshotting (Jangkar Diff Engine)
  const [originalData, setOriginalData] = useState(settings);

  // State UI & Lifecycle
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isOptimisticallyLocked, setIsOptimisticallyLocked] = useState(false);

  const isServerLocked = !!initialSettings?.is_locked;
  const isDataLocked = isServerLocked || isOptimisticallyLocked;

  const shouldLockUI = isDataLocked && !isSuperadmin;
  const isOverrideMode = isDataLocked && isSuperadmin;

  const lockStyles = shouldLockUI
    ? "opacity-60 grayscale-[30%] pointer-events-none cursor-not-allowed select-none"
    : "";

  // --- 1. SINKRONISASI DATA & SNAPSHOTTING ---
  useEffect(() => {
    if (initialSettings && !isEditing) {
      const data = {
        introHeadline: initialSettings.introHeadline || "",
        introBody: initialSettings.introBody || "",
      };
      setSettings(data);
      setOriginalData(data);

      if (!initialSettings.is_locked) {
        setIsOptimisticallyLocked(false);
      }
    }
  }, [initialSettings, isEditing]);

  // --- 2. RESTORE HANDLER (Menggunakan Data Context) ---
  const handleRestoreDraft = useCallback(() => {
    if (!rejectedIntro?.payload) return;
    const payload = rejectedIntro.payload;

    setSettings((prev) => ({
      introHeadline: payload.introHeadline ?? prev.introHeadline,
      introBody: payload.introBody ?? prev.introBody,
    }));

    setIsEditing(true);
    toast.info("Draf berhasil dipulihkan", {
      description: "Silakan perbaiki dan simpan kembali.",
    });
  }, [rejectedIntro]);

  const hasDataChanged = useCallback(() => {
    return JSON.stringify(settings) !== JSON.stringify(originalData);
  }, [settings, originalData]);

  // --- 3. ATOMIC SUBMISSION ---
  const handleSave = async () => {
    // Guardrail tambahan: Cegah eksekusi paksa jika form sedang terkunci
    if (shouldLockUI) {
      return toast.error("Akses Dibatasi", {
        description: "Data ini sedang ditinjau.",
      });
    }

    // Eksekusi Diff Engine
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

    try {
      const payload: any = {
        introHeadline: settings.introHeadline,
        introBody: settings.introBody,
        status: isSuperadmin ? "Active" : "Published",
      };

      // Injeksi tiket lama jika ini adalah resubmission draf yang ditolak
      if (rejectedIntro?.notrans && isEditor) {
        payload.previous_notrans = rejectedIntro.notrans;
      }

      await api.put("/settings", payload, { timeout: 60000 });

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

  const isFormLocked = !isEditing || shouldLockUI;
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
              🔒 Akses Dibatasi
            </h4>
            <p className="text-[11px] md:text-xs text-blue-700 leading-relaxed mt-0.5 max-w-2xl">
              Pengaturan ini sedang ditinjau. Anda tidak dapat melakukan
              perubahan hingga proses selesai.
            </p>
          </div>
        </div>
      )}

      {/* 3. Rejection Ribbon (Draft Needs Fixing) */}
      {rejectedIntro && !isSuperadmin && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl overflow-hidden shadow-sm animate-in slide-in-from-top-4 duration-300">
          <div className="p-4 md:p-5 flex flex-col sm:flex-row items-start justify-between gap-4 relative">
            <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-amber-500"></div>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center shrink-0 mt-0.5 animate-pulse">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h4 className="text-xs md:text-sm font-black text-amber-900 uppercase tracking-tighter mb-0.5">
                  Revisi Welcome Intro Ditolak
                </h4>
                <p className="text-xs text-amber-800 leading-relaxed max-w-2xl">
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

            <div className="w-full sm:w-auto flex flex-col items-center gap-2">
              <button
                onClick={handleRestoreDraft}
                disabled={shouldLockUI || !isEditing}
                className="w-full shrink-0 flex items-center justify-center gap-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-300 disabled:cursor-not-allowed text-white rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95">
                <RotateCcw className="w-3.5 h-3.5" />
                PULIHKAN DRAF
              </button>
              {!isEditing && (
                <p className="text-[10px] text-amber-600 font-medium italic animate-pulse text-center">
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

          {/* Matrix Action Button (Publish/Request) */}
          <button
            onClick={handleSave}
            disabled={isSaving || !isEditing || shouldLockUI}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg font-black text-[11px] uppercase tracking-widest transition-all shadow-lg active:scale-95 disabled:cursor-not-allowed disabled:shadow-none ${
              isSaving
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
              disabled={!isEditing}
              onChange={(e) =>
                setSettings({ ...settings, introHeadline: e.target.value })
              }
              className={`w-full px-4 py-3 rounded-lg font-serif text-2xl transition-all ${
                isEditing
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
              disabled={!isEditing}
              onChange={(e) =>
                setSettings({ ...settings, introBody: e.target.value })
              }
              className={`w-full px-4 py-3 rounded-lg text-base transition-all ${
                isEditing
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
