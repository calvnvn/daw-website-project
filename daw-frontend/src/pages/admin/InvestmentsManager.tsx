import { useState, useEffect } from "react";
import {
  Save,
  Lock,
  Unlock,
  Plus,
  Trash2,
  Image as ImageIcon,
  Building,
  Type,
} from "lucide-react";
import { toast } from "sonner";
import { useInvestments } from "@/contexts/InvestmentContext";

interface LocalAffiliate {
  id: number | string;
  name: string;
  desc: string;
  category: "fnb" | "steel" | "finance" | "edu";
  logoUrl: string | null;
  newLogoFile?: File | null;
  isNew?: boolean;
}

export default function InvestmentsManager() {
  const [activeTab, setActiveTab] = useState<"content" | "companies">(
    "content",
  );
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Tarik Context
  const { settings, companies, refreshData } = useInvestments();

  // --- STATE 1: TEXT CONTENT ---
  const [pageContent, setPageContent] = useState({
    teaserHeadline: "",
    teaserBody: "",
    sectionIntro: "",
  });

  // --- STATE 2: LOCAL COMPANIES ---
  const [localCompanies, setLocalCompanies] = useState<LocalAffiliate[]>([]);

  // Sinkronisasi data dari Context ke Local State saat pertama kali render
  useEffect(() => {
    if (settings) {
      setPageContent({
        teaserHeadline: settings.teaserHeadline,
        teaserBody: settings.teaserBody,
        sectionIntro: settings.sectionIntro,
      });
    }
    if (companies) {
      // Copy data ke local state agar aman diedit
      setLocalCompanies(companies.map((c) => ({ ...c })));
    }
  }, [settings, companies]);

  // ==========================================
  // LOGIKA TAB 1: CONTENT
  // ==========================================
  const handleSaveSettings = async () => {
    const token = localStorage.getItem("daw_token");
    const res = await fetch("http://localhost:5000/api/investment/settings", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(pageContent),
    });
    if (!res.ok) throw new Error("Failed to save text settings");
  };

  // ==========================================
  // LOGIKA TAB 2: COMPANIES
  // ==========================================
  const addCompany = () => {
    setLocalCompanies([
      ...localCompanies,
      {
        id: Date.now(),
        name: "",
        desc: "",
        category: "fnb",
        logoUrl: null,
        isNew: true,
      },
    ]);
  };

  const removeCompany = async (id: number | string) => {
    if (!confirm("Are you sure you want to remove this affiliated company?"))
      return;

    const target = localCompanies.find((c) => c.id === id);

    // Jika data baru (belum disave ke DB), langsung hapus dari UI
    if (target?.isNew) {
      setLocalCompanies(localCompanies.filter((c) => c.id !== id));
      return;
    }

    // Jika data lama, hapus dari Database
    try {
      const token = localStorage.getItem("daw_token");
      const res = await fetch(
        `http://localhost:5000/api/investment/affiliate/${id}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (res.ok) {
        toast.success("Company deleted permanently!");
        refreshData();
      }
    } catch (err) {
      toast.error("Failed to delete company.");
      console.log(err);
    }
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
    const token = localStorage.getItem("daw_token");

    // Looping semua perusahaan di layar, simpan satu per satu (Mass Save)
    const promises = localCompanies.map(async (comp) => {
      // Abaikan jika namanya kosong
      if (!comp.name.trim()) return null;

      const formData = new FormData();
      formData.append("name", comp.name);
      formData.append("desc", comp.desc || "");
      formData.append("category", comp.category);
      if (comp.newLogoFile) formData.append("logo", comp.newLogoFile);

      const url = comp.isNew
        ? "http://localhost:5000/api/investment/affiliate"
        : `http://localhost:5000/api/investment/affiliate/${comp.id}`;

      const method = comp.isNew ? "POST" : "PUT";

      return fetch(url, {
        method,
        headers: { Authorization: `Bearer ${token}` }, // Tanpa Content-Type karena FormData
        body: formData,
      });
    });

    await Promise.all(promises); // Tunggu semua selesai
  };

  // ==========================================
  // MAIN SAVE CONTROLLER
  // ==========================================
  const handleSave = async () => {
    setIsSaving(true);
    const loadingToast = toast.loading("Saving changes...");
    try {
      if (activeTab === "content") {
        await handleSaveSettings();
      } else {
        await handleSaveCompanies();
      }
      toast.success("Changes saved successfully!", { id: loadingToast });
      refreshData();
      setIsEditing(false);
    } catch (err) {
      toast.error("Failed to save changes.", { id: loadingToast });
      console.log(err);
    } finally {
      setIsSaving(false);
    }
  };

  // Helper untuk Preview Gambar
  const getPreviewUrl = (comp: LocalAffiliate) => {
    if (comp.newLogoFile) return URL.createObjectURL(comp.newLogoFile);
    if (comp.logoUrl) return `http://localhost:5000${comp.logoUrl}`;
    return null;
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500 pb-12">
      {/* --- HEADER --- */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm sticky top-0 z-20">
        <div>
          <h1 className="text-2xl font-serif font-bold text-slate-900">
            Investments Manager
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage diversified ecosystem, text content, and affiliated company
            logos.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsEditing(!isEditing)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-bold text-sm transition-colors border ${
              isEditing
                ? "bg-amber-100 text-amber-700 border-amber-200"
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

      {/* --- TABS NAVIGATION --- */}
      <div className="flex items-end overflow-x-auto border border-slate-200 border-b-0 shadow-sm bg-white rounded-t-xl px-2 pt-2 hide-scrollbar">
        <button
          onClick={() => setActiveTab("content")}
          className={`flex items-center gap-2 px-6 py-3 font-bold text-sm uppercase tracking-wider border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "content"
              ? "border-daw-green text-daw-green"
              : "border-transparent text-slate-400 hover:text-slate-700"
          }`}
        >
          <Type className="w-4 h-4" /> Page Content
        </button>
        <button
          onClick={() => setActiveTab("companies")}
          className={`flex items-center gap-2 px-6 py-3 font-bold text-sm uppercase tracking-wider border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "companies"
              ? "border-daw-green text-daw-green"
              : "border-transparent text-slate-400 hover:text-slate-700"
          }`}
        >
          <Building className="w-4 h-4" /> Affiliated Companies
        </button>
      </div>

      {/* --- TAB CONTENT AREA --- */}
      <div className="bg-white rounded-b-xl border border-t-0 border-slate-200 shadow-sm p-6 lg:p-8 min-h-[500px]">
        {/* TAB 1: PAGE CONTENT*/}
        {activeTab === "content" && (
          <div className="space-y-8 animate-in fade-in duration-300">
            <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
              <h3 className="text-base font-bold text-slate-900 mb-4 border-b border-slate-200 pb-2">
                Home Page Teaser
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
                    disabled={!isEditing}
                    className={`w-full px-3 py-2 rounded-lg font-serif text-lg transition-all duration-300 ${
                      isEditing
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
                    disabled={!isEditing}
                    className={`w-full px-3 py-2 rounded-lg resize-none transition-all duration-300 ${
                      isEditing
                        ? "bg-white border border-slate-300 text-slate-900 focus:ring-2 focus:ring-daw-green/20 shadow-inner"
                        : "bg-slate-100/50 border-transparent text-slate-500 cursor-not-allowed"
                    }`}
                  />
                </div>
              </div>
            </div>

            <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
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
                  disabled={!isEditing}
                  className={`w-full px-3 py-2 rounded-lg resize-none transition-all duration-300 ${
                    isEditing
                      ? "bg-white border border-slate-300 text-slate-900 focus:ring-2 focus:ring-daw-green/20 shadow-inner"
                      : "bg-slate-100/50 border-transparent text-slate-500 cursor-not-allowed"
                  }`}
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: AFFILIATED COMPANIES */}
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
                  className="flex items-center gap-1.5 px-4 py-2 bg-daw-green/10 hover:bg-daw-green hover:text-white text-daw-green rounded-lg text-sm font-bold transition-colors"
                >
                  <Plus className="w-4 h-4" /> Add Company
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {localCompanies.map((company) => (
                <div
                  key={company.id}
                  className="flex gap-4 items-start bg-slate-50 p-5 rounded-xl border border-slate-200 group transition-all"
                >
                  {/* LOGO UPLOAD COMPONENT */}
                  <div className="w-24 shrink-0 relative">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 text-center">
                      Logo
                    </label>
                    <div
                      className={`relative aspect-square rounded-lg border-2 border-dashed flex flex-col items-center justify-center text-center p-2 overflow-hidden transition-colors ${
                        isEditing
                          ? "border-slate-300 bg-white hover:border-daw-green cursor-pointer"
                          : "border-slate-200 bg-slate-100/50 cursor-not-allowed"
                      }`}
                    >
                      {getPreviewUrl(company) ? (
                        <img
                          src={getPreviewUrl(company)!}
                          alt="Logo"
                          className="w-full h-full object-contain p-1"
                        />
                      ) : (
                        <>
                          <ImageIcon
                            className={`w-5 h-5 mb-1 ${isEditing ? "text-daw-green" : "text-slate-400"}`}
                          />
                          <span
                            className={`text-[9px] font-medium leading-tight ${isEditing ? "text-slate-700" : "text-slate-400"}`}
                          >
                            Upload Logo
                          </span>
                        </>
                      )}

                      {/* Hidden Input File */}
                      {isEditing && (
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) =>
                            e.target.files?.[0] &&
                            handleLogoChange(company.id, e.target.files[0])
                          }
                          className="absolute inset-0 opacity-0 cursor-pointer"
                        />
                      )}
                    </div>
                  </div>

                  {/* COMPANY DETAILS */}
                  <div className="flex-1 space-y-3">
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
                        disabled={!isEditing}
                        className={`w-full px-3 py-1.5 text-sm rounded-md font-bold transition-all duration-300 ${isEditing ? "bg-white border border-slate-300 text-slate-900 focus:ring-2 focus:ring-daw-green/20" : "bg-slate-100/50 border-transparent text-slate-500"}`}
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
                          disabled={!isEditing}
                          className={`w-full px-3 py-1.5 text-xs rounded-md transition-all duration-300 ${isEditing ? "bg-white border border-slate-300 text-slate-900 focus:ring-2 focus:ring-daw-green/20" : "bg-slate-100/50 border-transparent text-slate-500"}`}
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
                          disabled={!isEditing}
                          className={`w-full px-3 py-1.5 text-xs rounded-md transition-all duration-300 ${isEditing ? "bg-white border border-slate-300 text-slate-900 focus:ring-2 focus:ring-daw-green/20" : "bg-slate-100/50 border-transparent text-slate-500 appearance-none"}`}
                        >
                          <option value="fnb">Food & Beverage</option>
                          <option value="steel">Steel</option>
                          <option value="finance">
                            Finance / Microfinance
                          </option>
                          <option value="edu">Education</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* DELETE ACTION */}
                  {isEditing && (
                    <button
                      onClick={() => removeCompany(company.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors mt-5 shrink-0"
                      title="Remove Company"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}

              {localCompanies.length === 0 && (
                <div className="col-span-full py-10 text-center text-slate-500 italic">
                  No affiliated companies yet. Click "Add Company" to start.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
