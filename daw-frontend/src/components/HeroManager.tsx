import { useState, useEffect, useRef, useCallback } from "react";
import { useHome, type HeroSlides } from "@/contexts/HomeContext";
import {
  Save,
  Plus,
  Trash2,
  UploadCloud,
  ImageIcon,
  Lock,
  Unlock,
  ChevronUp,
  ChevronDown,
  GripVertical,
  AlertTriangle,
  RotateCcw,
  ShieldAlert,
  Loader2,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import api, { BASE_UPLOAD_URL } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

interface EditableSlide extends Omit<HeroSlides, "id"> {
  id: string | number;
  file?: File | null;
  previewUrl?: string;
}

export default function HeroManager() {
  const { slides: initialSlides, refreshData } = useHome();
  const { user } = useAuth();

  // Identity Sync
  const isSuperadmin =
    user?.role?.toLowerCase() === "superadmin" ||
    user?.role?.toLowerCase() === "admin";
  const isEditor = user?.role?.toLowerCase() === "editor";

  // States
  const [slides, setSlides] = useState<EditableSlide[]>([]);
  const [originalSlides, setOriginalSlides] = useState<EditableSlide[]>([]);

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const [rejectedDrafts, setRejectedDrafts] = useState<any[]>([]);
  const [isOptimisticallyLocked, setIsOptimisticallyLocked] = useState(false);

  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  // Interaction Shield
  const hasLockedSlides = slides.some((s) => s.is_locked);
  const shouldLockGlobalActions =
    (hasLockedSlides || isOptimisticallyLocked) && !isSuperadmin;

  useEffect(() => {
    if (initialSlides && !isEditing) {
      const cleanSlides = initialSlides.map((s) => ({ ...s }));
      setSlides(cleanSlides);

      setOriginalSlides(initialSlides.map((s) => ({ ...s })));

      if (!initialSlides.some((s) => s.is_locked)) {
        setIsOptimisticallyLocked(false);
      }
    }
  }, [initialSlides, isEditing]);

  useEffect(() => {
    // Superadmin tidak perlu melihat banner restorasi draf
    if (isSuperadmin) return;

    const controller = new AbortController();

    const fetchRejectedDrafts = async () => {
      try {
        const promises = slides.map((s) =>
          api
            .get(`/approval/rejected/${s.id}?module=HeroSlide`, {
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
        if (err.name !== "CanceledError") {
          console.error("Gagal menarik data pemulihan:", err);
        }
      }
    };

    if (slides.length > 0 && !isEditing) {
      fetchRejectedDrafts();
    }

    return () => controller.abort();
  }, [slides.length, isEditing, isSuperadmin]);

  useEffect(() => {
    return () => {
      slides.forEach((slide) => {
        if (slide.previewUrl) {
          URL.revokeObjectURL(slide.previewUrl);
          console.log(
            `🧠 Memory Cleared: Preview for slide ${slide.id} revoked.`,
          );
        }
      });
    };
  }, []);

  const handleRestoreDraft = useCallback(
    (targetId: string | number) => {
      const draft = rejectedDrafts.find(
        (d) => String(d.target_id) === String(targetId),
      );
      if (!draft?.payload) return;

      const payload = draft.payload;

      setSlides((prev) =>
        prev.map((s) => {
          if (String(s.id) === String(targetId)) {
            return {
              ...s,
              title: payload.title ?? s.title,
              subtitle: payload.subtitle ?? s.subtitle,
              order: payload.order ?? s.order,
              imageUrl: payload.imageUrl ?? s.imageUrl,
              file: null,
              previewUrl: undefined,
              previous_notrans: draft.notrans,
            } as EditableSlide;
          }
          return s;
        }),
      );

      setIsEditing(true);
      toast.info("Draf revisi berhasil dipulihkan.");
    },
    [rejectedDrafts],
  );

  const addSlide = () => {
    setSlides([
      ...slides,
      {
        id: `new-${Date.now()}`,
        title: "",
        subtitle: "",
        imageUrl: null,
        order: slides.length,
      },
    ]);
  };

  const removeSlide = async (id: string | number) => {
    toast("Hapus Slide?", {
      description: isSuperadmin
        ? "Data akan langsung terhapus."
        : "Tindakan ini akan diajukan untuk disetujui.",
      action: {
        label: "Hapus",
        onClick: async () => {
          toast.promise(
            async () => {
              if (typeof id === "number") {
                const res = await api.delete(`/homepage/hero/${id}`);
                if (res.status === 202) {
                  setSlides((prev) =>
                    prev.map((s) =>
                      s.id === id ? { ...s, is_locked: true } : s,
                    ),
                  );
                  return "Permintaan hapus dikirim. Menunggu persetujuan.";
                }
              }

              setSlides((prev) => prev.filter((s) => s.id !== id));
              return "Slide berhasil dihapus!";
            },
            {
              loading: "Memproses...",
              success: (msg) => msg,
              error: (err) => {
                console.error("Delete error: ", err);
                return (
                  err.response?.data?.message || "Failed to delete from server"
                );
              },
            },
          );
        },
      },
      cancel: {
        label: "Cancel",
        onClick: () => console.log("Delete cancelled"),
      },
    });
  };

  const moveSlide = (index: number, direction: "up" | "down") => {
    if (shouldLockGlobalActions) {
      return toast.error("Urutan terkunci", {
        description:
          "Terdapat slide yang sedang dalam proses peninjauan.",
      });
    }

    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= slides.length) return;

    const updatedSlides = [...slides];
    [updatedSlides[index], updatedSlides[newIndex]] = [
      updatedSlides[newIndex],
      updatedSlides[index],
    ];

    // Re-index urutan secara otomatis
    setSlides(updatedSlides.map((slide, idx) => ({ ...slide, order: idx })));
  };

  const getChangedSlides = useCallback(() => {
    return slides.filter((slide) => {
      if (slide.is_locked && !isSuperadmin) return false;

      if (typeof slide.id === "string" && slide.id.startsWith("new-"))
        return true;

      const original = originalSlides.find((os) => os.id === slide.id);
      if (!original) return false;

      const isTextChanged =
        slide.title !== original.title || slide.subtitle !== original.subtitle;
      const isOrderChanged = slide.order !== original.order;
      const isImageChanged = !!slide.file;

      return isTextChanged || isOrderChanged || isImageChanged;
    });
  }, [slides, originalSlides, isSuperadmin]);

  const handleImageChange = (id: string | number, file: File) => {
    if (!file) return;

    const currentSlide = slides.find((s) => s.id === id);
    if (currentSlide?.previewUrl) URL.revokeObjectURL(currentSlide.previewUrl);

    const previewUrl = URL.createObjectURL(file);
    setSlides(
      slides.map((s) => (s.id === id ? { ...s, file, previewUrl } : s)),
    );
  };

  // --- DRAG AND DROP LOGIC ---
  const handleDragStart = (
    e: React.DragEvent<HTMLDivElement>,
    index: number,
  ) => {
    if (slides[index].is_locked && !isSuperadmin) {
      e.preventDefault();
      return toast.error("Interaksi dibatasi", {
        description: "Slide ini sedang dikunci.",
      });
    }
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnter = (
    e: React.DragEvent<HTMLDivElement>,
    index: number,
  ) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); // WAJIB ada agar elemen bisa di-drop
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDrop = (index: number) => {
    if (
      draggedIndex === null ||
      draggedIndex === index ||
      shouldLockGlobalActions
    )
      return;

    const updatedSlides = [...slides];
    const draggedItem = updatedSlides[draggedIndex];

    updatedSlides.splice(draggedIndex, 1);
    updatedSlides.splice(index, 0, draggedItem);

    const finalSlides = updatedSlides.map((slide, idx) => ({
      ...slide,
      order: idx,
    }));

    setSlides(finalSlides);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const getDisplayImageUrl = (slide: EditableSlide) => {
    if (slide.previewUrl) return slide.previewUrl;
    if (slide.imageUrl) {
      // Konsep "Split & Pop": Apapun isinya (path lengkap atau cuma nama),
      // kita hanya ambil bagian paling ujung (nama filenya).
      const filename = slide.imageUrl.split("/").pop();

      // Konsep "Sanitized Join": Pastikan base URL tidak diakhiri slash,
      // lalu kita tambahkan satu slash "/" secara manual agar konsisten.
      const cleanBase = BASE_UPLOAD_URL.replace(/\/$/, "");

      return `${cleanBase}/${filename}`;
    }
    return null;
  };

  const handleSave = async () => {
    const changedData = getChangedSlides();

    if (changedData.length === 0) {
      toast.info("Tidak ada perubahan", {
        description: "Data slide masih sama dengan versi Live.",
      });
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    const loadingToast = toast.loading(
      isSuperadmin
        ? "Menerapkan perubahan live..."
        : "Mengajukan revisi spanduk...",
    );

    try {
      const promises = changedData.map(async (slide) => {
        const isNew =
          typeof slide.id === "string" && slide.id.startsWith("new-");
        const url = isNew ? "/homepage/hero" : `/homepage/hero/${slide.id}`;

        const formData = new FormData();
        formData.append("title", slide.title);
        formData.append("subtitle", slide.subtitle);
        formData.append("order", slide.order.toString());
        formData.append("status", isSuperadmin ? "Active" : "Published");

        if ((slide as any).previous_notrans) {
          formData.append("previous_notrans", (slide as any).previous_notrans);
        }

        // 🚀 ASSET DIFFING: Hanya kirim binary gambar jika ada file baru (Hemat Bandwidth)
        if (slide.file) {
          formData.append("image", slide.file);
        }

        return isNew ? api.post(url, formData) : api.put(url, formData);
      });

      await Promise.all(promises);

      if (isEditor) setIsOptimisticallyLocked(true);

      await refreshData();
      setIsEditing(false);
      toast.success(isSuperadmin ? "Banner diperbarui!" : "Revisi diajukan!", {
        id: loadingToast,
      });
    } catch (error: any) {
      console.error(error);
      toast.error(
        error.response?.data?.message || "Gagal menyimpan perubahan",
        { id: loadingToast },
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* --- SOVEREIGN BANNERS (Contextual Awareness) --- */}
      {/* 1. Amber Banner (Superadmin Override Warning) */}
      {hasLockedSlides && isSuperadmin && (
        <div className="bg-amber-50 border border-amber-200 p-4 md:p-5 rounded-xl flex items-center gap-4 animate-in slide-in-from-top-4 shadow-sm mb-4">
          <div className="bg-amber-100 p-2 rounded-full text-amber-600 shrink-0">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs md:text-sm font-black text-amber-900 uppercase tracking-tight">
              Mode Override Aktif
            </h4>
            <p className="text-[11px] md:text-xs text-amber-700 leading-relaxed mt-0.5 max-w-2xl">
              Beberapa slide sedang dalam antrean peninjauan.{" "}
              <span className="font-bold underline">
                Direct Commit akan membatalkan draf Editor secara sepihak.
              </span>
            </p>
          </div>
        </div>
      )}

      {/* 2. Blue Banner (Editor Locked Warning) */}
      {shouldLockGlobalActions && (
        <div className="bg-blue-50 border border-blue-200 p-4 md:p-5 rounded-xl flex items-center gap-4 animate-pulse shadow-sm mb-4">
          <div className="bg-blue-100 p-2 rounded-full text-blue-600 shrink-0">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs md:text-sm font-black text-blue-900 uppercase tracking-tight">
              🔒 Interaksi Dibatasi
            </h4>
            <p className="text-[11px] md:text-xs text-blue-700 leading-relaxed mt-0.5 max-w-2xl">
              Urutan slide dan data tertentu sedang ditinjau. Anda tidak
              dapat melakukan perubahan kolektif hingga proses selesai.
            </p>
          </div>
        </div>
      )}

      {/* --- HEADER MANAGER (MATRIX BUTTONS) --- */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 border-b border-slate-100 pb-4 gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            Hero Carousel
            {hasLockedSlides && !isSuperadmin && (
              <span className="bg-blue-50 text-blue-600 border border-blue-200 text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                <Lock className="w-3 h-3" /> Ada Draf Tertunda
              </span>
            )}
          </h3>
          <p className="text-sm text-slate-500">
            Urutkan dan kelola gambar spanduk utama untuk beranda publik.
          </p>
        </div>

        <div className="flex gap-3 w-full sm:w-auto">
          {/* Edit Toggle Matrix */}
          <button
            onClick={() => {
              if (shouldLockGlobalActions) {
                return toast.error("Akses Dibatasi", {
                  description: "Data sedang dalam proses peninjauan.",
                });
              }
              setIsEditing(!isEditing);
            }}
            disabled={isSaving || shouldLockGlobalActions}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-black text-[11px] uppercase tracking-widest transition-colors border shadow-sm ${
              shouldLockGlobalActions
                ? "bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed"
                : isEditing
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

          {isEditing && !shouldLockGlobalActions && (
            <button
              onClick={() => slides.length < 5 && addSlide()}
              className="flex items-center gap-1.5 px-4 py-2 bg-daw-green/10 hover:bg-daw-green hover:text-white text-daw-green rounded-lg text-[11px] font-black uppercase tracking-widest transition-colors">
              <Plus className="w-4 h-4" /> Add Slide
            </button>
          )}

          {/* Matrix Action Button (Publish Live vs Request Approval) */}
          <button
            onClick={handleSave}
            disabled={isSaving || !isEditing || shouldLockGlobalActions}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg font-black text-[11px] uppercase tracking-widest transition-all shadow-lg active:scale-95 disabled:cursor-not-allowed disabled:shadow-none ${
              isSaving
                ? "bg-slate-300 text-slate-700"
                : shouldLockGlobalActions
                  ? "bg-slate-200 text-slate-500"
                  : isSuperadmin
                    ? "bg-daw-green hover:bg-[#003b1c] text-white shadow-daw-green/20"
                    : "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20"
            }`}>
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isSuperadmin ? (
              <Save className="w-4 h-4" />
            ) : (
              <Send className="w-4 h-4" />
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

      <div className="space-y-6">
        {slides.map((slide, index) => {
          const displayImage = getDisplayImageUrl(slide);
          const isLocked = !!slide.is_locked;

          // Row Authority Logic
          const shouldLockRowUI = isLocked && !isSuperadmin;
          const isOverrideRow = isLocked && isSuperadmin;

          const isDragging = draggedIndex === index;
          const isTargeted = dragOverIndex === index && draggedIndex !== index;

          const rejectedDraft = rejectedDrafts.find(
            (d) => String(d.target_id) === String(slide.id),
          );

          return (
            <div
              key={slide.id}
              // 🚀 KONEKSIKAN SEMUA DND HANDLERS (Cleanup unused variables)
              draggable={isEditing && !shouldLockRowUI}
              onDragStart={(e) => handleDragStart(e, index)}
              onDragEnter={(e) => handleDragEnter(e, index)}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
              onDrop={() => handleDrop(index)}
              className={`flex flex-col md:flex-row gap-6 p-5 rounded-xl border transition-all duration-300 relative overflow-hidden ${
                shouldLockRowUI
                  ? "opacity-60 grayscale-[30%] pointer-events-none bg-slate-50"
                  : isOverrideRow
                    ? "bg-amber-50/30 border-amber-200 shadow-sm"
                    : isEditing
                      ? "bg-white border-slate-200 shadow-sm"
                      : "bg-slate-50 border-slate-100"
              } ${isDragging ? "opacity-20 scale-95 border-daw-green border-dashed" : ""} ${
                isTargeted
                  ? "border-t-4 border-t-daw-green shadow-lg scale-[1.01]"
                  : ""
              }`}>
              {/* STATUS OVERLAYS */}
              {rejectedDraft && !isEditing && !isSuperadmin && (
                <div className="absolute top-0 left-0 right-0 bg-amber-500 text-white text-[10px] font-bold px-3 py-1 flex justify-between items-center z-10 animate-in slide-in-from-top-2">
                  <span className="flex items-center gap-1.5 uppercase tracking-tighter">
                    <AlertTriangle className="w-3 h-3" /> Catatan Peninjau: "
                    {rejectedDraft.rejection_reason}"
                  </span>
                  <button
                    onClick={() => handleRestoreDraft(slide.id)}
                    className="bg-white/20 hover:bg-white/30 px-2 py-0.5 rounded transition-colors pointer-events-auto">
                    <RotateCcw className="w-3 h-3 inline mr-1" /> Pulihkan Draf
                  </button>
                </div>
              )}

              {isOverrideRow && (
                <div className="absolute top-0 left-0 right-0 bg-amber-100 border-b border-amber-200 text-amber-800 text-[10px] font-black px-3 py-1 flex items-center justify-center gap-1.5 z-10 uppercase tracking-widest">
                  <ShieldAlert className="w-3 h-3 text-amber-600" /> Mode
                  Override: Sedang Ditinjau Editor
                </div>
              )}

              {shouldLockRowUI && (
                <div className="absolute top-0 left-0 right-0 bg-blue-50 border-b border-blue-100 text-blue-600 text-[10px] font-black px-3 py-1 flex items-center justify-center gap-1.5 z-10 uppercase tracking-widest">
                  <Lock className="w-3 h-3" /> Sedang Ditinjau
                </div>
              )}

              {/* SEQUENTIAL CONTROLS */}
              {isEditing && !shouldLockRowUI && (
                <div className="flex flex-row md:flex-col items-center justify-center gap-1 border-b md:border-b-0 md:border-r border-slate-100 pb-4 md:pb-0 md:pr-4 shrink-0 cursor-grab active:cursor-grabbing">
                  <button
                    onClick={() => moveSlide(index, "up")}
                    disabled={index === 0}
                    className="p-1.5 rounded-md hover:bg-slate-100 disabled:opacity-10 text-slate-500 transition-colors">
                    <ChevronUp className="w-5 h-5" />
                  </button>
                  <GripVertical className="w-5 h-5 text-slate-300" />
                  <button
                    onClick={() => moveSlide(index, "down")}
                    disabled={index === slides.length - 1}
                    className="p-1.5 rounded-md hover:bg-slate-100 disabled:opacity-10 text-slate-500 transition-colors">
                    <ChevronDown className="w-5 h-5" />
                  </button>
                </div>
              )}

              {/* ASSET AREA (IMAGE) */}
              <div
                className={`md:w-1/3 shrink-0 flex flex-col gap-2 relative mt-${(rejectedDraft || isLocked) && !isSuperadmin ? "6" : isOverrideRow ? "6" : "0"}`}>
                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest text-center mb-1">
                  Gambar Latar
                </label>
                <div
                  onClick={() =>
                    !shouldLockRowUI && fileInputRefs.current[slide.id]?.click()
                  }
                  className={`relative aspect-video rounded-lg border-2 border-dashed flex flex-col items-center justify-center overflow-hidden transition-all ${
                    !shouldLockRowUI
                      ? "cursor-pointer border-slate-300 bg-white hover:border-daw-green"
                      : "border-slate-200 bg-slate-50"
                  }`}>
                  {displayImage ? (
                    <>
                      <img
                        src={displayImage}
                        className="absolute inset-0 w-full h-full object-cover"
                        alt="Preview"
                      />
                      {!shouldLockRowUI && (
                        <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white">
                          <UploadCloud className="w-6 h-6 mb-1" />
                          <span className="text-[10px] font-bold uppercase tracking-widest">
                            Ganti Gambar
                          </span>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center">
                      <ImageIcon className="w-8 h-8 text-slate-300 mb-1 mx-auto" />
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                        Klik Upload
                      </span>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    ref={(el) => {
                      fileInputRefs.current[slide.id] = el;
                    }}
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0])
                        handleImageChange(slide.id, e.target.files[0]);
                    }}
                  />
                </div>
              </div>

              {/* CONTENT AREA */}
              <div
                className={`flex-1 flex flex-col gap-4 mt-${(rejectedDraft || isLocked) && !isSuperadmin ? "6" : isOverrideRow ? "6" : "0"}`}>
                <div className="flex justify-between items-center">
                  <span className="bg-slate-100 text-slate-500 font-black px-2 py-0.5 rounded text-[9px] uppercase tracking-widest">
                    Slide #{index + 1}
                  </span>
                  {isEditing && !shouldLockRowUI && (
                    <button
                      onClick={() => removeSlide(slide.id)}
                      className="text-slate-300 hover:text-red-500 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                      Judul Utama
                    </label>
                    <input
                      type="text"
                      value={slide.title}
                      disabled={!isEditing || shouldLockRowUI}
                      onChange={(e) =>
                        setSlides(
                          slides.map((s) =>
                            s.id === slide.id
                              ? { ...s, title: e.target.value }
                              : s,
                          ),
                        )
                      }
                      className={`w-full px-3 py-1.5 text-sm font-black rounded-lg transition-all ${
                        isEditing
                          ? "bg-white border border-slate-200 focus:ring-2 focus:ring-daw-green/10"
                          : "bg-transparent border-transparent"
                      }`}
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                      Sub-judul
                    </label>
                    <textarea
                      rows={2}
                      value={slide.subtitle}
                      disabled={!isEditing || shouldLockRowUI}
                      onChange={(e) =>
                        setSlides(
                          slides.map((s) =>
                            s.id === slide.id
                              ? { ...s, subtitle: e.target.value }
                              : s,
                          ),
                        )
                      }
                      className={`w-full px-3 py-1.5 text-xs font-medium rounded-lg transition-all resize-none ${
                        isEditing
                          ? "bg-white border border-slate-200 focus:ring-2 focus:ring-daw-green/10"
                          : "bg-transparent border-transparent"
                      }`}
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {slides.length === 0 && (
          <div className="text-center py-20 text-slate-400 italic bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            Belum ada slide. Klik “Tambah Slide Baru” untuk memulai.
          </div>
        )}
      </div>
    </div>
  );
}
