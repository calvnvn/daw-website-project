/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Save,
  Lock,
  Unlock,
  Plus,
  Trash2,
  Image as ImageIcon,
  Building,
  Type,
  AlertTriangle,
  RotateCcw,
  ShieldAlert,
  Loader2,
  Send,
  Clock,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useInvestments } from "@/contexts/InvestmentContext";
import { useAuth } from "@/contexts/AuthContext";
import api from "@/lib/api";
import { getCleanImageUrl } from "@/lib/utils";

interface LocalAffiliate {
  id: number | string;
  name: string;
  desc: string;
  category: "fnb" | "steel" | "finance" | "edu";
  websiteUrl?: string | null;
  logoUrl: string | null;
  newLogoFile?: File | null;
  removePhoto?: boolean;
  isNew?: boolean;
  is_locked?: boolean;
  lock_ticket?: string | null;
  has_rejected?: boolean;
  previous_notrans?: string | null;
  isDirty?: boolean;
}

const LogoPreviewer = React.memo(
  ({
    file,
    savedUrl,
    isEditing,
    onRemove,
  }: {
    file?: File | null;
    savedUrl: string | null;
    isEditing: boolean;
    onRemove: () => void;
  }) => {
    const previewUrl = useMemo(() => {
      if (file) return URL.createObjectURL(file);
      return getCleanImageUrl(savedUrl);
    }, [file, savedUrl]);

    useEffect(() => {
      return () => {
        if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
      };
    }, [previewUrl]);

    return (
      <div
        className={`relative aspect-square rounded-lg border-2 border-dashed flex flex-col items-center justify-center p-2 overflow-hidden transition-colors ${
          isEditing
            ? "border-slate-300 bg-white hover:border-daw-green cursor-pointer group/preview"
            : "border-slate-200 bg-slate-100/50 cursor-not-allowed"
        }`}>
        {previewUrl ? (
          <>
            <img
              src={previewUrl}
              alt="Logo"
              className="w-full h-full object-contain p-1"
            />
            {isEditing && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove();
                }}
                className="absolute top-1 right-1 p-1.5 bg-red-500/90 hover:bg-red-600 text-white rounded-md opacity-0 group-hover/preview:opacity-100 transition-opacity"
                title="Hapus Logo">
                <X className="w-3 h-3" />
              </button>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center text-center space-y-1.5 animate-in fade-in">
            <ImageIcon
              className={`w-6 h-6 ${isEditing ? "text-daw-green" : "text-slate-400"}`}
            />
            <span
              className={`text-[9px] font-medium leading-tight ${isEditing ? "text-slate-700" : "text-slate-400"}`}>
              Upload Logo
            </span>
          </div>
        )}
      </div>
    );
  },
);
LogoPreviewer.displayName = "LogoPreviewer";

