import { useState, useEffect, useCallback } from "react"; // Tambahkan useCallback
import { useHome, type ImpactStats } from "@/contexts/HomeContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  Save,
  Plus,
  Trash2,
  Lock,
  Unlock,
  AlertTriangle,
  RotateCcw,
} from "lucide-react";
import * as Icons from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";

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

  const [stats, setStats] = useState<ImpactStats[]>([]);
  const { user } = useAuth();

  const isEditor = user?.role?.toLowerCase() === "editor";
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const [rejectedDrafts, setRejectedDrafts] = useState<any[]>([]);

  useEffect(() => {
    if (initialStats && !isEditing) {
      setStats(initialStats.map((s) => ({ ...s })));
    }
  }, [initialStats, isEditing]);

  useEffect(() => {
    const controller = new AbortController();

    const fetchRejectedDrafts = async () => {
      try {
        // Cek draf ditolak untuk SEMUA item di ImpactStat
        const promises = stats.map(
          (s) =>
            api
              .get(`/approval/rejected/${s.id}?module=ImpactStat`, {
                signal: controller.signal,
              })
              .catch(() => null), // Ignore error per item
        );

        const results = await Promise.all(promises);
        const rejected = results
          .filter((res) => res && res.data && res.data.hasRejected)
          .map((res) => res!.data.data); // Ambil object drafnya

        setRejectedDrafts(rejected);
      } catch (err: any) {
        if (err.name !== "CanceledError")
          console.log("Gagal mengecek draf ditolak.");
      }
    };

    // Hanya fetch jika ada data stats
    if (stats.length > 0 && !isEditing) {
      fetchRejectedDrafts();
    }

    return () => controller.abort();
  }, [stats.length, isEditing]);

  const handleRestoreDraft = useCallback(
    (targetId: string | number) => {
      const draft = rejectedDrafts.find(
        (d) => String(d.target_id) === String(targetId),
      );
      if (!draft?.payload) return;

      setStats((prev) =>
        prev.map((s) => {
          if (String(s.id) === String(targetId)) {
            return {
              ...s,
              icon: draft.payload.icon ?? s.icon,
              value: draft.payload.value ?? s.value,
              label: draft.payload.label ?? s.label,
              desc: draft.payload.desc ?? s.desc,
              order: draft.payload.order ?? s.order,
              previous_notrans: draft.notrans,
            } as any;
          }
          return s;
        }),
      );

      setIsEditing(true);
      toast.info("Draf dipulihkan ke dalam form", {
        description: "Silakan perbaiki dan klik Save.",
      });
    },
    [rejectedDrafts],
  );

  const reorderStats = (startIndex: number, endIndex: number) => {
    const result = Array.from(stats);
    const [removed] = result.splice(startIndex, 1);
    result.splice(endIndex, 0, removed);

    const finalResult = result.map((item, index) => ({
      ...item,
      order: index,
    }));

    setStats(finalResult);
  };
  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (index: number) => {
    if (draggedIndex === null) return;
    reorderStats(draggedIndex, index);
    setDraggedIndex(null);
  };

  const updateStatField = (
    id: string | number,
    field: keyof ImpactStats,
    value: string,
  ) => {
    setStats((prevStats) =>
      prevStats.map((s) => (s.id === id ? { ...s, [field]: value } : s)),
    );
  };

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
    // 1. Tampilkan toast konfirmasi terlebih dahulu
    toast("Hapus data statistik ini?", {
      description:
        "Tindakan ini akan menghilangkan angka pencapaian tersebut dari tampilan website publik secara permanen.",
      action: {
        label: "Delete",
        onClick: () => {
          toast.promise(
            async () => {
              if (typeof id === "number") {
                const res = await api.delete(`/homepage/stats/${id}`);

                if (res.status === 202) {
                  setStats((prev) =>
                    prev.map((s) =>
                      s.id === id ? { ...s, is_locked: true } : s,
                    ),
                  );
                  return "Pengajuan hapus dikirim. Menunggu persetujuan.";
                }
              }

              setStats((prev) => prev.filter((s) => s.id !== id));
              return "Statistic berhasil dihapus!";
            },
            {
              loading: "Memproses...",
              success: (msg) => msg,
              error: (err) => err.response?.data?.message || "Gagal menghapus.",
            },
          );
        },
      },
      cancel: {
        label: "Cancel",
        onClick: () => console.log("Deletion cancelled"),
      },
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    const loadingToast = toast.loading(
      isEditor ? "Mengajukan revisi..." : "Menyimpan statistik...",
    );

    try {
      const changedStats = stats.filter((stat) => {
        if (stat.is_locked) return false;
        if (typeof stat.id === "string" && stat.id.startsWith("new-"))
          return true;

        const original = initialStats.find((s) => s.id === stat.id);
        if (!original) return false;

        return (
          stat.icon !== original.icon ||
          stat.value !== original.value ||
          stat.label !== original.label ||
          stat.desc !== original.desc ||
          stat.order !== original.order
        );
      });

      if (changedStats.length === 0) {
        toast.dismiss(loadingToast);
        toast.info("Tidak ada perubahan", {
          description: "Semua data masih sama.",
        });
        setIsEditing(false);
        return;
      }
      const promises = changedStats.map((stat) => {
        const isNew = typeof stat.id === "string" && stat.id.startsWith("new-");
        const url = isNew ? "/homepage/stats" : `/homepage/stats/${stat.id}`;

        const payload = {
          ...stat,
          status: "Published", // Tetap kirim ini, backend yang nentuin ini dieksekusi atau masuk draf
        };

        if (isNew) {
          return api.post(url, payload, { timeout: 60000 });
        } else {
          return api.put(url, payload, { timeout: 60000 });
        }
      });

      await Promise.all(promises);

      if (isEditor) {
        const changedIds = changedStats.map((s) => s.id);
        setStats((prev) =>
          prev.map((s) =>
            changedIds.includes(s.id) ? { ...s, is_locked: true } : s,
          ),
        );
      }

      await refreshData();
      toast.success(
        isEditor ? "Revisi berhasil diajukan!" : "Data tersimpan!",
        { id: loadingToast },
      );
      setIsEditing(false);
    } catch (error: any) {
      console.error(error);
      toast.error(error.response?.data?.message || "Error saving statistics.", {
        id: loadingToast,
      });
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
            Tampilkan angka-angka kunci yang merepresentasikan skala operasional
            dan pencapaian perusahaan (Maksimal 4 item).
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setIsEditing(!isEditing)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-colors border ${
              isEditing
                ? "bg-amber-100 text-amber-700 border-amber-200"
                : "bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200"
            }`}>
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
              className="flex items-center gap-1.5 px-4 py-2 bg-daw-green/10 hover:bg-daw-green hover:text-white text-daw-green rounded-lg text-sm font-bold transition-colors">
              <Plus className="w-4 h-4" /> Add Stat
            </button>
          )}

          <button
            onClick={handleSave}
            disabled={isSaving || !isEditing}
            className="flex items-center gap-2 bg-daw-green hover:bg-[#003b1c] disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-5 py-2 rounded-lg font-medium transition-colors shadow-sm">
            <Save className="w-4 h-4" />
            {isSaving ? "Saving..." : isEditor ? "Request Approval" : "Publish"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {stats.map((stat, index) => {
          const IconComponent = (Icons as any)[stat.icon] || Icons.HelpCircle;
          const isDragging = draggedIndex === index;

          const isItemLocked = !isEditing || stat.is_locked;
          const rejectedDraft = rejectedDrafts.find(
            (d) => String(d.target_id) === String(stat.id),
          );
          return (
            <div
              key={stat.id}
              draggable={isEditing && !stat.is_locked}
              onDragStart={() => handleDragStart(index)}
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(index)}
              onDragEnd={() => setDraggedIndex(null)}
              className={`flex gap-4 items-start p-5 rounded-xl border transition-all duration-300 relative overflow-hidden ${
                stat.is_locked
                  ? "bg-slate-100/50 opacity-70 grayscale-[20%]"
                  : isEditing
                    ? "bg-white border-slate-200 shadow-sm cursor-grab active:cursor-grabbing"
                    : "bg-slate-50 border-slate-100"
              } ${isDragging ? "opacity-40 scale-95 border-daw-green border-dashed" : ""}`}>
              {/* ⚠️ THE RESTORATION BANNER (Individual) */}
              {rejectedDraft && !isEditing && (
                <div className="absolute top-0 left-0 right-0 bg-amber-500 text-white text-[10px] font-bold px-3 py-1 flex justify-between items-center z-10 animate-in slide-in-from-top-2">
                  <span className="flex items-center gap-1.5">
                    <AlertTriangle className="w-3 h-3" /> Revisi Ditolak: "
                    {rejectedDraft.rejection_reason}"
                  </span>
                  <button
                    onClick={() => handleRestoreDraft(stat.id)}
                    className="flex items-center gap-1 bg-white/20 hover:bg-white/30 px-2 py-0.5 rounded transition-colors">
                    <RotateCcw className="w-3 h-3" /> Pulihkan
                  </button>
                </div>
              )}

              {/* 🔒 PENDING BADGE */}
              {stat.is_locked && (
                <div className="absolute top-0 left-0 right-0 bg-blue-50 border-b border-blue-100 text-blue-600 text-[10px] font-bold px-3 py-1 flex items-center justify-center gap-1.5 z-10">
                  <Lock className="w-3 h-3" /> PENDING APPROVAL
                </div>
              )}

              <div
                className={`flex w-full gap-4 mt-${(rejectedDraft && !isEditing) || stat.is_locked ? "6" : "0"}`}>
                {/* Orders Control */}
                {isEditing && !stat.is_locked && (
                  <div className="flex flex-col items-center gap-1 pr-2 border-r border-slate-100 pt-1">
                    <button
                      onClick={() =>
                        index > 0 && reorderStats(index, index - 1)
                      }
                      disabled={index === 0}
                      className="p-1 hover:bg-slate-100 rounded disabled:opacity-20">
                      <Icons.ChevronUp className="w-4 h-4 text-slate-500" />
                    </button>

                    <Icons.GripVertical className="w-4 h-4 text-slate-300" />

                    <button
                      onClick={() =>
                        index < stats.length - 1 &&
                        reorderStats(index, index + 1)
                      }
                      disabled={index === stats.length - 1}
                      className="p-1 hover:bg-slate-100 rounded disabled:opacity-20">
                      <Icons.ChevronDown className="w-4 h-4 text-slate-500" />
                    </button>
                  </div>
                )}
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
                    {isEditing && !stat.is_locked && (
                      <button
                        onClick={() => removeStat(stat.id)}
                        className="text-slate-400 hover:text-red-600 transition-colors">
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
                        disabled={
                          isItemLocked
                        } /* 👈 PERBAIKAN 2: Gunakan isItemLocked */
                        onChange={(e) =>
                          updateStatField(stat.id, "value", e.target.value)
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
                        disabled={
                          isItemLocked
                        } /* 👈 PERBAIKAN 2: Gunakan isItemLocked */
                        onChange={(e) =>
                          updateStatField(stat.id, "icon", e.target.value)
                        }
                        className={`w-full px-2 py-1.5 text-xs transition-all rounded-md appearance-none ${isEditing ? "bg-white border border-slate-300" : "bg-slate-100/50 border-transparent text-slate-500"}`}>
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
                      disabled={
                        isItemLocked
                      } /* 👈 PERBAIKAN 2: Gunakan isItemLocked */
                      onChange={(e) =>
                        updateStatField(stat.id, "label", e.target.value)
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
                      disabled={
                        isItemLocked
                      } /* 👈 PERBAIKAN 2: Gunakan isItemLocked */
                      onChange={(e) =>
                        updateStatField(stat.id, "desc", e.target.value)
                      }
                      className={`w-full px-3 py-1.5 text-xs transition-all rounded-md ${isEditing ? "bg-white border border-slate-300" : "bg-slate-100/50 border-transparent text-slate-500"}`}
                    />
                  </div>
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
