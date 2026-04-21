import { useState, useEffect, useCallback } from "react";
import { useHome } from "@/contexts/HomeContext";
import { useAuth } from "@/contexts/AuthContext";
import { Save, Lock, Unlock, AlertTriangle, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";

export default function IntroManager() {
  const { settings: initialSettings, refreshData } = useHome();
  const { user } = useAuth();
  const isSuperadmin =
    user?.role?.toLowerCase() === "superadmin" ||
    user?.role?.toLowerCase() === "admin";
  const isEditor = user?.role?.toLowerCase() === "editor";
  // State Utama Form
  const [settings, setSettings] = useState({
    introHeadline: "",
    introBody: "",
  });

  // State UI & Lifecycle
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isOptimisticallyLocked, setIsOptimisticallyLocked] = useState(false);
  const [rejectedDraft, setRejectedDraft] = useState<any | null>(null);

  // --- 1. SINKRONISASI DATA DARI CONTEXT ---
  useEffect(() => {
    if (initialSettings && !isEditing) {
      setSettings({
        introHeadline: initialSettings.introHeadline || "",
        introBody: initialSettings.introBody || "",
      });
      if (!initialSettings.is_locked) {
        setIsOptimisticallyLocked(false);
      }
    }
  }, [initialSettings, isEditing]);

  // --- 2. THE RESTORATION ENGINE (Cari Draf Ditolak) ---
  useEffect(() => {
    if (isSuperadmin) return;

    const controller = new AbortController();
    const fetchRejectedDraft = async () => {
      try {
        const res = await api.get("/approval/rejected/1?module=HomeSettings", {
          signal: controller.signal,
        });
        if (res.data.hasRejected) {
          setRejectedDraft(res.data.data);
        }
      } catch (err: any) {
        if (err.name !== "CanceledError")
          console.log("Tidak ada draf ditolak.");
      }
    };

    fetchRejectedDraft();
    return () => controller.abort();
  }, [isSuperadmin]);

  // --- 3. RESTORE HANDLER (Deep Merge) ---
  const handleRestoreDraft = useCallback(() => {
    if (!rejectedDraft?.payload) return;
    const payload = rejectedDraft.payload;

    setSettings((prev) => ({
      introHeadline: payload.introHeadline ?? prev.introHeadline,
      introBody: payload.introBody ?? prev.introBody,
    }));

    setIsEditing(true);
    toast.info("Draf berhasil dipulihkan", {
      description: "Silakan perbaiki dan simpan kembali.",
    });
  }, [rejectedDraft]);

  // --- 4. ATOMIC SUBMISSION ---
  const handleSave = async () => {
    if (
      settings.introHeadline === (initialSettings?.introHeadline || "") &&
      settings.introBody === (initialSettings?.introBody || "")
    ) {
      toast.info("Tidak ada perubahan", {
        description: "Data masih sama dengan versi Live.",
      });
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    const loadingToast = toast.loading(
      isEditor ? "Mengajukan persetujuan..." : "Menyimpan Perubahan...",
    );

    try {
      const payload: any = {
        introHeadline: settings.introHeadline,
        introBody: settings.introBody,
        status: isSuperadmin ? "Active" : "Published",
      };

      if (rejectedDraft?.notrans && isEditor) {
        payload.previous_notrans = rejectedDraft.notrans;
      }

      await api.put("/settings", payload, { timeout: 60000 });

      if (isEditor) {
        setIsOptimisticallyLocked(true);
      }

      setIsEditing(false);
      setRejectedDraft(null); // Bersihkan banner penolakan

      await refreshData();
      toast.success(
        isSuperadmin ? "Intro terupdate!" : "Revisi intro diajukan!",
        {
          id: loadingToast,
        },
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

  const isServerLocked = !!initialSettings?.is_locked;
  const isFormLocked = !isEditing || isServerLocked || isOptimisticallyLocked;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* ⚠️ THE RESTORATION BANNER (Hanya muncul untuk Editor jika draf ditolak) */}
      {rejectedDraft && !isSuperadmin && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 md:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm relative overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-amber-500"></div>
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center shrink-0 mt-0.5 animate-pulse">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-amber-900 mb-0.5">
                Revisi Welcome Intro Ditolak
              </h3>
              <p className="text-xs text-amber-700 leading-relaxed max-w-2xl">
                Catatan Peninjau:{" "}
                <span className="font-bold italic">
                  "
                  {rejectedDraft.rejection_reason ||
                    "Mohon periksa kembali data yang diinput."}
                  "
                </span>
                <br className="hidden sm:block" />
                Klik tombol di samping untuk memulihkan draf terakhir Anda ke
                dalam form.
              </p>
            </div>
          </div>
          <button
            onClick={handleRestoreDraft}
            disabled={isServerLocked || isOptimisticallyLocked}
            className="w-full sm:w-auto shrink-0 flex items-center justify-center gap-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-300 text-white rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95">
            <RotateCcw className="w-4 h-4" />
            Restore Draft
          </button>
        </div>
      )}

      {/* --- HEADER --- */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 border-b border-slate-100 pb-4 gap-4">
        <div className="flex items-center gap-3">
          <div>
            <h3 className="text-lg font-bold text-slate-900">
              Welcome Introduction
            </h3>
            <p className="text-sm text-slate-500 mt-1">
              Teks sambutan utama yang muncul tepat di bawah spanduk (hero
              banner).
            </p>
          </div>

          {/* 🔒 PENDING BADGE (Sembunyikan jika Superadmin) */}
          {(isServerLocked || isOptimisticallyLocked) && !isSuperadmin && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-bold uppercase tracking-wider border border-blue-100 mt-1 sm:mt-0">
              <Lock className="w-3 h-3" /> Pending Approval
            </span>
          )}
        </div>

        <div className="flex gap-2 w-full sm:w-auto">
          <button
            onClick={() => {
              // Pencegahan klik untuk Editor jika terkunci
              if ((isServerLocked || isOptimisticallyLocked) && !isSuperadmin) {
                return toast.error("Akses Terbatas", {
                  description: "Data ini sedang dalam proses peninjauan.",
                });
              }
              setIsEditing(!isEditing);
            }}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-bold text-xs transition-colors border ${
              isEditing
                ? "bg-amber-100 text-amber-700 border-amber-200"
                : (isServerLocked || isOptimisticallyLocked) && !isSuperadmin
                  ? "bg-slate-50 text-slate-400 border-slate-100 cursor-not-allowed"
                  : "bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200"
            }`}>
            {isEditing ? (
              <Unlock className="w-4 h-4" />
            ) : (
              <Lock className="w-4 h-4" />
            )}
            <span>{isEditing ? "Editing Mode" : "Locked"}</span>
          </button>

          <button
            onClick={handleSave}
            disabled={isSaving || isFormLocked}
            className="flex items-center gap-2 bg-daw-green hover:bg-[#003b1c] disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-5 py-2 rounded-lg font-medium transition-colors shadow-sm">
            <Save className="w-4 h-4" />
            <span>
              {isSaving
                ? "Saving..."
                : isSuperadmin
                  ? "Publish"
                  : "Request Approval"}
            </span>
          </button>
        </div>
      </div>

      {/* --- FORM AREA --- */}
      <div
        className={`bg-slate-50 p-6 rounded-xl border border-slate-200 transition-all duration-500 ${
          // Visual Lockdown: Hanya buram jika user adalah Editor dan data terkunci
          (isServerLocked || isOptimisticallyLocked) && !isSuperadmin
            ? "opacity-60 grayscale-[20%] pointer-events-none"
            : ""
        }`}>
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
              disabled={isFormLocked}
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