export default function InvestmentsManager() {
  const { user } = useAuth();
  const isSuperadmin = user?.role === "superadmin" || user?.role === "admin";

  const [activeTab, setActiveTab] = useState<"content" | "companies">(
    "content",
  );
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [hideDraftBanner, setHideDraftBanner] = useState(false);

  const { settings, companies, rejectedSettings, refreshData } =
    useInvestments();

  // STATES & SNAPSHOTS (DIFF ENGINE)
  const [pageContent, setPageContent] = useState({
    teaserHeadline: "",
    teaserBody: "",
    sectionIntro: "",
  });
  const [originalContent, setOriginalContent] = useState(pageContent);

  const [localCompanies, setLocalCompanies] = useState<LocalAffiliate[]>([]);
  const [, setOriginalCompanies] = useState<LocalAffiliate[]>([]);
  const [rejectedAffiliates, setRejectedAffiliates] = useState<
    Record<string, any>
  >({});

  const isSettingsLockedForEditor =
    settings?.is_locked === true && !isSuperadmin;
  const isSettingsOverrideMode = settings?.is_locked === true && isSuperadmin;

  const currentLockState =
    activeTab === "content" ? isSettingsLockedForEditor : false;

  const lockStyles = currentLockState
    ? "opacity-60 grayscale-[30%] pointer-events-none cursor-not-allowed select-none"
    : "";

  useEffect(() => {
    if (!isEditing) {
      if (settings) {
        const content = {
          teaserHeadline: settings.teaserHeadline || "",
          teaserBody: settings.teaserBody || "",
          sectionIntro: settings.sectionIntro || "",
        };
        setPageContent(content);
        setOriginalContent(content);
      }

      if (companies) {
        const comps = companies.map((c: any) => ({
          ...c,
          websiteUrl: c.websiteUrl ?? "",
          logoUrl: c.logoUrl || null,
          is_locked: c.is_locked || false,
          lock_ticket: c.lock_ticket || null,
          has_rejected: c.has_rejected || false,
          isDirty: false,
          removePhoto: false,
        }));
        setLocalCompanies(comps);
        setOriginalCompanies(comps);
      }

      setHideDraftBanner(false);
    }
  }, [settings, companies, isEditing]);

  useEffect(() => {
    const controller = new AbortController();

    const fetchRejectedDrafts = async () => {
      if (!companies || companies.length === 0) return;

      const rejectedComps = companies.filter((c) => c.has_rejected);
      if (rejectedComps.length === 0) return;

      try {
        const promises = rejectedComps.map((comp) =>
          api
            .get(`/approval/rejected/${comp.id}?module=Affiliate`, {
              signal: controller.signal,
            })
            .then((res) => ({ id: comp.id, data: res.data })),
        );

        const results = await Promise.allSettled(promises);

        const newRejectedState: Record<string, any> = {};

        results.forEach((result) => {
          if (result.status === "fulfilled" && result.value.data.hasRejected) {
            newRejectedState[result.value.id] = result.value.data.data;
          }
        });

        setRejectedAffiliates((prev) => ({ ...prev, ...newRejectedState }));
      } catch (error: any) {
        if (error?.name !== "CanceledError" && error?.code !== "ERR_CANCELED") {
          console.error("🚨 Gagal memuat kumpulan draf penolakan:", error);
        }
      }
    };

    fetchRejectedDrafts();

    return () => controller.abort();
  }, [companies]);

  const handleRestoreAffiliateDraft = (companyId: string | number) => {
    const draft = rejectedAffiliates[companyId];
    if (!draft?.payload) return;

    if (draft.action === "DELETE") {
      return toast.error("Tidak dapat memulihkan.", {
        description: "Draf ini adalah permintaan penghapusan data.",
      });
    }

    try {
      const rawPayload = draft.payload;
      const payload =
        typeof rawPayload === "string" ? JSON.parse(rawPayload) : rawPayload;

      setLocalCompanies((prev) =>
        prev.map((c) => {
          if (c.id === companyId) {
            return {
              ...c,
              name: payload.name ?? c.name,
              desc: payload.desc ?? c.desc,
              category: payload.category ?? c.category,
              websiteUrl: payload.websiteUrl ?? c.websiteUrl,
              removePhoto:
                payload.removePhoto === "true" ? true : c.removePhoto,
              previous_notrans: draft.notrans,
              isDirty: true,
              has_rejected: false,
            };
          }
          return c;
        }),
      );

      setRejectedAffiliates((prev) => {
        const newObj = { ...prev };
        delete newObj[companyId];
        return newObj;
      });

      if (!isEditing) setIsEditing(true);
      toast.success(`Draf afiliasi berhasil dipulihkan.`);
    } catch (e) {
      toast.error("Gagal memproses struktur data draf.");
    }
  };

  // Fungsi Discard Level-Item
  const handleDiscardAffiliateDraft = async (companyId: string | number) => {
    const draft = rejectedAffiliates[companyId];
    if (!draft?.notrans) return;

    const toastId = toast.loading("Mengabaikan notifikasi penolakan...");
    try {
      const safeTicket = encodeURIComponent(draft.notrans);
      await api.patch(`/approval/discard/${safeTicket}`);

      setLocalCompanies((prev) =>
        prev.map((c) =>
          c.id === companyId ? { ...c, has_rejected: false } : c,
        ),
      );

      setRejectedAffiliates((prev) => {
        const newObj = { ...prev };
        delete newObj[companyId];
        return newObj;
      });

      toast.success("Notifikasi revisi afiliasi diabaikan.", { id: toastId });
    } catch (error: any) {
      toast.error("Gagal mengabaikan draf", {
        id: toastId,
        description: error.response?.data?.message,
      });
    }
  };

  const hasSettingsChanged = useCallback(() => {
    return JSON.stringify(pageContent) !== JSON.stringify(originalContent);
  }, [pageContent, originalContent]);
  const handleRestoreSettingsDraft = useCallback(() => {
    if (!rejectedSettings?.payload) {
      toast.error("Data pemulihan tidak ditemukan.");
      return;
    }

    if (rejectedSettings.action === "DELETE") {
      toast.error("Tidak dapat memulihkan.", {
        description:
          "Draf ini adalah permintaan penghapusan data, tidak ada teks yang bisa dipulihkan.",
      });
      return;
    }

    try {
      const rawPayload = rejectedSettings.payload;
      const payload =
        typeof rawPayload === "string" ? JSON.parse(rawPayload) : rawPayload;

      setPageContent((prev) => ({
        teaserHeadline: payload.teaserHeadline ?? prev.teaserHeadline,
        teaserBody: payload.teaserBody ?? prev.teaserBody,
        sectionIntro: payload.sectionIntro ?? prev.sectionIntro,
      }));

      setIsEditing(true);
      setHideDraftBanner(true);

      toast.success("Draf berhasil disuntikkan ke formulir.", {
        description: "Silakan perbaiki data dan klik Request Approval.",
      });
    } catch (error) {
      console.error("🚨 [RESTORE_PARSE_ERROR]:", error);
      toast.error("Gagal memproses struktur data pemulihan.");
    }
  }, [rejectedSettings]);

  const handleDiscardDraft = async () => {
    if (!rejectedSettings?.notrans) {
      toast.error("Nomor tiket tidak valid.");
      return;
    }

    const toastId = toast.loading("Mengabaikan notifikasi penolakan...");

    try {
      const safeTicket = encodeURIComponent(rejectedSettings.notrans);

      await api.patch(`/approval/discard/${safeTicket}`);

      toast.success("Notifikasi revisi berhasil diabaikan.", { id: toastId });

      setHideDraftBanner(true);

      await refreshData();
    } catch (error: any) {
      toast.error("Gagal mengabaikan draf", {
        id: toastId,
        description:
          error.response?.data?.message ||
          "Kesalahan komunikasi dengan server.",
      });
    }
  };

  const handleSaveCompanies = async () => {
    const dirtyCompanies = localCompanies.filter(
      (comp) =>
        comp.name.trim() &&
        (comp.isNew || comp.isDirty) &&
        !(comp.is_locked && !isSuperadmin),
    );

    if (dirtyCompanies.length === 0) return;

    const saveTasks = dirtyCompanies.map((comp) => {
      const formData = new FormData();
      formData.append("name", comp.name);
      formData.append("desc", comp.desc || "");
      formData.append("category", comp.category);
      formData.append("websiteUrl", comp.websiteUrl || "");
      formData.append("status", "Published");

      if (comp.previous_notrans)
        formData.append("previous_notrans", comp.previous_notrans);
      if (comp.newLogoFile) formData.append("logo", comp.newLogoFile);
      if (comp.removePhoto) formData.append("removePhoto", "true");

      const config = { timeout: 60000 };

      const request = comp.isNew
        ? api.post("/investments/affiliates", formData, config)
        : api.put(`/investments/affiliates/${comp.id}`, formData, config);

      return request.then((res) => ({ id: comp.id, response: res }));
    });

    const results = await Promise.allSettled(saveTasks);

    const successfulIds = new Set(
      results
        .filter((r) => r.status === "fulfilled")
        .map((r: any) => r.value.id),
    );

    if (successfulIds.size > 0) {
      setLocalCompanies((prev) =>
        prev.map((c) =>
          successfulIds.has(c.id)
            ? { ...c, isDirty: false, isNew: false, previous_notrans: null }
            : c,
        ),
      );
    }

    const hasError = results.some((r) => r.status === "rejected");
    if (hasError) throw new Error("Partial sync failure");
  };

  const handleSaveSettings = async () => {
    const payload = {
      ...pageContent,
      status: "Published",
      previous_notrans: rejectedSettings?.notrans || null,
    };

    await api.put("/investments/settings", payload, { timeout: 60000 });
  };

  // THE GATEKEEPER SAVE EXECUTION
  const handleSave = async () => {
    if (activeTab === "content" && currentLockState) {
      return toast.error("Akses Dibatasi.", {
        description: "Data teks sedang dalam peninjauan.",
      });
    }

    const anyCompanyChanged = localCompanies.some(
      (c) => (c.isNew || c.isDirty) && !(c.is_locked && !isSuperadmin),
    );

    if (activeTab === "content" && !hasSettingsChanged()) {
      setIsEditing(false);
      return toast.info("Tidak ada perubahan terdeteksi.");
    }

    if (activeTab === "companies" && !anyCompanyChanged) {
      setIsEditing(false);
      return toast.info("Tidak ada perubahan valid yang bisa disimpan.");
    }

    setIsSaving(true);
    const loadingToast = toast.loading(
      isSuperadmin
        ? "Menyimpan secara live..."
        : "Mengirim revisi ke sistem...",
    );

    try {
      if (activeTab === "content") {
        await handleSaveSettings();
      } else {
        await handleSaveCompanies();
      }

      toast.success(
        isSuperadmin
          ? "Pembaruan berhasil diterapkan!"
          : "Perubahan berhasil diajukan!",
        { id: loadingToast },
      );

      await refreshData();
      setIsEditing(false);
    } catch (err: any) {
      toast.error(
        err.message === "Partial sync failure"
          ? "Sebagian data gagal disimpan. Yang lain berhasil."
          : err.response?.data?.message || "Gagal memproses data.",
        { id: loadingToast },
      );
    } finally {
      setIsSaving(false);
    }
  };

  // ARRAY MUTATION HANDLERS
  const addCompany = () => {
    setLocalCompanies([
      {
        id: `temp-${Date.now()}`,
        name: "",
        desc: "",
        category: "fnb",
        websiteUrl: "",
        logoUrl: null,
        isNew: true,
        isDirty: true,
        is_locked: false,
      },
      ...localCompanies,
    ]);
  };

  const removeCompany = (id: number | string) => {
    const target = localCompanies.find((c) => c.id === id);
    if (!target || (target.is_locked && !isSuperadmin)) return;

    toast.warning(`Hapus ${target.name || "Perusahaan"}?`, {
      description: isSuperadmin
        ? "Data akan dihapus permanen dari server."
        : "Permintaan hapus akan dikirim ke sistem approval.",
      action: {
        label: "Eksekusi Hapus",
        onClick: async () => {
          if (target.isNew) {
            setLocalCompanies((prev) => prev.filter((c) => c.id !== id));
            return toast.success("Draf dibatalkan.");
          }

          toast.promise(api.delete(`/investments/affiliates/${id}`), {
            loading: `Memproses ${target.name}...`,
            success: (response) => {
              if (response.status === 202) {
                setLocalCompanies((prev) =>
                  prev.map((c) =>
                    c.id === id
                      ? {
                          ...c,
                          is_locked: true,
                          lock_ticket: response.data.ticket,
                        }
                      : c,
                  ),
                );
                refreshData(); // Sinkronisasi background
                return "Pengajuan hapus dikirim. Data dikunci.";
              } else {
                // Admin path (200)
                setLocalCompanies((prev) => prev.filter((c) => c.id !== id));
                return "Berhasil dihapus permanen.";
              }
            },
            error: (err) => err.response?.data?.message || "Gagal menghapus",
          });
        },
      },
      cancel: { label: "Batal", onClick: () => {} },
    });
  };

  const updateCompany = (
    id: number | string,
    field: keyof LocalAffiliate,
    value: any,
  ) => {
    setLocalCompanies((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, [field]: value, isDirty: true } : c,
      ),
    );
  };

  const handleLogoChange = (id: number | string, file: File) => {
    if (!file) return;
    updateCompany(id, "newLogoFile", file);
    updateCompany(id, "removePhoto", false);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500 pb-12">
      {/* SOVEREIGN BANNERS (Contextual Awareness) */}
      {/* AMBER BANNER: Sovereign Bypass (Khusus Admin) */}
      {isSettingsOverrideMode && activeTab === "content" && (
        <div className="bg-amber-50 border-l-4 border-l-amber-500 border-y border-r border-amber-200 p-4 rounded-xl flex items-center gap-4 animate-in slide-in-from-top-4 shadow-sm">
          <div className="bg-amber-100 p-2 rounded-full text-amber-600 shrink-0">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-black text-amber-900 uppercase tracking-tight">
              Mode Override Aktif
            </h4>
            <p className="text-xs text-amber-700 leading-relaxed mt-0.5">
              Anda sedang mengedit data yang sedang dalam antrean peninjauan.
              <span className="font-bold underline">
                Direct Commit akan membatalkan draf Editor secara sepihak.
              </span>
            </p>
          </div>
        </div>
      )}

      {/* BLUE BANNER: Locked UI (Khusus Editor) */}
      {currentLockState && (
        <div className="bg-blue-50 border-l-4 border-l-blue-500 border-y border-r border-blue-200 p-4 rounded-xl flex items-center gap-4 animate-pulse shadow-sm">
          <div className="bg-blue-100 p-2 rounded-full text-blue-600 shrink-0">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-black text-blue-900 uppercase tracking-tight">
              Akses Dibatasi
            </h4>
            <p className="text-xs text-blue-700 leading-relaxed mt-0.5">
              Data pada halaman ini sedang ditinjau. Anda tidak dapat melakukan
              perubahan hingga proses selesai.
            </p>
          </div>
        </div>
      )}

      {/* C. RED/AMBER BANNER: Recovery Banner (Rejection Feedback) UX CLEANUP FIXED: Menambahkan handleDiscardDraft dan state hideDraftBanner */}
      {rejectedSettings && activeTab === "content" && !hideDraftBanner && (
        <div className="bg-red-50 border-l-4 border-l-red-500 border-y border-r border-red-200 rounded-xl overflow-hidden shadow-sm animate-in slide-in-from-top-4 duration-300">
          <div className="p-5 flex gap-4 items-start">
            <div className="bg-red-100 p-2.5 rounded-lg h-fit shrink-0">
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
                {rejectedSettings.rejection_reason ||
                  "Silakan perbaiki data sesuai arahan."}
                "
              </p>

              {/* ACTION BUTTONS CONTAINER */}
              <div className="pt-2 flex flex-col sm:flex-row sm:items-center gap-3">
                {/* ACTION 1: PULIHKAN DATA (Primary Action) */}
                <button
                  onClick={handleRestoreSettingsDraft}
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

                {/* ACTION 2: ABAIKAN NOTIFIKASI (Secondary Action / Clean Discard) */}
                <button
                  onClick={handleDiscardDraft}
                  className="flex items-center justify-center gap-2 bg-white border border-red-200 text-red-600 hover:bg-red-50 px-4 py-2.5 rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95">
                  <X className="w-3.5 h-3.5" />
                  ABAIKAN NOTIFIKASI
                </button>

                {/* Helper Text jika tidak dalam mode edit */}
                {!isEditing && (
                  <p className="text-[10px] text-red-500 font-medium italic animate-pulse ml-2">
                    * Aktifkan "Editing Mode" untuk memulihkan.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* HEADER AREA & ACTION MATRIX*/}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm top-0 z-30">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-serif font-black text-slate-900 tracking-tight">
              Investments Manager
            </h1>
            {(settings?.is_locked ||
              localCompanies.some((c) => c.is_locked)) && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-600 rounded-full text-[10px] font-black uppercase tracking-tighter border border-blue-100 animate-pulse">
                <Clock className="w-3 h-3" /> PENDING
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Kelola ekosistem investasi, konten teks promosi, dan logo perusahaan
            afiliasi secara terpusat.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* THE "VIEW-ONLY" / EDIT TOGGLE LINK */}
          <button
            onClick={() => {
              if (currentLockState)
                return toast.error("Akses Dibatasi", {
                  description: "Data teks sedang dalam antrean approval.",
                });
              setIsEditing(!isEditing);
            }}
            disabled={isSaving || currentLockState}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-black text-[11px] uppercase tracking-widest transition-all border shadow-sm ${
              currentLockState
                ? "bg-slate-50 text-slate-300 border-slate-200 cursor-not-allowed"
                : isEditing
                  ? "bg-amber-50 text-amber-700 border-amber-200 ring-4 ring-amber-500/5 hover:bg-amber-100"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300"
            }`}>
            {currentLockState ? (
              <Lock className="w-4 h-4 text-slate-400" />
            ) : isEditing ? (
              <Unlock className="w-4 h-4 text-amber-500" />
            ) : (
              <Lock className="w-4 h-4 text-slate-400" />
            )}
            <span>
              {currentLockState
                ? "Locked"
                : isSettingsOverrideMode && isEditing && activeTab === "content"
                  ? "Override Mode"
                  : isEditing
                    ? "Editing Mode"
                    : "Locked"}
            </span>
          </button>

          {/* THE SOVEREIGN / CONTEXTUAL SAVE BUTTON */}
          <button
            onClick={handleSave}
            disabled={
              isSaving ||
              !isEditing ||
              currentLockState ||
              (activeTab === "companies" &&
                !localCompanies.some((c) => c.isDirty || c.isNew)) ||
              (activeTab === "content" && !hasSettingsChanged())
            }
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-black text-[11px] uppercase tracking-widest transition-all shadow-lg active:scale-95 disabled:cursor-not-allowed disabled:shadow-none ${
              isSaving
                ? "bg-slate-300 text-slate-700"
                : currentLockState
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
                : isSuperadmin
                  ? "Publish Live"
                  : "Request Approval"}
            </span>
          </button>
        </div>
      </div>

      {/* TABS NAVIGATION & MICRO-INDICATORS */}
      <div className="flex items-end overflow-x-auto border border-slate-200 border-b-0 shadow-sm bg-white rounded-t-xl px-2 pt-2 hide-scrollbar">
        {/* TAB 1: PAGE CONTENT */}
        <button
          onClick={() => !isSaving && setActiveTab("content")}
          className={`flex items-center gap-2 px-6 py-3 font-bold text-sm uppercase tracking-wider border-b-2 transition-colors whitespace-nowrap ${
            isSaving ? "cursor-wait opacity-80" : ""
          } ${activeTab === "content" ? "border-daw-green text-daw-green bg-green-50/30" : "border-transparent text-slate-400 hover:text-slate-700 hover:bg-slate-50"}`}>
          <Type className="w-4 h-4" />
          <span>Page Content</span>
          <div className="flex items-center gap-1 ml-1">
            {/* VISUAL TOKEN FIXED: Red Pulse untuk Rejected */}
            {rejectedSettings && (
              <span title="Revisi Diperlukan">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse ring-2 ring-white" />
              </span>
            )}
            {settings?.is_locked && !rejectedSettings && (
              <span title="Pending Approval">
                <Lock className="w-3 h-3 text-blue-500" />
              </span>
            )}
          </div>
        </button>

        {/* TAB 2: AFFILIATED COMPANIES */}
        <button
          onClick={() => !isSaving && setActiveTab("companies")}
          className={`flex items-center gap-2 px-6 py-3 font-bold text-sm uppercase tracking-wider border-b-2 transition-colors whitespace-nowrap ${
            isSaving ? "cursor-wait opacity-80" : ""
          } ${activeTab === "companies" ? "border-daw-green text-daw-green bg-green-50/30" : "border-transparent text-slate-400 hover:text-slate-700 hover:bg-slate-50"}`}>
          <Building className="w-4 h-4" />
          <span>Affiliated Companies</span>
          <div className="flex items-center gap-1 ml-1">
            {localCompanies.some((c) => c.has_rejected) && (
              <span title="Revisi Diperlukan">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse ring-2 ring-white" />
              </span>
            )}
            {localCompanies.some((c) => c.is_locked && !c.has_rejected) && (
              <span title="Pending Approval">
                <Lock className="w-3 h-3 text-blue-500" />
              </span>
            )}
          </div>
        </button>
      </div>

      {/* TAB CONTENT AREA */}
      <div className="bg-white rounded-b-xl border border-t-0 border-slate-200 shadow-sm p-6 lg:p-8 min-h-[500px] transition-all duration-500">
        {/* TAB 1: PAGE CONTENT (SINGLETON) */}
        {activeTab === "content" && (
          <div className="space-y-8 animate-in fade-in duration-300">
            <div
              className={`bg-slate-50 p-6 rounded-xl border border-slate-200 relative overflow-hidden transition-all duration-500 ${lockStyles}`}>
              {settings?.is_locked && !isSuperadmin && (
                <div className="absolute top-0 right-0 bg-blue-100 text-blue-700 px-3 py-1.5 rounded-bl-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm z-10">
                  <Lock className="w-3 h-3" /> Locked
                </div>
              )}
              {settings?.is_locked && isSuperadmin && isEditing && (
                <div className="absolute top-0 right-0 bg-amber-500 text-white px-3 py-1.5 rounded-bl-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm z-10">
                  <ShieldAlert className="w-3 h-3" /> Override Active
                </div>
              )}

              <h3 className="text-base font-bold text-slate-900 mb-4 border-b border-slate-200 pb-2">
                Home Page Teaser Content
              </h3>
              <div className="space-y-4 relative z-0">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Teaser Headline
                  </label>
                  <input
                    type="text"
                    value={pageContent.teaserHeadline}
                    onChange={(e) =>
                      setPageContent({
                        ...pageContent,
                        teaserHeadline: e.target.value,
                      })
                    }
                    disabled={!isEditing || currentLockState}
                    className={`w-full px-3 py-2 rounded-lg font-serif text-lg transition-all duration-300 ${
                      isEditing && !currentLockState
                        ? "bg-white border border-slate-300 text-slate-900 focus:ring-2 focus:ring-daw-green/20 shadow-inner"
                        : "bg-slate-100/50 border-transparent text-slate-500 cursor-not-allowed"
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Teaser Body Text
                  </label>
                  <textarea
                    rows={3}
                    value={pageContent.teaserBody}
                    onChange={(e) =>
                      setPageContent({
                        ...pageContent,
                        teaserBody: e.target.value,
                      })
                    }
                    disabled={!isEditing || currentLockState}
                    className={`w-full px-3 py-2 rounded-lg resize-none transition-all duration-300 ${
                      isEditing && !currentLockState
                        ? "bg-white border border-slate-300 text-slate-900 focus:ring-2 focus:ring-daw-green/20 shadow-inner"
                        : "bg-slate-100/50 border-transparent text-slate-500 cursor-not-allowed"
                    }`}
                  />
                </div>
              </div>
            </div>

            <div
              className={`bg-slate-50 p-6 rounded-xl border border-slate-200 relative overflow-hidden transition-all duration-500 ${lockStyles}`}>
              <h3 className="text-base font-bold text-slate-900 mb-4 border-b border-slate-200 pb-2">
                Main Investments Page
              </h3>
              <div className="relative z-0">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Ecosystem Intro Text
                </label>
                <textarea
                  rows={2}
                  value={pageContent.sectionIntro}
                  onChange={(e) =>
                    setPageContent({
                      ...pageContent,
                      sectionIntro: e.target.value,
                    })
                  }
                  disabled={!isEditing || currentLockState}
                  className={`w-full px-3 py-2 rounded-lg resize-none transition-all duration-300 ${
                    isEditing && !currentLockState
                      ? "bg-white border border-slate-300 text-slate-900 focus:ring-2 focus:ring-daw-green/20 shadow-inner"
                      : "bg-slate-100/50 border-transparent text-slate-500 cursor-not-allowed"
                  }`}
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: AFFILIATED COMPANIES (COLLECTION) */}
        {activeTab === "companies" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Building className="w-5 h-5 text-daw-green" /> Company
                  Network
                </h3>
                <p className="text-sm text-slate-500 mt-1">
                  Add or edit logos and details for the Constellation Grid.
                </p>
              </div>
              {isEditing && (
                <button
                  onClick={addCompany}
                  disabled={isSaving}
                  className="flex items-center gap-1.5 px-4 py-2 bg-daw-green/10 hover:bg-daw-green hover:text-white disabled:opacity-50 disabled:cursor-not-allowed text-daw-green rounded-lg text-sm font-bold transition-colors">
                  <Plus className="w-4 h-4" /> Add Company
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {localCompanies.map((company) => {
                const isNeedsRevision = company.has_rejected === true;
                const isPending = company.is_locked && !isNeedsRevision;
                const isDeleting =
                  isPending && company.lock_ticket?.includes("DEL");
                const isLockedForEditor = isPending && !isSuperadmin;
                const isOverrideModeItem = isPending && isSuperadmin;

                const cardStyle = isDeleting
                  ? "bg-rose-50/40 border-l-4 border-l-rose-500 border-rose-200 grayscale opacity-80"
                  : isNeedsRevision
                    ? "bg-red-50/30 border-l-4 border-l-red-500 border-red-200 shadow-sm ring-1 ring-red-500/20"
                    : isOverrideModeItem
                      ? "bg-amber-50/30 border-l-4 border-l-amber-500 border-amber-200 ring-1 ring-amber-500/20"
                      : isLockedForEditor
                        ? "bg-slate-50 border-l-4 border-l-blue-500 border-slate-200 grayscale opacity-70 pointer-events-none"
                        : "bg-slate-50 border-slate-200 hover:border-slate-300 hover:shadow-sm";
                const draft = rejectedAffiliates[company.id];
                return (
                  <div
                    key={company.id}
                    className={`flex flex-col gap-4 p-5 rounded-xl border transition-all relative ${cardStyle}`}>
                    {isNeedsRevision && draft && (
                      <div className="w-full bg-red-50 border-l-4 border-l-red-500 border-y border-r border-red-200 rounded-lg p-3.5 shadow-sm animate-in fade-in slide-in-from-top-2">
                        <div className="flex flex-col gap-2.5">
                          <div className="flex items-center gap-2 text-red-900">
                            <AlertTriangle className="w-4 h-4" />
                            <span className="text-xs font-black uppercase tracking-tighter">
                              ⚠️ Catatan Peninjau
                            </span>
                          </div>

                          <p className="text-xs font-medium text-red-800 bg-white/60 p-2.5 rounded border border-red-200/50 shadow-inner">
                            "
                            {draft.rejection_reason ||
                              "Silakan perbaiki data sesuai arahan."}
                            "
                          </p>

                          {/* ACTION BUTTONS (Sama dengan format Tab 1 tapi ukuran lebih compact) */}
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            <button
                              onClick={() =>
                                handleRestoreAffiliateDraft(company.id)
                              }
                              disabled={!isEditing}
                              title={
                                !isEditing
                                  ? "Buka mode edit untuk memulihkan"
                                  : "Pulihkan draf"
                              }
                              className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 disabled:bg-red-300 disabled:cursor-not-allowed text-white px-4 py-2 rounded-md text-[10px] font-bold transition-all shadow-sm active:scale-95">
                              <RotateCcw
                                className={`w-3 h-3 ${isEditing ? "" : "opacity-50"}`}
                              />
                              PULIHKAN DATA
                            </button>

                            <button
                              onClick={() =>
                                handleDiscardAffiliateDraft(company.id)
                              }
                              className="flex items-center gap-1.5 bg-white border border-red-200 hover:bg-red-50 text-red-600 px-4 py-2 rounded-md text-[10px] font-bold transition-all shadow-sm active:scale-95">
                              <X className="w-3 h-3" />
                              ABAIKAN NOTIFIKASI
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="flex gap-4 items-start w-full">
                      {/* LOGO UPLOAD & INDICATOR BADGES */}
                      <div className="w-24 shrink-0 relative">
                        <div className="absolute -top-3 -right-3 z-20 flex flex-col gap-1.5">
                          {isDeleting && (
                            <span
                              className="flex h-5 w-5 items-center justify-center text-white rounded-full bg-rose-500 shadow-sm ring-2 ring-white"
                              title="Menunggu Penghapusan">
                              <Trash2 className="w-3 h-3" />
                            </span>
                          )}
                          {isPending && !isDeleting && (
                            <span
                              className={`flex h-5 w-5 items-center justify-center text-white rounded-full shadow-sm ring-2 ring-white ${isSuperadmin ? "bg-amber-500" : "bg-blue-500"}`}
                              title={`Terkunci: ${company.lock_ticket}`}>
                              <Lock className="w-3 h-3" />
                            </span>
                          )}
                          {/* Pulse Merah tetap ada sebagai fallback visual */}
                          {isNeedsRevision && (
                            <span
                              className="flex h-5 w-5 relative"
                              title="Revisi Ditolak: Butuh Perbaikan">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-5 w-5 bg-red-500 items-center justify-center text-[10px] text-white font-bold ring-2 ring-white">
                                !
                              </span>
                            </span>
                          )}
                          {(company.isDirty || company.isNew) &&
                            !isPending &&
                            !isNeedsRevision && (
                              <span
                                className="flex h-5 w-5 items-center justify-center bg-daw-green text-white rounded-full shadow-sm ring-2 ring-white animate-in zoom-in"
                                title="Perubahan Belum Disimpan">
                                <Save className="w-2.5 h-2.5" />
                              </span>
                            )}
                        </div>

                        <LogoPreviewer
                          file={company.newLogoFile}
                          savedUrl={
                            company.removePhoto ? null : company.logoUrl
                          }
                          isEditing={
                            isEditing &&
                            !isLockedForEditor &&
                            !isDeleting &&
                            !isNeedsRevision
                          }
                          onRemove={() => {
                            updateCompany(company.id, "removePhoto", true);
                            updateCompany(company.id, "newLogoFile", null);
                          }}
                        />
                        {isEditing &&
                          !isLockedForEditor &&
                          !isDeleting &&
                          !isNeedsRevision && (
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) =>
                                e.target.files?.[0] &&
                                handleLogoChange(company.id, e.target.files[0])
                              }
                              className="absolute inset-0 opacity-0 cursor-pointer z-10"
                            />
                          )}
                      </div>

                      {/* COMPANY DETAILS FORM */}
                      <fieldset
                        disabled={
                          !isEditing ||
                          isLockedForEditor ||
                          isDeleting ||
                          isNeedsRevision
                        }
                        className="flex-1 space-y-3">
                        <div>
                          <input
                            type="text"
                            value={company.name}
                            placeholder="Company Name"
                            onChange={(e) =>
                              updateCompany(company.id, "name", e.target.value)
                            }
                            className={`w-full px-3 py-1.5 text-sm rounded-md font-bold transition-all duration-300 outline-none
                              ${isDeleting ? "line-through text-rose-800" : "text-slate-900"} 
                              ${isEditing && !isLockedForEditor && !isDeleting && !isNeedsRevision ? "bg-white border border-slate-300 focus:ring-2 focus:ring-daw-green/20" : "bg-transparent border-transparent"}`}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <input
                            type="text"
                            placeholder="Sub-text (Optional)"
                            value={company.desc}
                            onChange={(e) =>
                              updateCompany(company.id, "desc", e.target.value)
                            }
                            className={`w-full px-3 py-1.5 text-xs rounded-md outline-none ${isEditing && !isLockedForEditor && !isDeleting && !isNeedsRevision ? "bg-white border border-slate-300 focus:border-daw-green" : "bg-transparent border-transparent text-slate-500"}`}
                          />
                          <select
                            value={company.category}
                            onChange={(e) =>
                              updateCompany(
                                company.id,
                                "category",
                                e.target.value,
                              )
                            }
                            className={`w-full px-3 py-1.5 text-xs rounded-md outline-none ${isEditing && !isLockedForEditor && !isDeleting && !isNeedsRevision ? "bg-white border border-slate-300 focus:border-daw-green" : "bg-transparent border-transparent text-slate-500 appearance-none"}`}>
                            <option value="fnb">Food & Beverage</option>
                            <option value="steel">Steel</option>
                            <option value="finance">Finance</option>
                            <option value="edu">Education</option>
                            {!["fnb", "steel", "finance", "edu"].includes(
                              company.category,
                            ) && (
                              <option
                                value={company.category}
                                className="text-red-500">
                                ⚠ Unknown ({company.category})
                              </option>
                            )}
                          </select>
                        </div>
                        <input
                          type="url"
                          placeholder="Website URL (https://)"
                          value={company.websiteUrl || ""}
                          onChange={(e) =>
                            updateCompany(
                              company.id,
                              "websiteUrl",
                              e.target.value,
                            )
                          }
                          className={`w-full px-3 py-1.5 text-xs rounded-md outline-none ${isEditing && !isLockedForEditor && !isDeleting && !isNeedsRevision ? "bg-white border border-slate-300 focus:border-daw-green" : "bg-transparent border-transparent text-slate-500"}`}
                        />
                      </fieldset>

                      {/* ACTION BUTTONS */}
                      {isEditing &&
                        !isLockedForEditor &&
                        !isDeleting &&
                        !isNeedsRevision && (
                          <button
                            onClick={() => removeCompany(company.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md shrink-0 transition-colors"
                            title="Ajukan Penghapusan">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* EMPTY STATE (Blueprint Part 5) */}
            {localCompanies.length === 0 && (
              <div className="col-span-full py-16 text-center text-slate-500 flex flex-col items-center gap-3 bg-slate-50 rounded-xl border border-slate-200 border-dashed">
                <Building className="w-10 h-10 text-slate-300" />
                <div>
                  <h4 className="font-bold text-slate-700">
                    Portofolio Kosong
                  </h4>
                  <p className="text-xs mt-1">
                    Belum ada perusahaan afiliasi. Klik "Add Company" untuk
                    memulai.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
