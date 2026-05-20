import React, { useState, useRef, useMemo } from "react";
import {
  Lock,
  Edit,
  Trash2,
  Plus,
  Save,
  ChevronDown,
  Target,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { useAbout } from "@/contexts/AboutContext";
import type { AchievementItem } from "@/contexts/AboutContext";
import { PhotoPreviewer } from "../AboutSharedComponents";
import { AVAILABLE_ICONS } from "../AboutConstants";
import { getCleanImageUrl } from "@/lib/utils";

interface AchievementTabProps {
  isEditing: boolean;
  isSuperadmin: boolean;
  isEditor: boolean;
}

const toSafeInputDate = (dateStr: string) => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr; // fallback to whatever string is there
  return d.toISOString().split("T")[0];
};

export default function AchievementTab({
  isEditing,
  isSuperadmin,
  isEditor,
}: AchievementTabProps) {
  const { achievements, refreshData } = useAbout();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [openIconPicker, setOpenIconPicker] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    year: "",
    title: "",
    category: "",
    iconId: "star",
    date: "",
    description: "",
    photo: null as File | null,
    removePhoto: false,
    savedPhotoUrl: null as string | null,
    originalSnapshot: null as string | null,
    previous_notrans: undefined as string | undefined,
  });

  const openModal = async (achievement: AchievementItem | null = null) => {
    // PROTEKSI: Jika ada gembok, modal tidak bisa dibuka sama sekali oleh Editor
    if (achievement?.is_locked && !isSuperadmin) {
      return toast.warning("Akses Dibatasi", {
        description:
          "Data penghargaan ini sedang dikunci karena proses approval OWL.",
      });
    }

    if (achievement) {
      setEditingId(achievement.id);
      let payload = { ...achievement };
      let draftNotrans = undefined;

      // 🔄 DATA RECOVERY FLOW (Blueprint 3)
      if (achievement.hasRejected && isEditor) {
        const loadingToast = toast.loading("Memuat draf revisi terakhir...");
        try {
          const response = await api.get(
            `/approval/rejected/${achievement.id}?module=Achievement`,
          );
          if (response.data?.success && response.data?.data?.payload) {
            const parsedPayload =
              typeof response.data.data.payload === "string"
                ? JSON.parse(response.data.data.payload)
                : response.data.data.payload;
            payload = { ...payload, ...parsedPayload };
            draftNotrans = response.data.data.notrans;

            toast.info("Memuat draf revisi terakhir yang ditolak.", {
              id: loadingToast,
            });
          } else {
            toast.dismiss(loadingToast);
          }
        } catch (error) {
          console.error("Gagal memuat draf penolakan:", error);
          toast.dismiss(loadingToast);
        }
      }

      const safeDate = toSafeInputDate(payload.date);
      setForm((prev) => ({
        ...prev,
        year: payload.year || "",
        title: payload.title || "",
        category: payload.category || "",
        iconId: payload.iconId || "star",
        date: safeDate || "",
        description: payload.description || "",
        photo: null,
        removePhoto: false,
        savedPhotoUrl: payload.imageUrl || null,
        previous_notrans: draftNotrans,
        originalSnapshot: JSON.stringify({
          year: payload.year || "",
          title: payload.title || "",
          category: payload.category || "",
          iconId: payload.iconId || "star",
          date: safeDate || "",
          description: payload.description || "",
          imageUrl: payload.imageUrl || null,
        }),
      }));
    } else {
      setEditingId(null);
      setForm({
        year: new Date().getFullYear().toString(),
        date: new Date().toISOString().split("T")[0],
        title: "",
        category: "",
        iconId: "star",
        description: "",
        photo: null,
        removePhoto: false,
        savedPhotoUrl: null,
        originalSnapshot: null,
        previous_notrans: undefined,
      });
    }

    setIsModalOpen(true);
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setForm((prev) => ({ ...prev, photo: file, removePhoto: false }));
    }
  };

  const hasDataChanged = useMemo(() => {
    if (!editingId) return true; // Data baru
    if (!form.originalSnapshot) return true;
    if (form.photo || form.removePhoto) return true;

    const currentData = {
      year: form.year.trim(),
      title: form.title.trim(),
      category: form.category.trim(),
      iconId: form.iconId,
      date: form.date.trim(),
      description: form.description.trim(),
      imageUrl: form.savedPhotoUrl,
    };

    return JSON.stringify(currentData) !== form.originalSnapshot;
  }, [form, editingId]);

  const saveAchievement = async (e: React.FormEvent) => {
    e.preventDefault();

    if (
      !form.year.trim() ||
      !form.title.trim() ||
      !form.category.trim() ||
      !form.date.trim() ||
      !form.description.trim()
    ) {
      return toast.error("Lengkapi semua kolom wajib.");
    }

    if (!hasDataChanged) {
      return toast.info("Tidak ada perubahan yang perlu disimpan.");
    }

    setIsSaving(true);
    const loadingToast = toast.loading("Menyimpan penghargaan...");

    const formData = new FormData();
    formData.append("year", form.year.trim());
    formData.append("title", form.title.trim());
    formData.append("category", form.category.trim());
    formData.append("iconId", form.iconId);
    formData.append("date", form.date.trim());
    formData.append("description", form.description.trim());

    if (form.removePhoto) formData.append("removePhoto", "true");
    if (form.photo) formData.append("image", form.photo); // achievementRoutes expects 'image'

    // Inject Editor status for approval workflow
    if (isEditor) {
      formData.append("status", "Published");
      if (form.previous_notrans) {
        formData.append("previous_notrans", form.previous_notrans);
      }
    }

    try {
      if (editingId) {
        await api.put(`/achievements/${editingId}`, formData, {
          timeout: 60000,
        });
      } else {
        await api.post("/achievements", formData, { timeout: 60000 });
      }

      await refreshData();
      toast.success("Penghargaan berhasil disimpan!", { id: loadingToast });
      setIsModalOpen(false);
    } catch (error: any) {
      toast.error(
        error.response?.data?.message || "Terjadi kesalahan sistem.",
        { id: loadingToast },
      );
    } finally {
      setIsSaving(false);
    }
  };

  const deleteAchievement = (id: number) => {
    toast("Konfirmasi Hapus", {
      description: "Anda yakin ingin menghapus penghargaan ini permanen?",
      action: {
        label: "Hapus",
        onClick: async () => {
          const loadingToast = toast.loading("Memproses...");
          try {
            await api.delete(`/achievements/${id}`, { timeout: 60000 });
            await refreshData(); // Optimistic data update
            toast.success("Penghargaan dihapus!", { id: loadingToast });
          } catch (error: any) {
            toast.error(error.response?.data?.message || "Gagal menghapus", {
              id: loadingToast,
            });
          }
        },
      },
    });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300 relative">
      {/* REJECTION RIBBON (Blueprint 3) */}
      {isEditor && achievements.some((item) => item.hasRejected) && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3 text-red-700 shadow-sm">
          <div className="p-2 bg-red-100 rounded-lg">
            <svg
              className="w-5 h-5 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
          </div>
          <div className="flex-1">
            <h4 className="font-bold">Draf Ditolak</h4>
            <p className="text-sm text-red-600/80">
              Satu atau lebih draf yang Anda ajukan telah ditolak oleh Approver.
              Silakan klik tombol <b>'Edit'</b> pada baris dengan label merah{" "}
              <span className="inline-block px-1.5 py-0.5 mx-1 rounded text-[10px] font-bold bg-red-100 text-red-600 border border-red-200">
                Ditolak
              </span>{" "}
              untuk melihat revisi terakhir yang ditolak, lalu perbaiki atau
              buang draf tersebut.
            </p>
          </div>
        </div>
      )}

      {/* HEADER */}
      <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-4">
        <div>
          <h3 className="font-bold text-slate-900 text-lg">
            Awards & Accolades
          </h3>
          <p className="text-sm text-slate-500">
            Kelola daftar penghargaan dan sertifikasi resmi korporat.
          </p>
        </div>
        {isEditing && (
          <button
            onClick={() => openModal()}
            className="flex items-center gap-1.5 px-4 py-2 bg-daw-green hover:bg-[#003b1c] text-white rounded-lg text-sm font-bold transition-colors shadow-sm active:scale-95">
            <Plus className="w-4 h-4" /> Add Achievement
          </button>
        )}
      </div>

      {/* TABLE LIST */}
      <div className="overflow-x-auto border border-slate-200 rounded-lg bg-white shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500 font-bold">
              <th className="px-6 py-4 w-16">Visual</th>
              <th className="px-6 py-4">Title & Category</th>
              <th className="px-6 py-4 text-center">Year</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {achievements.map((item) => {
              const isRowLocked = item.is_locked && !isSuperadmin;
              const lockStyles =
                "opacity-60 grayscale-[30%] bg-slate-50 pointer-events-none select-none";

              const SelectedIcon =
                AVAILABLE_ICONS.find((i) => i.id === item.iconId)?.icon ||
                Target;

              return (
                <tr
                  key={item.id}
                  className={`transition-colors ${isRowLocked ? lockStyles : "hover:bg-slate-50/50"}`}>
                  <td className="px-6 py-4 text-center">
                    {item.imageUrl ? (
                      <div className="w-10 h-10 rounded-md overflow-hidden border border-slate-200 bg-white shadow-sm mx-auto">
                        <img
                          src={getCleanImageUrl(item.imageUrl)}
                          alt={item.title}
                          className="w-full h-full object-cover bg-slate-50"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = ""; // Clear src to trigger fallback rendering (using css/parent if needed) but simple way is just replace with div later.
                            (e.target as HTMLElement).parentElement!.innerHTML =
                              '<div class="w-full h-full flex items-center justify-center bg-slate-100 text-slate-400"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="1" y1="1" x2="23" y2="23"></line><path d="M21 21H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3m3-3h6l2 3h4a2 2 0 0 1 2 2v9.34m-7.72-2.06a4 4 0 1 1-5.56-5.56"></path></svg></div>';
                          }}
                        />
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-md bg-slate-100 flex items-center justify-center text-slate-400 border border-slate-200 mx-auto">
                        <SelectedIcon className="w-5 h-5 text-daw-green opacity-70" />
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-slate-900">
                        {item.title}
                      </p>
                      {item.hasRejected && isEditor && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-600 border border-red-200">
                          Ditolak
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest mt-1">
                      {item.category}
                    </p>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="inline-flex items-center px-2 py-1 rounded text-xs font-black bg-slate-100 text-slate-700">
                      {item.year}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {isRowLocked ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-100 uppercase tracking-widest">
                        <Lock className="w-3 h-3" /> Terkunci
                      </span>
                    ) : isEditing ? (
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openModal(item)}
                          className="p-2 rounded-lg transition-colors border text-slate-400 bg-white border-slate-200 hover:text-daw-green hover:border-daw-green"
                          title="Edit Data">
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteAchievement(item.id)}
                          className="p-2 text-slate-400 bg-white border border-slate-200 hover:text-red-600 hover:border-red-600 rounded-lg transition-colors"
                          title="Hapus Permanen">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-300 italic flex justify-end">
                        Mode Baca
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}

            {achievements.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="px-6 py-12 text-center text-slate-500 text-sm border-2 border-dashed border-slate-200 bg-slate-50">
                  Belum ada data penghargaan. <br /> Klik{" "}
                  <b>'Add Achievement'</b> untuk memulai.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL: CREATE / EDIT ACHIEVEMENT */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
              <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
                {editingId ? (
                  <Edit className="w-5 h-5 text-daw-green" />
                ) : (
                  <Plus className="w-5 h-5 text-daw-green" />
                )}
                {editingId ? "Edit Penghargaan" : "Tambah Penghargaan Baru"}
              </h3>
              <div className="flex items-center gap-2">
                {editingId &&
                  isEditor &&
                  achievements.find((a) => a.id === editingId)?.hasRejected &&
                  form.previous_notrans && (
                    <button
                      type="button"
                      onClick={async () => {
                        if (!form.previous_notrans) return;
                        const loading = toast.loading("Membuang draf...");
                        try {
                          await api.patch("/approval/discard", {
                            notrans: form.previous_notrans,
                          });
                          await refreshData();
                          setIsModalOpen(false);
                          toast.success("Draf dibuang & gembok dibuka.", {
                            id: loading,
                          });
                        } catch (e) {
                          toast.error("Gagal membuang draf.", { id: loading });
                        }
                      }}
                      className="text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-md transition-colors border border-red-200">
                      Buang Draf Ditolak
                    </button>
                  )}
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 p-1.5 rounded-md transition-colors">
                  ✕
                </button>
              </div>
            </div>

            <div className="overflow-y-auto p-6">
              <form
                id="achievement-form"
                onSubmit={saveAchievement}
                className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      Title / Headline
                    </label>
                    <input
                      required
                      type="text"
                      value={form.title}
                      onChange={(e) =>
                        setForm({ ...form, title: e.target.value })
                      }
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-daw-green/20 transition-all text-sm"
                      placeholder="Contoh: CSR Excellence Award"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      Kategori
                    </label>
                    <input
                      required
                      type="text"
                      value={form.category}
                      onChange={(e) =>
                        setForm({ ...form, category: e.target.value })
                      }
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-daw-green/20 transition-all text-sm"
                      placeholder="Contoh: Sustainability"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      Tahun
                    </label>
                    <input
                      required
                      type="text"
                      value={form.year}
                      onChange={(e) =>
                        setForm({ ...form, year: e.target.value })
                      }
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-daw-green/20 transition-all text-sm"
                      placeholder="2026"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      Tanggal Spesifik
                    </label>
                    <input
                      required
                      type="date"
                      value={form.date}
                      onChange={(e) => {
                        const newDate = e.target.value;
                        const yearFromDate = newDate
                          ? newDate.split("-")[0]
                          : form.year;
                        setForm({ ...form, date: newDate, year: yearFromDate });
                      }}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-daw-green/20 transition-all text-sm"
                    />
                  </div>
                  <div className="relative">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      Ikon (Fallback)
                    </label>
                    <button
                      type="button"
                      onClick={() => setOpenIconPicker(!openIconPicker)}
                      className="flex items-center justify-between w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-daw-green/20">
                      <div className="flex items-center gap-2">
                        {React.createElement(
                          AVAILABLE_ICONS.find((i) => i.id === form.iconId)
                            ?.icon || Target,
                          { className: "w-4 h-4 text-slate-500" },
                        )}
                        <span>
                          {
                            AVAILABLE_ICONS.find((i) => i.id === form.iconId)
                              ?.label
                          }
                        </span>
                      </div>
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    </button>
                    {openIconPicker && (
                      <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden max-h-48 overflow-y-auto">
                        {AVAILABLE_ICONS.map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => {
                              setForm({ ...form, iconId: opt.id });
                              setOpenIconPicker(false);
                            }}
                            className="flex items-center gap-3 w-full px-3 py-2.5 text-left text-sm hover:bg-slate-50">
                            <opt.icon className="w-4 h-4 text-slate-400" />{" "}
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Deskripsi
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={form.description}
                    onChange={(e) =>
                      setForm({ ...form, description: e.target.value })
                    }
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-daw-green/20 resize-none transition-all text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Visual Sertifikat / Trofi (Opsional)
                  </label>
                  <div className="flex items-center gap-5 p-4 border border-slate-100 bg-slate-50/50 rounded-xl">
                    <PhotoPreviewer
                      file={form.photo}
                      savedUrl={form.removePhoto ? null : form.savedPhotoUrl}
                    />
                    <div className="flex flex-col gap-3 w-full">
                      <input
                        type="file"
                        accept="image/jpeg, image/png, image/webp"
                        ref={fileInputRef}
                        onChange={handlePhotoChange}
                        className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-bold file:bg-daw-green/10 file:text-daw-green hover:file:bg-daw-green/20 transition-colors cursor-pointer"
                      />
                      {(form.photo ||
                        (form.savedPhotoUrl && !form.removePhoto)) && (
                        <button
                          type="button"
                          onClick={() => {
                            setForm({
                              ...form,
                              photo: null,
                              removePhoto: true,
                            });
                            if (fileInputRef.current)
                              fileInputRef.current.value = "";
                          }}
                          className="text-[10px] font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 w-max px-3 py-1.5 rounded-md transition-colors flex items-center gap-1">
                          <Trash2 className="w-3.5 h-3.5" /> Hapus Visual Saat
                          Ini
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </form>
            </div>

            <div className="px-6 py-4 flex justify-end gap-3 border-t border-slate-100 bg-slate-50 shrink-0">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-5 py-2.5 rounded-lg font-bold text-sm text-slate-600 hover:bg-slate-200 transition-colors">
                Batal
              </button>
              <button
                form="achievement-form"
                type="submit"
                disabled={isSaving || !hasDataChanged}
                className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-black text-[11px] uppercase tracking-widest transition-all shadow-lg active:scale-95 disabled:cursor-not-allowed disabled:shadow-none bg-daw-green hover:bg-[#003b1c] text-white shadow-daw-green/20">
                {isSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <span>{isSaving ? "Menyimpan..." : "Simpan Data"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
