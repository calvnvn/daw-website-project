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
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import api, { BASE_UPLOAD_URL } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

interface EditableSlide extends Omit<HeroSlides, "id"> {
  id: string | number;
  file?: File | null;
  previewUrl?: string;
  previous_notrans?: string;
  isDeleting?: boolean;
}

export default function HeroManager() {
  const { slides: initialSlides, rejectedSlidesMap, refreshData } = useHome();
  const { user } = useAuth();

  const isSuperadmin =
    user?.role?.toLowerCase() === "superadmin" ||
    user?.role?.toLowerCase() === "admin";
  const isEditor = user?.role?.toLowerCase() === "editor";

  const [slides, setSlides] = useState<EditableSlide[]>([]);
  const [originalSlides, setOriginalSlides] = useState<EditableSlide[]>([]);

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const [isOptimisticallyLocked, setIsOptimisticallyLocked] = useState(false);

  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  const hasLockedSlides = slides.some((s) => s.is_locked);
  const shouldLockGlobalActions =
    (hasLockedSlides || isOptimisticallyLocked) && !isSuperadmin;

  // LIFECYCLE EFFECTS
  // Data Synchronization & Snapshotting (Blueprint 2.2)
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

  // Garbage Collection & Memory Safety
  useEffect(() => {
    return () => {
      slides.forEach((slide) => {
        if (slide.previewUrl) {
          URL.revokeObjectURL(slide.previewUrl);
          // console.log(
          //   `🧠 [Memory Safety]: Preview image for slide ${slide.id} revoked.`,
          // );
        }
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDiscardDraft = async (notrans: string) => {
    toast("Abaikan Notifikasi?", {
      description:
        "Tindakan ini akan menghapus draf penolakan secara permanen.",
      action: {
        label: "Abaikan",
        onClick: async () => {
          try {
            await api.patch(`/approval/discard/${encodeURIComponent(notrans)}`);
            toast.success("Notifikasi diabaikan.");
            await refreshData();
          } catch {
            toast.error("Gagal mengabaikan draf.");
          }
        },
      },
    });
  };

  const handleRestoreDraft = useCallback(
    (targetId: string | number) => {
      const draft = rejectedSlidesMap[String(targetId)];
      if (!draft?.payload) return;

      setSlides((prev) =>
        prev.map((s) => {
          if (String(s.id) === String(targetId)) {
            return {
              ...s,
              ...draft.payload,
              file: null,
              previewUrl: undefined,
              previous_notrans: draft.notrans,
            };
          }
          return s;
        }),
      );

      setIsEditing(true);
      toast.info("Draf berhasil dipulihkan.");
    },
    [rejectedSlidesMap],
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
    toast("Konfirmasi Penghapusan", {
      description: isSuperadmin
        ? "Data akan dihapus permanen dari sistem."
        : "Tindakan ini akan diajukan untuk disetujui (Pending Delete).",
      action: {
        label: "Hapus",
        onClick: async () => {
          toast.promise(
            async () => {
              if (
                typeof id === "number" ||
                (typeof id === "string" && !id.startsWith("new-"))
              ) {
                const res = await api.delete(`/homepage/hero/${id}`);

                if (res.status === 202) {
                  setSlides((prev) =>
                    prev.map((s) =>
                      s.id === id
                        ? {
                            ...s,
                            is_locked: true,
                            isDeleting: true,
                            lock_ticket: res.data.ticket,
                          }
                        : s,
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
              error: (err) =>
                err.response?.data?.message || "Gagal menghapus slide.",
            },
          );
        },
      },
      cancel: {
        label: "Batal",
        onClick: () => {},
      },
    });
  };
  const moveSlide = (index: number, direction: "up" | "down") => {
    if (shouldLockGlobalActions) {
      return toast.error("Akses Dibatasi", {
        description:
          "Terdapat slide dalam antrean peninjauan. Urutan dikunci sementara.",
      });
    }

    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= slides.length) return;

    const updatedSlides = [...slides];
    [updatedSlides[index], updatedSlides[newIndex]] = [
      updatedSlides[newIndex],
      updatedSlides[index],
    ];

    // Re-index otomatis
    setSlides(updatedSlides.map((slide, idx) => ({ ...slide, order: idx })));
  };

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

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) =>
    e.preventDefault();

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

    setSlides(updatedSlides.map((slide, idx) => ({ ...slide, order: idx })));
    setDraggedIndex(null);
    setDragOverIndex(null);
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

  const getDisplayImageUrl = (slide: EditableSlide) => {
    if (slide.previewUrl) return slide.previewUrl;
    if (slide.imageUrl) {
      const filename = slide.imageUrl.split("/").pop();
      const cleanBase = BASE_UPLOAD_URL.replace(/\/$/, "");
      return `${cleanBase}/${filename}`;
    }
    return null;
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

    const successfulIds: (string | number)[] = [];
    let hasError = false;

    try {
      for (const slide of changedData) {
        const isNew =
          typeof slide.id === "string" && slide.id.startsWith("new-");
        const url = isNew ? "/homepage/hero" : `/homepage/hero/${slide.id}`;

        const formData = new FormData();
        formData.append("title", slide.title);
        formData.append("subtitle", slide.subtitle);
        formData.append("order", slide.order.toString());
        formData.append("status", isSuperadmin ? "Active" : "Published");

        const radarDraft = rejectedSlidesMap[String(slide.id)];
        const ticketToClear = slide.previous_notrans || radarDraft?.notrans;

        if (ticketToClear && isEditor) {
          formData.append("previous_notrans", ticketToClear);
        }

        if (slide.file) {
          formData.append("image", slide.file);
        }

        try {
          const res = isNew
            ? await api.post(url, formData)
            : await api.put(url, formData);
          successfulIds.push(slide.id);

          // Optimistic UI Instan (Blueprint 3.5)
          if (isEditor && res.status === 202) {
            setSlides((prev) =>
              prev.map((s) =>
                s.id === slide.id
                  ? { ...s, is_locked: true, lock_ticket: res.data.ticket }
                  : s,
              ),
            );
          }
        } catch (itemError: any) {
          console.error(`Gagal menyimpan slide ${slide.id}:`, itemError);
          hasError = true;
          toast.error(`Gagal menyimpan slide: ${slide.title || "Baru"}`, {
            description:
              itemError.response?.data?.message || "Kesalahan jaringan.",
          });
        }
      }

      await refreshData();

      if (!hasError) {
        setIsEditing(false);
        if (isEditor) setIsOptimisticallyLocked(true);
        toast.success(
          isSuperadmin ? "Banner diperbarui!" : "Seluruh revisi diajukan!",
          { id: loadingToast },
        );
      } else {
        toast.warning("Sebagian data gagal disimpan", {
          id: loadingToast,
          description:
            "Data yang berhasil telah diajukan. Silakan periksa sisa data yang gagal.",
        });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const hasRejectedSlides = Object.keys(rejectedSlidesMap || {}).length > 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* SOVEREIGN BANNERS */}

      {/* 1. Amber Banner (Superadmin Override Warning) */}
      {hasLockedSlides && isSuperadmin && (
        <div className="bg-amber-50 border border-amber-200 p-4 md:p-5 rounded-xl flex items-center gap-4 animate-in slide-in-from-top-4 shadow-sm mb-4">
          <div className="bg-amber-100 p-2 rounded-full text-amber-600 shrink-0">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs md:text-sm font-bold text-amber-900 uppercase tracking-tight">
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
            <h4 className="text-xs md:text-sm font-bold text-blue-900 uppercase tracking-tight">
              Akses Dibatasi
            </h4>
            <p className="text-[11px] md:text-xs text-blue-700 leading-relaxed mt-0.5 max-w-2xl">
              Urutan slide dan data tertentu sedang ditinjau. Anda tidak dapat
              melakukan perubahan kolektif hingga proses selesai.
            </p>
          </div>
        </div>
      )}

      {/* HEADER MANAGER & MATRIX BUTTONS */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 border-b border-slate-100 pb-4 gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-500 flex items-center gap-2">
            Hero Carousel
            {/* Visual Mirroring: Status Indicators */}
            {!isSuperadmin && (
              <>
                {hasRejectedSlides && (
                  <span className="bg-red-50 text-red-600 border border-red-200 text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                    <AlertTriangle className="w-3 h-3" /> Perlu Revisi
                  </span>
                )}
                {hasLockedSlides && !hasRejectedSlides && (
                  <span className="bg-blue-50 text-blue-600 border border-blue-200 text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                    <Lock className="w-3 h-3" /> Draf Tertunda
                  </span>
                )}
              </>
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
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-bold text-[11px] uppercase tracking-widest transition-colors border shadow-sm ${
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

          {/* Add Slide Guard */}
          {isEditing && !shouldLockGlobalActions && (
            <button
              onClick={() => slides.length < 5 && addSlide()}
              className="flex items-center gap-1.5 px-4 py-2 bg-daw-green/10 hover:bg-daw-green hover:text-white text-daw-green rounded-lg text-[11px] font-bold uppercase tracking-widest transition-colors">
              <Plus className="w-4 h-4" /> Add Slide
            </button>
          )}

          {/* Matrix Action Button (Rule 2.5: Sovereign vs Restrictive) */}
          <button
            onClick={handleSave}
            disabled={isSaving || !isEditing || shouldLockGlobalActions}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg font-bold text-[11px] uppercase tracking-widest transition-all shadow-lg active:scale-95 disabled:cursor-not-allowed disabled:shadow-none ${
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

          const shouldLockRowUI = isLocked && !isSuperadmin;
          const isOverrideRow = isLocked && isSuperadmin;

          const isDragging = draggedIndex === index;
          const isTargeted = dragOverIndex === index && draggedIndex !== index;

          const rejectedDraft = rejectedSlidesMap[String(slide.id)];

          return (
            <div
              key={slide.id}
              draggable={isEditing && !shouldLockRowUI}
              onDragStart={(e) => handleDragStart(e, index)}
              onDragEnter={(e) => handleDragEnter(e, index)}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
              onDrop={() => handleDrop(index)}
              className={`flex flex-col md:flex-row gap-6 p-5 rounded-xl border transition-all duration-300 relative overflow-hidden ${
                slide.isDeleting
                  ? "bg-rose-50/40 border-rose-200 opacity-60 grayscale-[50%] pointer-events-none"
                  : shouldLockRowUI
                    ? "bg-slate-50 opacity-70 border-slate-200 pointer-events-none"
                    : isOverrideRow
                      ? "bg-amber-50/40 border-amber-200 shadow-sm"
                      : isEditing
                        ? "bg-white border-slate-200 shadow-sm"
                        : "bg-slate-50/50 border-slate-100 hover:bg-slate-50/80"
              } ${isDragging ? "opacity-20 scale-95 border-daw-green border-dashed" : ""} 
                ${isTargeted ? "border-t-4 border-t-daw-green shadow-lg scale-[1.01]" : ""}`}>
              {/* STATUS OVERLAYS (The Bureaucratic Mirror) */}

              {/* Rejection Ribbon (Needs Revision) */}
              {rejectedDraft && !isEditing && !isSuperadmin && (
                <div className="absolute top-0 left-0 right-0 bg-red-500 text-white text-[10px] font-bold px-3 py-1.5 flex justify-between items-center z-10 animate-in slide-in-from-top-2">
                  <span className="flex items-center gap-1.5 uppercase tracking-wider">
                    <AlertTriangle className="w-3 h-3" />
                    <span className="hidden sm:inline">Catatan Peninjau:</span>
                    <span className="font-medium italic truncate max-w-[200px] md:max-w-md">
                      "{rejectedDraft.rejection_reason}"
                    </span>
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleRestoreDraft(slide.id)}
                      className="flex items-center gap-1 bg-white/20 hover:bg-white/30 px-2 py-0.5 rounded transition-colors pointer-events-auto">
                      <RotateCcw className="w-3 h-3" /> Pulihkan Data
                    </button>
                    <button
                      onClick={() => handleDiscardDraft(rejectedDraft.notrans)}
                      title="Abaikan Notifikasi"
                      className="p-0.5 hover:bg-white/20 rounded transition-colors pointer-events-auto text-red-100 hover:text-white">
                      <XCircle className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* 2. Override Mode (Admin Only) */}
              {isOverrideRow && (
                <div className="absolute top-0 left-0 right-0 bg-amber-100 border-b border-amber-200 text-amber-800 text-[10px] font-bold px-3 py-1 flex items-center justify-center gap-1.5 z-10 uppercase tracking-widest">
                  <ShieldAlert className="w-3 h-3 text-amber-600" /> Mode
                  Override: Sedang Ditinjau Editor
                </div>
              )}

              {/* 3. Locked & Pending Delete Status */}
              {shouldLockRowUI && (
                <div
                  className={`absolute top-0 left-0 right-0 border-b text-[10px] font-bold px-3 py-1 flex items-center justify-center gap-1.5 z-10 uppercase tracking-widest ${
                    slide.isDeleting
                      ? "bg-rose-100 border-rose-200 text-rose-700"
                      : "bg-blue-50 border-blue-100 text-blue-600"
                  }`}>
                  {slide.isDeleting ? (
                    <>
                      <Trash2 className="w-3 h-3" /> Menunggu Persetujuan Hapus
                    </>
                  ) : (
                    <>
                      <Lock className="w-3 h-3" /> Akses Dibatasi (Dalam
                      Peninjauan)
                    </>
                  )}
                </div>
              )}

              {/* SEQUENTIAL CONTROLS (DND) */}
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
                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest text-center mb-1">
                  Gambar Latar
                </label>
                <div
                  onClick={() =>
                    !shouldLockRowUI && fileInputRefs.current[slide.id]?.click()
                  }
                  className={`relative aspect-video rounded-lg border-2 flex flex-col items-center justify-center overflow-hidden transition-all ${
                    !shouldLockRowUI
                      ? "cursor-pointer border-dashed border-slate-300 bg-white hover:border-daw-green"
                      : "border-solid border-transparent bg-slate-100/50"
                  }`}>
                  {displayImage ? (
                    <>
                      <img
                        src={displayImage}
                        className={`absolute inset-0 w-full h-full object-cover ${slide.isDeleting ? "opacity-40" : ""}`}
                        alt="Slide preview"
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

              {/* CONTENT AREA (TEXT) */}
              <div
                className={`flex-1 flex flex-col gap-4 mt-${(rejectedDraft || isLocked) && !isSuperadmin ? "6" : isOverrideRow ? "6" : "0"}`}>
                <div className="flex justify-between items-center">
                  <span className="bg-slate-100 text-slate-500 font-bold px-2 py-0.5 rounded text-[9px] uppercase tracking-widest">
                    Slide #{index + 1}
                  </span>
                  {isEditing && !shouldLockRowUI && (
                    <button
                      onClick={() => removeSlide(slide.id)}
                      className="text-slate-300 hover:text-red-500 transition-colors p-1">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">
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
                      className={`w-full px-3 py-1.5 text-sm font-bold rounded-lg transition-all ${
                        isEditing && !shouldLockRowUI
                          ? "bg-white border border-slate-200 focus:ring-2 focus:ring-daw-green/10"
                          : "bg-transparent border-transparent"
                      } ${slide.isDeleting ? "line-through text-slate-400" : ""}`} // 🎨 The Line-Through Rule
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">
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
                        isEditing && !shouldLockRowUI
                          ? "bg-white border border-slate-200 focus:ring-2 focus:ring-daw-green/10"
                          : "bg-transparent border-transparent"
                      } ${slide.isDeleting ? "line-through text-slate-400" : ""}`}
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {slides.length === 0 && (
          <div className="text-center py-20 text-slate-400 italic bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            Belum ada slide. Klik “Tambah Slide” untuk memulai.
          </div>
        )}
      </div>
    </div>
  );
}
