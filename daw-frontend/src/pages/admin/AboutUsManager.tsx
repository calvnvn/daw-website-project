import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Save,
  Users,
  Target,
  BookOpen,
  ImageOff,
  Edit,
  Trash2,
  Plus,
  History,
  Lock,
  Unlock,
  AlertTriangle,
  RotateCcw,
  Heart,
  Briefcase,
  Globe,
  Zap,
  Lightbulb,
  Shield,
  Star,
  Leaf,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { getCleanImageUrl } from "@/lib/utils";
import { useAbout } from "@/contexts/AboutContext";
import { useAuth } from "@/contexts/AuthContext";
import type {
  PhilosophyPillar,
  ManagementItem as ManagementMember,
} from "@/contexts/AboutContext";

interface PhotoPreviewerProps {
  file?: File | null;
  savedUrl?: string | null;
  isItemLocked?: boolean;
}

const AVAILABLE_ICONS = [
  { id: "human", icon: Heart, label: "Heart / Human" },
  { id: "ethics", icon: Briefcase, label: "Briefcase / Ethics" },
  { id: "unity", icon: Globe, label: "Globe / Unity" },
  { id: "speed", icon: Zap, label: "Zap / Speed" },
  { id: "smart", icon: Lightbulb, label: "Lightbulb / Smart" },
  { id: "shield", icon: Shield, label: "Shield / Integrity" },
  { id: "star", icon: Star, label: "Star / Excellence" },
  { id: "leaf", icon: Leaf, label: "Leaf / Sustainability" },
];

const PhotoPreviewer = React.memo(
  ({ file, savedUrl, isItemLocked = false }: PhotoPreviewerProps) => {
    const [isDecoding, setIsDecoding] = useState(false);
    const [hasError, setHasError] = useState(false);

    // 🛡️ Optimasi Memori & Defensive Try/Catch
    const previewUrl = useMemo(() => {
      if (file) {
        try {
          return URL.createObjectURL(file);
        } catch (err) {
          console.error("🚨 Gagal memproses file gambar:", err);
          // eslint-disable-next-line react-hooks/set-state-in-render
          setHasError(true);
          return null;
        }
      }
      return savedUrl ? getCleanImageUrl(savedUrl) : null;
    }, [file, savedUrl]);

    // Reset error state & trigger loading saat file berubah
    useEffect(() => {
      setHasError(false);
      if (file) setIsDecoding(true);
    }, [previewUrl, file]);

    // 🛡️ Memory Leak Guard
    useEffect(() => {
      return () => {
        // Gunakan nilai lokal dari closure ini untuk cleanup
        if (previewUrl && previewUrl.startsWith("blob:")) {
          URL.revokeObjectURL(previewUrl);
        }
      };
    }, [previewUrl]);

    return (
      <div
        className={`relative w-24 h-24 rounded-full border-4 border-slate-100 flex items-center justify-center overflow-hidden shadow-sm shrink-0 transition-all duration-300 ${
          isItemLocked
            ? "bg-slate-100 opacity-60 grayscale-[30%] pointer-events-none cursor-not-allowed"
            : "bg-white group"
        }`}>
        {/* FALLBACK LOGIC */}
        {previewUrl && !hasError ? (
          <img
            src={previewUrl}
            alt="Preview"
            className="w-full h-full object-cover"
            onError={() => setHasError(true)}
            onLoad={() => setIsDecoding(false)}
          />
        ) : (
          <div className="flex flex-col items-center animate-in fade-in duration-300">
            <ImageOff className="w-6 h-6 text-slate-300 mb-1" />
            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">
              No Image
            </span>
          </div>
        )}

        {/* LOADING SPINNER */}
        {isDecoding && !hasError && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/50 backdrop-blur-[1px]">
            <div className="w-5 h-5 border-2 border-daw-green border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* HOVER OVERLAY (Hanya aktif jika tidak dilock) */}
        {!isItemLocked && (
          <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
            <Edit className="w-5 h-5 text-white drop-shadow-md" />
          </div>
        )}
      </div>
    );
  },
);

PhotoPreviewer.displayName = "PhotoPreviewer";
interface ManagementImageProps {
  src: string | null;
  alt: string;
}

/**
 * @description Menampilkan gambar pada tabel list dengan dukungan Lazy Loading.
 */
const ManagementImage = React.memo(({ src, alt }: ManagementImageProps) => {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [src]);

  // 🛡️ Pencegahan kalkulasi string berulang
  const finalSrc = useMemo(() => (src ? getCleanImageUrl(src) : null), [src]);

  if (!finalSrc || hasError) {
    return (
      <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 shrink-0 border border-slate-200">
        <ImageOff className="w-4 h-4" />
      </div>
    );
  }

  return (
    <div className="w-10 h-10 rounded-full overflow-hidden border border-slate-200 shrink-0 bg-white shadow-sm">
      <img
        src={finalSrc}
        alt={alt}
        className="w-full h-full object-cover bg-slate-50"
        decoding="async"
        loading="lazy"
        onError={() => {
          console.error(`Gagal memuat gambar untuk: ${alt}`);
          setHasError(true);
        }}
      />
    </div>
  );
});

ManagementImage.displayName = "ManagementImage";

