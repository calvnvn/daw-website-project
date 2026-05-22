import { useState, useEffect, useCallback, useRef } from "react";
import { useHome, type ImpactStats } from "@/contexts/HomeContext";
import HomeLivePreview from "./HomeLivePreview";
import { useAuth } from "@/contexts/AuthContext";
import {
  Save,
  Plus,
  Trash2,
  Lock,
  Unlock,
  AlertTriangle,
  RotateCcw,
  XCircle,
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

export default function StatsManager({ mode = "edit" }: { mode?: "edit" | "preview" }) {
  const { stats: initialStats, refreshData, rejectedStatsMap } = useHome();
  const { user } = useAuth();

  const isSuperadmin = user?.role === "superadmin" || user?.role === "admin";
  const isEditor = user?.role?.toLowerCase() === "editor";

  // States
  const [stats, setStats] = useState<ImpactStats[]>([]);
  const [originalStats, setOriginalStats] = useState<ImpactStats[]>([]);

  const [restoredTickets, setRestoredTickets] = useState<
    Record<string, string>
  >({});

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const hasLockedItems = stats.some((s) => s.is_locked);

  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

  // 1. SINKRONISASI DATA & SNAPSHOTTING
  useEffect(() => {
    if (initialStats && !isEditing) {
      const cleanStats = initialStats.map((s) => ({ ...s }));
      setStats(cleanStats);
      setOriginalStats(cleanStats);
      setRestoredTickets({}); // Reset tracker saat data sinkron
    }
  }, [initialStats, isEditing]);

  // 2. RESTORATION ENGINE (Anti-Corruption Guard)
  const handleRestoreDraft = useCallback(
    (targetId: string | number) => {
      const draft = rejectedStatsMap[String(targetId)];
      if (!draft?.payload) return;

      let payloadObj = draft.payload;
      if (typeof payloadObj === "string") {
        try {
          payloadObj = JSON.parse(payloadObj);
        } catch (error) {
          console.error("🚨 [Anti-Corruption] Gagal parse draf:", error);
          return toast.error("Data draf korup.");
        }
      }

      setStats((prev) =>
        prev.map((s) => {
          if (String(s.id) === String(targetId)) {
            return {
              ...s,
              icon: payloadObj.icon ?? s.icon,
              value: payloadObj.value ?? s.value,
              label: payloadObj.label ?? s.label,
              desc: payloadObj.desc ?? s.desc,
              order: payloadObj.order ?? s.order,
            } as ImpactStats;
          }
          return s;
        }),
      );

      setRestoredTickets((prev) => ({
        ...prev,
        [targetId]: draft.notrans,
      }));

      setIsEditing(true);
      toast.info("Draf dipulihkan ke form", {
        description: "Silakan perbaiki data dan klik Save/Request.",
      });
    },
    [rejectedStatsMap],
  );

  // 3. DISCARD LOGIC (Ghost Cleanup Lanjutan)
  const handleDiscardDraft = async (targetId: string | number) => {
    const draft = rejectedStatsMap[String(targetId)];
    if (!draft?.notrans) return;

    toast("Abaikan Notifikasi?", {
      description: "Draf penolakan ini akan dihapus secara permanen.",
      action: {
        label: "Abaikan",
        onClick: async () => {
          const toastId = toast.loading("Membersihkan draf...");
          try {
            await api.patch("/approval/discard", { notrans: draft.notrans });
            toast.success("Notifikasi berhasil diabaikan.", { id: toastId });
            await refreshData(); // Flush Global State
          } catch (error: any) {
            toast.error("Gagal mengabaikan draf.", {
              description: error.response?.data?.message || "Kesalahan server.",
              id: toastId,
            });
          }
        },
      },
      cancel: { label: "Batal", onClick: () => {} },
    });
  };

  // 4. GRANULAR DRAG AND DROP HANDLERS
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
    if (stats[index]?.is_locked && !isSuperadmin) {
      return toast.error("Akses Dibatasi", {
        description: "Statistik ini sedang dalam antrean peninjauan.",
      });
    }
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  const handleDrop = (index: number) => {
    if (draggedIndex === null) return;
    if (stats[index]?.is_locked && !isSuperadmin) {
      toast.error("Posisi Terkunci", {
        description: "Tidak dapat menggeser ke area item yang terkunci.",
      });
      setDraggedIndex(null);
      return;
    }
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

  // 5. ACTION GUARDS (Blueprint 3.1)
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
    const targetStat = stats.find((s) => s.id === id);
    if (targetStat?.is_locked && !isSuperadmin) {
      return toast.error("Akses Terbatas", {
        description: "Item ini sedang dalam proses peninjauan.",
      });
    }

    toast("Hapus data statistik ini?", {
      description: isSuperadmin
        ? "Data akan dihapus secara permanen."
        : "Pengajuan hapus akan dikirim.",
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

  // 6. ROBUST DIFF ENGINE
  const getChangedStats = useCallback(() => {
    return stats.filter((stat) => {
      if (stat.is_locked && !isSuperadmin) return false;

      if (typeof stat.id === "string" && stat.id.startsWith("new-"))
        return true;

      const original = originalStats.find(
        (s) => String(s.id) === String(stat.id),
      );
      if (!original) return false;

      return (
        stat.icon !== original.icon ||
        stat.value !== original.value ||
        stat.label !== original.label ||
        stat.desc !== original.desc ||
        stat.order !== original.order
      );
    });
  }, [stats, originalStats, isSuperadmin]);

  // 7. PARTIAL SYNC RESILIENCE SUBMISSION
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
      isSuperadmin ? "Menerapkan perubahan live..." : "Mengajukan revisi...",
    );

    abortControllerRef.current = new AbortController();

    try {
      const promises = changedData.map((stat) => {
        const isNew = typeof stat.id === "string" && stat.id.startsWith("new-");
        const url = isNew ? "/homepage/stats" : `/homepage/stats/${stat.id}`;

        const payload: any = {
          icon: stat.icon,
          value: stat.value,
          label: stat.label,
          desc: stat.desc,
          order: stat.order,
          status: isSuperadmin ? "Active" : "Published",
        };

        if (restoredTickets[stat.id] && isEditor) {
          payload.previous_notrans = restoredTickets[stat.id];
        }

        return isNew
          ? api.post(url, payload, {
              signal: abortControllerRef.current?.signal,
            })
          : api.put(url, payload, {
              signal: abortControllerRef.current?.signal,
            });
      });

      const results = await Promise.allSettled(promises);

      const successfulIds: (string | number)[] = [];
      let failCount = 0;

      results.forEach((result, index) => {
        if (result.status === "fulfilled") {
          successfulIds.push(changedData[index].id);
        } else {
          failCount++;
          console.error(
            `🚨 Gagal simpan ID ${changedData[index].id}:`,
            result.reason,
          );
        }
      });

      if (isEditor && successfulIds.length > 0) {
        setStats((prev) =>
          prev.map((s) =>
            successfulIds.includes(s.id) ? { ...s, is_locked: true } : s,
          ),
        );
      }

      await refreshData();

      if (failCount === 0) {
        toast.success(
          isSuperadmin
            ? "Statistik diperbarui secara live!"
            : "Semua revisi berhasil diajukan!",
          { id: loadingToast },
        );
        setIsEditing(false);
      } else {
        toast.warning(
          `Berhasil menyimpan ${successfulIds.length} item. ${failCount} item gagal.`,
          {
            id: loadingToast,
            description:
              "Silakan periksa koneksi dan coba simpan ulang item yang gagal.",
          },
        );
      }
    } catch (error: any) {
      if (error.name === "CanceledError") return;
      console.error("Critical Save Error:", error);
      toast.error("Terjadi kesalahan fatal saat menyimpan.", {
        id: loadingToast,
      });
    } finally {
      setIsSaving(false);
    }
  };
  if (mode === "preview") {
    return <HomeLivePreview type="stats" data={stats} />;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* HEADER (MATRIX BUTTONS) */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 border-b border-slate-100 pb-4 gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            Impact Statistics
            {/* Global Warning: Jika ada item terkunci tapi bukan Admin */}
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
          {/* Edit Toggle Button (Tidak Terkunci Secara Global di V4.0) */}
          <button
            onClick={() => setIsEditing(!isEditing)}
            disabled={isSaving}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-bold text-[11px] uppercase tracking-widest transition-colors border shadow-sm ${
              isEditing
                ? "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}>
            {isEditing ? (
              <Unlock className="w-4 h-4 text-amber-500" />
            ) : (
              <Lock className="w-4 h-4 text-slate-400" />
            )}
            <span>{isEditing ? "Editing Mode" : "Locked"}</span>
          </button>

          {/* Add Stat Button - Bebas menambah meskipun ada item lain yang dikunci */}
          {isEditing && stats.length < 4 && (
            <button
              onClick={addStat}
              className="flex items-center gap-1.5 px-4 py-2 bg-daw-green/10 hover:bg-daw-green hover:text-white text-daw-green rounded-lg text-[11px] font-bold uppercase tracking-widest transition-colors">
              <Plus className="w-4 h-4" /> Add Stat
            </button>
          )}

          {/* Matrix Save Button */}
          <button
            onClick={handleSave}
            disabled={isSaving || !isEditing}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2 rounded-lg font-bold text-[11px] uppercase tracking-widest transition-all shadow-lg active:scale-95 disabled:cursor-not-allowed disabled:shadow-none ${
              isSaving
                ? "bg-slate-300 text-slate-700"
                : isSuperadmin
                  ? "bg-daw-green hover:bg-[#003b1c] text-white shadow-daw-green/20"
                  : "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20"
            }`}>
            {isSaving ? (
              <Icons.Loader2 className="w-4 h-4 animate-spin" />
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

      {/* GRID LIST (The Bureaucratic Mirror) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {stats.map((stat, index) => {
          const IconComponent = (Icons as any)[stat.icon] || Icons.HelpCircle;
          const isDragging = draggedIndex === index;
          const isLocked = !!stat.is_locked;

          // 🛡️ Otoritas Baris (Granular Isolation)
          const shouldLockThisRowUI = isLocked && !isSuperadmin;
          const isOverrideThisRow = isLocked && isSuperadmin;

          // Cek apakah item ini punya draf ditolak
          const rejectedDraft = rejectedStatsMap[String(stat.id)];

          // 🎨 Semantic Styling Engine
          let cardStyle = "bg-slate-50 border-slate-100";
          if (shouldLockThisRowUI) {
            // Blue/Slate untuk Pending Update
            cardStyle =
              "opacity-60 bg-blue-50/50 border-blue-100 pointer-events-none select-none";
          } else if (isOverrideThisRow) {
            // Amber untuk Admin Override
            cardStyle =
              "bg-amber-50/50 border-amber-200 shadow-sm border-l-4 border-l-amber-500";
          } else if (rejectedDraft && !isSuperadmin) {
            // Red/Crimson untuk Rejected Needs Revision (Jika Editor sedang tidak Edit)
            cardStyle =
              "bg-red-50/30 border-red-200 border-l-4 border-l-red-500";
          } else if (isEditing) {
            cardStyle =
              "bg-white border-slate-200 shadow-sm cursor-grab active:cursor-grabbing";
          }

          return (
            <div
              key={stat.id}
              draggable={isEditing && !shouldLockThisRowUI}
              onDragStart={() => handleDragStart(index)}
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(index)}
              onDragEnd={() => setDraggedIndex(null)}
              className={`flex gap-4 items-start p-5 rounded-xl border transition-all duration-300 relative overflow-hidden ${cardStyle} ${isDragging ? "opacity-30 scale-95 border-daw-green border-dashed" : ""}`}>
              {/* 1. REJECTION BANNER (Prioritas Tertinggi untuk Editor) */}
              {rejectedDraft && !isSuperadmin && (
                <div className="absolute top-0 left-0 right-0 bg-red-500 text-white text-[10px] font-bold px-3 py-1.5 flex justify-between items-center z-10 animate-in slide-in-from-top-2">
                  <span className="flex items-center gap-1.5 uppercase tracking-tighter truncate max-w-[60%]">
                    <AlertTriangle className="w-3 h-3 shrink-0" /> Revisi
                    Ditolak: "{rejectedDraft.rejection_reason}"
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleRestoreDraft(stat.id)}
                      className="bg-white/20 hover:bg-white/30 px-2 py-0.5 rounded transition-colors pointer-events-auto">
                      <RotateCcw className="w-3 h-3 inline mr-1" /> Pulihkan
                    </button>
                    {/* Ghost Cleanup Button */}
                    <button
                      onClick={() => handleDiscardDraft(stat.id)}
                      className="text-white/80 hover:text-white px-1 py-0.5 rounded transition-colors pointer-events-auto"
                      title="Abaikan Notifikasi">
                      <XCircle className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* 2. OVERRIDE BANNER (Khusus Admin) */}
              {isOverrideThisRow && (
                <div className="absolute top-0 left-0 right-0 bg-amber-100 border-b border-amber-200 text-amber-800 text-[10px] font-bold px-3 py-1 flex items-center justify-center gap-1.5 z-10 uppercase tracking-widest">
                  <Icons.ShieldAlert className="w-3 h-3 text-amber-600" /> Mode
                  Override: Sedang Ditinjau Editor
                </div>
              )}

              {/* 3. PENDING BANNER (Birokrasi Mengunci Editor) */}
              {shouldLockThisRowUI && !rejectedDraft && (
                <div className="absolute top-0 left-0 right-0 bg-blue-100 border-b border-blue-200 text-blue-700 text-[10px] font-bold px-3 py-1 flex items-center justify-center gap-1.5 z-10 uppercase tracking-widest">
                  <Lock className="w-3 h-3" /> Akses Dibatasi (Menunggu
                  Persetujuan)
                </div>
              )}

              {/* CONTENT AREA */}
              <div
                className={`flex w-full gap-4 mt-${rejectedDraft || isLocked || isOverrideThisRow ? "6" : "0"} transition-all`}>
                {/* Orders Control (Drag Handles) */}
                {isEditing && (
                  <div
                    className={`flex flex-col items-center gap-1 pr-2 border-r border-slate-100 pt-1 shrink-0 ${shouldLockThisRowUI ? "opacity-20" : ""}`}>
                    <button
                      onClick={() =>
                        !shouldLockThisRowUI &&
                        index > 0 &&
                        reorderStats(index, index - 1)
                      }
                      disabled={index === 0 || shouldLockThisRowUI}
                      className="p-1 hover:bg-slate-100 rounded disabled:opacity-10 pointer-events-auto">
                      <Icons.ChevronUp className="w-4 h-4 text-slate-500" />
                    </button>
                    <Icons.GripVertical className="w-4 h-4 text-slate-300 cursor-grab" />
                    <button
                      onClick={() =>
                        !shouldLockThisRowUI &&
                        index < stats.length - 1 &&
                        reorderStats(index, index + 1)
                      }
                      disabled={
                        index === stats.length - 1 || shouldLockThisRowUI
                      }
                      className="p-1 hover:bg-slate-100 rounded disabled:opacity-10 pointer-events-auto">
                      <Icons.ChevronDown className="w-4 h-4 text-slate-500" />
                    </button>
                  </div>
                )}

                {/* ICON AREA */}
                <div className="w-16 shrink-0">
                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1 text-center">
                    Icon
                  </label>
                  <div
                    className={`aspect-square rounded-lg border flex items-center justify-center shadow-sm ${isOverrideThisRow ? "bg-amber-50 border-amber-200 text-amber-600" : "bg-white border-slate-200 text-daw-green"}`}>
                    <IconComponent className="w-7 h-7 stroke-[1.5px]" />
                  </div>
                </div>

                {/* DETAILS AREA */}
                <div className="flex-1 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      Statistic #{index + 1}
                      {typeof stat.id === "string" &&
                        stat.id.startsWith("new-") && (
                          <span className="ml-2 text-daw-green italic">
                            (New)
                          </span>
                        )}
                    </span>

                    {/* Delete Button (Hanya jika tidak terkunci atau Admin) */}
                    {isEditing && !shouldLockThisRowUI && (
                      <button
                        onClick={() => removeStat(stat.id)}
                        className="text-slate-300 hover:text-red-500 transition-colors pointer-events-auto z-10 relative">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                        Value
                      </label>
                      <input
                        type="text"
                        value={stat.value || ""}
                        disabled={!isEditing || shouldLockThisRowUI}
                        onChange={(e) =>
                          updateStatField(stat.id, "value", e.target.value)
                        }
                        className={`w-full px-3 py-1.5 text-sm font-bold rounded-md transition-all ${isEditing && !shouldLockThisRowUI ? "bg-white border border-slate-200 focus:ring-2 focus:ring-daw-green/10" : "bg-transparent border-transparent"}`}
                        placeholder="E.g., 500+"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                        Select Icon
                      </label>
                      <select
                        value={stat.icon}
                        disabled={!isEditing || shouldLockThisRowUI}
                        onChange={(e) =>
                          updateStatField(stat.id, "icon", e.target.value)
                        }
                        className={`w-full px-2 py-1.5 text-[11px] font-medium rounded-md appearance-none transition-all ${isEditing && !shouldLockThisRowUI ? "bg-white border border-slate-200" : "bg-transparent border-transparent"}`}>
                        {AVAILABLE_ICONS.map((i) => (
                          <option key={i.name} value={i.name}>
                            {i.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                      Label
                    </label>
                    <input
                      type="text"
                      value={stat.label || ""}
                      disabled={!isEditing || shouldLockThisRowUI}
                      onChange={(e) =>
                        updateStatField(stat.id, "label", e.target.value)
                      }
                      className={`w-full px-3 py-1.5 text-xs font-bold uppercase tracking-wide rounded-md transition-all ${isEditing && !shouldLockThisRowUI ? "bg-white border border-slate-200 focus:ring-2 focus:ring-daw-green/10" : "bg-transparent border-transparent"}`}
                      placeholder="E.g., Global Projects"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                      Description
                    </label>
                    <input
                      type="text"
                      value={stat.desc || ""}
                      disabled={!isEditing || shouldLockThisRowUI}
                      onChange={(e) =>
                        updateStatField(stat.id, "desc", e.target.value)
                      }
                      className={`w-full px-3 py-1.5 text-[11px] rounded-md transition-all ${isEditing && !shouldLockThisRowUI ? "bg-white border border-slate-200 focus:ring-2 focus:ring-daw-green/10" : "bg-transparent border-transparent"}`}
                      placeholder="Short description here..."
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {/* Empty State */}
        {stats.length === 0 && (
          <div className="col-span-full py-16 text-center text-slate-400 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center">
            <Icons.BarChart3 className="w-10 h-10 text-slate-300 mb-3" />
            <p className="font-bold text-slate-500 uppercase tracking-widest text-xs">
              Belum ada statistik
            </p>
            <p className="text-xs mt-1">
              Aktifkan Editing Mode dan klik "Add Stat" untuk mulai menambahkan.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
