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
  const { user } = useAuth();

  // 🚀 Sub-Langkah 3.1: Identity Alignment
  const isSuperadmin = user?.role === "Superadmin" || user?.role === "admin";
  const isEditor = user?.role?.toLowerCase() === "editor";

  // --- States ---
  const [stats, setStats] = useState<ImpactStats[]>([]);
  const [originalStats, setOriginalStats] = useState<ImpactStats[]>([]);

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [rejectedDrafts, setRejectedDrafts] = useState<any[]>([]);

  const hasLockedItems = stats.some((s) => s.is_locked);
  const shouldLockGlobalActions = hasLockedItems && !isSuperadmin;

  // --- 1. SINKRONISASI DATA & SNAPSHOTTING ---
  useEffect(() => {
    if (initialStats && !isEditing) {
      const cleanStats = initialStats.map((s) => ({ ...s }));
      setStats(cleanStats);
      setOriginalStats(cleanStats); // Simpan jangkar komparasi
    }
  }, [initialStats, isEditing]);

  // --- 2. REJECTED DRAFTS FETCHING ---
  useEffect(() => {
    if (isSuperadmin) return;
    const controller = new AbortController();

    const fetchRejectedDrafts = async () => {
      try {
        const promises = stats
          .filter(
            (s) =>
              typeof s.id === "number" ||
              (typeof s.id === "string" && !s.id.startsWith("new-")),
          )
          .map((s) =>
            api
              .get(`/approval/rejected/${s.id}?module=ImpactStat`, {
                signal: controller.signal,
              })
              .catch(() => null),
          );

        const results = await Promise.all(promises);
        const rejected = results
          .filter((res) => res && res.data && res.data.hasRejected)
          .map((res) => res!.data.data);

        setRejectedDrafts(rejected);
      } catch (err: any) {
        if (err.name !== "CanceledError")
          console.log("Gagal sinkronisasi draf ditolak.");
      }
    };

    if (stats.length > 0 && !isEditing) fetchRejectedDrafts();
    return () => controller.abort();
  }, [stats.length, isEditing, isSuperadmin]);

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

  // --- DRAG AND DROP HANDLERS ---
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
    if (shouldLockGlobalActions)
      return toast.error("Interaksi dibatasi", {
        description: "Data sedang dalam antrean pusat.",
      });
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  const handleDrop = (index: number) => {
    if (shouldLockGlobalActions || draggedIndex === null) return;
    reorderStats(draggedIndex, index);
    setDraggedIndex(null);
  };

  const updateStatField = (
    id: string | number,
    field: keyof ImpactStats,
    value: string,
  ) => {
    setStats((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)),
    );
  };

  // --- 3. GUARDRAIL & LIMIT ENFORCEMENT ---
  const addStat = () => {
    if (stats.length >= 4 || shouldLockGlobalActions) return;
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
    if (shouldLockGlobalActions) {
      return toast.error("Akses Terbatas", {
        description: "Terdapat data yang sedang ditinjau pusat.",
      });
    }

    toast("Hapus data statistik ini?", {
      description: isSuperadmin
        ? "Data akan dihapus secara permanen."
        : "Pengajuan hapus akan dikirim ke pusat.",
      action: {
        label: "Hapus",
        onClick: () => {
          toast.promise(
            async () => {
              if (
                typeof id === "number" ||
                (typeof id === "string" && !id.startsWith("new-"))
              ) {
                const res = await api.delete(`/homepage/stats/${id}`);
                if (res.status === 202) {
                  setStats((prev) =>
                    prev.map((s) =>
                      s.id === id ? { ...s, is_locked: true } : s,
                    ),
                  );
                  return "Pengajuan hapus dikirim.";
                }
              }
              setStats((prev) => prev.filter((s) => s.id !== id));
              return "Berhasil dihapus!";
            },
            {
              loading: "Memproses...",
              success: (msg) => msg,
              error: (err) => err.response?.data?.message || "Gagal menghapus.",
            },
          );
        },
      },
      cancel: { label: "Batal", onClick: () => {} },
    });
  };

  const getChangedStats = useCallback(() => {
    return stats.filter((stat) => {
      // Jika data dikunci dan user bukan admin, abaikan (mencegah spam)
      if (stat.is_locked && !isSuperadmin) return false;

      // Jika item baru ditambahkan
      if (typeof stat.id === "string" && stat.id.startsWith("new-"))
        return true;

      // Cari pasangan di data asli
      const original = originalStats.find((s) => s.id === stat.id);
      if (!original) return false;

      // Deteksi perubahan sekecil apapun (termasuk Drag & Drop / Order)
      return (
        stat.icon !== original.icon ||
        stat.value !== original.value ||
        stat.label !== original.label ||
        stat.desc !== original.desc ||
        stat.order !== original.order
      );
    });
  }, [stats, originalStats, isSuperadmin]);

  // --- 4. ATOMIC SUBMISSION ---
  const handleSave = async () => {
    const changedData = getChangedStats();

    if (changedData.length === 0) {
      toast.info("Tidak ada perubahan terdeteksi.", {
        description: "Semua statistik masih sama dengan versi Live.",
      });
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    const loadingToast = toast.loading(
      isSuperadmin
        ? "Menerapkan perubahan live..."
        : "Mengajukan revisi ke pusat...",
    );

    try {
      const promises = changedData.map((stat) => {
        const isNew = typeof stat.id === "string" && stat.id.startsWith("new-");
        const url = isNew ? "/homepage/stats" : `/homepage/stats/${stat.id}`;

        const payload = {
          ...stat,
          status: isSuperadmin ? "Active" : "Published",
        };

        return isNew
          ? api.post(url, payload, { timeout: 60000 })
          : api.put(url, payload, { timeout: 60000 });
      });

      await Promise.all(promises);

      // Lock optimistic update for Editor
      if (isEditor) {
        const changedIds = changedData.map((s) => s.id);
        setStats((prev) =>
          prev.map((s) =>
            changedIds.includes(s.id) ? { ...s, is_locked: true } : s,
          ),
        );
      }

      await refreshData();
      toast.success(
        isSuperadmin
          ? "Statistik diperbarui secara live!"
          : "Revisi berhasil diajukan!",
        { id: loadingToast },
      );
      setIsEditing(false);
    } catch (error: any) {
      console.error(error);
      toast.error("Gagal menyimpan data", {
        description:
          error.response?.data?.message || "Periksa koneksi server Anda.",
        id: loadingToast,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* --- HEADER (MATRIX BUTTONS) --- */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 border-b border-slate-100 pb-4 gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            Impact Statistics
            {hasLockedItems && !isSuperadmin && (
              <span className="bg-blue-50 text-blue-600 border border-blue-200 text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                <Lock className="w-3 h-3" /> Ada Draf Tertunda
              </span>
            )}
          </h3>
          <p className="text-sm text-slate-500">
            Tampilkan angka pencapaian perusahaan (Maksimal 4 item).
          </p>
        </div>

        <div className="flex gap-3 w-full sm:w-auto">
          {/* Edit Toggle Button */}
          <button
            onClick={() => {
              if (shouldLockGlobalActions) {
                return toast.error("Akses Dibatasi", {
                  description: "Terdapat data yang sedang ditinjau pusat.",
                });
              }
              setIsEditing(!isEditing);
            }}
            disabled={isSaving || shouldLockGlobalActions}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-black text-[11px] uppercase tracking-widest transition-colors border shadow-sm ${
              shouldLockGlobalActions
                ? "bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed"
                : isEditing
                  ? "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}>
            {shouldLockGlobalActions ? (
              <Lock className="w-4 h-4 text-slate-300" />
            ) : isEditing ? (
              <Unlock className="w-4 h-4 text-amber-500" />
            ) : (
              <Lock className="w-4 h-4 text-slate-400" />
            )}
            <span>
              {shouldLockGlobalActions
                ? "System Locked"
                : isEditing
                  ? "Editing Mode"
                  : "Locked"}
            </span>
          </button>

          {isEditing && stats.length < 4 && !shouldLockGlobalActions && (
            <button
              onClick={addStat}
              className="flex items-center gap-1.5 px-4 py-2 bg-daw-green/10 hover:bg-daw-green hover:text-white text-daw-green rounded-lg text-[11px] font-black uppercase tracking-widest transition-colors">
              <Plus className="w-4 h-4" /> Add Stat
            </button>
          )}

          {/* Matrix Save Button */}
          <button
            onClick={handleSave}
            disabled={isSaving || !isEditing || shouldLockGlobalActions}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2 rounded-lg font-black text-[11px] uppercase tracking-widest transition-all shadow-lg active:scale-95 disabled:cursor-not-allowed disabled:shadow-none ${
              isSaving
                ? "bg-slate-300 text-slate-700"
                : shouldLockGlobalActions
                  ? "bg-slate-200 text-slate-500"
                  : isSuperadmin
                    ? "bg-daw-green hover:bg-[#003b1c] text-white shadow-daw-green/20"
                    : "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20"
            }`}>
            {isSaving ? (
              <Icons.Loader2 className="w-4 h-4 animate-spin" />
            ) : shouldLockGlobalActions ? (
              <Lock className="w-4 h-4" />
            ) : isSuperadmin ? (
              <Save className="w-4 h-4" />
            ) : (
              <Icons.Send className="w-4 h-4" />
            )}
            <span>
              {isSaving
                ? "Memproses..."
                : isSuperadmin
                  ? "Publish Live"
                  : "Request Approval"}
            </span>
          </button>
        </div>
      </div>

      {/* --- GRID LIST --- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {stats.map((stat, index) => {
          const IconComponent = (Icons as any)[stat.icon] || Icons.HelpCircle;
          const isDragging = draggedIndex === index;
          const isLocked = !!stat.is_locked;

          // Otoritas Baris: Editor terkunci, Admin hanya di-highlight
          const shouldLockThisRowUI = isLocked && !isSuperadmin;
          const isOverrideThisRow = isLocked && isSuperadmin;

          const rejectedDraft = rejectedDrafts.find(
            (d) => String(d.target_id) === String(stat.id),
          );

          return (
            <div
              key={stat.id}
              draggable={isEditing && !shouldLockThisRowUI}
              onDragStart={() => handleDragStart(index)}
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(index)}
              onDragEnd={() => setDraggedIndex(null)}
              className={`flex gap-4 items-start p-5 rounded-xl border transition-all duration-300 relative overflow-hidden ${
                shouldLockThisRowUI
                  ? "opacity-60 grayscale-[30%] pointer-events-none cursor-not-allowed bg-slate-50"
                  : isOverrideThisRow
                    ? "bg-amber-50/50 border-amber-200 shadow-sm"
                    : isEditing
                      ? "bg-white border-slate-200 shadow-sm cursor-grab active:cursor-grabbing"
                      : "bg-slate-50 border-slate-100"
              } ${isDragging ? "opacity-30 scale-95 border-daw-green border-dashed" : ""}`}>
              {rejectedDraft && !isEditing && !isSuperadmin && (
                <div className="absolute top-0 left-0 right-0 bg-amber-500 text-white text-[10px] font-bold px-3 py-1 flex justify-between items-center z-10 animate-in slide-in-from-top-2">
                  <span className="flex items-center gap-1.5 uppercase tracking-tighter">
                    <AlertTriangle className="w-3 h-3" /> Revisi Ditolak: "
                    {rejectedDraft.rejection_reason}"
                  </span>
                  <button
                    onClick={() => handleRestoreDraft(stat.id)}
                    className="bg-white/20 hover:bg-white/30 px-2 py-0.5 rounded transition-colors pointer-events-auto">
                    <RotateCcw className="w-3 h-3 inline mr-1" /> Pulihkan
                  </button>
                </div>
              )}

              {isOverrideThisRow && (
                <div className="absolute top-0 left-0 right-0 bg-amber-100 border-b border-amber-200 text-amber-800 text-[10px] font-black px-3 py-1 flex items-center justify-center gap-1.5 z-10 uppercase tracking-widest">
                  <Icons.ShieldAlert className="w-3 h-3 text-amber-600" /> Mode
                  Override: Sedang Ditinjau Editor
                </div>
              )}

              {shouldLockThisRowUI && (
                <div className="absolute top-0 left-0 right-0 bg-blue-50 border-b border-blue-100 text-blue-600 text-[10px] font-black px-3 py-1 flex items-center justify-center gap-1.5 z-10 uppercase tracking-widest">
                  <Lock className="w-3 h-3" /> Sedang Ditinjau Pusat
                </div>
              )}

              <div
                className={`flex w-full gap-4 mt-${(rejectedDraft || isLocked) && !isSuperadmin ? "6" : isOverrideThisRow ? "6" : "0"}`}>
                {/* Orders Control */}
                {isEditing && !shouldLockThisRowUI && (
                  <div className="flex flex-col items-center gap-1 pr-2 border-r border-slate-100 pt-1 shrink-0">
                    <button
                      onClick={() =>
                        index > 0 && reorderStats(index, index - 1)
                      }
                      disabled={index === 0}
                      className="p-1 hover:bg-slate-100 rounded disabled:opacity-10">
                      <Icons.ChevronUp className="w-4 h-4 text-slate-500" />
                    </button>
                    <Icons.GripVertical className="w-4 h-4 text-slate-300" />
                    <button
                      onClick={() =>
                        index < stats.length - 1 &&
                        reorderStats(index, index + 1)
                      }
                      disabled={index === stats.length - 1}
                      className="p-1 hover:bg-slate-100 rounded disabled:opacity-10">
                      <Icons.ChevronDown className="w-4 h-4 text-slate-500" />
                    </button>
                  </div>
                )}

                {/* ICON AREA */}
                <div className="w-16 shrink-0">
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 text-center">
                    Icon
                  </label>
                  <div
                    className={`aspect-square rounded-lg border flex items-center justify-center shadow-sm ${isOverrideThisRow ? "bg-amber-100 border-amber-200 text-amber-600" : "bg-white border-slate-200 text-daw-green"}`}>
                    <IconComponent className="w-7 h-7 stroke-[1.5px]" />
                  </div>
                </div>

                {/* DETAILS AREA */}
                <div className="flex-1 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      Statistic #{index + 1}
                    </span>
                    {isEditing && !shouldLockThisRowUI && (
                      <button
                        onClick={() => removeStat(stat.id)}
                        className="text-slate-300 hover:text-red-500 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                        Value
                      </label>
                      <input
                        type="text"
                        value={stat.value}
                        disabled={!isEditing || shouldLockThisRowUI}
                        onChange={(e) =>
                          updateStatField(stat.id, "value", e.target.value)
                        }
                        className={`w-full px-3 py-1.5 text-sm font-black rounded-md transition-all ${isEditing ? "bg-white border border-slate-200 focus:ring-2 focus:ring-daw-green/10" : "bg-transparent border-transparent"}`}
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                        Select Icon
                      </label>
                      <select
                        value={stat.icon}
                        disabled={!isEditing || shouldLockThisRowUI}
                        onChange={(e) =>
                          updateStatField(stat.id, "icon", e.target.value)
                        }
                        className={`w-full px-2 py-1.5 text-[11px] rounded-md appearance-none transition-all ${isEditing ? "bg-white border border-slate-200" : "bg-transparent border-transparent"}`}>
                        {AVAILABLE_ICONS.map((i) => (
                          <option key={i.name} value={i.name}>
                            {i.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                      Label
                    </label>
                    <input
                      type="text"
                      value={stat.label}
                      disabled={!isEditing || shouldLockThisRowUI}
                      onChange={(e) =>
                        updateStatField(stat.id, "label", e.target.value)
                      }
                      className={`w-full px-3 py-1.5 text-xs font-black uppercase rounded-md transition-all ${isEditing ? "bg-white border border-slate-200" : "bg-transparent border-transparent"}`}
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                      Description
                    </label>
                    <input
                      type="text"
                      value={stat.desc}
                      disabled={!isEditing || shouldLockThisRowUI}
                      onChange={(e) =>
                        updateStatField(stat.id, "desc", e.target.value)
                      }
                      className={`w-full px-3 py-1.5 text-xs rounded-md transition-all ${isEditing ? "bg-white border border-slate-200" : "bg-transparent border-transparent"}`}
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {stats.length === 0 && (
          <div className="col-span-full py-16 text-center text-slate-400 italic bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            No statistics yet. Click "Add Stat" to start.
          </div>
        )}
      </div>
    </div>
  );
}
