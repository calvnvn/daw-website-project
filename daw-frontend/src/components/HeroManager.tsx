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

  const isSuperadmin =
    user?.role?.toLowerCase() === "superadmin" ||
    user?.role?.toLowerCase() === "admin";
  const isEditor = user?.role?.toLowerCase() === "editor";

  const [slides, setSlides] = useState<EditableSlide[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const [rejectedDrafts, setRejectedDrafts] = useState<any[]>([]);
  const [isOptimisticallyLocked, setIsOptimisticallyLocked] = useState(false);

  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  useEffect(() => {
    if (initialSlides) {
      setSlides(initialSlides.map((s) => ({ ...s })));
    }
  }, [initialSlides]);

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
    const slide = slides[index];
    if (slide.is_locked && !isSuperadmin) {
      return toast.error("Slide terkunci", {
        description: "Sedang dalam proses peninjauan.",
      });
    }

    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= slides.length) return;

    const updatedSlides = [...slides];

    [updatedSlides[index], updatedSlides[newIndex]] = [
      updatedSlides[newIndex],
      updatedSlides[index],
    ];

    const finalSlides = updatedSlides.map((slide, idx) => ({
      ...slide,
      order: idx,
    }));

    setSlides(finalSlides);
  };

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
    if (draggedIndex === null || draggedIndex === index) return;

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
    setIsSaving(true);
    setIsOptimisticallyLocked(true);
    const loadingToast = toast.loading(
      isEditor ? "Mengajukan revisi..." : "Menyimpan perubahan...",
    );

    try {
      const changedSlides = slides.filter((slide) => {
        if (slide.is_locked) return false;

        if (typeof slide.id === "string" && slide.id.startsWith("new-"))
          return true;

        const original = initialSlides.find((os) => os.id === slide.id);
        if (!original) return false;

        const isTextChanged =
          slide.title !== original.title ||
          slide.subtitle !== original.subtitle;
        const isOrderChanged = slide.order !== original.order;
        const isImageChanged = !!slide.file;

        return isTextChanged || isOrderChanged || isImageChanged;
      });

      if (changedSlides.length === 0) {
        toast.dismiss(loadingToast);
        toast.info("Tidak ada perubahan", {
          description: "Semua slide masih sama dengan versi Live.",
        });
        setIsEditing(false);
        return;
      }

      const promises = changedSlides.map(async (slide) => {
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

        if (slide.file) formData.append("image", slide.file);

        return isNew ? api.post(url, formData) : api.put(url, formData);
      });

      await Promise.all(promises);
      setIsOptimisticallyLocked(false);

      if (isEditor) {
        const changedIds = changedSlides.map((s) => s.id);
        setSlides((prev) =>
          prev.map((s) =>
            changedIds.includes(s.id) ? { ...s, is_locked: true } : s,
          ),
        );
      }

      await refreshData();
      toast.success(
        isSuperadmin ? "Slide berhasil diperbarui!" : "Revisi diajukan!",
        { id: loadingToast },
      );
      setIsEditing(false);
    } catch (error: any) {
      console.error(error);
      setIsOptimisticallyLocked(false);
      toast.error(
        error.response?.data?.message || "Gagal menyimpan perubahan",
        { id: loadingToast },
      );
    } finally {
      setIsSaving(false);
    }
  };

  const hasLockedSlides = slides.some((s) => s.is_locked);
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* --- HEADER MANAGER --- */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 border-b border-slate-100 pb-4 gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            Slide Banner Utama
            {hasLockedSlides && !isSuperadmin && (
              <span className="bg-blue-50 text-blue-600 border border-blue-200 text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1">
                <Lock className="w-3 h-3" /> Ada Draf Tertunda
              </span>
            )}
          </h3>
          <p className="text-sm text-slate-500">
            Upload gambar berkualitas tinggi dan tuliskan judul yang menarik
            untuk spanduk depan.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => {
              if (hasLockedSlides && !isEditing && !isSuperadmin) {
                toast.warning("Akses Dibatasi", {
                  description:
                    "Beberapa slide sedang ditinjau. Anda hanya bisa mengedit slide yang tidak terkunci.",
                });
              }
              setIsEditing(!isEditing);
            }}
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
            <span>{isEditing ? "Editing Mode" : "Locked"}</span>
          </button>

          {isEditing && (
            <button
              onClick={addSlide}
              disabled={isSaving || isOptimisticallyLocked}
              className="flex items-center gap-1.5 px-4 py-2 bg-daw-green/10 hover:bg-daw-green hover:text-white text-daw-green disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-bold transition-colors">
              <Plus className="w-4 h-4" /> Tambah Slide Baru
            </button>
          )}

          <button
            onClick={handleSave}
            disabled={isSaving || !isEditing || isOptimisticallyLocked}
            className="flex items-center gap-2 bg-daw-green hover:bg-[#003b1c] disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-5 py-2 rounded-lg font-medium transition-colors shadow-sm">
            <Save className="w-4 h-4" />
            <span>
              {isSaving
                ? "Saving..."
                : isSuperadmin
                  ? "Publish"
                  : "Request Approval"}
            </span>
          </button>
        </div>
      </div>

      {/* --- RENDER COLLECTION SLIDES --- */}
      <div className="space-y-6">
        {slides.map((slide, index) => {
          const displayImage = getDisplayImageUrl(slide);

          const isItemLocked = isSuperadmin
            ? false
            : !isEditing || slide.is_locked;
          const isDragging = draggedIndex === index;

          const rejectedDraft = rejectedDrafts.find(
            (d) => String(d.target_id) === String(slide.id),
          );

          return (
            <div
              key={slide.id}
              draggable={isEditing && !isItemLocked}
              onDragStart={(e) => handleDragStart(e, index)}
              onDragEnter={(e) => handleDragEnter(e, index)}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
              onDrop={() => handleDrop(index)}
              className={`flex flex-col md:flex-row gap-6 p-5 rounded-xl border transition-all duration-500 relative overflow-hidden ${
                slide.is_locked && !isSuperadmin
                  ? "bg-slate-100/50 opacity-60 grayscale-[30%] pointer-events-none"
                  : isEditing
                    ? "bg-white border-slate-200 shadow-sm"
                    : "bg-slate-50 border-transparent"
              } ${isDragging ? "opacity-30 scale-[0.98] border-daw-green border-dashed" : ""} ${
                dragOverIndex === index && draggedIndex !== index
                  ? "border-t-4 border-t-daw-green shadow-lg scale-[1.01]"
                  : ""
              }`}>
              {/* ⚠️ THE REVISION RIBBON: Muncul jika draf slide ini ditolak */}
              {rejectedDraft && !isEditing && !isSuperadmin && (
                <div className="absolute top-0 left-0 right-0 bg-amber-500 text-white text-[10px] font-bold px-3 py-1 flex justify-between items-center z-10 animate-in slide-in-from-top-2">
                  <span className="flex items-center gap-1.5">
                    <AlertTriangle className="w-3 h-3" /> Catatan Peninjau: "
                    {rejectedDraft.rejection_reason}"
                  </span>
                  <button
                    onClick={() => handleRestoreDraft(slide.id)}
                    className="flex items-center gap-1 bg-white/20 hover:bg-white/30 px-2 py-0.5 rounded transition-colors pointer-events-auto">
                    <RotateCcw className="w-3 h-3" /> Pulihkan Draf
                  </button>
                </div>
              )}

              {/* 🔒 THE PENDING OVERLAY: Muncul jika slide nunggu approval */}
              {slide.is_locked && !isSuperadmin && (
                <div className="absolute top-0 left-0 right-0 bg-blue-50 border-b border-blue-100 text-blue-600 text-[10px] font-bold px-3 py-1 flex items-center justify-center gap-1.5 z-10">
                  <Lock className="w-3 h-3" /> SEDANG DITINJAU
                </div>
              )}

              {/* Order Control (Disembunyikan jika dikunci) */}
              {isEditing && !isItemLocked && (
                <div
                  className="flex flex-row md:flex-col items-center justify-center gap-1 border-b md:border-b-0 md:border-r border-slate-100 pb-4 md:pb-0 md:pr-4 shrink-0 cursor-grab active:cursor-grabbing"
                  title="Tarik untuk atur urutan">
                  <button
                    onClick={() => moveSlide(index, "up")}
                    disabled={index === 0}
                    className="p-1.5 rounded-md hover:bg-slate-100 disabled:opacity-20 text-slate-500 transition-colors">
                    <ChevronUp className="w-5 h-5 pointer-events-none" />
                  </button>
                  <div className="flex flex-col items-center py-1 text-slate-400 hover:text-daw-green transition-colors">
                    <GripVertical className="w-5 h-5 hidden md:block pointer-events-none" />
                  </div>
                  <button
                    onClick={() => moveSlide(index, "down")}
                    disabled={index === slides.length - 1}
                    className="p-1.5 rounded-md hover:bg-slate-100 disabled:opacity-20 text-slate-500 transition-colors">
                    <ChevronDown className="w-5 h-5 pointer-events-none" />
                  </button>
                </div>
              )}

              {/* IMAGE UPLOAD AREA */}
              <div
                className={`md:w-1/3 shrink-0 flex flex-col gap-2 relative mt-${(rejectedDraft || slide.is_locked) && !isSuperadmin ? "6" : "0"}`}>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block text-center mb-1">
                  Gambar Latar
                </label>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={isItemLocked}
                  ref={(el) => {
                    fileInputRefs.current[slide.id] = el;
                  }}
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0])
                      handleImageChange(slide.id, e.target.files[0]);
                  }}
                />
                <div
                  onClick={() =>
                    !isItemLocked && fileInputRefs.current[slide.id]?.click()
                  }
                  className={`relative aspect-video rounded-lg border-2 border-dashed flex flex-col items-center justify-center p-4 overflow-hidden transition-colors ${
                    !isItemLocked
                      ? "cursor-pointer border-slate-300 bg-white hover:border-daw-green"
                      : "border-slate-200 bg-slate-100/50" // Disable state
                  }`}>
                  {displayImage ? (
                    <>
                      <img
                        src={displayImage}
                        alt="Preview"
                        className="absolute inset-0 w-full h-full object-cover"
                        onLoad={(e) => {
                          if (slide.previewUrl)
                            URL.revokeObjectURL(
                              (e.target as HTMLImageElement).src,
                            );
                        }}
                      />
                      {/* Hover Overlay ganti gambar (Hanya muncul jika tidak dilock) */}
                      {!isItemLocked && (
                        <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white">
                          <UploadCloud className="w-6 h-6 mb-1" />
                          <span className="text-xs font-bold">
                            Ganti Gambar
                          </span>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <ImageIcon
                        className={`w-8 h-8 mb-2 ${!isItemLocked ? "text-slate-400" : "text-slate-300"}`}
                      />
                      <span
                        className={`text-xs font-bold ${!isItemLocked ? "text-slate-500" : "text-slate-400"}`}>
                        Klik untuk Upload
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* TEXT INPUTS */}
              <div
                className={`flex-1 flex flex-col gap-4 mt-${(rejectedDraft || slide.is_locked) && !isSuperadmin ? "6" : "0"}`}>
                <div className="flex justify-between items-center mb-1">
                  <span className="bg-slate-200 text-slate-600 font-bold px-3 py-1 rounded-md text-[10px] uppercase tracking-wider">
                    Slide #{index + 1}
                  </span>
                  {/* Tombol Hapus: Hilang jika item terkunci */}
                  {isEditing && !isItemLocked && (
                    <button
                      onClick={() => removeSlide(slide.id)}
                      className="text-slate-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-md transition-colors"
                      title="Hapus Slide">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Judul Utama
                  </label>
                  <input
                    type="text"
                    value={slide.title}
                    disabled={isItemLocked}
                    onChange={(e) =>
                      setSlides(
                        slides.map((s) =>
                          s.id === slide.id
                            ? { ...s, title: e.target.value }
                            : s,
                        ),
                      )
                    }
                    className={`w-full px-3 py-2 rounded-lg font-serif text-lg transition-all ${!isItemLocked ? "bg-white border border-slate-300 focus:ring-2 focus:ring-daw-green/20" : "bg-slate-100/50 border-transparent text-slate-500"}`}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Sub-judul
                  </label>
                  <textarea
                    rows={2}
                    value={slide.subtitle}
                    disabled={isItemLocked}
                    onChange={(e) =>
                      setSlides(
                        slides.map((s) =>
                          s.id === slide.id
                            ? { ...s, subtitle: e.target.value }
                            : s,
                        ),
                      )
                    }
                    className={`w-full px-3 py-2 rounded-lg text-sm resize-none transition-all ${!isItemLocked ? "bg-white border border-slate-300 focus:ring-2 focus:ring-daw-green/20" : "bg-slate-100/50 border-transparent text-slate-500"}`}
                  />
                </div>
              </div>
            </div>
          );
        })}
        {slides.length === 0 && (
          <div className="text-center py-10 text-slate-500 italic bg-slate-50 rounded-xl border border-dashed border-slate-200">
            Belum ada slide. Klik “Tambah Slide Baru” untuk memulai.
          </div>
        )}
      </div>
    </div>
  );
}
