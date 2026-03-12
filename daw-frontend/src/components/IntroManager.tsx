import { useState, useEffect } from "react";
import { useHome } from "@/contexts/HomeContext";
import { Save, Lock, Unlock } from "lucide-react";
import { toast } from "sonner";

export default function IntroManager() {
  const { settings: initialSettings, refreshData } = useHome();
  const [settings, setSettings] = useState({
    introHeadline: "",
    introBody: "",
  });
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (initialSettings) setSettings(initialSettings);
  }, [initialSettings]);

  const handleSave = async () => {
    setIsSaving(true);
    const loadingToast = toast.loading("Saving intro text...");
    const token = localStorage.getItem("daw_token");
    try {
      const res = await fetch("http://localhost:5000/api/homepage/settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(settings),
      });

      if (res.ok) {
        await refreshData();
        toast.success("Intro text saved successfully!", { id: loadingToast });
        setIsEditing(false);
      } else {
        toast.error("Failed to save intro text.", { id: loadingToast });
      }
    } catch (error) {
      console.error(error);
      toast.error("Error saving data.", { id: loadingToast });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 border-b border-slate-100 pb-4 gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900">
            Transformation Intro
          </h3>
          <p className="text-sm text-slate-500">
            The main welcoming text directly below the hero banner.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setIsEditing(!isEditing)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-colors border ${
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
            <span>{isEditing ? "Editing" : "Locked"}</span>
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !isEditing}
            className="flex items-center gap-2 bg-daw-green hover:bg-[#003b1c] disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-5 py-2 rounded-lg font-medium transition-colors shadow-sm"
          >
            <Save className="w-4 h-4" /> {isSaving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
        <div className="space-y-5">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
              Main Headline
            </label>
            <input
              type="text"
              value={settings.introHeadline}
              disabled={!isEditing}
              onChange={(e) =>
                setSettings({ ...settings, introHeadline: e.target.value })
              }
              className={`w-full px-4 py-3 rounded-lg font-serif text-2xl transition-all ${isEditing ? "bg-white border border-slate-300 focus:ring-2 focus:ring-daw-green/20" : "bg-slate-100/50 border-transparent text-slate-500"}`}
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
              Body Text
            </label>
            <textarea
              rows={5}
              value={settings.introBody}
              disabled={!isEditing}
              onChange={(e) =>
                setSettings({ ...settings, introBody: e.target.value })
              }
              className={`w-full px-4 py-3 rounded-lg text-base transition-all ${isEditing ? "bg-white border border-slate-300 focus:ring-2 focus:ring-daw-green/20" : "bg-slate-100/50 border-transparent text-slate-500"}`}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
