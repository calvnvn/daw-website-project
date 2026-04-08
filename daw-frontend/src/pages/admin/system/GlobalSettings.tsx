import { useState, useEffect } from "react";
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

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const [isDraggingLogo, setIsDraggingLogo] = useState(false);
  const [isDraggingFavicon, setIsDraggingFavicon] = useState(false);

  const { refreshSettings } = useSettings();
  // --- 1. Fetch Data ---
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await api.get("/settings");
        const data = response.data;

        setFormData({
          companyName: data.companyName || "",
          address: data.address || "",
          phone: data.phone || "",
          email: data.email || "",
          website: data.website || "",
          googleMapsUrl: data.googleMapsUrl || "",
          linkedinUrl: data.linkedinUrl || "",
        });

        if (data.logoUrl) setLogoPreview(getCleanImageUrl(data.logoUrl));
        if (data.faviconUrl)
          setFaviconPreview(getCleanImageUrl(data.faviconUrl));
      } catch {
        toast.error(
          "Gagal terhubung ke server. Silakan coba beberapa saat lagi.",
        );
      } finally {
        setIsLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    const loadingToast = toast.loading("Sedang menyimpan pengaturan global...");
    try {
      const data = new FormData();

      // Loop data teks
      Object.entries(formData).forEach(([key, value]) => {
        data.append(key, value);
      });

      // Append File (Gunakan key yang sama dengan Multer di Backend)
      if (logoFile) data.append("logo", logoFile);
      if (faviconFile) data.append("favicon", faviconFile);

      await api.put("/settings", data);
      await refreshSettings();
      toast.success("Pengaturan berhasil diperbarui!", { id: loadingToast });

      setIsEditing(false);
      setLogoFile(null);
      setFaviconFile(null);
    } catch (error: any) {
      toast.error("Gagal Memperbarui Data", {
        description:
          error.response?.data?.message || "Periksa koneksi internet Anda",
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

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* --- HEADER --- */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm top-0 z-20">
        <div className="w-full">
          <h1 className="text-xl md:text-2xl font-serif font-bold text-slate-900">
            Global Settings
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-1">
            Kelola identitas, kontak, dan branding website.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <button
            onClick={() => setIsEditing(!isEditing)}
            className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg font-bold text-xs transition-colors border ${
              isEditing
                ? "bg-amber-100 text-amber-700 border-amber-200"
                : "bg-slate-100 text-slate-500 border-slate-200"
            }`}
          >
            {isEditing ? (
              <Unlock className="w-4 h-4" />
            ) : (
              <Lock className="w-4 h-4" />
            )}
            <span>{isEditing ? "Editing" : "Locked"}</span>
          </button>

          <button
            onClick={handleSave}
            disabled={isSaving || !isEditing}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-daw-green hover:bg-[#003b1c] disabled:bg-slate-200 disabled:text-slate-400 text-white px-5 py-2.5 rounded-lg font-bold text-xs transition-all shadow-sm"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? "Saving..." : "Save"}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* KOLOM KIRI: Identitas & Sosial Media */}
        <div className="space-y-6 md:col-span-1">
          {/* Corporate Identity Card */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
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
                  disabled={!isEditing}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-daw-green/20 focus:border-daw-green text-slate-700 transition-colors disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                />
              </div>
              {/* Note: Tagline input dihilangkan dari sini */}
            </div>
          </div>

          {/* Social Media Card */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
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
                  disabled={!isEditing}
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
                    disabled={!isEditing}
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
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
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
                  disabled={!isEditing}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-daw-green/20 focus:border-daw-green text-slate-700 resize-none transition-colors leading-relaxed disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                />
                <p className="text-[11px] text-slate-400 mt-1.5">
                  Alamat ini akan ditampilkan pada halaman 'Hubungi Kami' dan
                  bagian bawah (footer) website. Menjelaskan keterkaitan data
                  dengan tampilan publik.
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
                    disabled={!isEditing}
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
                    disabled={!isEditing}
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
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
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
                  disabled={!isEditing}
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
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
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
                  // EVENT LISTENER UNTUK DRAG & DROP LOGO
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (isEditing) setIsDraggingLogo(true);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    setIsDraggingLogo(false);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDraggingLogo(false);
                    if (!isEditing) return;
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
                  // CSS Dinamis: Berubah warna saat file di-drag
                  className={`border-2 border-dashed rounded-xl p-4 flex flex-col items-center gap-4 transition-all duration-200 ${
                    isDraggingLogo
                      ? "border-daw-green bg-daw-green/5 scale-[0.99] ring-4 ring-daw-green/10"
                      : "border-slate-200 bg-slate-50/50 hover:border-slate-300"
                  } ${!isEditing && "opacity-70 cursor-not-allowed"}`}
                >
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
                      disabled={!isEditing}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setLogoFile(file);
                          setLogoPreview(URL.createObjectURL(file));
                        }
                      }}
                      className="w-full text-[10px] file:mr-3 file:py-1.5 file:px-3 file:rounded-full file:border-0 file:bg-daw-green/10 file:text-daw-green file:font-bold cursor-pointer disabled:opacity-50"
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
                  // EVENT LISTENER UNTUK DRAG & DROP FAVICON
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (isEditing) setIsDraggingFavicon(true);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    setIsDraggingFavicon(false);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDraggingFavicon(false);
                    if (!isEditing) return;
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
                  // CSS Dinamis: Berubah warna saat file di-drag
                  className={`border-2 border-dashed rounded-xl p-4 flex flex-col items-center gap-4 transition-all duration-200 ${
                    isDraggingFavicon
                      ? "border-daw-green bg-daw-green/5 scale-[0.99] ring-4 ring-daw-green/10"
                      : "border-slate-200 bg-slate-50/50 hover:border-slate-300"
                  } ${!isEditing && "opacity-70 cursor-not-allowed"}`}
                >
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
                      disabled={!isEditing}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setFaviconFile(file);
                          setFaviconPreview(URL.createObjectURL(file));
                        }
                      }}
                      className="w-full text-[10px] file:mr-3 file:py-1.5 file:px-3 file:rounded-full file:border-0 file:bg-daw-green/10 file:text-daw-green file:font-bold cursor-pointer disabled:opacity-50"
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
