/**
 * Custom hook that encapsulates ALL business logic for InvestmentsManager.
 *
 * Responsibilities:
 * - State management (settings text, local companies, categories, drafts)
 * - Data synchronization from InvestmentContext
 * - Draft rejection/restore/discard workflows
 * - Save orchestration (settings & affiliates)
 * - Company CRUD mutation handlers
 */
import { useState, useEffect, useMemo, useCallback } from "react";
import { toast } from "sonner";
import { useInvestments } from "@/contexts/InvestmentContext";
import { useAuth } from "@/contexts/AuthContext";
import api from "@/lib/api";
import { getErrorMessage } from "@/lib/utils";
import type { LocalAffiliate, LocalCategory } from "./InvestmentConstants";

export function useInvestmentManager() {
  const { user } = useAuth();
  const isSuperadmin = user?.role === "superadmin" || user?.role === "admin";

  const [activeTab, setActiveTab] = useState<"content" | "companies">("content");
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [hideDraftBanner, setHideDraftBanner] = useState(false);
  const [localCategories, setLocalCategories] = useState<LocalCategory[]>([]);
  const [showNewCategoryForm, setShowNewCategoryForm] = useState(false);
  const [newCategoryData, setNewCategoryData] = useState({ name: "", description: "", icon: "Briefcase" });
  const [editingCategoryId, setEditingCategoryId] = useState<number | string | null>(null);

  const { settings, companies, categories, rejectedSettings, refreshData } =
    useInvestments();

  // Sync categories from context
  useEffect(() => {
    if (categories && categories.length > 0) {
      setLocalCategories(categories.map((c: any) => ({
        id: c.id,
        name: c.name || "",
        description: c.description || "",
        icon: c.icon || "Briefcase",
        isCollapsed: false,
      })));
    }
  }, [categories]);

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

  // Sync settings & companies from context
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

  // Fetch rejected drafts for affiliates
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
      } catch (error: unknown) {
        if (
          !(
            (typeof error === "object" &&
              error !== null &&
              "name" in error &&
              (error as { name?: string }).name === "CanceledError") ||
            (typeof error === "object" &&
              error !== null &&
              "code" in error &&
              (error as { code?: string }).code === "ERR_CANCELED")
          )
        ) {
          console.error("🚨 Gagal memuat kumpulan draf penolakan:", error);
        }
      }
    };

    fetchRejectedDrafts();

    return () => controller.abort();
  }, [companies]);

  // ==========================================
  // DRAFT HANDLERS
  // ==========================================

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
              category_id: payload.category_id ?? c.category_id,
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

  const handleDiscardAffiliateDraft = async (companyId: string | number) => {
    const draft = rejectedAffiliates[companyId];
    if (!draft?.notrans) return;

    const toastId = toast.loading("Mengabaikan notifikasi penolakan...");
    try {
      await api.patch(`/approval/discard`, {
        notrans: draft.notrans,
      });

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
    } catch (error: unknown) {
      toast.error("Gagal mengabaikan draf", {
        id: toastId,
        description: getErrorMessage(error) || "Kesalahan pada server.",
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
      await api.patch("/approval/discard", {
        notrans: rejectedSettings.notrans,
      });

      toast.success("Notifikasi revisi berhasil diabaikan.", { id: toastId });

      setHideDraftBanner(true);

      await refreshData();
    } catch (error: unknown) {
      toast.error("Gagal mengabaikan draf", {
        id: toastId,
        description:
          getErrorMessage(error) || "Kesalahan komunikasi dengan server.",
      });
    }
  };

  // ==========================================
  // SAVE HANDLERS
  // ==========================================

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
      formData.append("category_id", String(comp.category_id || ""));
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

  // ==========================================
  // COMPANY MUTATION HANDLERS
  // ==========================================

  const addCompany = (categoryId: number | string) => {
    setLocalCompanies([
      {
        id: `temp-${Date.now()}`,
        name: "",
        desc: "",
        category_id: typeof categoryId === "number" ? categoryId : null,
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
                refreshData();
                return "Pengajuan hapus dikirim. Data dikunci.";
              } else {
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

  const sortedCompanies = useMemo(() => {
    return [...localCompanies].sort((a, b) => {
      if (a.isNew && !b.isNew) return -1;
      if (!a.isNew && b.isNew) return 1;
      return (a.name || "").localeCompare(b.name || "");
    });
  }, [localCompanies]);

  return {
    // Auth
    isSuperadmin,

    // Tab
    activeTab, setActiveTab,

    // Edit mode
    isEditing, setIsEditing,
    isSaving,

    // Lock states
    isSettingsLockedForEditor,
    isSettingsOverrideMode,
    currentLockState,
    lockStyles,

    // Settings content
    pageContent, setPageContent,
    rejectedSettings,
    hideDraftBanner,

    // Companies
    localCompanies,
    sortedCompanies,
    rejectedAffiliates,

    // Categories
    localCategories, setLocalCategories,
    showNewCategoryForm, setShowNewCategoryForm,
    newCategoryData, setNewCategoryData,
    editingCategoryId, setEditingCategoryId,

    // Handlers
    handleSave,
    handleRestoreSettingsDraft,
    handleDiscardDraft,
    handleRestoreAffiliateDraft,
    handleDiscardAffiliateDraft,
    addCompany,
    removeCompany,
    updateCompany,
    handleLogoChange,
    refreshData,
  };
}