export default function AboutUsManager() {
  const {
    aboutData,
    companyHistory: ctxHistory,
    managementTeam: ctxManagement,
    isLoading,
    refreshData,
  } = useAbout();
  const { user } = useAuth();

  const isSuperadmin =
    user?.role?.toLowerCase() === "superadmin" ||
    user?.role?.toLowerCase() === "admin";
  const isEditor = user?.role?.toLowerCase() === "editor";

  const [activeTab, setActiveTab] = useState<
    "info" | "history" | "philosophy" | "management"
  >("info");
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const [openIconPickerId, setOpenIconPickerId] = useState<string | null>(null);
  const [optimisticLocks, setOptimisticLocks] = useState({
    info: false,
    history: false,
  });
  const [rejectedDrafts, setRejectedDrafts] = useState<any[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [companyInfo, setCompanyInfo] = useState({
    spiritTitle: "Founders' Spirit",
    spiritText: "",
    missionTitle: "Mission",
    missionText: "",
    visionTitle: "Vision",
    visionText: "",
  });

  const [philosophy, setPhilosophy] = useState<{
    mainTitle: string;
    pillars: PhilosophyPillar[];
  }>({
    mainTitle: "Our Philosophy",
    pillars: [],
  });

  const [companyHistory, setCompanyHistory] = useState<any[]>([]);
  const [managementTeam, setManagementTeam] = useState<ManagementMember[]>([]);

  const [isPersonModalOpen, setIsPersonModalOpen] = useState(false);
  const [editingPersonId, setEditingPersonId] = useState<number | null>(null);
  const [personForm, setPersonForm] = useState({
    name: "",
    role: "",
    description: "",
    level: "division",
    order: 1,
    photo: null as File | null,
    removePhoto: false,
    savedPhotoUrl: null as string | null,
    previous_notrans: null as string | null,
  });

  // The Sync Engine
  useEffect(() => {
    if (!isEditing && !isLoading) {
      if (aboutData) {
        setCompanyInfo({
          spiritTitle: "Founders' Spirit",
          spiritText: aboutData.spiritText || "",
          missionTitle: "Mission",
          missionText: aboutData.missionText || "",
          visionTitle: "Vision",
          visionText: aboutData.visionText || "",
        });
        setPhilosophy({
          mainTitle: aboutData.philosophyTitle || "Our Philosophy",
          pillars: aboutData.philosophyPillars || [],
        });
        if (!aboutData.is_locked)
          setOptimisticLocks((prev) => ({ ...prev, info: false }));
      }

      if (ctxHistory) {
        setCompanyHistory(
          ctxHistory.map((h) => ({
            id: h.id,
            year: h.year,
            text: h.description,
            is_locked: h.is_locked,
            lock_ticket: h.lock_ticket,
          })),
        );
        const isHistoryLocked = ctxHistory.some((h) => h.is_locked);
        if (!isHistoryLocked)
          setOptimisticLocks((prev) => ({ ...prev, history: false }));
      }

      if (ctxManagement) {
        setManagementTeam(ctxManagement.map((m) => ({ ...m })));
      }
    }
  }, [aboutData, ctxHistory, ctxManagement, isEditing, isLoading]);

  useEffect(() => {
    if (isSuperadmin || isEditing || isLoading) return;

    const controller = new AbortController();
    const fetchDrafts = async () => {
      try {
        const promises = [
          api.get("/approval/rejected/1?module=AboutInfo", {
            signal: controller.signal,
          }),
          api.get("/approval/rejected/ALL?module=History", {
            signal: controller.signal,
          }),
        ];

        ctxManagement.forEach((m) => {
          promises.push(
            api.get(`/approval/rejected/${m.id}?module=Management`, {
              signal: controller.signal,
            }),
          );
        });

        const results = await Promise.allSettled(promises);
        const drafts = results
          .filter(
            (res): res is PromiseFulfilledResult<any> =>
              res.status === "fulfilled",
          )
          .map((res) => res.value.data.data)
          .filter(Boolean);

        setRejectedDrafts(drafts);
      } catch (err: any) {
        if (err.name !== "CanceledError")
          console.error("Gagal menarik draf penolakan", err);
      }
    };

    fetchDrafts();
    return () => controller.abort();
  }, [isSuperadmin, isEditing, isLoading, ctxManagement]);

  // API SAVING
  const handleSave = async () => {
    if (activeTab === "management") {
      toast.info("Gunakan tombol Edit pada masing-masing baris profil.");
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    const loadingToast = toast.loading(
      isEditor ? "Mengajukan persetujuan..." : "Menyimpan perubahan live...",
    );

    try {
      // --- TAB 1 & 3: SINGLETON (INFO & PHILOSOPHY) ---
      if (activeTab === "info" || activeTab === "philosophy") {
        const isInfoChanged =
          companyInfo.spiritText !== aboutData?.spiritText ||
          companyInfo.missionText !== aboutData?.missionText ||
          companyInfo.visionText !== aboutData?.visionText;

        const isPhilosophyChanged =
          philosophy.mainTitle !== aboutData?.philosophyTitle ||
          JSON.stringify(philosophy.pillars) !==
            JSON.stringify(aboutData?.philosophyPillars);

        if (!isInfoChanged && !isPhilosophyChanged) {
          toast.dismiss(loadingToast);
          toast.info("Tidak ada perubahan terdeteksi.");
          setIsEditing(false);
          setIsSaving(false);
          return;
        }

        const draftData = rejectedDrafts.find(
          (d) => d.module_name === "AboutInfo",
        );
        const payload: any = {
          spiritText: companyInfo.spiritText,
          missionText: companyInfo.missionText,
          visionText: companyInfo.visionText,
          philosophyTitle: philosophy.mainTitle,
          philosophyPillars: philosophy.pillars,
          status: isSuperadmin ? "Active" : "Published", // 🛡️ Role Injection
        };

        if (isEditor && draftData?.notrans)
          payload.previous_notrans = draftData.notrans;

        await api.put("/about", payload, { timeout: 60000 });
        if (isEditor) setOptimisticLocks((prev) => ({ ...prev, info: true }));
      }

      // --- TAB 2: BULK UPDATE (HISTORY) ---
      else if (activeTab === "history") {
        const strippedLocal = companyHistory.map(({ year, text }) => ({
          year,
          text,
        }));
        const strippedContext = ctxHistory.map(({ year, description }) => ({
          year,
          text: description,
        }));

        if (JSON.stringify(strippedLocal) === JSON.stringify(strippedContext)) {
          toast.dismiss(loadingToast);
          toast.info("Tidak ada perubahan sejarah terdeteksi.");
          setIsEditing(false);
          setIsSaving(false);
          return;
        }

        const draftData = rejectedDrafts.find(
          (d) => d.module_name === "History",
        );
        const payload: any = {
          histories: companyHistory.map((h) => ({
            year: h.year,
            text: h.text,
          })),
          status: isSuperadmin ? "Active" : "Published",
        };

        if (isEditor && draftData?.notrans)
          payload.previous_notrans = draftData.notrans;

        await api.put("/history", payload, { timeout: 60000 });
        if (isEditor)
          setOptimisticLocks((prev) => ({ ...prev, history: true }));
      }

      // Cleanup & Resync Context
      await refreshData();
      toast.success(
        isSuperadmin
          ? "Perubahan berhasil disimpan!"
          : "Draf berhasil diajukan!",
        { id: loadingToast },
      );
      setIsEditing(false);
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Kesalahan jaringan", {
        id: loadingToast,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const addHistory = () =>
    setCompanyHistory([
      ...companyHistory,
      { id: Date.now(), year: "", text: "" },
    ]);
  const removeHistory = (id: number) =>
    setCompanyHistory(companyHistory.filter((h) => h.id !== id));
  const updateHistory = (id: number, field: "year" | "text", value: string) => {
    setCompanyHistory(
      companyHistory.map((h) => (h.id === id ? { ...h, [field]: value } : h)),
    );
  };

  const updatePillar = (id: string, field: "title" | "text", value: string) => {
    setPhilosophy({
      ...philosophy,
      pillars: philosophy.pillars.map((p) =>
        p.id === id ? { ...p, [field]: value } : p,
      ),
    });
  };
  const openPersonModal = (person: ManagementMember | null = null) => {
    if (person?.is_locked && !isSuperadmin) {
      return toast.warning("Akses Dibatasi", {
        description: "Data profil ini sedang dalam peninjauan.",
      });
    }

    const draftData = person
      ? rejectedDrafts.find(
          (d) =>
            d.module_name === "Management" && d.target_id === String(person.id),
        )
      : null;

    if (person) {
      setEditingPersonId(person.id);
      setPersonForm({
        name: draftData?.payload?.name ?? person.name,
        role: draftData?.payload?.role ?? person.role,
        description: draftData?.payload?.description ?? person.description,
        level: draftData?.payload?.level ?? person.level,
        order: draftData?.payload?.order ?? person.order,
        photo: null,
        removePhoto: false,
        savedPhotoUrl: person.photoUrl,
        previous_notrans: draftData?.notrans || null,
      });
    } else {
      setEditingPersonId(null);
      setPersonForm({
        name: "",
        role: "",
        description: "",
        level: "division",
        order: 1,
        photo: null,
        removePhoto: false,
        savedPhotoUrl: null,
        previous_notrans: null,
      });
    }
    setIsPersonModalOpen(true);
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      React.startTransition(() =>
        setPersonForm((prev) => ({ ...prev, photo: file, removePhoto: false })),
      );
    }
  };

  const savePerson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !personForm.name.trim() ||
      !personForm.role.trim() ||
      !personForm.description.trim()
    ) {
      return toast.error("Lengkapi semua kolom wajib.");
    }

    const loadingToast = toast.loading(
      isEditor ? "Mengajukan perubahan..." : "Menyimpan data...",
    );
    const formData = new FormData();

    formData.append("name", personForm.name);
    formData.append("role", personForm.role);
    formData.append("description", personForm.description);
    formData.append("level", personForm.level);
    formData.append("order", personForm.order.toString());
    formData.append("status", isSuperadmin ? "Active" : "Published");

    if (personForm.removePhoto) formData.append("removePhoto", "true");
    if (personForm.photo) formData.append("photo", personForm.photo);
    if (isEditor && personForm.previous_notrans)
      formData.append("previous_notrans", personForm.previous_notrans);

    try {
      if (editingPersonId) {
        await api.put(`/management/${editingPersonId}`, formData, {
          timeout: 60000,
        });
      } else {
        await api.post("/management", formData, { timeout: 60000 });
      }

      await refreshData();
      toast.success(
        isSuperadmin ? "Profil diperbarui!" : "Draf tim diajukan!",
        { id: loadingToast },
      );
      setIsPersonModalOpen(false);
    } catch (error: any) {
      toast.error(
        error.response?.data?.message || "Terjadi kesalahan sistem.",
        { id: loadingToast },
      );
    }
  };

  const deletePerson = async (id: number) => {
    toast("Konfirmasi Hapus", {
      description: "Anda yakin ingin menghapus data anggota ini?",
      action: {
        label: "Hapus",
        onClick: async () => {
          const loadingToast = toast.loading("Memproses...");
          try {
            await api.delete(`/management/${id}`, { timeout: 60000 });
            await refreshData();
            toast.success(
              isEditor ? "Pengajuan hapus dikirim!" : "Anggota dihapus!",
              { id: loadingToast },
            );
          } catch (error: any) {
            toast.error(error.response?.data?.message || "Gagal menghapus", {
              id: loadingToast,
            });
          }
        },
      },
    });
  };

  // --- EARLY RETURN GUARD ---
  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center text-slate-500 animate-pulse">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-daw-green border-t-transparent rounded-full animate-spin" />
          <p className="font-medium text-sm tracking-wider uppercase">
            Memuat Konfigurasi...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* ==========================================
          🚩 HEADER: Action Center & Role Awareness
          ========================================== */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm sticky top-0 z-30">
        <div>
          <h1 className="text-2xl font-serif font-bold text-slate-900">
            About Us Manager
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Kelola profil korporat, linimasa sejarah, dan struktur kepemimpinan
            DAW Group.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsEditing(!isEditing)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-bold text-sm transition-all border ${
              isEditing
                ? "bg-amber-50 text-amber-700 border-amber-200 shadow-sm"
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
            disabled={isSaving || !isEditing}
            className="flex items-center gap-2 bg-daw-green hover:bg-[#003b1c] disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-lg font-bold transition-all shadow-md active:scale-95">
            {isSaving ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Memproses...</span>
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                <span>
                  {isSuperadmin ? "Publish Live" : "Request Approval"}
                </span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ==========================================
          TABS NAVIGATION: Double-Badge System
          ========================================== */}
      <div className="flex items-end overflow-x-auto border border-slate-200 border-b-0 shadow-sm bg-white rounded-t-xl px-2 pt-2 hide-scrollbar">
        {[
          {
            id: "info",
            label: "Company Info",
            icon: Target,
            module: "AboutInfo",
          },
          { id: "history", label: "History", icon: History, module: "History" },
          {
            id: "philosophy",
            label: "Philosophy",
            icon: BookOpen,
            module: "AboutInfo",
          },
          {
            id: "management",
            label: "Management Team",
            icon: Users,
            module: "Management",
          },
        ].map((tab) => {
          const isLocked =
            tab.id === "history"
              ? companyHistory.some((h) => h.is_locked)
              : tab.id === "management"
                ? managementTeam.some((m) => m.is_locked)
                : aboutData?.is_locked; // Info & Philosophy share singleton lock

          const hasRejected =
            tab.id === "management"
              ? rejectedDrafts.some((d) => d.module_name === "Management")
              : rejectedDrafts.some((d) => d.module_name === tab.module);

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`group relative flex items-center gap-2 px-6 py-4 font-bold text-xs uppercase tracking-widest border-b-2 transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? "border-daw-green text-daw-green"
                  : "border-transparent text-slate-400 hover:text-slate-600"
              }`}>
              <tab.icon
                className={`w-4 h-4 ${activeTab === tab.id ? "text-daw-green" : "text-slate-300"}`}
              />
              {tab.label}

              {/* 🛡️ DOUBLE-BADGE INDICATORS */}
              <div className="flex items-center gap-1 ml-1">
                {isLocked && (
                  <div
                    title="Sedang ditinjau"
                    className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.5)]"
                  />
                )}
                {hasRejected && (
                  <div
                    title="Ada draf perlu revisi"
                    className="flex items-center justify-center bg-amber-500 text-white rounded-full p-0.5 animate-bounce">
                    <AlertTriangle className="w-2.5 h-2.5" />
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
      {/* --- TAB CONTENT AREA START ---*/}
      <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500 pb-12">
        {/* TAB 1: COMPANY INFO (The Singleton) */}
        {activeTab === "info" &&
          (() => {
            const isItemLocked =
              (aboutData?.is_locked || optimisticLocks.info) && !isSuperadmin;
            const lockStyles =
              "opacity-60 grayscale-[30%] pointer-events-none select-none";

            // Deteksi Draf Ditolak
            const rejectedDraft = rejectedDrafts.find(
              (d) => d.module_name === "AboutInfo",
            );
            const hasRejected = !!rejectedDraft;

            return (
              <div
                className={`space-y-6 animate-in fade-in duration-300 transition-all ${isItemLocked ? lockStyles : ""}`}>
                {/* 🛡️ REJECTION RIBBON & RESTORATION */}
                {hasRejected && (
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-amber-500 text-white p-4 rounded-xl shadow-sm mb-6 animate-in slide-in-from-top-2">
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="w-6 h-6 shrink-0" />
                      <div>
                        <h4 className="font-bold text-sm">
                          Catatan Peninjau (Perlu Perbaikan)
                        </h4>
                        <p className="text-sm text-amber-50">
                          {rejectedDraft.rejection_reason}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        if (!rejectedDraft.payload) return;
                        setCompanyInfo({
                          spiritTitle: "Founders' Spirit",
                          spiritText:
                            rejectedDraft.payload.spiritText ??
                            companyInfo.spiritText,
                          missionTitle: "Mission",
                          missionText:
                            rejectedDraft.payload.missionText ??
                            companyInfo.missionText,
                          visionTitle: "Vision",
                          visionText:
                            rejectedDraft.payload.visionText ??
                            companyInfo.visionText,
                        });
                        toast.success(
                          "Teks visi misi berhasil dipulihkan dari draf!",
                        );
                      }}
                      className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg text-sm font-bold transition-colors whitespace-nowrap">
                      <RotateCcw className="w-4 h-4" /> Pulihkan Draf
                    </button>
                  </div>
                )}

                <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-2">
                  <h3 className="text-lg font-bold text-slate-900">
                    Identitas Utama
                  </h3>
                  {isItemLocked && (
                    <span className="flex items-center gap-1.5 text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full border border-blue-100">
                      <Lock className="w-3.5 h-3.5" /> Sedang Ditinjau
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* --- FOUNDERS SPIRIT --- */}
                  <div className="md:col-span-2 bg-slate-50 p-5 rounded-xl border border-slate-200">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      Spirit Title (Locked)
                    </label>
                    <input
                      type="text"
                      value={companyInfo.spiritTitle}
                      disabled
                      className="w-full mb-4 px-3 py-2 bg-slate-200/50 border-transparent rounded-lg text-slate-400 cursor-not-allowed font-medium"
                    />
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      Spirit Text
                    </label>
                    <textarea
                      rows={2}
                      value={companyInfo.spiritText}
                      onChange={(e) =>
                        setCompanyInfo({
                          ...companyInfo,
                          spiritText: e.target.value,
                        })
                      }
                      disabled={!isEditing || isItemLocked}
                      className={`w-full px-3 py-2 rounded-lg resize-none font-serif transition-all duration-300 ${
                        isEditing && !isItemLocked
                          ? "bg-white border border-slate-300 text-slate-900 focus:ring-2 focus:ring-daw-green/20 shadow-inner"
                          : "bg-slate-100/50 border-transparent text-slate-500 cursor-not-allowed"
                      }`}
                    />
                  </div>

                  {/* --- MISSION --- */}
                  <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      Mission Title (Locked)
                    </label>
                    <input
                      type="text"
                      value={companyInfo.missionTitle}
                      disabled
                      className="w-full mb-4 px-3 py-2 bg-slate-200/50 border-transparent rounded-lg text-slate-400 cursor-not-allowed font-medium"
                    />
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      Mission Text
                    </label>
                    <textarea
                      rows={4}
                      value={companyInfo.missionText}
                      onChange={(e) =>
                        setCompanyInfo({
                          ...companyInfo,
                          missionText: e.target.value,
                        })
                      }
                      disabled={!isEditing || isItemLocked}
                      className={`w-full px-3 py-2 rounded-lg resize-none font-serif transition-all duration-300 ${
                        isEditing && !isItemLocked
                          ? "bg-white border border-slate-300 text-slate-900 focus:ring-2 focus:ring-daw-green/20 shadow-inner"
                          : "bg-slate-100/50 border-transparent text-slate-500 cursor-not-allowed"
                      }`}
                    />
                  </div>

                  {/* --- VISION --- */}
                  <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      Vision Title (Locked)
                    </label>
                    <input
                      type="text"
                      value={companyInfo.visionTitle}
                      disabled
                      className="w-full mb-4 px-3 py-2 bg-slate-200/50 border-transparent rounded-lg text-slate-400 cursor-not-allowed font-medium"
                    />
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      Vision Text
                    </label>
                    <textarea
                      rows={4}
                      value={companyInfo.visionText}
                      onChange={(e) =>
                        setCompanyInfo({
                          ...companyInfo,
                          visionText: e.target.value,
                        })
                      }
                      disabled={!isEditing || isItemLocked}
                      className={`w-full px-3 py-2 rounded-lg resize-none font-serif transition-all duration-300 ${
                        isEditing && !isItemLocked
                          ? "bg-white border border-slate-300 text-slate-900 focus:ring-2 focus:ring-daw-green/20 shadow-inner"
                          : "bg-slate-100/50 border-transparent text-slate-500 cursor-not-allowed"
                      }`}
                    />
                  </div>
                </div>
              </div>
            );
          })()}

        {/* TAB 2: HISTORY (The Bulk Architect)*/}
        {activeTab === "history" &&
          (() => {
            const isModuleLocked =
              (companyHistory.some((h) => h.is_locked) ||
                optimisticLocks.history) &&
              !isSuperadmin;
            const lockStyles =
              "opacity-60 grayscale-[30%] pointer-events-none select-none";

            // Deteksi Draf Ditolak
            const rejectedDraft = rejectedDrafts.find(
              (d) => d.module_name === "History",
            );
            const hasRejected = !!rejectedDraft;

            return (
              <div
                className={`space-y-6 animate-in fade-in duration-300 transition-all ${isModuleLocked ? lockStyles : ""}`}>
                {hasRejected && (
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-amber-500 text-white p-4 rounded-xl shadow-sm mb-6 animate-in slide-in-from-top-2">
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="w-6 h-6 shrink-0" />
                      <div>
                        <h4 className="font-bold text-sm">
                          Catatan Peninjau (Perlu Perbaikan)
                        </h4>
                        <p className="text-sm text-amber-50">
                          {rejectedDraft.rejection_reason}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        if (!rejectedDraft.payload?.histories) return;
                        setCompanyHistory(
                          rejectedDraft.payload.histories.map(
                            (h: any, i: number) => ({
                              id: Date.now() + i, // Generate temporary ID for React keys
                              year: h.year,
                              text: h.text || h.description,
                            }),
                          ),
                        );
                        toast.success(
                          "Timeline berhasil dipulihkan dari draf!",
                        );
                      }}
                      className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg text-sm font-bold transition-colors whitespace-nowrap">
                      <RotateCcw className="w-4 h-4" /> Pulihkan Draf
                    </button>
                  </div>
                )}

                <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-4">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                      Company Timeline
                    </h3>
                    <p className="text-sm text-slate-500 mt-1">
                      Tambah atau edit jejak sejarah perusahaan secara
                      berurutan.
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    {isModuleLocked && (
                      <span className="flex items-center gap-1.5 text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full border border-blue-100">
                        <Lock className="w-3.5 h-3.5" /> Sedang Ditinjau
                      </span>
                    )}
                    {isEditing && !isModuleLocked && (
                      <button
                        onClick={addHistory}
                        className="flex items-center gap-1.5 px-4 py-2 bg-daw-green/10 hover:bg-daw-green hover:text-white text-daw-green rounded-lg text-sm font-bold transition-colors shadow-sm active:scale-95">
                        <Plus className="w-4 h-4" /> Tambah Jejak Sejarah
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  {companyHistory.map((item) => (
                    <div
                      key={item.id}
                      className="flex flex-col sm:flex-row gap-4 items-start bg-slate-50 p-5 rounded-xl border border-slate-200 group transition-all hover:border-slate-300">
                      <div className="w-full sm:w-32 shrink-0">
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                          Tahun
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. 2026"
                          value={item.year}
                          onChange={(e) =>
                            updateHistory(item.id, "year", e.target.value)
                          }
                          disabled={!isEditing || isModuleLocked}
                          className={`w-full px-3 py-2 rounded-lg font-bold transition-all duration-300 ${
                            isEditing && !isModuleLocked
                              ? "bg-white border border-slate-300 text-slate-900 focus:ring-2 focus:ring-daw-green/20 shadow-inner"
                              : "bg-slate-100/50 border-transparent text-slate-500 cursor-not-allowed"
                          }`}
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
                          disabled={!isEditing || isModuleLocked}
                          className={`w-full px-3 py-2 rounded-lg resize-none transition-all duration-300 ${
                            isEditing && !isModuleLocked
                              ? "bg-white border border-slate-300 text-slate-900 focus:ring-2 focus:ring-daw-green/20 shadow-inner"
                              : "bg-slate-100/50 border-transparent text-slate-500 cursor-not-allowed"
                          }`}
                        />
                      </div>

                      {/* Sembunyikan tombol Trash jika di-lock */}
                      {isEditing && !isModuleLocked && (
                        <button
                          onClick={() => removeHistory(item.id)}
                          className="mt-6 p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors sm:opacity-0 sm:group-hover:opacity-100 w-full sm:w-auto flex justify-center"
                          title="Hapus sejarah ini">
                          <Trash2 className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  ))}

                  {companyHistory.length === 0 && (
                    <div className="text-center py-12 text-slate-500 text-sm bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
                      Belum ada jejak sejarah perusahaan. <br /> Klik{" "}
                      <b>"Tambah Jejak Sejarah"</b> untuk memulai.
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        {/* ==========================================
            TAB 3: PHILOSOPHY (Shared Singleton Lock)
            ========================================== */}
        {activeTab === "philosophy" &&
          (() => {
            const isItemLocked =
              (aboutData?.is_locked || optimisticLocks.info) && !isSuperadmin;
            const lockStyles =
              "opacity-60 grayscale-[30%] pointer-events-none select-none";

            const rejectedDraft = rejectedDrafts.find(
              (d) => d.module_name === "AboutInfo",
            );
            const hasRejected = !!rejectedDraft;

            return (
              <div
                className={`space-y-8 animate-in fade-in duration-300 transition-all ${isItemLocked ? lockStyles : ""}`}>
                {hasRejected && (
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-amber-500 text-white p-4 rounded-xl shadow-sm mb-6 animate-in slide-in-from-top-2">
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="w-6 h-6 shrink-0" />
                      <div>
                        <h4 className="font-bold text-sm">
                          Catatan Peninjau (Perlu Perbaikan)
                        </h4>
                        <p className="text-sm text-amber-50">
                          {rejectedDraft.rejection_reason}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        if (!rejectedDraft.payload) return;
                        setPhilosophy({
                          mainTitle:
                            rejectedDraft.payload.philosophyTitle ??
                            philosophy.mainTitle,
                          pillars:
                            rejectedDraft.payload.philosophyPillars ??
                            philosophy.pillars,
                        });
                        toast.success(
                          "Filosofi perusahaan berhasil dipulihkan dari draf!",
                        );
                      }}
                      className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg text-sm font-bold transition-colors whitespace-nowrap">
                      <RotateCcw className="w-4 h-4" /> Pulihkan Draf
                    </button>
                  </div>
                )}

                <div className="flex items-center justify-between mb-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      Main Section Title
                    </label>
                    <input
                      type="text"
                      value={philosophy.mainTitle}
                      onChange={(e) =>
                        setPhilosophy({
                          ...philosophy,
                          mainTitle: e.target.value,
                        })
                      }
                      disabled={!isEditing || isItemLocked}
                      className={`w-full max-w-md px-4 py-3 rounded-lg font-serif text-xl transition-all duration-300 ${
                        isEditing && !isItemLocked
                          ? "bg-white border border-slate-300 text-slate-900 focus:ring-2 focus:ring-daw-green/20 shadow-inner"
                          : "bg-slate-100/50 border-transparent text-slate-500 cursor-not-allowed"
                      }`}
                    />
                  </div>

                  {isItemLocked && (
                    <span className="flex items-center gap-1.5 text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full border border-blue-100 mt-6">
                      <Lock className="w-3.5 h-3.5" /> Sedang Ditinjau
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {philosophy.pillars.map((pillar) => {
                    // 🛡️ DYNAMIC ICON RESOLVER: Cari ikon dari daftar, fallback ke Target
                    const SelectedIcon =
                      AVAILABLE_ICONS.find((i) => i.id === pillar.id)?.icon ||
                      Target;

                    return (
                      <div
                        key={pillar.id}
                        className="bg-slate-50 border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row gap-4 items-start group relative">
                        {/* Visual Indicator of the "ID" (Sekarang Dinamis) */}
                        <div className="w-12 h-12 rounded-lg bg-white border border-slate-200 flex items-center justify-center shadow-sm shrink-0 transition-all duration-300">
                          <SelectedIcon className="w-6 h-6 text-daw-green opacity-80" />
                        </div>

                        <div className="flex-1 space-y-4 w-full">
                          {/* 🛡️ NEW: ICON PICKER UI */}
                          <div className="relative">
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                              Pilih Ikon Pilar
                            </label>
                            <button
                              type="button"
                              onClick={() => {
                                if (!isEditing || isItemLocked) return;
                                setOpenIconPickerId(
                                  openIconPickerId === pillar.id
                                    ? null
                                    : pillar.id,
                                );
                              }}
                              disabled={!isEditing || isItemLocked}
                              className={`flex items-center justify-between w-full px-3 py-2 rounded-lg text-xs font-medium transition-all duration-300 ${
                                isEditing && !isItemLocked
                                  ? "bg-white border border-slate-300 text-slate-900 hover:bg-slate-50 focus:ring-2 focus:ring-daw-green/20"
                                  : "bg-slate-100/50 border-transparent text-slate-500 cursor-not-allowed"
                              }`}>
                              <div className="flex items-center gap-2">
                                <SelectedIcon className="w-4 h-4 text-slate-500" />
                                <span>
                                  {AVAILABLE_ICONS.find(
                                    (i) => i.id === pillar.id,
                                  )?.label || `Unknown Key (${pillar.id})`}
                                </span>
                              </div>
                              {isEditing && !isItemLocked && (
                                <ChevronDown className="w-4 h-4 text-slate-400" />
                              )}
                            </button>

                            {/* Dropdown Menu */}
                            {openIconPickerId === pillar.id &&
                              isEditing &&
                              !isItemLocked && (
                                <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden animate-in fade-in zoom-in-95">
                                  <div className="max-h-48 overflow-y-auto p-1 hide-scrollbar">
                                    {AVAILABLE_ICONS.map((iconOpt) => (
                                      <button
                                        key={iconOpt.id}
                                        type="button"
                                        onClick={() => {
                                          updatePillar(
                                            pillar.id,
                                            "id" as any,
                                            iconOpt.id,
                                          );
                                          setOpenIconPickerId(null); // Tutup dropdown setelah memilih
                                        }}
                                        className={`flex items-center gap-3 w-full px-3 py-2.5 text-left text-sm rounded-md transition-colors ${
                                          pillar.id === iconOpt.id
                                            ? "bg-daw-green/10 text-daw-green font-bold"
                                            : "text-slate-700 hover:bg-slate-100"
                                        }`}>
                                        <iconOpt.icon
                                          className={`w-4 h-4 ${pillar.id === iconOpt.id ? "text-daw-green" : "text-slate-400"}`}
                                        />
                                        {iconOpt.label}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}
                          </div>

                          {/* --- TITLE INPUT --- */}
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                              Pillar Title
                            </label>
                            <input
                              type="text"
                              value={pillar.title}
                              onChange={(e) =>
                                updatePillar(pillar.id, "title", e.target.value)
                              }
                              disabled={!isEditing || isItemLocked}
                              className={`w-full px-3 py-2 rounded-lg font-bold transition-all duration-300 ${
                                isEditing && !isItemLocked
                                  ? "bg-white border border-slate-300 text-slate-900 focus:ring-2 focus:ring-daw-green/20 shadow-inner"
                                  : "bg-slate-100/50 border-transparent text-slate-500 cursor-not-allowed"
                              }`}
                            />
                          </div>

                          {/* --- TEXT/DESCRIPTION INPUT --- */}
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                              Description
                            </label>
                            <textarea
                              rows={4}
                              value={pillar.text}
                              onChange={(e) =>
                                updatePillar(pillar.id, "text", e.target.value)
                              }
                              disabled={!isEditing || isItemLocked}
                              className={`w-full px-3 py-2 rounded-lg resize-none text-sm transition-all duration-300 ${
                                isEditing && !isItemLocked
                                  ? "bg-white border border-slate-300 text-slate-900 focus:ring-2 focus:ring-daw-green/20 shadow-inner"
                                  : "bg-slate-100/50 border-transparent text-slate-500 cursor-not-allowed"
                              }`}
                            />
                            <p className="text-[10px] text-slate-400 mt-1 italic">
                              Gunakan tombol{" "}
                              <kbd className="bg-slate-100 border border-slate-200 px-1 rounded">
                                Enter
                              </kbd>{" "}
                              untuk membuat baris baru.
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {philosophy.pillars.length === 0 && (
                    <div className="md:col-span-2 text-center py-12 text-slate-500 text-sm bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
                      Belum ada pilar filosofi yang ditambahkan.
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        {/* TAB 4: MANAGEMENT TEAM (Row-Level Lock)*/}
        {activeTab === "management" &&
          (() => {
            return (
              <div className="space-y-8 animate-in fade-in duration-300 relative">
                {/* --- HEADER & ADD BUTTON --- */}
                <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-4">
                  <div>
                    <h3 className="font-bold text-slate-900 text-lg">
                      Board of Directors & Management
                    </h3>
                    <p className="text-sm text-slate-500">
                      Atur data direksi, jabatan, serta foto profil resmi.
                    </p>
                  </div>
                  {/* 🛡️ Tombol Add Person tetap aktif karena menambah orang baru tidak melanggar gembok orang lain */}
                  {isEditing && (
                    <button
                      onClick={() => openPersonModal()}
                      className="flex items-center gap-1.5 px-4 py-2 bg-daw-green hover:bg-[#003b1c] text-white rounded-lg text-sm font-bold transition-colors shadow-sm active:scale-95">
                      <Plus className="w-4 h-4" /> Add Person
                    </button>
                  )}
                </div>

                {/* --- TABLE LIST --- */}
                <div className="overflow-x-auto border border-slate-200 rounded-lg bg-white shadow-sm">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500 font-bold">
                        <th className="px-6 py-4">Photo</th>
                        <th className="px-6 py-4">Name & Role</th>
                        <th className="px-6 py-4">Level (Order)</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {managementTeam.map((person) => {
                        // 🛡️ BLUEPRINT: Row-Level Lock & Rejection Detection
                        const isRowLocked = person.is_locked && !isSuperadmin;
                        const lockStyles =
                          "opacity-60 grayscale-[30%] bg-slate-50";
                        const rejectedDraft = rejectedDrafts.find(
                          (d) =>
                            d.module_name === "Management" &&
                            d.target_id === String(person.id),
                        );
                        const hasRejected = !!rejectedDraft;

                        return (
                          <tr
                            key={person.id}
                            className={`transition-colors ${isRowLocked ? lockStyles : "hover:bg-slate-50/50"}`}>
                            <td className="px-6 py-4">
                              <ManagementImage
                                src={person.photoUrl}
                                alt={person.name}
                              />
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-bold text-slate-900">
                                  {person.name}
                                </p>
                                {/* 🛡️ Penanda Draf Ditolak di List */}
                                {hasRejected && !isSuperadmin && (
                                  <span
                                    title="Draf perlu direvisi"
                                    className="flex h-2 w-2 rounded-full bg-amber-500 animate-pulse"
                                  />
                                )}
                              </div>
                              <p className="text-xs text-slate-500">
                                {person.role}
                              </p>
                            </td>
                            <td className="px-6 py-4">
                              <span className="inline-flex items-center px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-200 text-slate-700">
                                {person.level} ({person.order})
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              {isRowLocked ? (
                                <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-100">
                                  <Lock className="w-3 h-3" /> Sedang Ditinjau
                                </span>
                              ) : isEditing ? (
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    onClick={() => openPersonModal(person)}
                                    className={`p-2 rounded-lg transition-colors border ${
                                      hasRejected
                                        ? "text-amber-600 bg-amber-50 border-amber-200 hover:bg-amber-100"
                                        : "text-slate-400 bg-white border-slate-200 hover:text-daw-green hover:border-daw-green"
                                    }`}
                                    title={
                                      hasRejected ? "Revisi Draf" : "Edit Data"
                                    }>
                                    <Edit className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => deletePerson(person.id)}
                                    className="p-2 text-slate-400 hover:text-red-600 bg-white border border-slate-200 hover:border-red-600 rounded-lg transition-colors"
                                    title="Ajukan Hapus">
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              ) : (
                                <span className="text-xs text-slate-300 italic flex justify-end">
                                  Mode Baca
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}

                      {managementTeam.length === 0 && (
                        <tr>
                          <td
                            colSpan={4}
                            className="px-6 py-12 text-center text-slate-500 text-sm border-2 border-dashed border-slate-200 bg-slate-50">
                            Belum ada data kepemimpinan. <br /> Klik{" "}
                            <b>'Add Person'</b> untuk memulai.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* ==========================================
                  MODAL: CREATE / EDIT PERSON
                  ========================================== */}
                {isPersonModalOpen &&
                  (() => {
                    const rejectedDraft = editingPersonId
                      ? rejectedDrafts.find(
                          (d) =>
                            d.module_name === "Management" &&
                            d.target_id === String(editingPersonId),
                        )
                      : null;

                    return (
                      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                          {/* --- MODAL HEADER --- */}
                          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                            <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
                              {editingPersonId ? (
                                <Edit className="w-5 h-5 text-daw-green" />
                              ) : (
                                <Plus className="w-5 h-5 text-daw-green" />
                              )}
                              {editingPersonId
                                ? "Edit Profil Kepemimpinan"
                                : "Tambah Anggota Baru"}
                            </h3>
                            <button
                              onClick={() => setIsPersonModalOpen(false)}
                              className="text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 p-1.5 rounded-md transition-colors">
                              ✕
                            </button>
                          </div>

                          {/* 🛡️ REJECTION RIBBON (Didalam Modal) */}
                          {rejectedDraft && (
                            <div className="bg-amber-500 text-white px-6 py-3 flex items-start gap-3">
                              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                              <div className="text-sm">
                                <span className="font-bold block">
                                  Draf Ditolak:
                                </span>
                                {rejectedDraft.rejection_reason}
                                <span className="block mt-1 text-xs text-amber-100 italic">
                                  *Data di bawah ini adalah data draf terakhir
                                  Anda. Silakan perbaiki dan ajukan ulang.
                                </span>
                              </div>
                            </div>
                          )}

                          {/* --- MODAL FORM --- */}
                          <form onSubmit={savePerson} className="p-6 space-y-6">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                              <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                                  Full Name
                                </label>
                                <input
                                  required
                                  type="text"
                                  value={personForm.name}
                                  onChange={(e) =>
                                    setPersonForm({
                                      ...personForm,
                                      name: e.target.value,
                                    })
                                  }
                                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-daw-green/20 focus:border-daw-green transition-all"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                                  Job Title / Role
                                </label>
                                <input
                                  required
                                  type="text"
                                  value={personForm.role}
                                  onChange={(e) =>
                                    setPersonForm({
                                      ...personForm,
                                      role: e.target.value,
                                    })
                                  }
                                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-daw-green/20 focus:border-daw-green transition-all"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                              <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                                  Tingkat Jabatan
                                </label>
                                <select
                                  value={personForm.level}
                                  onChange={(e) =>
                                    setPersonForm({
                                      ...personForm,
                                      level: e.target.value,
                                    })
                                  }
                                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-daw-green/20 focus:border-daw-green transition-all bg-white">
                                  <option value="chairman">Chairman</option>
                                  <option value="director">Director</option>
                                  <option value="division">
                                    Division Head
                                  </option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                                  Urutan Tampilan
                                </label>
                                <input
                                  required
                                  type="number"
                                  min="1"
                                  value={personForm.order}
                                  onChange={(e) =>
                                    setPersonForm({
                                      ...personForm,
                                      order: parseInt(e.target.value) || 1,
                                    })
                                  }
                                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-daw-green/20 focus:border-daw-green transition-all"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                                Description / Bio
                              </label>
                              <textarea
                                required
                                rows={3}
                                value={personForm.description}
                                onChange={(e) =>
                                  setPersonForm({
                                    ...personForm,
                                    description: e.target.value,
                                  })
                                }
                                className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-daw-green/20 focus:border-daw-green resize-none transition-all"
                              />
                            </div>

                            {/* --- PHOTO UPLOAD AREA --- */}
                            <div>
                              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                                Profile Photo (Opsional)
                              </label>
                              <div className="flex items-center gap-5 p-4 border border-slate-100 bg-slate-50/50 rounded-xl">
                                <PhotoPreviewer
                                  file={personForm.photo}
                                  savedUrl={
                                    personForm.removePhoto
                                      ? null
                                      : personForm.savedPhotoUrl
                                  }
                                  // isItemLocked={false} // Di dalam modal, anggap selalu false karena pre-flight guard sudah jalan
                                />

                                <div className="flex flex-col gap-3 w-full">
                                  <input
                                    type="file"
                                    accept="image/jpeg, image/png, image/webp"
                                    ref={fileInputRef}
                                    onChange={handlePhotoChange}
                                    className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-bold file:bg-daw-green/10 file:text-daw-green hover:file:bg-daw-green/20 transition-colors cursor-pointer"
                                  />
                                  {(personForm.photo ||
                                    (personForm.savedPhotoUrl &&
                                      !personForm.removePhoto)) && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setPersonForm({
                                          ...personForm,
                                          photo: null,
                                          removePhoto: true,
                                        });
                                        if (fileInputRef.current)
                                          fileInputRef.current.value = "";
                                      }}
                                      className="text-xs font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 w-max px-3 py-1.5 rounded-md transition-colors flex items-center gap-1">
                                      <Trash2 className="w-3.5 h-3.5" /> Hapus
                                      Foto Saat Ini
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* --- MODAL FOOTER --- */}
                            <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                              <button
                                type="button"
                                onClick={() => setIsPersonModalOpen(false)}
                                className="px-5 py-2.5 rounded-lg font-bold text-sm text-slate-600 hover:bg-slate-100 transition-colors">
                                Batal
                              </button>
                              <button
                                type="submit"
                                className="px-6 py-2.5 bg-daw-green text-white rounded-lg font-bold text-sm hover:bg-[#003b1c] transition-all shadow-md active:scale-95 flex items-center gap-2">
                                <Save className="w-4 h-4" />
                                {isSuperadmin ? "Publish Data" : "Ajukan Draf"}
                              </button>
                            </div>
                          </form>
                        </div>
                      </div>
                    );
                  })()}
              </div>
            );
          })()}
      </div>
    </div>
  );
}
