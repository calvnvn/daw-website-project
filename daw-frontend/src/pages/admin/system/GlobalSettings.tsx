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
  Plus,
  Image as ImageIcon,
} from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { getCleanImageUrl } from "@/lib/utils";
import { useSettings } from "@/contexts/SettingsContext";
export default function GlobalSettings() {
  const [formData, setFormData] = useState({
    companyName: "",
    address: "",
    phone: "",
    email: "",
    website: "",
    googleMapsUrl: "",
    linkedinUrl: "",
  });

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [faviconFile, setFaviconFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [faviconPreview, setFaviconPreview] = useState<string | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const [isDraggingLogo, setIsDraggingLogo] = useState(false);
  const [isDraggingFavicon, setIsDraggingFavicon] = useState(false);

  const [rejectedDraft, setRejectedDraft] = useState<any | null>(null);
  const { settings, isLoading, refreshSettings } = useSettings();

  const [isOptimisticallyLocked, setIsOptimisticallyLocked] = useState(false);

  const sanitizeUrl = (url: string) => {
    if (!url || url.trim() === "") return "";
    const trimmed = url.trim();
    return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  };

  // --- Sync Data from Context ---
  useEffect(() => {
    if (settings && !isEditing) {
      setFormData({
        companyName: settings.companyName || "",
        address: settings.address || "",
        phone: settings.phone || "",
        email: settings.email || "",
        website: settings.website || "",
        googleMapsUrl: settings.googleMapsUrl || "",
        linkedinUrl: settings.linkedinUrl || "",
      });

      if (settings.logoUrl) setLogoPreview(getCleanImageUrl(settings.logoUrl));
      if (settings.faviconUrl)
        setFaviconPreview(getCleanImageUrl(settings.faviconUrl));
    }
  }, [settings, isEditing]);

  // Recovery Data
  useEffect(() => {
    const controller = new AbortController();
    const checkRejectedDraft = async () => {
      try {
        const res = await api.get("/approval/rejected/1?module=Settings", {
          signal: controller.signal,
        });
        if (res.data.hasRejected) {
          setRejectedDraft(res.data.data);
        }
      } catch (err: any) {
        if (err.name !== "CanceledError") {
          console.log("Tidak ada draf ditolak atau gagal mengecek.");
        }
      }
    };
    checkRejectedDraft();

    return () => controller.abort();
  }, []);

  // Memory Leak Guard
  useEffect(() => {
    return () => {
      if (logoPreview && logoPreview.startsWith("blob:"))
        URL.revokeObjectURL(logoPreview);
      if (faviconPreview && faviconPreview.startsWith("blob:"))
        URL.revokeObjectURL(faviconPreview);
    };
  }, [logoPreview, faviconPreview]);

  // Restore Handler
  const handleRestoreDraft = useCallback(() => {
    if (!rejectedDraft?.payload) return;
    const payload = rejectedDraft.payload;

    setFormData((prev) => ({
      companyName: payload.companyName ?? prev.companyName,
      address: payload.address ?? prev.address,
      phone: payload.phone ?? prev.phone,
      email: payload.email ?? prev.email,
      website: payload.website ?? prev.website,
      googleMapsUrl: payload.googleMapsUrl ?? prev.googleMapsUrl,
      linkedinUrl: payload.linkedinUrl ?? prev.linkedinUrl,
    }));

    if (payload.logoUrl) setLogoPreview(getCleanImageUrl(payload.logoUrl));
    if (payload.faviconUrl)
      setFaviconPreview(getCleanImageUrl(payload.faviconUrl));
    setIsEditing(true);
    toast.info("Draf berhasil dipulihkan", {
      description: "Silakan perbaiki dan simpan kembali.",
    });
  }, [rejectedDraft]);

  const handleSave = async () => {
    setIsSaving(true);
    const loadingToast = toast.loading("Menghubungkan ke Server...");

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
      if (rejectedDraft?.notrans) {
        data.append("previous_notrans", rejectedDraft.notrans);
      }

      if (logoFile) data.append("logo", logoFile);
      if (faviconFile) data.append("favicon", faviconFile);

      await api.put("/settings", data, { timeout: 60000 });

      setIsOptimisticallyLocked(true);
      setIsEditing(false);

      setRejectedDraft(null);
      setLogoFile(null);
      setFaviconFile(null);

      await refreshSettings();
      toast.success("Perubahan diajukan!", { id: loadingToast });
    } catch (error: any) {
      toast.error("Gagal Memperbarui Data", {
        description:
          error.response?.data?.message ||
          "Periksa koneksi atau tunggu beberapa saat.",
        id: loadingToast,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  if (isLoading) {
    return (
      <div className="p-12 text-center text-slate-500">
        Memuat data pengaturan...
      </div>
    );
  }

  const isFormLocked =
    !isEditing || settings?.is_locked || isOptimisticallyLocked;

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {rejectedDraft && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 md:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in slide-in-from-top-4 duration-500 shadow-sm relative overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-amber-500"></div>
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center shrink-0 mt-0.5 animate-pulse">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-amber-900 mb-0.5">
                Revisi Settings Ditolak
              </h3>
              <p className="text-xs text-amber-700 leading-relaxed max-w-2xl">
                Alasan penolakan:{" "}
                <span className="font-bold italic">
                  "
                  {rejectedDraft.rejection_reason ||
                    "Tidak ada alasan spesifik"}
                  "
                </span>
                .
                <br className="hidden sm:block" />
                Klik tombol di samping untuk mengembalikan data draf terakhir
                Anda ke dalam form.
              </p>
            </div>
          </div>

          <button
            onClick={handleRestoreDraft}
            disabled={isFormLocked && isEditing === false}
            className="w-full sm:w-auto shrink-0 flex items-center justify-center gap-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-300 disabled:cursor-not-allowed text-white rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95">
            <Plus className="w-4 h-4 rotate-45" />
            Restore Draft
          </button>
        </div>
      )}
      {/* --- HEADER --- */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm top-0 z-20">
        <div className="w-full flex items-center gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-serif font-bold text-slate-900">
              Global Settings
            </h1>
            <p className="text-xs md:text-sm text-slate-500 mt-1">
              Kelola identitas, kontak, dan branding website.
            </p>
          </div>

          {/* 🛡️ BLUEPRINT: Status PENDING (Badge Lock) */}
          {settings?.is_locked && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-bold uppercase tracking-wider border border-blue-100 mt-1 md:mt-0">
              <Lock className="w-3 h-3" /> Pending Approval
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <button
            onClick={() => {
              if (settings?.is_locked) {
                return toast.error("Data Terkunci", {
                  description: "Menunggu persetujuan sistem.",
                });
              }
              setIsEditing(!isEditing);
            }}
            className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg font-bold text-xs transition-colors border ${
              isEditing
                ? "bg-amber-100 text-amber-700 border-amber-200"
                : settings?.is_locked
                  ? "bg-slate-50 text-slate-400 border-slate-100 cursor-not-allowed" // Visual tambahan saat terkunci
                  : "bg-slate-100 text-slate-500 border-slate-200"
            }`}>
            {isEditing ? (
              <Unlock className="w-4 h-4" />
            ) : (
              <Lock className="w-4 h-4" />
            )}
            <span>{isEditing ? "Editing" : "Locked"}</span>
          </button>

          <button
            onClick={handleSave}
            disabled={isSaving || isFormLocked}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-daw-green hover:bg-[#003b1c] disabled:bg-slate-200 disabled:text-slate-400 text-white px-5 py-2.5 rounded-lg font-bold text-xs transition-all shadow-sm">
            <Save className="w-4 h-4" />
            <span>{isSaving ? "Saving..." : "Save"}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* KOLOM KIRI: Identitas & Sosial Media */}
        <div className="space-y-6 md:col-span-1">
          {/* Corporate Identity Card */}
          <div
            className={`bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden transition-all ${settings?.is_locked ? "opacity-70 grayscale-[10%]" : ""}`}>
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-daw-green" />
              <h2 className="font-bold text-slate-800">Identitas Perusahaan</h2>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Company Name
                </label>
                <input
                  type="text"
                  name="companyName"
                  value={formData.companyName}
                  onChange={handleChange}
                  disabled={isFormLocked}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-daw-green/20 focus:border-daw-green text-slate-700 transition-colors disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                />
              </div>
            </div>
          </div>

          {/* Social Media Card */}
          <div
            className={`bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden transition-all ${settings?.is_locked ? "opacity-70 grayscale-[10%]" : ""}`}>
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
              <Share2 className="w-5 h-5 text-daw-green" />
              <h2 className="font-bold text-slate-800">Tautan Media Sosial</h2>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  LinkedIn URL
                </label>
                <input
                  type="url"
                  name="linkedinUrl"
                  value={formData.linkedinUrl}
                  onChange={handleChange}
                  disabled={isFormLocked}
                  placeholder="https://linkedin.com/..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-daw-green/20 focus:border-daw-green text-slate-700 transition-colors disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Situs Utama (URL)
                </label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    name="website"
                    value={formData.website}
                    onChange={handleChange}
                    disabled={isFormLocked}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-daw-green/20 focus:border-daw-green text-slate-700 transition-colors disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* KOLOM KANAN: Kontak Utama & Maps */}
        <div className="space-y-6 md:col-span-2">
          {/* Contact Information Card */}
          <div
            className={`bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden transition-all ${settings?.is_locked ? "opacity-70 grayscale-[10%]" : ""}`}>
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
              <Phone className="w-5 h-5 text-daw-green" />
              <h2 className="font-bold text-slate-800">
                Informasi Kontak Utama
              </h2>
            </div>
            <div className="p-5 space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" /> Alamat Kantor Pusat
                </label>
                <textarea
                  name="address"
                  rows={3}
                  value={formData.address}
                  onChange={handleChange}
                  disabled={isFormLocked}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-daw-green/20 focus:border-daw-green text-slate-700 resize-none transition-colors leading-relaxed disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                />
                <p className="text-[11px] text-slate-400 mt-1.5">
                  Alamat ini akan ditampilkan pada halaman 'Hubungi Kami' dan
                  bagian bawah (footer) website.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5" /> Phone Number
                  </label>
                  <input
                    type="text"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    disabled={isFormLocked}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-daw-green/20 focus:border-daw-green text-slate-700 transition-colors disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5" /> General Email
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    disabled={isFormLocked}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-daw-green/20 focus:border-daw-green text-slate-700 transition-colors disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ---> AREA BRANDING & SEO <--- */}
        <div className="md:col-span-3 space-y-6">
          {/* Google Maps Embed Card */}
          <div
            className={`bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden transition-all ${settings?.is_locked ? "opacity-70 grayscale-[10%]" : ""}`}>
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Map className="w-5 h-5 text-daw-green" />
                <h2 className="font-bold text-slate-800">
                  Integrasi Google Maps
                </h2>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Tautan Peta Digital (Source URL)
                </label>
                <input
                  type="text"
                  name="googleMapsUrl"
                  value={formData.googleMapsUrl}
                  onChange={handleChange}
                  disabled={isFormLocked}
                  placeholder="Paste the Google Maps embed link here..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-daw-green/20 focus:border-daw-green text-slate-700 transition-colors font-mono text-sm disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                />
                <p className="text-[11px] text-slate-400 mt-2">
                  Buka Google Maps &gt; Bagikan &gt; Sematkan peta &gt; Salin
                  URL yang ada di dalam atribut <code>src="..."</code>.
                </p>
              </div>
            </div>
          </div>

          <div
            className={`bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden transition-all ${settings?.is_locked ? "opacity-70 grayscale-[10%]" : ""}`}>
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-daw-green" />
              <h2 className="font-bold text-slate-800 text-sm md:text-base">
                Branding & Identitas Visual
              </h2>
            </div>

            <div className="p-5 md:p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* --- BOX UPLOAD LOGO UTAMA --- */}
              <div className="space-y-4">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Logo Utama
                </label>
                <div
                  // 🛡️ AMANKAN EVENT LISTENER DRAG & DROP
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (!isFormLocked) setIsDraggingLogo(true);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    setIsDraggingLogo(false);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDraggingLogo(false);
                    if (isFormLocked) return; // Guard agar tidak tembus
                    const file = e.dataTransfer.files?.[0];
                    if (file && file.type.startsWith("image/")) {
                      setLogoFile(file);
                      setLogoPreview(URL.createObjectURL(file));
                    } else if (file) {
                      toast.error(
                        "Format file tidak didukung. Gunakan gambar.",
                      );
                    }
                  }}
                  className={`border-2 border-dashed rounded-xl p-4 flex flex-col items-center gap-4 transition-all duration-200 ${
                    isDraggingLogo
                      ? "border-daw-green bg-daw-green/5 scale-[0.99] ring-4 ring-daw-green/10"
                      : "border-slate-200 bg-slate-50/50 hover:border-slate-300"
                  } ${isFormLocked && "opacity-70 cursor-not-allowed hover:border-slate-200 pointer-events-none"}`}>
                  <div className="h-20 w-full max-w-[200px] flex items-center justify-center bg-white rounded-lg border border-slate-100 p-2 shadow-inner pointer-events-none">
                    {logoPreview ? (
                      <img
                        src={logoPreview}
                        className="max-h-full object-contain"
                        alt="Preview"
                      />
                    ) : (
                      <span className="text-slate-300 text-[10px]">
                        No Logo
                      </span>
                    )}
                  </div>

                  <div className="text-center">
                    <p className="text-xs font-bold text-slate-600 mb-1">
                      {isDraggingLogo
                        ? "Lepaskan file di sini"
                        : "Drag & drop logo"}
                    </p>
                    <p className="text-[10px] text-slate-400 mb-2">atau</p>
                    <input
                      type="file"
                      accept="image/*"
                      disabled={isFormLocked}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setLogoFile(file);
                          setLogoPreview(URL.createObjectURL(file));
                        }
                      }}
                      className="w-full text-[10px] file:mr-3 file:py-1.5 file:px-3 file:rounded-full file:border-0 file:bg-daw-green/10 file:text-daw-green file:font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>
              </div>

              {/* --- BOX UPLOAD FAVICON --- */}
              <div className="space-y-4">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Ikon Tab (Favicon)
                </label>
                <div
                  // 🛡️ AMANKAN EVENT LISTENER DRAG & DROP
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (!isFormLocked) setIsDraggingFavicon(true);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    setIsDraggingFavicon(false);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDraggingFavicon(false);
                    if (isFormLocked) return;
                    const file = e.dataTransfer.files?.[0];
                    if (file && file.type.startsWith("image/")) {
                      setFaviconFile(file);
                      setFaviconPreview(URL.createObjectURL(file));
                    } else if (file) {
                      toast.error(
                        "Format file tidak didukung. Gunakan gambar.",
                      );
                    }
                  }}
                  className={`border-2 border-dashed rounded-xl p-4 flex flex-col items-center gap-4 transition-all duration-200 ${
                    isDraggingFavicon
                      ? "border-daw-green bg-daw-green/5 scale-[0.99] ring-4 ring-daw-green/10"
                      : "border-slate-200 bg-slate-50/50 hover:border-slate-300"
                  } ${isFormLocked && "opacity-70 cursor-not-allowed hover:border-slate-200 pointer-events-none"}`}>
                  <div className="h-20 w-20 flex items-center justify-center bg-white rounded-lg border border-slate-100 p-2 shadow-inner pointer-events-none">
                    {faviconPreview ? (
                      <img
                        src={faviconPreview}
                        className="max-h-full object-contain"
                        alt="Preview"
                      />
                    ) : (
                      <span className="text-slate-300 text-[10px] text-center leading-tight">
                        No Icon
                      </span>
                    )}
                  </div>

                  <div className="text-center">
                    <p className="text-xs font-bold text-slate-600 mb-1">
                      {isDraggingFavicon
                        ? "Lepaskan file di sini"
                        : "Drag & drop ikon"}
                    </p>
                    <p className="text-[10px] text-slate-400 mb-2">atau</p>
                    <input
                      type="file"
                      accept="image/png, image/x-icon, image/svg+xml"
                      disabled={isFormLocked}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setFaviconFile(file);
                          setFaviconPreview(URL.createObjectURL(file));
                        }
                      }}
                      className="w-full text-[10px] file:mr-3 file:py-1.5 file:px-3 file:rounded-full file:border-0 file:bg-daw-green/10 file:text-daw-green file:font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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
