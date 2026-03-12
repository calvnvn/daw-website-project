import { useState, useEffect } from "react";
import {
  Save,
  Users,
  Target,
  BookOpen,
  Image as ImageIcon,
  ImageOff,
  Edit,
  Trash2,
  Plus,
  History,
  Lock,
  Unlock,
} from "lucide-react";
import { toast } from "sonner";

// Milestones History
interface HistoryItem {
  id: number;
  year: string;
  text: string;
}

// Philosophy Pillar
interface PhilosophyPillar {
  id: string;
  title: string;
  text: string;
}

// Member Management
interface ManagementMember {
  id: number;
  name: string;
  role: string;
  description: string;
  level: string; // atau "chairman" | "director" | "division"
  order: number;
  photoUrl: string | null;
}

interface HistoryApiResponse {
  id: number;
  year: string;
  description: string;
}

export default function AboutUsManager() {
  const [activeTab, setActiveTab] = useState<
    "info" | "history" | "philosophy" | "management"
  >("info");
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // --- STATE 1: MANAGEMENT ---
  const [managementTeam, setManagementTeam] = useState<ManagementMember[]>([]);
  const [isPersonModalOpen, setIsPersonModalOpen] = useState(false);
  const [editingPersonId, setEditingPersonId] = useState<number | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [personForm, setPersonForm] = useState({
    name: "",
    role: "",
    description: "",
    level: "division",
    order: 1,
    photo: null as File | null,
    removePhoto: false, // 👈 TAMBAH INI
  });

  // --- STATE 2: COMPANY INFO (Core Identity) ---
  const [companyInfo, setCompanyInfo] = useState({
    spiritTitle: "Founders' Spirit",
    spiritText: "",
    missionTitle: "Mission",
    missionText: "",
    visionTitle: "Vision",
    visionText: "",
  });

  // --- STATE 3: HISTORY  ---
  const [companyHistory, setCompanyHistory] = useState([
    {
      id: 1,
      year: "2005",
      text: "DAW Group was founded in 2005 as an investment holding company in a food and beverage industry.",
    },
    {
      id: 2,
      year: "2009",
      text: "In 2009, DAW Group was transformed as an operating holding company that focuses in resources and energy industry.",
    },
  ]);

  // --- STATE 4: PHILOSOPHY ---
  const [philosophy, setPhilosophy] = useState<{
    mainTitle: string;
    pillars: PhilosophyPillar[];
  }>({
    mainTitle: "Our Philosophy",
    pillars: [],
  });

  // API FETCHING
  useEffect(() => {
    const fetchAllData = async () => {
      try {
        const resAbout = await fetch("http://localhost:5000/api/about");
        if (resAbout.ok) {
          const data = await resAbout.json();

          // Masukkan data ke state Company Info
          setCompanyInfo((prev) => ({
            ...prev,
            spiritText: data.spiritText || "",
            missionText: data.missionText || "",
            visionText: data.visionText || "",
          }));

          // Masukkan data ke state Philosophy
          setPhilosophy({
            mainTitle: data.philosophyTitle || "Our Philosophy",
            pillars: data.philosophyPillars || [],
          });
        }

        const resHistory = await fetch("http://localhost:5000/api/history");
        if (resHistory.ok) {
          const dataHistory = await resHistory.json();
          const formattedHistory: HistoryItem[] = dataHistory.map(
            (item: { id: number; year: string; description: string }) => ({
              id: item.id,
              year: item.year,
              text: item.description,
            }),
          );
          setCompanyHistory(formattedHistory);
        }

        const resManagement = await fetch(
          "http://localhost:5000/api/management",
        );
        if (resManagement.ok) {
          const dataManagement = await resManagement.json();
          setManagementTeam(dataManagement);
        }
      } catch {
        toast.error("Failed to load About Us data from the server.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchAllData();
  }, []);

  // API SAVING
  const handleSave = async () => {
    setIsSaving(true);
    const token = localStorage.getItem("daw_token");

    try {
      if (activeTab === "management") {
        toast.success("Management settings locked.");
        setIsEditing(false);
        return;
      }
      if (activeTab === "info" || activeTab === "philosophy") {
        const loadingToast = toast.loading("Saving About Us content...");
        const payload = {
          spiritText: companyInfo.spiritText,
          missionText: companyInfo.missionText,
          visionText: companyInfo.visionText,
          philosophyTitle: philosophy.mainTitle,
          philosophyPillars: philosophy.pillars,
        };
        const response = await fetch("http://localhost:5000/api/about", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          toast.success("Content updated successfully!", { id: loadingToast });
          setIsEditing(false);
        }
      } else if (activeTab === "history") {
        // 👇 TAMBAHAN: Simpan khusus untuk Tab History
        const loadingToast = toast.loading("Syncing Company Timeline...");
        const response = await fetch("http://localhost:5000/api/history", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ histories: companyHistory }), // Kirim seluruh array
        });

        if (response.ok) {
          toast.success("Timeline updated successfully!", { id: loadingToast });
          setIsEditing(false);

          // Refresh data agar mendapatkan ID asli dari database (auto-increment)
          const refreshRes = await fetch("http://localhost:5000/api/history");
          const freshData: HistoryApiResponse[] = await refreshRes.json();
          setCompanyHistory(
            freshData.map((item) => ({
              id: item.id,
              year: item.year,
              text: item.description,
            })),
          );
        }
      }
    } catch (error) {
      toast.error("Network Error.");
      console.log(error);
    } finally {
      setIsSaving(false);
    }
  };

  // Handler History Dinamis
  const addHistory = () => {
    const tempId = -Math.floor(Math.random() * 10000);
    setCompanyHistory([...companyHistory, { id: tempId, year: "", text: "" }]);
  };

  // --- HANDLERS ---
  const removeHistory = (id: number) => {
    setCompanyHistory(companyHistory.filter((h) => h.id !== id));
  };

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
    if (person) {
      setEditingPersonId(person.id);
      setPersonForm({
        name: person.name,
        role: person.role,
        description: person.description,
        level: person.level,
        order: person.order,
        photo: null,
        removePhoto: false, // 👈 TAMBAH INI
      });
      setPhotoPreview(
        person.photoUrl ? `http://localhost:5000${person.photoUrl}` : null,
      );
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
      });
      setPhotoPreview(null);
    }
    setIsPersonModalOpen(true);
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setPersonForm({ ...personForm, photo: file, removePhoto: false });
      // Buat URL sementara untuk preview gambar di browser
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const savePerson = async (e: React.FormEvent) => {
    e.preventDefault();

    if (
      !personForm.name.trim() ||
      !personForm.role.trim() ||
      !personForm.description.trim()
    ) {
      toast.error("Please fill in all required fields.");
      return;
    }

    const loadingToast = toast.loading("Saving person data...");

    const token = localStorage.getItem("daw_token");

    // 💡 THE MAGIC: Gunakan FormData, bukan JSON!
    const formData = new FormData();
    formData.append("name", personForm.name);
    formData.append("role", personForm.role);
    formData.append("description", personForm.description);
    formData.append("level", personForm.level);
    formData.append("order", personForm.order.toString());
    if (personForm.removePhoto) {
      formData.append("removePhoto", "true");
    }
    if (personForm.photo) {
      formData.append("photo", personForm.photo);
    }

    try {
      const url = editingPersonId
        ? `http://localhost:5000/api/management/${editingPersonId}`
        : "http://localhost:5000/api/management";

      const method = editingPersonId ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (response.ok) {
        toast.success("Team member saved!", { id: loadingToast });
        setIsPersonModalOpen(false);
        // Refresh data table
        const res = await fetch("http://localhost:5000/api/management");
        setManagementTeam(await res.json());
      } else {
        toast.error("Failed to save data.", { id: loadingToast });
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Network error.";
      toast.error(errorMessage, { id: loadingToast });
      console.error(error);
    }
  };

  const deletePerson = async (id: number) => {
    if (!confirm("Are you sure you want to delete this person?")) return;

    const token = localStorage.getItem("daw_token");
    const response = await fetch(`http://localhost:5000/api/management/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.ok) {
      toast.success("Person deleted!");
      setManagementTeam(managementTeam.filter((p) => p.id !== id));
    }
  };

  if (isLoading) {
    return (
      <div className="p-12 text-center text-slate-500">
        Loading company information...
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500 pb-12">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm sticky top-0 z-20">
        <div>
          <h1 className="text-2xl font-serif font-bold text-slate-900">
            About Us Manager
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage company history, vision, mission, and leadership team.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/*  Toggle Edit Mode */}
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

      {/* TABS NAVIGATION */}
      <div className="flex items-end overflow-x-auto border border-slate-200 border-b-0 shadow-sm bg-white rounded-t-xl px-2 pt-2 hide-scrollbar">
        <button
          onClick={() => setActiveTab("info")}
          className={`flex items-center gap-2 px-6 py-3 font-bold text-sm uppercase tracking-wider border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "info"
              ? "border-daw-green text-daw-green"
              : "border-transparent text-slate-400 hover:text-slate-700"
          }`}
        >
          <Target className="w-4 h-4" /> Company Info
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`flex items-center gap-2 px-6 py-3 font-bold text-sm uppercase tracking-wider border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "history"
              ? "border-daw-green text-daw-green"
              : "border-transparent text-slate-400 hover:text-slate-700"
          }`}
        >
          <History className="w-4 h-4" /> History
        </button>
        <button
          onClick={() => setActiveTab("philosophy")}
          className={`flex items-center gap-2 px-6 py-3 font-bold text-sm uppercase tracking-wider border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "philosophy"
              ? "border-daw-green text-daw-green"
              : "border-transparent text-slate-400 hover:text-slate-700"
          }`}
        >
          <BookOpen className="w-4 h-4" /> Philosophy
        </button>
        <button
          onClick={() => setActiveTab("management")}
          className={`flex items-center gap-2 px-6 py-3 font-bold text-sm uppercase tracking-wider border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "management"
              ? "border-daw-green text-daw-green"
              : "border-transparent text-slate-400 hover:text-slate-700"
          }`}
        >
          <Users className="w-4 h-4" /> Management Team
        </button>
      </div>

      {/* --- TAB CONTENT AREA --- */}
      <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500 pb-12">
        {" "}
        {/* TAB 1: COMPANY INFO */}
        {activeTab === "info" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <h3 className="text-lg font-bold text-slate-900 mb-4 border-b border-slate-100 pb-2">
              Core Identity
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Founders Spirit */}
              <div className="md:col-span-2 bg-slate-50 p-5 rounded-xl border border-slate-200">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Spirit Title (Locked)
                </label>
                <input
                  type="text"
                  value={companyInfo.spiritTitle}
                  disabled
                  // Visual Field Terkunci Permanen
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
                  disabled={!isEditing}
                  // Visual Dinamis: Berubah wujud saat isEditing
                  className={`w-full px-3 py-2 rounded-lg resize-none font-serif transition-all duration-300 ${
                    isEditing
                      ? "bg-white border border-slate-300 text-slate-900 focus:ring-2 focus:ring-daw-green/20 shadow-inner"
                      : "bg-slate-100/50 border-transparent text-slate-500 cursor-not-allowed"
                  }`}
                />
              </div>

              {/* Mission */}
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
                  disabled={!isEditing}
                  className={`w-full px-3 py-2 rounded-lg resize-none font-serif transition-all duration-300 ${
                    isEditing
                      ? "bg-white border border-slate-300 text-slate-900 focus:ring-2 focus:ring-daw-green/20 shadow-inner"
                      : "bg-slate-100/50 border-transparent text-slate-500 cursor-not-allowed"
                  }`}
                />
              </div>

              {/* Vision */}
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
                  disabled={!isEditing}
                  className={`w-full px-3 py-2 rounded-lg resize-none font-serif transition-all duration-300 ${
                    isEditing
                      ? "bg-white border border-slate-300 text-slate-900 focus:ring-2 focus:ring-daw-green/20 shadow-inner"
                      : "bg-slate-100/50 border-transparent text-slate-500 cursor-not-allowed"
                  }`}
                />
              </div>
            </div>
          </div>
        )}
        {/* TAB 2: HISTORY (TIMELINE) */}
        {activeTab === "history" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <History className="w-5 h-5 text-daw-green" /> Company
                  Timeline
                </h3>
                <p className="text-sm text-slate-500 mt-1">
                  Add or edit historical milestones of the company.
                </p>
              </div>
              {isEditing && (
                <button
                  onClick={addHistory}
                  className="flex items-center gap-1.5 px-4 py-2 bg-daw-green/10 hover:bg-daw-green hover:text-white text-daw-green rounded-lg text-sm font-bold transition-colors"
                >
                  <Plus className="w-4 h-4" /> Add Milestone
                </button>
              )}
            </div>

            <div className="space-y-4">
              {companyHistory.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col sm:flex-row gap-4 items-start bg-slate-50 p-5 rounded-xl border border-slate-200 group transition-all"
                >
                  <div className="w-full sm:w-32 shrink-0">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      Year
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 2026"
                      value={item.year}
                      onChange={(e) =>
                        updateHistory(item.id, "year", e.target.value)
                      }
                      disabled={!isEditing}
                      className={`w-full px-3 py-2 rounded-lg font-bold transition-all duration-300 ${
                        isEditing
                          ? "bg-white border border-slate-300 text-slate-900 focus:ring-2 focus:ring-daw-green/20 shadow-inner"
                          : "bg-slate-100/50 border-transparent text-slate-500 cursor-not-allowed"
                      }`}
                    />
                  </div>
                  <div className="flex-1 w-full">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      Description
                    </label>
                    <textarea
                      rows={2}
                      value={item.text}
                      onChange={(e) =>
                        updateHistory(item.id, "text", e.target.value)
                      }
                      disabled={!isEditing}
                      className={`w-full px-3 py-2 rounded-lg resize-none transition-all duration-300 ${
                        isEditing
                          ? "bg-white border border-slate-300 text-slate-900 focus:ring-2 focus:ring-daw-green/20 shadow-inner"
                          : "bg-slate-100/50 border-transparent text-slate-500 cursor-not-allowed"
                      }`}
                    />
                  </div>

                  {/* Sembunyikan tombol Trash jika di-lock */}
                  {isEditing && (
                    <button
                      onClick={() => removeHistory(item.id)}
                      className="mt-6 p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors sm:opacity-0 sm:group-hover:opacity-100 w-full sm:w-auto flex justify-center"
                      title="Remove this milestone"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  )}
                </div>
              ))}

              {companyHistory.length === 0 && (
                <div className="text-center py-8 text-slate-500 text-sm bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  No historical milestones added yet. Click "Add Milestone" to
                  start.
                </div>
              )}
            </div>
          </div>
        )}
        {/* TAB 3: PHILOSOPHY */}
        {activeTab === "philosophy" && (
          <div className="space-y-8 animate-in fade-in duration-300">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                Main Section Title
              </label>
              <input
                type="text"
                value={philosophy.mainTitle}
                onChange={(e) =>
                  setPhilosophy({ ...philosophy, mainTitle: e.target.value })
                }
                disabled={!isEditing}
                className={`w-full max-w-md px-4 py-3 rounded-lg font-serif text-xl transition-all duration-300 ${
                  isEditing
                    ? "bg-white border border-slate-300 text-slate-900 focus:ring-2 focus:ring-daw-green/20 shadow-inner"
                    : "bg-slate-100/50 border-transparent text-slate-500 cursor-not-allowed"
                }`}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {philosophy.pillars.map((pillar) => (
                <div
                  key={pillar.id}
                  className="bg-slate-50 border border-slate-200 rounded-xl p-5 flex gap-4 items-start"
                >
                  {/* ... (Icon pillar biarkan sama) ... */}
                  <div className="flex-1 space-y-3">
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
                        disabled={!isEditing}
                        className={`w-full px-3 py-2 rounded-lg font-bold transition-all duration-300 ${
                          isEditing
                            ? "bg-white border border-slate-300 text-slate-900 focus:ring-2 focus:ring-daw-green/20 shadow-inner"
                            : "bg-slate-100/50 border-transparent text-slate-500 cursor-not-allowed"
                        }`}
                      />
                    </div>
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
                        disabled={!isEditing}
                        className={`w-full px-3 py-2 rounded-lg resize-none text-sm transition-all duration-300 ${
                          isEditing
                            ? "bg-white border border-slate-300 text-slate-900 focus:ring-2 focus:ring-daw-green/20 shadow-inner"
                            : "bg-slate-100/50 border-transparent text-slate-500 cursor-not-allowed"
                        }`}
                      />
                      <p className="text-[10px] text-slate-400 mt-1 italic">
                        Tip: Press{" "}
                        <kbd className="bg-slate-100 border border-slate-200 px-1 rounded">
                          Enter
                        </kbd>{" "}
                        to create a new bullet point.
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {/* TAB 4: MANAGEMENT TEAM*/}
        {activeTab === "management" && (
          <div className="space-y-8 animate-in fade-in duration-300 relative">
            {/* Header & Add Button */}
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-4">
              <div>
                <h3 className="font-bold text-slate-900 text-lg">
                  Board of Directors & Management
                </h3>
                <p className="text-sm text-slate-500">
                  Manage executives, roles, and profile pictures.
                </p>
              </div>
              {isEditing && (
                <button
                  onClick={() => openPersonModal()}
                  className="flex items-center gap-1.5 px-4 py-2 bg-daw-green hover:bg-[#003b1c] text-white rounded-lg text-sm font-bold transition-colors shadow-sm"
                >
                  <Plus className="w-4 h-4" /> Add Person
                </button>
              )}
            </div>

            {/* Table List */}
            <div className="overflow-x-auto border border-slate-200 rounded-lg bg-white">
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
                  {managementTeam.map((person) => (
                    <tr
                      key={person.id}
                      className="hover:bg-slate-50/50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        {person.photoUrl ? (
                          <div className="w-10 h-10 rounded-full overflow-hidden border border-slate-200">
                            <img
                              src={`http://localhost:5000${person.photoUrl}`}
                              alt={person.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                            <ImageOff className="w-4 h-4" />
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-bold text-slate-900">
                          {person.name}
                        </p>
                        <p className="text-xs text-slate-500">{person.role}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600">
                          {person.level} ({person.order})
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => openPersonModal(person)}
                              className="p-2 text-slate-400 hover:text-daw-green bg-white border border-slate-200 hover:border-daw-green rounded-lg transition-colors"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => deletePerson(person.id)}
                              className="p-2 text-slate-400 hover:text-red-600 bg-white border border-slate-200 hover:border-red-600 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">
                            Locked
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {managementTeam.length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-6 py-8 text-center text-slate-500 italic"
                      >
                        No management data found. Click 'Add Person' to start.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* MODAL / POPUP FORM */}
            {isPersonModalOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                  <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <h3 className="font-bold text-lg text-slate-900">
                      {editingPersonId ? "Edit Person" : "Add New Person"}
                    </h3>
                    <button
                      onClick={() => setIsPersonModalOpen(false)}
                      className="text-slate-400 hover:text-slate-700"
                    >
                      ✕
                    </button>
                  </div>

                  <form onSubmit={savePerson} className="p-6 space-y-5">
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
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-daw-green/20 focus:border-daw-green"
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
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-daw-green/20 focus:border-daw-green"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                          Hierarchy Level
                        </label>
                        <select
                          value={personForm.level}
                          onChange={(e) =>
                            setPersonForm({
                              ...personForm,
                              level: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-daw-green/20 focus:border-daw-green"
                        >
                          <option value="chairman">Chairman</option>
                          <option value="director">Director</option>
                          <option value="division">Division Head</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                          Display Order (1 = Top)
                        </label>
                        <input
                          required
                          type="number"
                          min="1"
                          value={personForm.order}
                          onChange={(e) =>
                            setPersonForm({
                              ...personForm,
                              order: parseInt(e.target.value),
                            })
                          }
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-daw-green/20 focus:border-daw-green"
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
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-daw-green/20 focus:border-daw-green resize-none"
                      />
                    </div>

                    {/* Bagian Input Foto */}
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                        Profile Photo (Optional)
                      </label>
                      <div className="flex items-center gap-4">
                        {photoPreview ? (
                          <div className="relative group shrink-0">
                            <div className="w-16 h-16 rounded-full overflow-hidden border border-slate-200">
                              <img
                                src={photoPreview}
                                alt="Preview"
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setPhotoPreview(null);
                                setPersonForm({
                                  ...personForm,
                                  photo: null,
                                  removePhoto: true,
                                });
                              }}
                              className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:bg-red-600"
                              title="Remove Photo"
                            >
                              <svg
                                className="w-3 h-3"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth="2"
                                  d="M6 18L18 6M6 6l12 12"
                                ></path>
                              </svg>
                            </button>
                          </div>
                        ) : (
                          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                            <ImageIcon className="w-6 h-6 text-slate-400" />
                          </div>
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handlePhotoChange}
                          className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-daw-green/10 file:text-daw-green hover:file:bg-daw-green/20 transition-colors cursor-pointer"
                        />
                      </div>
                    </div>

                    <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setIsPersonModalOpen(false)}
                        className="px-5 py-2.5 rounded-lg font-bold text-sm text-slate-600 hover:bg-slate-100 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2.5 bg-daw-green text-white rounded-lg font-bold text-sm hover:bg-[#003b1c] transition-colors"
                      >
                        Save Person
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
