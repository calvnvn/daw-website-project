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
} from "lucide-react";
import { toast } from "sonner";

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

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // --- 1. Fetch Data ---
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch("http://localhost:5000/api/settings");
        if (response.ok) {
          const data = await response.json();
          setFormData({
            companyName: data.companyName || "",
            address: data.address || "",
            phone: data.phone || "",
            email: data.email || "",
            website: data.website || "",
            googleMapsUrl: data.googleMapsUrl || "",
            linkedinUrl: data.linkedinUrl || "",
          });
        } else {
          toast.error("Gagal memuat pengaturan global.");
        }
      } catch {
        toast.error("Koneksi ke server gagal.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    const loadingToast = toast.loading("Saving global settings...");
    try {
      const token = localStorage.getItem("daw_token");
      const response = await fetch("http://localhost:5000/api/settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        toast.success("Settings updated successfully!", { id: loadingToast });
        setIsEditing(false);
      } else {
        const errorData = await response.json();
        toast.error("Update Failed", {
          description: errorData.message,
          id: loadingToast,
        });
      }
    } catch {
      toast.error("Network Error", { id: loadingToast });
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
        Loading settings data...
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500 pb-12">
      {/* --- HEADER --- */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm sticky top-0 z-20">
        <div>
          <h1 className="text-2xl font-serif font-bold text-slate-900">
            Global Settings
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage corporate identity, contact info, and website footer.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsEditing(!isEditing)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-bold text-sm transition-colors border ${
              isEditing
                ? "bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-200"
                : "bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200"
            }`}
          >
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
            className="flex items-center gap-2 bg-daw-green hover:bg-[#003b1c] disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-lg font-medium transition-colors shadow-sm"
          >
            <Save className="w-5 h-5" />
            <span>{isSaving ? "Saving..." : "Save Changes"}</span>
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
              <h2 className="font-bold text-slate-800">Corporate Identity</h2>
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
              <h2 className="font-bold text-slate-800">Social Links</h2>
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
                  Main Website
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
                Primary Contact Information
              </h2>
            </div>
            <div className="p-5 space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" /> Head Office Address
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
                  This address will be displayed on the Contact Us page and
                  Footer.
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

          {/* Google Maps Embed Card */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Map className="w-5 h-5 text-daw-green" />
                <h2 className="font-bold text-slate-800">
                  Google Maps Integration
                </h2>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Maps Embed URL (Iframe Source)
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
                  Go to Google Maps &gt; Share &gt; Embed a map &gt; Copy the
                  URL inside the <code>src="..."</code> attribute.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
