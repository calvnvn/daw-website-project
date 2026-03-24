import { useState, useEffect } from "react";
import { useHome } from "@/contexts/HomeContext";
import { Save, Lock, Unlock } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";

export default function IntroManager() {
  const { settings: initialSettings, refreshData } = useHome();
  const [settings, setSettings] = useState({
    introHeadline: initialSettings?.introHeadline || "",
    introBody: initialSettings?.introBody || "",
  });
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (initialSettings) {
      setSettings({
        introHeadline: initialSettings.introHeadline || "",
        introBody: initialSettings.introBody || "",
      });
    }
  }, [initialSettings]);

  const handleSave = async () => {
    setIsSaving(true);
    const loadingToast = toast.loading("Sedang memperbarui teks sambutan...");
    try {
      await api.put("/homepage/settings", settings);

      await refreshData();
      toast.success("Teks sambutan berhasil diperbarui!", { id: loadingToast });
      setIsEditing(false);
    } catch (error) {
      console.error(error);
      toast.error(
        "Gagal menyimpan data. Silakan periksa koneksi atau coba lagi.",
        { id: loadingToast },
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 border-b border-slate-100 pb-4 gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900">
            Welcome Introduction
          </h3>
          <p className="text-sm text-slate-500">
            Teks sambutan utama yang muncul tepat di bawah spanduk (hero banner)
            halaman depan.
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
              Body Content
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
