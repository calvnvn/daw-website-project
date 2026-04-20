import { useState, useEffect, useRef } from "react";
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
} from "lucide-react";
import { toast } from "sonner";
import api, { BASE_UPLOAD_URL } from "@/lib/api";

interface EditableSlide extends Omit<HeroSlides, "id"> {
  id: string | number;
  file?: File | null;
  previewUrl?: string;
}

export default function HeroManager() {
  const { slides: initialSlides, refreshData } = useHome();
  const [slides, setSlides] = useState<EditableSlide[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  useEffect(() => {
    if (initialSlides) {
      setSlides(initialSlides.map((s) => ({ ...s })));
    }
  }, [initialSlides]);

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
    toast("Delete Slide?", {
      description: "This action cannot be undone. Are you sure?",
      action: {
        label: "Delete",
        onClick: async () => {
          toast.promise(
            async () => {
              // Jika ID adalah number (data dari database)
              if (typeof id === "number") {
                await api.delete(`/homepage/hero/${id}`);
              }

              // Update state di frontend setelah berhasil hapus di backend
              setSlides((prev) => prev.filter((s) => s.id !== id));
            },
            {
              loading: "Deleting slide from server...",
              success: "Slide has been removed successfully!",
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
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move"; // Mengubah kursor jadi mode "move"
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
    const loadingToast = toast.loading("Sedang menyimpan semua perubahan...");

    try {
      const promises = slides.map(async (slide) => {
        const isNew =
          typeof slide.id === "string" && slide.id.startsWith("new-");
        const formData = new FormData();
        formData.append("title", slide.title);
        formData.append("subtitle", slide.subtitle);
        formData.append("order", slide.order.toString());
        if (slide.file) formData.append("image", slide.file);

        if (isNew) {
          return api.post("/homepage/hero", formData);
        } else {
          return api.put(`/homepage/hero/${slide.id}`, formData);
        }
      });

      await Promise.all(promises);
      await refreshData();
      toast.success("Semua slide telah berhasil disimpan!", {
        id: loadingToast,
      });
      setIsEditing(false);
    } catch (error: any) {
      console.error("Save error details: ", error);
      toast.error(
        error.response?.data?.message || "Gagal menyimpan beberapa slide",
        {
          id: loadingToast,
        },
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 border-b border-slate-100 pb-4 gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900">
            Slide Banner Utama
          </h3>
          <p className="text-sm text-slate-500">
            Unggah gambar berkualitas tinggi dan tuliskan judul yang menarik
            untuk spanduk depan.
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

          {isEditing && (
            <button
              onClick={addSlide}
              className="flex items-center gap-1.5 px-4 py-2 bg-daw-green/10 hover:bg-daw-green hover:text-white text-daw-green rounded-lg text-sm font-bold transition-colors">
              <Plus className="w-4 h-4" /> Tambah Slide Baru
            </button>
          )}

          <button
            onClick={handleSave}
            disabled={isSaving || !isEditing}
            className="flex items-center gap-2 bg-daw-green hover:bg-[#003b1c] disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-5 py-2 rounded-lg font-medium transition-colors shadow-sm">
            <Save className="w-4 h-4" /> {isSaving ? "Menyimpan.." : "Save"}
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {slides.map((slide, index) => {
          const displayImage = getDisplayImageUrl(slide);
          return (
            <div
              key={slide.id}
              draggable={isEditing}
              onDragStart={(e) => handleDragStart(e, index)}
              onDragEnter={(e) => handleDragEnter(e, index)}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
              onDrop={() => handleDrop(index)}
              className={`flex flex-col md:flex-row gap-6 p-5 rounded-xl border transition-all ${
                isEditing
                  ? "bg-white border-slate-200 shadow-sm"
                  : "bg-slate-50 border-transparent"
              } ${draggedIndex === index ? "opacity-30 scale-[0.98] border-daw-green border-dashed" : ""} ${
                dragOverIndex === index && draggedIndex !== index
                  ? "border-t-4 border-t-daw-green shadow-lg scale-[1.01]" // Indikator garis mau di-drop
                  : ""
              }`}>
              {/* Order Control */}
              {isEditing && (
                <div
                  className="flex flex-row md:flex-col items-center justify-center gap-1 border-b md:border-b-0 md:border-r border-slate-100 pb-4 md:pb-0 md:pr-4 shrink-0 cursor-grab active:cursor-grabbing"
                  title="Tarik untuk atur urutan">
                  {/* Tombol Chevron Up & Down biarkan saja untuk fallback (aksesibilitas) */}
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
              {/* IMAGE UPLOAD */}
              <div className="md:w-1/3 shrink-0 flex flex-col gap-2 relative">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block text-center mb-1">
                  Gambar Latar
                </label>
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
                <div
                  onClick={() =>
                    isEditing && fileInputRefs.current[slide.id]?.click()
                  }
                  className={`relative aspect-video rounded-lg border-2 border-dashed flex flex-col items-center justify-center p-4 overflow-hidden transition-colors ${
                    isEditing
                      ? "cursor-pointer border-slate-300 bg-white hover:border-daw-green"
                      : "cursor-not-allowed border-slate-200 bg-slate-100/50"
                  }`}>
                  {displayImage ? (
                    <>
                      <img
                        src={displayImage}
                        alt="Preview"
                        className="absolute inset-0 w-full h-full object-cover"
                        onLoad={(e) => {
                          if (slide.previewUrl) {
                            URL.revokeObjectURL(
                              (e.target as HTMLImageElement).src,
                            );
                          }
                        }}
                      />
                      {isEditing && (
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
                        className={`w-8 h-8 mb-2 ${isEditing ? "text-slate-400" : "text-slate-300"}`}
                      />
                      <span
                        className={`text-xs font-bold ${isEditing ? "text-slate-500" : "text-slate-400"}`}>
                        Klik untuk Upload
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* TEXT INPUTS */}
              <div className="flex-1 flex flex-col gap-4">
                <div className="flex justify-between items-center mb-1">
                  <span className="bg-slate-200 text-slate-600 font-bold px-3 py-1 rounded-md text-[10px] uppercase tracking-wider">
                    Slide #{index + 1}
                  </span>
                  {isEditing && (
                    <button
                      onClick={() => removeSlide(slide.id)}
                      className="text-slate-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-md transition-colors"
                      title="Delete">
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
                    disabled={!isEditing}
                    onChange={(e) =>
                      setSlides(
                        slides.map((s) =>
                          s.id === slide.id
                            ? { ...s, title: e.target.value }
                            : s,
                        ),
                      )
                    }
                    className={`w-full px-3 py-2 rounded-lg font-serif text-lg transition-all ${isEditing ? "bg-white border border-slate-300 focus:ring-2 focus:ring-daw-green/20" : "bg-slate-100/50 border-transparent text-slate-500"}`}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Sub-judul
                  </label>
                  <textarea
                    rows={2}
                    value={slide.subtitle}
                    disabled={!isEditing}
                    onChange={(e) =>
                      setSlides(
                        slides.map((s) =>
                          s.id === slide.id
                            ? { ...s, subtitle: e.target.value }
                            : s,
                        ),
                      )
                    }
                    className={`w-full px-3 py-2 rounded-lg text-sm resize-none transition-all ${isEditing ? "bg-white border border-slate-300 focus:ring-2 focus:ring-daw-green/20" : "bg-slate-100/50 border-transparent text-slate-500"}`}
                  />
                </div>
              </div>
            </div>
          );
        })}
        {slides.length === 0 && (
          <div className="text-center py-10 text-slate-500 italic">
            Tidak ada slide yang tersedia. Klik “Tambahkan Slide Baru” untuk
            memulai.
          </div>
        )}
      </div>
    </div>
  );
}
