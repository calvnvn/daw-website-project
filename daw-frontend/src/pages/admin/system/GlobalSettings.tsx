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

  const isDataLocked = settings?.is_locked === true || isOptimisticallyLocked;
  const shouldLockUI = isDataLocked && !rejectedSettings && !isSuperadmin;
  const isOverrideMode = isDataLocked && isSuperadmin;

  const lockStyles = shouldLockUI
    ? "opacity-60 grayscale-[30%] pointer-events-none cursor-not-allowed select-none"
    : "";

  const sanitizeUrl = (url: string) => {
    if (!url || url.trim() === "") return "";
    const trimmed = url.trim();
    return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
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
      await api.patch('/approval/discard', { notrans: rejectedSettings.notrans });

      toast.success("Notifikasi revisi berhasil diabaikan.", { id: toastId });

      await refreshSettings();
    } catch (error: any) {
      toast.error("Gagal mengabaikan draf", {
        id: toastId,
        description:
          error.response?.data?.message ||
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
    } catch (error: any) {
      toast.error("Gagal Memperbarui", {
        description:
          error.response?.data?.message || "Periksa koneksi internet.",
        id: loadingToast,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
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

      {/* 3. THE FORM BODY (The Ledger Grid) */}
      <div
        className={`grid grid-cols-1 md:grid-cols-3 gap-6 transition-all duration-500 ${lockStyles}`}>
        <div className="space-y-6 md:col-span-1">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-daw-green" />
              <h2 className="font-bold text-sm text-slate-800">
                Identitas Perusahaan
              </h2>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label
                  htmlFor="companyName"
                  className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-2">
                  Company Name
                </label>
                <input
                  id="companyName"
                  type="text"
                  name="companyName"
                  value={formData.companyName}
                  onChange={handleChange}
                  disabled={!isEditing || shouldLockUI}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-daw-green/20 focus:border-daw-green text-slate-700 transition-colors disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                />
              </div>
            </div>
          </div>

          {/* Social Media Card */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
              <Share2 className="w-5 h-5 text-daw-green" />
              <h2 className="font-bold text-sm text-slate-800">
                Tautan Media Sosial
              </h2>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label
                  htmlFor="linkedinUrl"
                  className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-2">
                  LinkedIn URL
                </label>
                <input
                  id="linkedinUrl"
                  type="url"
                  name="linkedinUrl"
                  value={formData.linkedinUrl}
                  onChange={handleChange}
                  disabled={!isEditing || shouldLockUI}
                  placeholder="https://linkedin.com/company/..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-daw-green/20 focus:border-daw-green text-slate-700 transition-colors disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                />
              </div>
              <div>
                <label
                  htmlFor="website"
                  className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-2">
                  Situs Utama (URL)
                </label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    id="website"
                    type="text"
                    name="website"
                    value={formData.website}
                    onChange={handleChange}
                    disabled={!isEditing || shouldLockUI}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-daw-green/20 focus:border-daw-green text-slate-700 transition-colors disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* KOLOM KANAN  */}
        <div className="space-y-6 md:col-span-2">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
              <Phone className="w-5 h-5 text-daw-green" />
              <h2 className="font-bold text-sm text-slate-800">
                Informasi Kontak Utama
              </h2>
            </div>
            <div className="p-5 space-y-5">
              <div>
                <label
                  htmlFor="address"
                  className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" /> Alamat Kantor Pusat
                </label>
                <textarea
                  id="address"
                  name="address"
                  rows={3}
                  value={formData.address}
                  onChange={handleChange}
                  disabled={!isEditing || shouldLockUI}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-daw-green/20 focus:border-daw-green text-slate-700 resize-none transition-colors leading-relaxed disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                />
                <p className="text-[11px] text-slate-400 mt-1.5">
                  Ditampilkan pada halaman 'Hubungi Kami' dan bagian Footer
                  website.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label
                    htmlFor="phone"
                    className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5" /> Nomor Telepon
                  </label>
                  <input
                    id="phone"
                    type="text"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    disabled={!isEditing || shouldLockUI}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-daw-green/20 focus:border-daw-green text-slate-700 transition-colors disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                  />
                </div>
                <div>
                  <label
                    htmlFor="email"
                    className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5" /> Email Utama
                  </label>
                  <input
                    id="email"
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    disabled={!isEditing || shouldLockUI}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-daw-green/20 focus:border-daw-green text-slate-700 transition-colors disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* AREA BAWAH: Maps & Branding  */}
        <div className="md:col-span-3 space-y-6">
          {/* Google Maps Embed Card */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
              <Map className="w-5 h-5 text-daw-green" />
              <h2 className="font-bold text-sm text-slate-800">
                Integrasi Google Maps
              </h2>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label
                  htmlFor="googleMapsUrl"
                  className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-2">
                  Tautan Peta Digital (Iframe Source URL)
                </label>
                <input
                  id="googleMapsUrl"
                  type="text"
                  name="googleMapsUrl"
                  value={formData.googleMapsUrl}
                  onChange={handleChange}
                  disabled={!isEditing || shouldLockUI}
                  placeholder="https://www.google.com/maps/embed?pb=..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-daw-green/20 focus:border-daw-green text-slate-700 transition-colors disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                />
                <p className="text-[11px] text-slate-400 mt-2">
                  Buka Google Maps &gt; Bagikan &gt; Sematkan peta &gt; Salin
                  URL yang ada di dalam atribut <code>src="..."</code>.
                </p>
              </div>
            </div>
          </div>

          {/* Branding & Identitas Visual Card */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-daw-green" />
              <h2 className="font-bold text-sm text-slate-800">
                Branding & Identitas Visual
              </h2>
            </div>

            <div className="p-5 md:p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* BOX UPLOAD LOGO UTAMA */}
              <div className="space-y-3">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Logo Utama
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
                    // 🛡️ Guard Keras: Batalkan jika tidak edit mode atau sedang dilock
                    if (!isEditing || shouldLockUI) return;

                    const file = e.dataTransfer.files?.[0];
                    if (file && file.type.startsWith("image/")) {
                      setLogoFile(file);
                      setLogoPreview(URL.createObjectURL(file));
                    } else if (file) {
                      toast.error(
                        "Format file tidak didukung. Gunakan gambar (JPG/PNG/SVG).",
                      );
                    }
                  }}
                  className={`border-2 border-dashed rounded-xl p-5 flex flex-col items-center gap-4 transition-all duration-200 ${
                    isDraggingLogo
                      ? "border-daw-green bg-daw-green/5 scale-[0.99] ring-4 ring-daw-green/10"
                      : "border-slate-200 bg-slate-50/50 hover:border-slate-300"
                  } ${!isEditing || shouldLockUI ? "opacity-70 cursor-not-allowed hover:border-slate-200" : ""}`}>
                  <div className="h-24 w-full max-w-[240px] flex items-center justify-center bg-white rounded-lg border border-slate-100 p-2 shadow-sm pointer-events-none overflow-hidden bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjZjFmMTE1Ij48L3JlY3Q+CjxyZWN0IHg9IjQiIHk9IjQiIHdpZHRoPSI0IiBoZWlnaHQ9IjQiIGZpbGw9IiNmMWYxMTUiPjwvcmVjdD4KPC9zdmc+')]">
                    {logoPreview ? (
                      <img
                        src={logoPreview}
                        className="max-h-full object-contain drop-shadow-sm"
                        alt="Logo Preview"
                      />
                    ) : (
                      <span className="text-slate-300 text-xs font-medium">
                        No Logo Selected
                      </span>
                    )}
                  </div>

                  <div className="text-center w-full">
                    <p className="text-xs font-bold text-slate-600 mb-1">
                      {isDraggingLogo
                        ? "Lepaskan file di sini"
                        : "Drag & drop logo"}
                    </p>
                    <p className="text-[10px] text-slate-400 mb-3">atau</p>
                    <input
                      type="file"
                      accept="image/*"
                      disabled={!isEditing || shouldLockUI}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setLogoFile(file);
                          setLogoPreview(URL.createObjectURL(file));
                        }
                      }}
                      className="w-full text-center text-[10px] file:mr-3 file:py-1.5 file:px-4 file:rounded-full file:border-0 file:bg-daw-green/10 file:text-daw-green file:font-bold file:cursor-pointer cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>
              </div>

              {/* BOX UPLOAD FAVICON */}
              <div className="space-y-3">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Ikon Tab (Favicon)
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
                    // 🛡️ Guard Keras
                    if (!isEditing || shouldLockUI) return;

                    const file = e.dataTransfer.files?.[0];
                    if (file && file.type.startsWith("image/")) {
                      setFaviconFile(file);
                      setFaviconPreview(URL.createObjectURL(file));
                    } else if (file) {
                      toast.error(
                        "Format file tidak didukung. Gunakan gambar (ICO/PNG).",
                      );
                    }
                  }}
                  className={`border-2 border-dashed rounded-xl p-5 flex flex-col items-center gap-4 transition-all duration-200 ${
                    isDraggingFavicon
                      ? "border-daw-green bg-daw-green/5 scale-[0.99] ring-4 ring-daw-green/10"
                      : "border-slate-200 bg-slate-50/50 hover:border-slate-300"
                  } ${!isEditing || shouldLockUI ? "opacity-70 cursor-not-allowed hover:border-slate-200" : ""}`}>
                  <div className="h-24 w-24 flex items-center justify-center bg-white rounded-xl border border-slate-100 p-3 shadow-sm pointer-events-none overflow-hidden bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjZjFmMTE1Ij48L3JlY3Q+CjxyZWN0IHg9IjQiIHk9IjQiIHdpZHRoPSI0IiBoZWlnaHQ9IjQiIGZpbGw9IiNmMWYxMTUiPjwvcmVjdD4KPC9zdmc+')]">
                    {faviconPreview ? (
                      <img
                        src={faviconPreview}
                        className="max-h-full object-contain drop-shadow-sm"
                        alt="Favicon Preview"
                      />
                    ) : (
                      <span className="text-slate-300 text-[10px] font-medium text-center leading-tight">
                        No Icon
                      </span>
                    )}
                  </div>

                  <div className="text-center w-full">
                    <p className="text-xs font-bold text-slate-600 mb-1">
                      {isDraggingFavicon
                        ? "Lepaskan file di sini"
                        : "Drag & drop ikon"}
                    </p>
                    <p className="text-[10px] text-slate-400 mb-3">atau</p>
                    <input
                      type="file"
                      accept="image/png, image/x-icon, image/svg+xml, image/vnd.microsoft.icon"
                      disabled={!isEditing || shouldLockUI}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setFaviconFile(file);
                          setFaviconPreview(URL.createObjectURL(file));
                        }
                      }}
                      className="w-full text-center text-[10px] file:mr-3 file:py-1.5 file:px-4 file:rounded-full file:border-0 file:bg-daw-green/10 file:text-daw-green file:font-bold file:cursor-pointer cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
