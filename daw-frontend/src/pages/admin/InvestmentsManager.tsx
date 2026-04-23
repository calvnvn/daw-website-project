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
} from "lucide-react";
import { toast } from "sonner";
import { useInvestments } from "@/contexts/InvestmentContext";
import { useAuth } from "@/contexts/AuthContext";
import api from "@/lib/api";
import { getCleanImageUrl } from "@/lib/utils";
import { isDirty } from "zod/v3";
interface LocalAffiliate {
  id: number | string;
  name: string;
  desc: string;
  category: "fnb" | "steel" | "finance" | "edu";
  websiteUrl?: string | null;
  logoUrl: string | null;
  newLogoFile?: File | null;
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
  }: {
    file?: File | null;
    savedUrl: string | null;
    isEditing: boolean;
  }) => {
    // 1. Generate preview secara sinkron (Anti-flicker fixed)
    const previewUrl = useMemo(() => {
      if (file) {
        return URL.createObjectURL(file);
      }
      // utility getCleanImageUrl memastikan balikan string kosong "" jika savedUrl null
      return getCleanImageUrl(savedUrl);
    }, [file, savedUrl]);

    // 2. CLEANUP: Revoke ObjectURL (Memory leak fixed)
    useEffect(() => {
      return () => {
        if (previewUrl.startsWith("blob:")) {
          URL.revokeObjectURL(previewUrl);
        }
      };
    }, [previewUrl]);

    return (
      <div
        className={`relative aspect-square rounded-lg border-2 border-dashed flex flex-col items-center justify-center p-2 overflow-hidden transition-colors ${
          isEditing
            ? "border-slate-300 bg-white hover:border-daw-green cursor-pointer"
            : "border-slate-200 bg-slate-100/50 cursor-not-allowed"
        }`}>
        {previewUrl ? (
          <img
            src={previewUrl}
            alt="Logo Preview" // Alt text tetap ada untuk aksesibilitas
            className="w-full h-full object-contain p-1"
            key={previewUrl}
            // Hapus onLoad & onError manual dari sini, sudah dihandle useMemo + utility
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-center space-y-1.5 animate-in fade-in duration-300">
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

  // 🚀 TAHAP 1: THE CONTEXT INJECTION
  const { settings, companies, rejectedSettings, refreshData } =
    useInvestments();

  // --- STATES & SNAPSHOTS (DIFF ENGINE) ---
  const [pageContent, setPageContent] = useState({
    teaserHeadline: "",
    teaserBody: "",
    sectionIntro: "",
  });
  const [originalContent, setOriginalContent] = useState(pageContent);

  const [localCompanies, setLocalCompanies] = useState<LocalAffiliate[]>([]);
  const [originalCompanies, setOriginalCompanies] = useState<LocalAffiliate[]>(
    [],
  );

  // 🚀 SOVEREIGN LOGIC (Kasta & Gembok)
  const isSettingsLocked = settings?.is_locked === true;
  const shouldLockSettings = isSettingsLocked && !isSuperadmin;

  const hasLockedCompanies = localCompanies.some((c) => c.is_locked === true);
  const shouldLockCompaniesAgg = hasLockedCompanies && !isSuperadmin;

  const currentLockState =
    activeTab === "content" ? shouldLockSettings : shouldLockCompaniesAgg;
  const isOverrideMode =
    (activeTab === "content" ? isSettingsLocked : hasLockedCompanies) &&
    isSuperadmin;

  const lockStyles = currentLockState
    ? "opacity-60 grayscale-[30%] pointer-events-none cursor-not-allowed select-none"
    : "";

  // --- 🚀 SYNC & SNAPSHOT ENGINE ---
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
        }));
        setLocalCompanies(comps);
        setOriginalCompanies(comps);
      }
    }
  }, [settings, companies, isEditing]);

  const hasSettingsChanged = useCallback(() => {
    return JSON.stringify(pageContent) !== JSON.stringify(originalContent);
  }, [pageContent, originalContent]);

  const hasCompaniesChanged = useCallback(() => {
    const sanitizeForDiff = (arr: LocalAffiliate[]) =>
      arr.map(
        ({
          newLogoFile,
          is_locked,
          lock_ticket,
          has_rejected,
          previous_notrans,
          ...rest
        }) => rest,
      );

    return (
      JSON.stringify(sanitizeForDiff(localCompanies)) !==
      JSON.stringify(sanitizeForDiff(originalCompanies))
    );
  }, [localCompanies, originalCompanies]);

  // --- RESTORATION HANDLER ---
  const handleRestoreSettingsDraft = useCallback(() => {
    if (!rejectedSettings?.payload) return;

    const payload = rejectedSettings.payload;
    setPageContent((prev) => ({
      teaserHeadline: payload.teaserHeadline ?? prev.teaserHeadline,
      teaserBody: payload.teaserBody ?? prev.teaserBody,
      sectionIntro: payload.sectionIntro ?? prev.sectionIntro,
    }));

    setIsEditing(true);
    toast.info("Draf berhasil dipulihkan.", {
      description: "Silakan perbaiki dan simpan kembali.",
    });
  }, [rejectedSettings]);

  // --- SAVE HANDLERS ---
  const handleSaveSettings = async () => {
    const payload = {
      ...pageContent,
      status: "Published",
      previous_notrans: rejectedSettings?.notrans || null,
    };
    await api.put("/investment/settings", payload, { timeout: 60000 });
  };

  const handleSaveCompanies = async () => {
    const dirtyCompanies = localCompanies.filter(
      (comp) => comp.name.trim() && (comp.isNew || comp.isDirty),
    );

    if (dirtyCompanies.length === 0) return;

    const saveTasks = dirtyCompanies.map((comp) => {
      if (comp.is_locked && !comp.isNew) return Promise.resolve(comp);

      const formData = new FormData();
      formData.append("name", comp.name);
      formData.append("desc", comp.desc || "");
      formData.append("category", comp.category);
      formData.append("websiteUrl", comp.websiteUrl || "");
      formData.append("status", "Published");

      if (comp.previous_notrans)
        formData.append("previous_notrans", comp.previous_notrans);
      if (comp.newLogoFile) formData.append("logo", comp.newLogoFile);

      const config = { timeout: 60000 };

      if (comp.isNew) {
        return api
          .post("/investment/affiliate", formData, config)
          .then((res) => ({
            ...comp,
            id: res.data.data?.id || res.data.id,
            isNew: false,
            isDirty: false,
            newLogoFile: null,
            is_locked: !isSuperadmin,
          }));
      } else {
        return api
          .put(`/investment/affiliate/${comp.id}`, formData, config)
          .then(() => ({
            ...comp,
            isDirty: false,
            newLogoFile: null,
            is_locked: !isSuperadmin,
          }));
      }
    });

    const results = await Promise.allSettled(saveTasks);

    setLocalCompanies((prev) => {
      return prev.map((existing) => {
        const taskIndex = dirtyCompanies.findIndex((d) => d.id === existing.id);

        if (taskIndex !== -1) {
          const result = results[taskIndex];
          if (result.status === "fulfilled") {
            return result.value;
          }
        }
        return existing;
      });
    });

    const hasError = results.some((r) => r.status === "rejected");
    if (hasError) throw new Error("Partial sync failure");
  };

  // THE GATEKEEPER SAVE EXECUTION
  const handleSave = async () => {
    if (currentLockState) {
      return toast.error("Akses Dibatasi.", {
        description: "Data ini sedang dalam peninjauan.",
      });
    }

    const anyCompanyChanged = localCompanies.some((c) => c.isNew || c.isDirty);

    if (activeTab === "content" && !hasSettingsChanged()) {
      setIsEditing(false);
      return toast.info("Tidak ada perubahan terdeteksi.", {
        description: "Data Content masih sama dengan versi live.",
      });
    }

    if (activeTab === "companies" && !anyCompanyChanged) {
      setIsEditing(false);
      return toast.info("Tidak ada perubahan terdeteksi.", {
        description: "Data perusahaan masih sama dengan versi live.",
      });
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

  // --- ARRAY MUTATION HANDLERS ---
  const addCompany = () => {
    setLocalCompanies([
      ...localCompanies,
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
    ]);
  };

  const removeCompany = (id: number | string) => {
    const target = localCompanies.find((c) => c.id === id);
    if (!target || target.is_locked) return;

    toast.warning(`Remove ${target.name || "Company"}?`, {
      description: isSuperadmin
        ? "Data akan dihapus permanen dari server."
        : "Permintaan hapus akan dikirim ke sistem approval.",
      action: {
        label: "Remove",
        onClick: async () => {
          if (target.isNew) {
            setLocalCompanies((prev) => prev.filter((c) => c.id !== id));
            toast.success("Removed from list");
            return;
          }

          toast.promise(
            async () => {
              const response = await api.delete(`/investment/affiliate/${id}`);

              if (response.status === 202) {
                await refreshData();
              } else {
                setLocalCompanies((prev) => prev.filter((c) => c.id !== id));
              }
            },
            {
              loading: `Processing ${target.name}...`,
              success: isSuperadmin
                ? "Deleted permanently."
                : "Delete request submitted.",
              error: (err) => err.response?.data?.message || "Failed to delete",
            },
          );
        },
      },
      cancel: { label: "Cancel", onClick: () => {} },
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
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500 pb-12">
      {/* --- SOVEREIGN BANNERS (Contextual Awareness) --- */}
      {/* 1. Amber Banner (superadmin Override Warning) */}
      {isOverrideMode && (
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-center gap-4 animate-in slide-in-from-top-4 shadow-sm">
          <div className="bg-amber-100 p-2 rounded-full text-amber-600 shrink-0">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-black text-amber-900 uppercase tracking-tight">
              Mode Override Aktif
            </h4>
            <p className="text-xs text-amber-700 leading-relaxed mt-0.5">
              Anda sedang mengedit data yang sedang dalam antrean peninjauan.{" "}
              <span className="font-bold underline">
                Direct Commit akan membatalkan draf Editor secara sepihak.
              </span>
            </p>
          </div>
        </div>
      )}

      {/* 2. Blue Banner (Editor Locked Warning) */}
      {currentLockState && (
        <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl flex items-center gap-4 animate-pulse shadow-sm">
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

      {/* 3. Rejection Ribbon (Draft Needs Fixing) */}
      {/* 🚀 FIXED: Menggunakan rejectedSettings dari Context */}
      {rejectedSettings && activeTab === "content" && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl overflow-hidden shadow-sm animate-in slide-in-from-top-4 duration-300">
          <div className="p-4 flex gap-4 items-start">
            <div className="bg-amber-100 p-2 rounded-lg h-fit shrink-0">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <div className="flex-1 space-y-2">
              <div className="flex justify-between items-center">
                <h4 className="text-xs font-black text-amber-900 uppercase tracking-tighter">
                  ⚠️ Catatan Peninjau
                </h4>
              </div>
              <p className="text-xs text-amber-800 leading-relaxed font-bold italic bg-white/60 p-2.5 rounded border border-amber-200/50">
                "
                {rejectedSettings.rejection_reason ||
                  "Silakan perbaiki data sesuai arahan."}
                "
              </p>
              <div className="pt-2 flex flex-col sm:flex-row sm:items-center gap-3">
                <button
                  onClick={handleRestoreSettingsDraft}
                  disabled={!isEditing}
                  className="flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-300 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95">
                  <RotateCcw className="w-3.5 h-3.5" /> PULIHKAN DRAF
                </button>
                {!isEditing && (
                  <p className="text-[10px] text-amber-600 font-medium italic animate-pulse">
                    * Aktifkan "Editing Mode" untuk memulihkan draf.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- HEADER (MATRIX BUTTONS) --- */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm top-0 z-30">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-serif font-black text-slate-900 tracking-tight">
              Investments Manager
            </h1>
            {/* Indikator gembok level halaman (Agregat) */}
            {(settings?.is_locked || hasLockedCompanies) && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-600 rounded-full text-[10px] font-black uppercase tracking-tighter border border-blue-100 animate-pulse">
                <Clock className="w-3 h-3" /> Pending Approval
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Kelola ekosistem investasi, konten teks promosi, dan logo perusahaan
            afiliasi secara terpusat.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* Edit Toggle Button */}
          <button
            onClick={() => {
              if (currentLockState) {
                return toast.error("Akses Dibatasi", {
                  description: "Data sedang dalam antrean approval.",
                });
              }
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
                ? "System Locked"
                : isOverrideMode && isEditing
                  ? "Override Mode"
                  : isEditing
                    ? "Editing Mode"
                    : "Locked"}
            </span>
          </button>

          {/* Matrix Action Button */}
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
            ) : currentLockState ? (
              <Lock className="w-4 h-4" />
            ) : isSuperadmin ? (
              <Save className="w-4 h-4" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            <span>
              {isSaving
                ? "Memproses..."
                : currentLockState
                  ? "Akses Terbatas"
                  : isSuperadmin
                    ? "Publish Live"
                    : "Request Approval"}
            </span>
          </button>
        </div>
      </div>

      {/* --- TABS NAVIGATION --- */}
      <div className="flex items-end overflow-x-auto border border-slate-200 border-b-0 shadow-sm bg-white rounded-t-xl px-2 pt-2 hide-scrollbar">
        {/* TAB 1: PAGE CONTENT */}
        <button
          onClick={() => !isSaving && setActiveTab("content")}
          className={`flex items-center gap-2 px-6 py-3 font-bold text-sm uppercase tracking-wider border-b-2 transition-colors whitespace-nowrap ${
            isSaving ? "cursor-wait opacity-80" : ""
          } ${
            activeTab === "content"
              ? "border-daw-green text-daw-green"
              : "border-transparent text-slate-400 hover:text-slate-700"
          }`}>
          <Type className="w-4 h-4" />
          <span>Page Content</span>
          <div className="flex items-center gap-1 ml-1">
            {rejectedSettings && (
              <span title="Revision Required">
                <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              </span>
            )}
            {settings?.is_locked && (
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
          } ${
            activeTab === "companies"
              ? "border-daw-green text-daw-green"
              : "border-transparent text-slate-400 hover:text-slate-700"
          }`}>
          <Building className="w-4 h-4" />
          <span>Affiliated Companies</span>
          <div className="flex items-center gap-1 ml-1">
            {localCompanies.some((c) => c.has_rejected) && (
              <span title="Revision Required">
                <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              </span>
            )}
            {hasLockedCompanies && (
              <span title="Pending Approval">
                <Lock className="w-3 h-3 text-blue-500" />
              </span>
            )}
          </div>
        </button>
      </div>

      {/* --- TAB CONTENT AREA --- */}
      <div
        className={`bg-white rounded-b-xl border border-t-0 border-slate-200 shadow-sm p-6 lg:p-8 min-h-[500px] transition-all duration-500`}>
        {/* TAB 1: PAGE CONTENT (SINGLETON)           */}
        {activeTab === "content" && (
          <div className="space-y-8 animate-in fade-in duration-300">
            <div
              className={`bg-slate-50 p-6 rounded-xl border border-slate-200 relative overflow-hidden transition-all duration-500 ${lockStyles}`}>
              {/* Badge Lock Internal Form */}
              {settings?.is_locked && (
                <div className="absolute top-0 right-0 bg-blue-100 text-blue-700 px-3 py-1 rounded-bl-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-sm z-10">
                  <Lock className="w-3 h-3" /> Locked
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
              {settings?.is_locked && (
                <div className="absolute top-0 right-0 bg-blue-100 text-blue-700 px-3 py-1 rounded-bl-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-sm z-10">
                  <Lock className="w-3 h-3" /> Locked
                </div>
              )}
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

        {/* TAB 2: AFFILIATED COMPANIES (COLLECTION)  */}
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
              {isEditing && !currentLockState && (
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
                const isThisCardLockedByEditor =
                  company.is_locked && !isSuperadmin;
                const isThisCardLockedByAdmin =
                  company.is_locked && isSuperadmin;

                return (
                  <div
                    key={company.id}
                    className={`flex gap-4 items-start p-5 rounded-xl border group transition-all relative ${
                      isThisCardLockedByEditor
                        ? "opacity-60 grayscale-[30%] pointer-events-none bg-slate-50 border-slate-200"
                        : isThisCardLockedByAdmin
                          ? "bg-amber-50/50 border-amber-200 ring-2 ring-amber-500/20"
                          : company.has_rejected
                            ? "bg-amber-50/30 border-amber-200 ring-2 ring-amber-500/40"
                            : "bg-slate-50 border-slate-200 hover:border-slate-300"
                    }`}>
                    {/* LOGO UPLOAD COMPONENT */}
                    <div className="w-24 shrink-0 relative">
                      <div className="absolute -top-3 -right-3 z-20 flex flex-col gap-1.5">
                        {company.has_rejected && (
                          <span
                            title="Revisi Ditolak: Butuh Perbaikan"
                            className="flex h-5 w-5 relative">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-5 w-5 bg-amber-500 items-center justify-center text-[10px] text-white font-bold shadow-sm ring-2 ring-white">
                              !
                            </span>
                          </span>
                        )}
                        {company.is_locked && (
                          <span
                            title={`Dikunci (${company.lock_ticket})`}
                            className={`flex h-5 w-5 items-center justify-center text-white rounded-full shadow-sm ring-2 ring-white z-10 ${isSuperadmin ? "bg-amber-500" : "bg-blue-500"}`}>
                            <Lock className="w-3 h-3" />
                          </span>
                        )}
                        {(company.isDirty || company.isNew) &&
                          !company.is_locked && (
                            <span
                              title={
                                company.isNew
                                  ? "Data Baru"
                                  : "Perubahan Belum Disimpan"
                              }
                              className="flex h-5 w-5 items-center justify-center bg-daw-green text-white rounded-full shadow-sm ring-2 ring-white z-10 animate-in zoom-in duration-300">
                              <Save className="w-2.5 h-2.5" />
                            </span>
                          )}
                      </div>

                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 text-center">
                        Logo
                      </label>
                      <div
                        className={`relative group ${isThisCardLockedByEditor ? "pointer-events-none" : ""}`}>
                        <LogoPreviewer
                          file={company.newLogoFile}
                          savedUrl={company.logoUrl}
                          isEditing={isEditing && !isThisCardLockedByEditor}
                        />

                        {isEditing && !isThisCardLockedByEditor && (
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
                    </div>

                    {/* COMPANY DETAILS */}
                    <fieldset
                      disabled={!isEditing || isThisCardLockedByEditor}
                      className="flex-1 space-y-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                          Company Name
                        </label>
                        <input
                          type="text"
                          value={company.name}
                          onChange={(e) =>
                            updateCompany(company.id, "name", e.target.value)
                          }
                          className={`w-full px-3 py-1.5 text-sm rounded-md font-bold transition-all duration-300 ${
                            isEditing && !isThisCardLockedByEditor
                              ? "bg-white border border-slate-300 text-slate-900 focus:ring-2 focus:ring-daw-green/20 shadow-inner"
                              : "bg-slate-100/50 border-transparent text-slate-500"
                          }`}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                            Sub-text (Optional)
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. PT. BPR..."
                            value={company.desc}
                            onChange={(e) =>
                              updateCompany(company.id, "desc", e.target.value)
                            }
                            className={`w-full px-3 py-1.5 text-xs rounded-md transition-all duration-300 ${
                              isEditing && !isThisCardLockedByEditor
                                ? "bg-white border border-slate-300 text-slate-900 focus:ring-2 focus:ring-daw-green/20 shadow-inner"
                                : "bg-slate-100/50 border-transparent text-slate-500"
                            }`}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                            Industry
                          </label>
                          <select
                            value={company.category}
                            onChange={(e) =>
                              updateCompany(
                                company.id,
                                "category",
                                e.target.value,
                              )
                            }
                            className={`w-full px-3 py-1.5 text-xs rounded-md transition-all duration-300 ${
                              isEditing && !isThisCardLockedByEditor
                                ? "bg-white border border-slate-300 text-slate-900 focus:ring-2 focus:ring-daw-green/20 shadow-inner"
                                : "bg-slate-100/50 border-transparent text-slate-500 appearance-none"
                            }`}>
                            <option value="fnb">Food & Beverage</option>
                            <option value="steel">Steel</option>
                            <option value="finance">
                              Finance / Microfinance
                            </option>
                            <option value="edu">Education</option>
                            {!["fnb", "steel", "finance", "edu"].includes(
                              company.category,
                            ) && (
                              <option
                                value={company.category}
                                className="text-red-500">
                                ⚠ Unknown Category ({company.category})
                              </option>
                            )}
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                          Website Link (Optional)
                        </label>
                        <input
                          type="url"
                          placeholder="e.g. https://www.example.com"
                          value={company.websiteUrl || ""}
                          onChange={(e) =>
                            updateCompany(
                              company.id,
                              "websiteUrl",
                              e.target.value,
                            )
                          }
                          className={`w-full px-3 py-1.5 text-xs rounded-md transition-all duration-300 ${
                            isEditing && !isThisCardLockedByEditor
                              ? "bg-white border border-slate-300 text-slate-900 focus:ring-2 focus:ring-daw-green/20 shadow-inner"
                              : "bg-slate-100/50 border-transparent text-slate-500"
                          }`}
                        />
                      </div>
                    </fieldset>

                    {/* DELETE ACTION */}
                    {isEditing && !isThisCardLockedByEditor && (
                      <button
                        onClick={() => removeCompany(company.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors mt-5 shrink-0"
                        title="Remove Company">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                );
              })}

              {localCompanies.length === 0 && (
                <div className="col-span-full py-10 text-center text-slate-500 italic flex flex-col items-center gap-2">
                  <Building className="w-8 h-8 text-slate-300 mb-2" />
                  Belum ada perusahaan afiliasi. Klik "Add Company" untuk
                  memulai.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
