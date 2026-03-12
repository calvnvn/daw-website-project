import { useState, useEffect } from "react";
import { useHome, type ImpactStat } from "@/contexts/HomeContext";
import { Save, Plus, Trash2, Lock, Unlock } from "lucide-react";
import * as Icons from "lucide-react";
import { toast } from "sonner";

const AVAILABLE_ICONS = [
  { name: "Map", label: "Map / Area" },
  { name: "Zap", label: "Zap / Energy" },
  { name: "Factory", label: "Factory / Mill" },
  { name: "Settings", label: "Gears / Operations" },
  { name: "Leaf", label: "Leaf / Sustainability" },
  { name: "Users", label: "Users / Community" },
  { name: "Building", label: "Building / Corporate" },
  { name: "Globe", label: "Globe / Global" },
];

export default function StatsManager() {
  const { stats: initialStats, refreshData } = useHome();
  const [stats, setStats] = useState<ImpactStat[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (initialStats) setStats(initialStats);
  }, [initialStats]);

  const addStat = () => {
    if (stats.length >= 4) return;
    setStats([
      ...stats,
      {
        id: `new-${Date.now()}`,
        icon: "Map",
        value: "",
        label: "",
        desc: "",
        order: stats.length,
      },
    ]);
  };

  const removeStat = async (id: string | number) => {
    if (!confirm("Are you sure?")) return;
    if (typeof id === "number") {
      const token = localStorage.getItem("daw_token");
      await fetch(`http://localhost:5000/api/homepage/stats/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
    }
    setStats(stats.filter((s) => s.id !== id));
  };

  const handleSave = async () => {
    setIsSaving(true);
    const loadingToast = toast.loading("Saving statistics...");
    const token = localStorage.getItem("daw_token");

    try {
      const promises = stats.map((stat) => {
        const isNew = typeof stat.id === "string" && stat.id.startsWith("new-");
        const url = isNew
          ? "http://localhost:5000/api/homepage/stats"
          : `http://localhost:5000/api/homepage/stats/${stat.id}`;
        return fetch(url, {
          method: isNew ? "POST" : "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(stat),
        });
      });

      await Promise.all(promises);
      await refreshData();
      toast.success("Statistics saved successfully!", { id: loadingToast });
      setIsEditing(false);
    } catch (error) {
      console.error(error);
      toast.error("Error saving statistics.", { id: loadingToast });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 border-b border-slate-100 pb-4 gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900">
            Impact Statistics
          </h3>
          <p className="text-sm text-slate-500">
            Highlight key numbers (Maximum 4 items).
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

          {isEditing && stats.length < 4 && (
            <button
              onClick={addStat}
              className="flex items-center gap-1.5 px-4 py-2 bg-daw-green/10 hover:bg-daw-green hover:text-white text-daw-green rounded-lg text-sm font-bold transition-colors"
            >
              <Plus className="w-4 h-4" /> Add Stat
            </button>
          )}

          <button
            onClick={handleSave}
            disabled={isSaving || !isEditing}
            className="flex items-center gap-2 bg-daw-green hover:bg-[#003b1c] disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-5 py-2 rounded-lg font-medium transition-colors shadow-sm"
          >
            <Save className="w-4 h-4" /> {isSaving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {stats.map((stat, index) => {
          const IconComponent = (Icons as any)[stat.icon] || Icons.HelpCircle;
          return (
            <div
              key={stat.id}
              className="flex gap-4 items-start bg-slate-50 p-5 rounded-xl border border-slate-200"
            >
              {/* ICON PREVIEW AREA */}
              <div className="w-20 shrink-0">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 text-center">
                  Icon
                </label>
                <div className="aspect-square rounded-lg border border-slate-200 bg-white flex items-center justify-center text-daw-green shadow-sm">
                  <IconComponent className="w-8 h-8 stroke-[1.5px]" />
                </div>
              </div>

              {/* DETAILS AREA */}
              <div className="flex-1 space-y-3">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Stat #{index + 1}
                  </span>
                  {isEditing && (
                    <button
                      onClick={() => removeStat(stat.id)}
                      className="text-slate-400 hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                      Value
                    </label>
                    <input
                      type="text"
                      value={stat.value}
                      disabled={!isEditing}
                      onChange={(e) =>
                        setStats(
                          stats.map((s) =>
                            s.id === stat.id
                              ? { ...s, value: e.target.value }
                              : s,
                          ),
                        )
                      }
                      className={`w-full px-3 py-1.5 text-sm font-bold transition-all rounded-md ${isEditing ? "bg-white border border-slate-300" : "bg-slate-100/50 border-transparent text-slate-500"}`}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                      Select Icon
                    </label>
                    <select
                      value={stat.icon}
                      disabled={!isEditing}
                      onChange={(e) =>
                        setStats(
                          stats.map((s) =>
                            s.id === stat.id
                              ? { ...s, icon: e.target.value }
                              : s,
                          ),
                        )
                      }
                      className={`w-full px-2 py-1.5 text-xs transition-all rounded-md appearance-none ${isEditing ? "bg-white border border-slate-300" : "bg-slate-100/50 border-transparent text-slate-500"}`}
                    >
                      {AVAILABLE_ICONS.map((i) => (
                        <option key={i.name} value={i.name}>
                          {i.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Label
                  </label>
                  <input
                    type="text"
                    value={stat.label}
                    disabled={!isEditing}
                    onChange={(e) =>
                      setStats(
                        stats.map((s) =>
                          s.id === stat.id
                            ? { ...s, label: e.target.value }
                            : s,
                        ),
                      )
                    }
                    className={`w-full px-3 py-1.5 text-xs font-bold uppercase transition-all rounded-md ${isEditing ? "bg-white border border-slate-300" : "bg-slate-100/50 border-transparent text-slate-500"}`}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Description
                  </label>
                  <input
                    type="text"
                    value={stat.desc}
                    disabled={!isEditing}
                    onChange={(e) =>
                      setStats(
                        stats.map((s) =>
                          s.id === stat.id ? { ...s, desc: e.target.value } : s,
                        ),
                      )
                    }
                    className={`w-full px-3 py-1.5 text-xs transition-all rounded-md ${isEditing ? "bg-white border border-slate-300" : "bg-slate-100/50 border-transparent text-slate-500"}`}
                  />
                </div>
              </div>
            </div>
          );
        })}
        {stats.length === 0 && (
          <div className="col-span-full py-10 text-center text-slate-500 italic">
            No statistics yet. Click "Add Stat" to start.
          </div>
        )}
      </div>
    </div>
  );
}
