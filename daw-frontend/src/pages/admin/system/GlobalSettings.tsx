import { useState, useEffect, useCallback } from "react";
import {
  Save,
  Building2,
  MapPin,
  Phone,
  Mail,
  Globe,
  Share2,
  Map,
  Lock,
  Unlock,
  AlertTriangle,
  Image as ImageIcon,
  RotateCcw,
  ShieldAlert,
  Loader2,
  Send,
  X,
} from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { getCleanImageUrl } from "@/lib/utils";
import { useSettings } from "@/contexts/SettingsContext";
import { getErrorMessage } from "@/lib/utils";
import ImageAdjustmentModal from "@/components/admin/ImageAdjustmentModal";
import { HelpTooltip } from "@/components/ui/HelpTooltip";
import LockedStateTracker from "@/components/admin/LockedStateTracker";

export default function GlobalSettings() {
  const {
    settings,
    rejectedSettings,
    isLoading,
    isSuperadmin,
    refreshSettings,
  } = useSettings();

  const [formData, setFormData] = useState({
    companyName: "",
    address: "",
    phone: "",
    email: "",
    website: "",
    googleMapsUrl: "",
    linkedinUrl: "",
  });
  const [originalData, setOriginalData] = useState(formData);

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [faviconFile, setFaviconFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [faviconPreview, setFaviconPreview] = useState<string | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isDraggingLogo, setIsDraggingLogo] = useState(false);
  const [isDraggingFavicon, setIsDraggingFavicon] = useState(false);
  const [isOptimisticallyLocked, setIsOptimisticallyLocked] = useState(false);
  const [cropTarget, setCropTarget] = useState<{type: 'logo' | 'favicon', file: File} | null>(null);

  const isDataLocked = settings?.is_locked === true || isOptimisticallyLocked;
  const shouldLockUI = isDataLocked && !rejectedSettings && !isSuperadmin;
  const isOverrideMode = isDataLocked && isSuperadmin;

  const [activeTab, setActiveTab] = useState<"profile" | "contact" | "social">("profile");

  const sanitizeUrl = (url: string) => {
    if (!url || url.trim() === "") return "";
    const trimmed = url.trim();
    if (trimmed === "#" || trimmed === "/") return trimmed;
    return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  };

  const parseGoogleMapsEmbed = (input: string) => {
    if (!input) return "";
    const srcMatch = input.match(/src="([^"]+)"/);
    return srcMatch ? srcMatch[1] : input;
  };

  // Sync Optimistic Lock
  useEffect(() => {
    if (settings && isOptimisticallyLocked) {
      setIsOptimisticallyLocked(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings?.is_locked, settings?.lock_ticket]);

  // Sync Data & Create Snapshot
  useEffect(() => {
    if (settings && !isEditing) {
      const liveData = {
        companyName: settings.companyName || "",
        address: settings.address || "",
        phone: settings.phone || "",
        email: settings.email || "",
        website: settings.website || "",
        googleMapsUrl: settings.googleMapsUrl || "",
        linkedinUrl: settings.linkedinUrl || "",
      };

      setFormData(liveData);
      setOriginalData(liveData);

      if (settings.logoUrl) setLogoPreview(getCleanImageUrl(settings.logoUrl));
      if (settings.faviconUrl)
        setFaviconPreview(getCleanImageUrl(settings.faviconUrl));
    }
  }, [settings, isEditing]);

  // Memory Leak Guard
  useEffect(() => {
    return () => {
      if (logoPreview && logoPreview.startsWith("blob:"))
        URL.revokeObjectURL(logoPreview);
      if (faviconPreview && faviconPreview.startsWith("blob:"))
        URL.revokeObjectURL(faviconPreview);
    };
  }, [logoPreview, faviconPreview]);

  // Toggle Edit Guard
  const toggleEditMode = () => {
    if (shouldLockUI) {
      return toast.error("Akses Dibatasi", {
        description: "Data sedang dalam antrean approval.",
      });
    }

    if (!isEditing && rejectedSettings) {
      return toast.warning("Tindakan Diperlukan", {
        description:
          "Ada draf yang ditolak. Klik 'Pulihkan Draf' terlebih dahulu sebelum mengedit ulang.",
      });
    }

    if (isEditing) {
      setLogoFile(null);
      setFaviconFile(null);
      if (settings?.logoUrl) setLogoPreview(getCleanImageUrl(settings.logoUrl));
      if (settings?.faviconUrl)
        setFaviconPreview(getCleanImageUrl(settings.faviconUrl));
    }

    setIsEditing(!isEditing);
  };

  // Restore Handler
  const handleRestoreDraft = () => {
    if (!rejectedSettings?.payload) {
      toast.error("Data pemulihan tidak ditemukan.");
      return;
    }

    // Safety guard untuk aksi DELETE (sesuai referensi lo)
    if (rejectedSettings?.action === "DELETE") {
      toast.error(
        "Permintaan penghapusan yang ditolak tidak dapat dipulihkan ke dalam form.",
      );
      return;
    }

    try {
      // Handle payload jika dalam bentuk string (Sequelize JSON sering kirim string)
      const rawPayload = rejectedSettings.payload;
      const payload =
        typeof rawPayload === "string" ? JSON.parse(rawPayload) : rawPayload;

      // Deep Merge ke Form Data
      setFormData((prev) => ({
        ...prev,
        companyName: payload.companyName ?? prev.companyName,
        address: payload.address ?? prev.address,
        phone: payload.phone ?? prev.phone,
        email: payload.email ?? prev.email,
        website: payload.website ?? prev.website,
        googleMapsUrl: payload.googleMapsUrl ?? prev.googleMapsUrl,
        linkedinUrl: payload.linkedinUrl ?? prev.linkedinUrl,
      }));

      setLogoFile(null);
      setFaviconFile(null);

      if (payload.logoUrl) setLogoPreview(getCleanImageUrl(payload.logoUrl));
      if (payload.faviconUrl)
        setFaviconPreview(getCleanImageUrl(payload.faviconUrl));

      setIsEditing(true); // Masuk ke mode edit agar field bisa diketik ulang
      toast.success("Konten draf berhasil dipulihkan!", {
        description: "Silakan periksa kembali sebelum mengirim ulang.",
      });
    } catch (err) {
      console.error("Restore Error:", err);
      toast.error("Gagal memproses data pemulihan.");
    }
  };

  // CLEAN DISCARD LOGIC
  const handleDiscardDraft = async () => {
    if (!rejectedSettings?.notrans) return;

    const toastId = toast.loading("Mengabaikan notifikasi penolakan...");
    try {
      await api.patch("/approval/discard", {
        notrans: rejectedSettings.notrans,
      });

      toast.success("Notifikasi revisi berhasil diabaikan.", { id: toastId });

      await refreshSettings();
    } catch (error: unknown) {
      toast.error("Gagal mengabaikan draf", {
        id: toastId,
        description:
          getErrorMessage(error) ||
          "Kesalahan komunikasi dengan server.",
      });
    }
  };

  const hasDataChanged = useCallback(() => {
    const textChanged =
      JSON.stringify(formData) !== JSON.stringify(originalData);
    const filesChanged = logoFile !== null || faviconFile !== null;
    return textChanged || filesChanged;
  }, [formData, originalData, logoFile, faviconFile]);

  // Submission & Baton Pass
  const handleSave = async () => {
    if (shouldLockUI) {
      return toast.error("Akses Dibatasi.", {
        description: "Data ini sedang ditinjau.",
      });
    }

    if (!hasDataChanged()) {
      setIsEditing(false);
      return toast.info("Tidak ada perubahan terdeteksi.");
    }

    setIsSaving(true);
    const loadingToast = toast.loading(
      isSuperadmin
        ? "Menyimpan pembaruan secara live..."
        : "Mengirim revisi ke sistem ERP...",
    );

    try {
      const data = new FormData();
      const sanitizedData = {
        ...formData,
        website: sanitizeUrl(formData.website),
        linkedinUrl: sanitizeUrl(formData.linkedinUrl),
      };

      Object.entries(sanitizedData).forEach(([key, value]) => {
        data.append(key, value);
      });

      data.append("status", "Published");

      // Ghost Cleanup Ticket (Blueprint 7.4)
      if (rejectedSettings?.notrans) {
        data.append("previous_notrans", rejectedSettings.notrans);
      }

      if (logoFile) data.append("logo", logoFile);
      if (faviconFile) data.append("favicon", faviconFile);

      await api.put("/settings", data, { timeout: 60000 });

      if (!isSuperadmin) setIsOptimisticallyLocked(true); // UX Instan

      setIsEditing(false);
      setLogoFile(null);
      setFaviconFile(null);

      await refreshSettings();

      toast.success(
        isSuperadmin ? "Perubahan live berhasil!" : "Revisi diajukan",
        { id: loadingToast },
      );
    } catch (error: unknown) {
      toast.error("Gagal Memperbarui", {
        description:
          getErrorMessage(error) || "Periksa koneksi internet.",
        id: loadingToast,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    let value = e.target.value;
    if (e.target.name === "googleMapsUrl") {
      value = parseGoogleMapsEmbed(value);
    }
    setFormData({ ...formData, [e.target.name]: value });
  };

  if (isLoading) {
    return (
      <div className="p-12 flex flex-col items-center justify-center text-slate-500 gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-daw-green" />
        <p className="text-sm font-medium animate-pulse">Memuat Data...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* SOVEREIGN BANNERS */}

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

      {/* 2. Blue Banner (Editor Locked Warning) - Handled by LockedStateTracker */}

      {/* REJECTION RIBBON */}
      {rejectedSettings && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl overflow-hidden shadow-sm animate-in slide-in-from-top-4 duration-300">
          <div className="p-4 md:p-5 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 relative">
            {/* Semantic Left Border */}
            <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-amber-500"></div>

            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center shrink-0 mt-0.5 animate-pulse">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h4 className="text-xs md:text-sm font-black text-amber-900 uppercase tracking-tighter mb-0.5">
                  ⚠️ Catatan Peninjau
                </h4>
                <p className="text-xs text-amber-800 leading-relaxed max-w-2xl">
                  Alasan penolakan:{" "}
                  <span className="font-bold italic">
                    "
                    {rejectedSettings.rejection_reason ||
                      "Silakan perbaiki data sesuai arahan."}
                    "
                  </span>
                  <br className="hidden sm:block" />
                  Klik tombol di samping untuk mengembalikan draf terakhir Anda.
                </p>
              </div>
            </div>

            {/* RECOVERY ACTIONS */}
            <div className="flex items-center gap-2 w-full lg:w-auto shrink-0">
              {/* Opsi 1: Restoration Logic */}
              {rejectedSettings.action !== "DELETE" && (
                <button
                  type="button"
                  onClick={handleRestoreDraft}
                  disabled={shouldLockUI}
                  className="flex-1 lg:flex-none flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 shadow-sm shadow-amber-200 disabled:opacity-50 disabled:grayscale">
                  <RotateCcw className="w-4 h-4" />
                  Pulihkan Data
                </button>
              )}

              {/* Opsi 2: Discard Logic */}
              <button
                type="button"
                onClick={handleDiscardDraft}
                className="flex-1 lg:flex-none flex items-center justify-center gap-2 bg-white border border-amber-200 text-amber-600 hover:bg-amber-50 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95">
                <X className="w-4 h-4" />
                Abaikan Notifikasi
              </button>
            </div>
          </div>

          {/* Progress Bar Animation (Sesuai Referensi) */}
          <div className="h-1 bg-amber-200 w-full overflow-hidden">
            <div className="h-full bg-amber-500 w-1/3 animate-pulse"></div>
          </div>
        </div>
      )}

      {/* HEADER (MATRIX BUTTONS) */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm top-0 z-30">
        <div className="flex-1 flex flex-col md:flex-row items-start md:items-center gap-2 md:gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-serif font-bold text-slate-900">
              Global Settings
            </h1>
            <p className="text-xs md:text-sm text-slate-500 mt-1">
              Kelola identitas, kontak, dan branding website.
            </p>
          </div>

          {/* Indikator Gembok Universal */}
          {isDataLocked && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-bold uppercase tracking-wider border border-blue-100 mt-1 md:mt-0 animate-pulse">
              <Lock className="w-3 h-3" /> Pending Approval
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <button
            onClick={toggleEditMode}
            disabled={isSaving || shouldLockUI}
            className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-black text-[11px] uppercase tracking-widest transition-colors border shadow-sm ${
              shouldLockUI
                ? "bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed"
                : isEditing
                  ? "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 ring-2 ring-amber-500/10"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
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
                ? "Locked"
                : isOverrideMode && isEditing
                  ? "Override Mode"
                  : isEditing
                    ? "Editing Mode"
                    : "Locked"}
            </span>
          </button>

          <button
            onClick={handleSave}
            disabled={isSaving || !isEditing || shouldLockUI}
            className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg font-black text-[11px] uppercase tracking-widest transition-all shadow-lg active:scale-95 disabled:cursor-not-allowed disabled:shadow-none ${
              isSaving
                ? "bg-slate-300 text-slate-700"
                : shouldLockUI
                  ? "bg-slate-200 text-slate-500"
                  : isOverrideMode
                    ? "bg-amber-600 hover:bg-amber-700 text-white shadow-amber-600/20"
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
                  : isOverrideMode
                    ? "Override & Publish"
                    : isSuperadmin
                      ? "Publish Live"
                      : "Request Approval"}
            </span>
          </button>
        </div>
      </div>

      {/* 3. THE FORM BODY (Tabbed Interface) */}
      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col md:flex-row transition-all duration-500">
        
        {/* TAB NAVIGATION (Sidebar on Desktop, Top on Mobile) */}
        <div className="w-full md:w-64 bg-slate-50/50 border-b md:border-b-0 md:border-r border-slate-100 p-4 space-y-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab("profile")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all font-bold text-sm ${
              activeTab === "profile" 
                ? "bg-white text-daw-green shadow-sm border border-slate-200" 
                : "text-slate-500 hover:bg-slate-100/50 hover:text-slate-700 border border-transparent"
            }`}
          >
            <ImageIcon className="w-4 h-4" />
            Profil & Branding
          </button>
          
          <button
            type="button"
            onClick={() => setActiveTab("contact")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all font-bold text-sm ${
              activeTab === "contact" 
                ? "bg-white text-daw-green shadow-sm border border-slate-200" 
                : "text-slate-500 hover:bg-slate-100/50 hover:text-slate-700 border border-transparent"
            }`}
          >
            <MapPin className="w-4 h-4" />
            Kontak & Lokasi
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("social")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all font-bold text-sm ${
              activeTab === "social" 
                ? "bg-white text-daw-green shadow-sm border border-slate-200" 
                : "text-slate-500 hover:bg-slate-100/50 hover:text-slate-700 border border-transparent"
            }`}
          >
            <Share2 className="w-4 h-4" />
            Media Sosial
          </button>
        </div>

        {/* TAB CONTENT */}
        <LockedStateTracker isLocked={!!shouldLockUI} lockTicket={settings?.lock_ticket || null}>
        <div className="flex-1 p-6 md:p-10 bg-white">
          
          {/* TAB 1: PROFILE & BRANDING */}
          {activeTab === "profile" && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="border-b border-slate-100 pb-4">
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-daw-green" />
                  Identitas Perusahaan
                </h2>
                <p className="text-xs text-slate-500 mt-1">Logo dan nama yang merepresentasikan bisnis Anda.</p>
              </div>

              <div className="space-y-6 max-w-2xl">
                <div>
                  <label htmlFor="companyName" className="flex items-center text-[10px] font-black text-slate-500 uppercase tracking-wider mb-2">
                    Company Name
                  </label>
                  <input
                    id="companyName"
                    type="text"
                    name="companyName"
                    value={formData.companyName}
                    onChange={handleChange}
                    readOnly={!isEditing || shouldLockUI}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daw-green/20 focus:border-daw-green focus:bg-white text-slate-800 font-bold transition-colors read-only:bg-slate-50 read-only:text-slate-500 read-only:focus:ring-0 read-only:focus:border-slate-200 cursor-text"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {/* BOX UPLOAD LOGO UTAMA */}
                  <div className="space-y-3">
                    <label className="flex items-center text-[10px] font-black text-slate-500 uppercase tracking-widest">
                      Logo Utama
                      <HelpTooltip content="Gambar logo resmi perusahaan yang akan dipajang di pojok kiri atas dan bagian bawah (footer) website utama. Rekomendasi: Gunakan gambar berlatar transparan (.PNG) agar tidak menutupi warna background." position="top" />
                    </label>
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        if (isEditing && !shouldLockUI) setIsDraggingLogo(true);
                      }}
                      onDragLeave={(e) => {
                        e.preventDefault();
                        setIsDraggingLogo(false);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        setIsDraggingLogo(false);
                        if (!isEditing || shouldLockUI) return;
                        const file = e.dataTransfer.files?.[0];
                        if (file && file.type.startsWith("image/")) {
                          setCropTarget({ type: 'logo', file });
                        } else if (file) {
                          toast.error("Format file tidak didukung. Gunakan gambar (JPG/PNG/SVG).");
                        }
                      }}
                      className={`relative border-2 border-dashed rounded-2xl p-6 flex flex-col items-center gap-4 transition-all duration-300 ${
                        isDraggingLogo ? "border-daw-green bg-daw-green/5 scale-[0.99]" : "border-slate-200 bg-slate-50 hover:border-slate-300"
                      } ${!isEditing || shouldLockUI ? "opacity-60 cursor-not-allowed hover:border-slate-200" : ""}`}
                    >
                      <div className="h-28 w-full flex items-center justify-center bg-white rounded-xl border border-slate-100 p-2 shadow-sm pointer-events-none overflow-hidden bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjZjFmMTE1Ij48L3JlY3Q+CjxyZWN0IHg9IjQiIHk9IjQiIHdpZHRoPSI0IiBoZWlnaHQ9IjQiIGZpbGw9IiNmMWYxMTUiPjwvcmVjdD4KPC9zdmc+')]">
                        {logoPreview ? (
                          <img src={logoPreview} className="max-h-full max-w-full object-contain drop-shadow-sm" alt="Logo Preview" />
                        ) : (
                          <span className="text-slate-300 text-xs font-medium">No Logo Selected</span>
                        )}
                      </div>
                      <div className="text-center w-full">
                        <input
                          type="file"
                          accept="image/*"
                          disabled={!isEditing || shouldLockUI}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setCropTarget({ type: 'logo', file });
                              e.target.value = '';
                            }
                          }}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                        />
                        <button type="button" disabled={!isEditing || shouldLockUI} className="text-xs font-bold text-daw-green bg-daw-green/10 hover:bg-daw-green hover:text-white transition-colors px-4 py-2 rounded-lg disabled:opacity-50">
                          {isDraggingLogo ? "Lepaskan file di sini" : "Pilih Logo"}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* BOX UPLOAD FAVICON */}
                  <div className="space-y-3">
                    <label className="flex items-center text-[10px] font-black text-slate-500 uppercase tracking-widest">
                      Ikon Tab (Favicon)
                      <HelpTooltip content="Favicon adalah ikon kecil yang muncul di tab browser (sebelah judul website). Mengapa penting? Membuat website Anda terlihat tepercaya dan profesional. Gunakan gambar persegi (1:1)." position="top" />
                    </label>
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        if (isEditing && !shouldLockUI) setIsDraggingFavicon(true);
                      }}
                      onDragLeave={(e) => {
                        e.preventDefault();
                        setIsDraggingFavicon(false);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        setIsDraggingFavicon(false);
                        if (!isEditing || shouldLockUI) return;
                        const file = e.dataTransfer.files?.[0];
                        if (file && file.type.startsWith("image/")) {
                          setCropTarget({ type: 'favicon', file });
                        } else if (file) {
                          toast.error("Format file tidak didukung. Gunakan gambar (ICO/PNG).");
                        }
                      }}
                      className={`relative border-2 border-dashed rounded-2xl p-6 flex flex-col items-center gap-4 transition-all duration-300 ${
                        isDraggingFavicon ? "border-daw-green bg-daw-green/5 scale-[0.99]" : "border-slate-200 bg-slate-50 hover:border-slate-300"
                      } ${!isEditing || shouldLockUI ? "opacity-60 cursor-not-allowed hover:border-slate-200" : ""}`}
                    >
                      <div className="h-28 w-28 flex items-center justify-center bg-white rounded-xl border border-slate-100 p-3 shadow-sm pointer-events-none overflow-hidden bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjZjFmMTE1Ij48L3JlY3Q+CjxyZWN0IHg9IjQiIHk9IjQiIHdpZHRoPSI0IiBoZWlnaHQ9IjQiIGZpbGw9IiNmMWYxMTUiPjwvcmVjdD4KPC9zdmc+')]">
                        {faviconPreview ? (
                          <img src={faviconPreview} className="max-h-full max-w-full object-contain drop-shadow-sm" alt="Favicon Preview" />
                        ) : (
                          <span className="text-slate-300 text-xs font-medium text-center">No Icon</span>
                        )}
                      </div>
                      <div className="text-center w-full">
                        <input
                          type="file"
                          accept="image/png, image/x-icon, image/svg+xml, image/vnd.microsoft.icon"
                          disabled={!isEditing || shouldLockUI}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setCropTarget({ type: 'favicon', file });
                              e.target.value = '';
                            }
                          }}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                        />
                        <button type="button" disabled={!isEditing || shouldLockUI} className="text-xs font-bold text-daw-green bg-daw-green/10 hover:bg-daw-green hover:text-white transition-colors px-4 py-2 rounded-lg disabled:opacity-50">
                          {isDraggingFavicon ? "Lepaskan file di sini" : "Pilih Ikon"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CONTACT & LOCATION */}
          {activeTab === "contact" && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="border-b border-slate-100 pb-4">
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <Phone className="w-5 h-5 text-daw-green" />
                  Informasi Kontak Utama
                </h2>
                <p className="text-xs text-slate-500 mt-1">Ditampilkan pada halaman 'Hubungi Kami' dan bagian Footer website.</p>
              </div>

              <div className="space-y-6 max-w-2xl">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="phone" className="flex items-center text-[10px] font-black text-slate-500 uppercase tracking-wider mb-2">
                      <Phone className="w-3.5 h-3.5 mr-1.5" /> Nomor Telepon
                    </label>
                    <input
                      id="phone"
                      type="text"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      readOnly={!isEditing || shouldLockUI}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daw-green/20 focus:border-daw-green focus:bg-white text-slate-800 font-bold transition-colors read-only:bg-slate-50 read-only:text-slate-500 read-only:focus:ring-0 cursor-text"
                    />
                  </div>
                  <div>
                    <label htmlFor="email" className="flex items-center text-[10px] font-black text-slate-500 uppercase tracking-wider mb-2">
                      <Mail className="w-3.5 h-3.5 mr-1.5" /> Email Utama
                      <HelpTooltip content="Alamat email resmi untuk menerima pertanyaan dari pengunjung website. Segala pesan masuk dari form kontak pengunjung akan otomatis diteruskan ke sistem." position="bottom" />
                    </label>
                    <input
                      id="email"
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      readOnly={!isEditing || shouldLockUI}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daw-green/20 focus:border-daw-green focus:bg-white text-slate-800 font-bold transition-colors read-only:bg-slate-50 read-only:text-slate-500 read-only:focus:ring-0 cursor-text"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="address" className="flex items-center text-[10px] font-black text-slate-500 uppercase tracking-wider mb-2">
                    <MapPin className="w-3.5 h-3.5 mr-1.5" /> Alamat Kantor Pusat
                  </label>
                  <textarea
                    id="address"
                    name="address"
                    rows={3}
                    value={formData.address}
                    onChange={handleChange}
                    readOnly={!isEditing || shouldLockUI}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daw-green/20 focus:border-daw-green focus:bg-white text-slate-800 font-medium resize-none transition-colors leading-relaxed read-only:bg-slate-50 read-only:text-slate-500 read-only:focus:ring-0 cursor-text"
                  />
                </div>

                <div className="pt-4 border-t border-slate-100">
                  <label htmlFor="googleMapsUrl" className="flex items-center text-[10px] font-black text-slate-500 uppercase tracking-wider mb-2">
                    <Map className="w-3.5 h-3.5 mr-1.5" /> Tautan Peta Digital (Google Maps)
                    <HelpTooltip content={
                      <div className="space-y-2">
                        <p>Peta interaktif yang akan tampil di halaman 'Hubungi Kami'.</p>
                        <p className="font-bold text-amber-300">Cara mengambil:</p>
                        <ol className="list-decimal pl-4 space-y-1">
                          <li>Buka Google Maps, cari lokasi.</li>
                          <li>Klik tombol "Bagikan" &rarr; pilih "Sematkan Peta".</li>
                          <li>Klik "Salin HTML".</li>
                          <li>Tempel seluruh kodenya ke kotak ini. Sistem akan otomatis mengambil URL bersihnya!</li>
                        </ol>
                      </div>
                    } position="top" />
                  </label>
                  <input
                    id="googleMapsUrl"
                    type="text"
                    name="googleMapsUrl"
                    value={formData.googleMapsUrl}
                    onChange={handleChange}
                    readOnly={!isEditing || shouldLockUI}
                    placeholder='Tempel (Paste) kode iframe HTML atau URL di sini'
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-daw-green/20 focus:border-daw-green focus:bg-white text-slate-700 transition-colors read-only:bg-slate-50 read-only:text-slate-500 read-only:focus:ring-0 cursor-text"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: SOCIAL MEDIA */}
          {activeTab === "social" && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="border-b border-slate-100 pb-4">
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <Share2 className="w-5 h-5 text-daw-green" />
                  Tautan Media Sosial & Web
                </h2>
                <p className="text-xs text-slate-500 mt-1">Platform publik yang terhubung dengan website utama.</p>
              </div>

              <div className="space-y-6 max-w-2xl">
                <div>
                  <label htmlFor="website" className="flex items-center text-[10px] font-black text-slate-500 uppercase tracking-wider mb-2">
                    Situs Utama (URL)
                  </label>
                  <div className="relative">
                    <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      id="website"
                      type="text"
                      name="website"
                      value={formData.website}
                      onChange={handleChange}
                      readOnly={!isEditing || shouldLockUI}
                      placeholder="contoh: daw.co.id"
                      className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daw-green/20 focus:border-daw-green focus:bg-white text-slate-800 font-medium transition-colors read-only:bg-slate-50 read-only:text-slate-500 read-only:focus:ring-0 cursor-text"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="linkedinUrl" className="flex items-center text-[10px] font-black text-slate-500 uppercase tracking-wider mb-2">
                    LinkedIn URL
                    <HelpTooltip content="Tautan langsung ke halaman profil LinkedIn perusahaan Anda. Contoh format: https://linkedin.com/company/nama-perusahaan" position="top" />
                  </label>
                  <input
                    id="linkedinUrl"
                    type="url"
                    name="linkedinUrl"
                    value={formData.linkedinUrl}
                    onChange={handleChange}
                    readOnly={!isEditing || shouldLockUI}
                    placeholder="https://linkedin.com/company/..."
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-daw-green/20 focus:border-daw-green focus:bg-white text-slate-800 font-medium transition-colors read-only:bg-slate-50 read-only:text-slate-500 read-only:focus:ring-0 cursor-text"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
        </LockedStateTracker>
      </div>

      <ImageAdjustmentModal
        isOpen={!!cropTarget}
        onClose={() => setCropTarget(null)}
        imageFile={cropTarget?.file || null}
        onSave={(croppedFile) => {
          if (!cropTarget) return;
          if (cropTarget.type === 'logo') {
            setLogoFile(croppedFile);
            setLogoPreview(URL.createObjectURL(croppedFile));
          } else if (cropTarget.type === 'favicon') {
            setFaviconFile(croppedFile);
            setFaviconPreview(URL.createObjectURL(croppedFile));
          }
          setCropTarget(null);
        }}
        aspectRatio={1}
        title={`Sesuaikan ${cropTarget?.type === 'logo' ? 'Logo Utama' : 'Ikon Favicon'}`}
      />
    </div>
  );
}
