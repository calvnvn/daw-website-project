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
} from "lucide-react";
import { toast } from "sonner";
import { useInvestments } from "@/contexts/InvestmentContext";
import api, { BASE_UPLOAD_URL } from "@/lib/api";
import { getCleanImageUrl } from "@/lib/utils";

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
        {/* 🛡️ PERBAIKAN DISPLAY: Cek apakah previewUrl benar-benar ada data string-nya */}
        {previewUrl ? (
          <img
            src={previewUrl}
            alt="Logo Preview" // Alt text tetap ada untuk aksesibilitas
            className="w-full h-full object-contain p-1"
            key={previewUrl}
            // Hapus onLoad & onError manual dari sini, sudah dihandle useMemo + utility
          />
        ) : (
          /* --- 🛡️ PERBAIKAN UI: Tampilkan Ikon Placeholder yang Bersih --- */
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
  const [activeTab, setActiveTab] = useState<"content" | "companies">(
    "content",
  );
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const { settings, companies, refreshData } = useInvestments();

  const [pageContent, setPageContent] = useState({
    teaserHeadline: "",
    teaserBody: "",
    sectionIntro: "",
  });

  const [localCompanies, setLocalCompanies] = useState<LocalAffiliate[]>([]);
  const [rejectedSettingsDraft, setRejectedSettingsDraft] = useState<
    any | null
  >(null);

  // Resilient Fetching & Abort Controller
  useEffect(() => {
    const controller = new AbortController();

    const checkRejectedDrafts = async () => {
      try {
        // Kita cek modul Singleton (Settings) dengan targetId 1
        const res = await api.get(
          "/approval/rejected/1?module=InvestmentSettings",
          {
            signal: controller.signal,
          },
        );

        if (res.data.hasRejected) {
          setRejectedSettingsDraft(res.data.data);
        }
      } catch (err: any) {
        if (err.name !== "CanceledError") {
          console.error("Failed to fetch rejected drafts:", err);
        }
      }
    };

    checkRejectedDrafts();

    return () => {
      controller.abort(); // Cleanup jika komponen di-unmount cepat
    };
  }, []);

  useEffect(() => {
    if (!isEditing) {
      if (settings) {
        setPageContent({
          teaserHeadline: settings.teaserHeadline || "",
          teaserBody: settings.teaserBody || "",
          sectionIntro: settings.sectionIntro || "",
        });
      }
      if (companies) {
        setLocalCompanies(
          companies.map((c: any) => ({
            ...c,
            websiteUrl: c.websiteUrl ?? "",
            logoUrl: c.logoUrl || null,
            is_locked: c.is_locked || false,
            lock_ticket: c.lock_ticket || null,
            has_rejected: c.has_rejected || false,
          })),
        );
      }
    }
  }, [settings, companies, isEditing]);

  // Restoration
  const handleRestoreSettingsDraft = useCallback(() => {
    if (!rejectedSettingsDraft?.payload) return;

    const payload = rejectedSettingsDraft.payload;
    setPageContent((prev) => ({
      teaserHeadline: payload.teaserHeadline ?? prev.teaserHeadline,
      teaserBody: payload.teaserBody ?? prev.teaserBody,
      sectionIntro: payload.sectionIntro ?? prev.sectionIntro,
    }));

    setIsEditing(true);
    toast.info("Draf berhasil dipulihkan.", {
      description: "Silakan perbaiki dan simpan kembali.",
    });
  }, [rejectedSettingsDraft]);

  const handleSaveSettings = async () => {
    const payload = {
      ...pageContent,
      status: "Published",
      previous_notrans: rejectedSettingsDraft?.notrans || null,
    };

    await api.put("/investment/settings", payload, { timeout: 60000 });
    setRejectedSettingsDraft(null);
  };

  const addCompany = () => {
    setLocalCompanies([
      ...localCompanies,
      {
        id: Date.now(),
        name: "",
        desc: "",
        category: "fnb",
        websiteUrl: "",
        logoUrl: null,
        isNew: true,
        is_locked: false,
      },
    ]);
  };

  const removeCompany = (id: number | string) => {
    const target = localCompanies.find((c) => c.id === id);
    if (!target) return;

    toast.warning(`Remove ${target.name || "Company"}?`, {
      description: "This action will remove the affiliate from the grid.",
      action: {
        label: "Remove",
        onClick: async () => {
          // --- LOGIKA A: Jika data baru (Belum di-save ke DB) ---
          if (target.isNew) {
            setLocalCompanies((prev) => prev.filter((c) => c.id !== id));
            toast.success("Removed from list");
            return;
          }

          // --- LOGIKA B: Jika data lama (Hapus permanen dari DB) ---
          toast.promise(
            async () => {
              // Panggil API Backend
              await api.delete(`/investment/affiliate/${id}`);

              // Update state UI agar baris langsung hilang
              setLocalCompanies((prev) => prev.filter((c) => c.id !== id));

              // Sync data context agar dashboard utama terupdate
              refreshData();
            },
            {
              loading: `Deleting ${target.name}...`,
              success: "Company permanently deleted.",
              error: (err) => {
                console.error("Delete Error:", err);
                return (
                  err.response?.data?.message || "Failed to delete from server"
                );
              },
            },
          );
        },
      },
      cancel: {
        label: "Cancel",
        onClick: () => {},
      },
    });
  };

  const updateCompany = (
    id: number | string,
    field: keyof LocalAffiliate,
    value: any,
  ) => {
    setLocalCompanies(
      localCompanies.map((c) => (c.id === id ? { ...c, [field]: value } : c)),
    );
  };

  const handleLogoChange = (id: number | string, file: File) => {
    updateCompany(id, "newLogoFile", file);
  };

  const handleSaveCompanies = async () => {
    const loadingToast = toast.loading("Syncing affiliate records...");
    const validCompanies = localCompanies.filter((comp) => comp.name.trim());

    if (validCompanies.length === 0) {
      toast.dismiss(loadingToast);
      return;
    }
    const saveTasks = validCompanies.map((comp) => {
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
            newLogoFile: null,
            is_locked: true,
          }));
      } else {
        return api
          .put(`/investment/affiliate/${comp.id}`, formData, config)
          .then(() => ({ ...comp, newLogoFile: null, is_locked: true }));
      }
    });

    const results = await Promise.allSettled(saveTasks);

    const successfulComps: LocalAffiliate[] = [];
    let failedCount = 0;

    results.forEach((result, index) => {
      if (result.status === "fulfilled") {
        successfulComps.push(result.value);
      } else {
        failedCount++;
        successfulComps.push(validCompanies[index]);
        console.error(
          `Failed to save company: ${validCompanies[index].name}`,
          result.reason,
        );
      }
    });

    setLocalCompanies(successfulComps);

    if (failedCount === 0) {
      toast.success("Grid tersinkronisasi!", {
        id: loadingToast,
        description: `Berhasil memproses ${successfulComps.length} data.`,
      });
    } else {
      toast.error("Sinkronisasi Parsial", {
        id: loadingToast,
        description: `${failedCount} data gagal disimpan. Silakan coba lagi.`,
      });
      throw new Error("Partial sync failure");
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    const loadingToast = toast.loading("Saving changes...");
    try {
      if (activeTab === "content") {
        await handleSaveSettings();
      } else {
        await handleSaveCompanies();
      }
      toast.success("Perubahan berhasil dikirim ke OWL!", { id: loadingToast });
      await refreshData();
      setIsEditing(false);
    } catch (err) {
      toast.error("Gagal memproses data.", { id: loadingToast });
    } finally {
      setIsSaving(false);
    }
  };

  // Helper untuk Preview Gambar
  const getPreviewUrl = (comp: LocalAffiliate) => {
    if (comp.newLogoFile) {
      return URL.createObjectURL(comp.newLogoFile);
    }

    if (comp.logoUrl) {
      const cleanPath = comp.logoUrl.replace("/uploads", "");
      return `${BASE_UPLOAD_URL}${cleanPath}`;
    }

    return null;
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500 pb-12">
      {rejectedSettingsDraft && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 animate-in slide-in-from-top duration-500 shadow-sm ring-2 ring-amber-500/10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center shrink-0 animate-pulse">
              <AlertTriangle className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <h4 className="text-sm font-black text-amber-900 uppercase tracking-tight">
                Revisi Konten Ditolak Admin OWL
              </h4>
              <p className="text-xs text-amber-700 leading-relaxed max-w-xl">
                Alasan:{" "}
                <span className="italic font-medium">
                  "
                  {rejectedSettingsDraft.rejection_reason ||
                    "Tidak ada alasan spesifik."}
                  "
                </span>
                . Gunakan tombol di samping untuk memulihkan draf terakhir Anda.
              </p>
            </div>
          </div>
          <button
            onClick={handleRestoreSettingsDraft}
            className="flex items-center gap-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-amber-600/20 active:scale-95">
            <Plus className="w-4 h-4 rotate-45" /> Restore & Fix Draft
          </button>
        </div>
      )}
      {/* --- HEADER --- */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm sticky top-0 z-30">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-serif font-black text-slate-900 tracking-tight">
              Investments Manager
            </h1>
            {settings?.is_locked && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-600 rounded-full text-[10px] font-black uppercase tracking-tighter border border-blue-100 animate-in fade-in zoom-in duration-300">
                <Lock className="w-3 h-3" /> Pending: {settings.lock_ticket}
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Kelola ekosistem investasi, konten teks promosi, dan logo perusahaan
            afiliasi secara terpusat.
          </p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            onClick={() => {
              if (settings?.is_locked) {
                return toast.error("Data Terkunci", {
                  description:
                    "Konten utama sedang dalam antrean approval Admin.",
                });
              }
              setIsEditing(!isEditing);
            }}
            disabled={isSaving}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-black text-[11px] uppercase tracking-widest transition-all border shadow-sm ${
              isEditing
                ? "bg-amber-50 text-amber-700 border-amber-200 ring-4 ring-amber-500/5"
                : settings?.is_locked
                  ? "bg-slate-50 text-slate-400 border-slate-100 cursor-not-allowed"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300"
            }`}>
            {isEditing ? (
              <Unlock className="w-4 h-4 text-amber-500" />
            ) : settings?.is_locked ? (
              <Lock className="w-4 h-4" />
            ) : (
              <Lock className="w-4 h-4 text-slate-400" />
            )}
            <span>
              {isEditing
                ? "Editing Mode"
                : settings?.is_locked
                  ? "Locked by System"
                  : "Locked"}
            </span>
          </button>

          <button
            onClick={handleSave}
            disabled={isSaving || !isEditing || settings?.is_locked}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-daw-green hover:bg-[#003b1c] disabled:bg-slate-100 disabled:text-slate-400 text-white px-6 py-2.5 rounded-xl font-black text-[11px] uppercase tracking-widest transition-all shadow-lg shadow-daw-green/20 active:scale-95">
            {isSaving ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>{isSaving ? "Syncing..." : "Publish"}</span>
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
            {rejectedSettingsDraft && (
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
            {localCompanies.some((c) => c.is_locked) && (
              <span title="Pending Approval">
                <Lock className="w-3 h-3 text-blue-500" />
              </span>
            )}
          </div>
        </button>
      </div>

      {/* --- TAB CONTENT AREA --- */}
      <div className="bg-white rounded-b-xl border border-t-0 border-slate-200 shadow-sm p-6 lg:p-8 min-h-[500px]">
        {/* TAB 1: PAGE CONTENT (SINGLETON)              */}
        {activeTab === "content" && (
          <div className="space-y-8 animate-in fade-in duration-300">
            <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 relative overflow-hidden">
              {settings?.is_locked && (
                <div className="absolute top-0 right-0 bg-blue-100 text-blue-700 px-3 py-1 rounded-bl-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-sm">
                  <Lock className="w-3 h-3" /> Locked
                </div>
              )}

              <h3 className="text-base font-bold text-slate-900 mb-4 border-b border-slate-200 pb-2">
                Home Page Teaser Content
              </h3>
              <div className="space-y-4">
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
                    disabled={!isEditing || settings?.is_locked}
                    className={`w-full px-3 py-2 rounded-lg font-serif text-lg transition-all duration-300 ${
                      isEditing && !settings?.is_locked
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
                    disabled={!isEditing || settings?.is_locked}
                    className={`w-full px-3 py-2 rounded-lg resize-none transition-all duration-300 ${
                      isEditing && !settings?.is_locked
                        ? "bg-white border border-slate-300 text-slate-900 focus:ring-2 focus:ring-daw-green/20 shadow-inner"
                        : "bg-slate-100/50 border-transparent text-slate-500 cursor-not-allowed"
                    }`}
                  />
                </div>
              </div>
            </div>

            <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 relative overflow-hidden">
              {settings?.is_locked && (
                <div className="absolute top-0 right-0 bg-blue-100 text-blue-700 px-3 py-1 rounded-bl-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-sm">
                  <Lock className="w-3 h-3" /> Locked
                </div>
              )}
              <h3 className="text-base font-bold text-slate-900 mb-4 border-b border-slate-200 pb-2">
                Main Investments Page
              </h3>
              <div>
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
                  disabled={!isEditing || settings?.is_locked}
                  className={`w-full px-3 py-2 rounded-lg resize-none transition-all duration-300 ${
                    isEditing && !settings?.is_locked
                      ? "bg-white border border-slate-300 text-slate-900 focus:ring-2 focus:ring-daw-green/20 shadow-inner"
                      : "bg-slate-100/50 border-transparent text-slate-500 cursor-not-allowed"
                  }`}
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: AFFILIATED COMPANIES (COLLECTION)     */}
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
              {localCompanies.map((company) => (
                <div
                  key={company.id}
                  className={`flex gap-4 items-start bg-slate-50 p-5 rounded-xl border border-slate-200 group transition-all relative ${
                    company.is_locked
                      ? "opacity-60 ring-2 ring-blue-500/20"
                      : ""
                  } ${company.has_rejected ? "ring-2 ring-amber-500/40 bg-amber-50/30" : ""}`}>
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
                          title={`Dikunci oleh OWL (${company.lock_ticket})`}
                          className="flex h-5 w-5 items-center justify-center bg-blue-500 text-white rounded-full shadow-sm ring-2 ring-white z-10">
                          <Lock className="w-3 h-3" />
                        </span>
                      )}
                    </div>

                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 text-center">
                      Logo
                    </label>
                    <div
                      className={`relative group ${company.is_locked ? "pointer-events-none grayscale-[20%]" : ""}`}>
                      <LogoPreviewer
                        file={company.newLogoFile}
                        savedUrl={company.logoUrl}
                        isEditing={isEditing && !company.is_locked}
                      />

                      {isEditing && !company.is_locked && (
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
                    disabled={!isEditing || company.is_locked}
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
                          isEditing && !company.is_locked
                            ? "bg-white border border-slate-300 text-slate-900 focus:ring-2 focus:ring-daw-green/20"
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
                            isEditing && !company.is_locked
                              ? "bg-white border border-slate-300 text-slate-900 focus:ring-2 focus:ring-daw-green/20"
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
                            isEditing && !company.is_locked
                              ? "bg-white border border-slate-300 text-slate-900 focus:ring-2 focus:ring-daw-green/20"
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
                          isEditing && !company.is_locked
                            ? "bg-white border border-slate-300 text-slate-900 focus:ring-2 focus:ring-daw-green/20"
                            : "bg-slate-100/50 border-transparent text-slate-500"
                        }`}
                      />
                    </div>
                  </fieldset>

                  {/* DELETE ACTION */}
                  {isEditing && !company.is_locked && (
                    <button
                      onClick={() => removeCompany(company.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors mt-5 shrink-0"
                      title="Remove Company">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}

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
