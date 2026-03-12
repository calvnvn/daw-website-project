import { useState, useEffect, useRef } from "react";
import { useHome, type HeroSlide } from "@/contexts/HomeContext";
import {
  Save,
  Plus,
  Trash2,
  UploadCloud,
  ImageIcon,
  Lock,
  Unlock,
} from "lucide-react";
import { toast } from "sonner"; // Pastikan sonner terinstall

interface EditableSlide extends Omit<HeroSlide, "id"> {
  id: string | number;
  file?: File | null;
  previewUrl?: string;
}

export default function HeroManager() {
  const { slides: initialSlides, refreshData } = useHome();
  const [slides, setSlides] = useState<EditableSlide[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

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
    if (!confirm("Are you sure you want to delete this slide?")) return;

    if (typeof id === "number") {
      const token = localStorage.getItem("daw_token");
      try {
        await fetch(`http://localhost:5000/api/homepage/hero/${id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch (err) {
        console.error("Failed to delete slide from DB:", err);
      }
    }
    setSlides(slides.filter((s) => s.id !== id));
  };

  const handleImageChange = (id: string | number, file: File) => {
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    setSlides(
      slides.map((s) => (s.id === id ? { ...s, file, previewUrl } : s)),
    );
  };

  const getDisplayImageUrl = (slide: EditableSlide) => {
    if (slide.previewUrl) return slide.previewUrl;
    if (slide.imageUrl) return `http://localhost:5000${slide.imageUrl}`;
    return null;
  };

  const handleSave = async () => {
    setIsSaving(true);
    const loadingToast = toast.loading("Saving slides...");
    const token = localStorage.getItem("daw_token");

    try {
      for (const slide of slides) {
        const isNew =
          typeof slide.id === "string" && slide.id.startsWith("new-");
        const url = isNew
          ? "http://localhost:5000/api/homepage/hero"
          : `http://localhost:5000/api/homepage/hero/${slide.id}`;

        const formData = new FormData();
        formData.append("title", slide.title);
        formData.append("subtitle", slide.subtitle);
        formData.append("order", slide.order.toString());

        if (slide.file) {
          formData.append("image", slide.file);
        }

        await fetch(url, {
          method: isNew ? "POST" : "PUT",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
      }

      await refreshData();
      toast.success("Hero slides saved successfully!", { id: loadingToast });
      setIsEditing(false);
    } catch (error) {
      console.error(error);
      toast.error("Error saving hero slides.", { id: loadingToast });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 border-b border-slate-100 pb-4 gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900">
            Hero Banner Slides
          </h3>
          <p className="text-sm text-slate-500">
            Upload high-quality images and catchy headlines.
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

          {isEditing && (
            <button
              onClick={addSlide}
              className="flex items-center gap-1.5 px-4 py-2 bg-daw-green/10 hover:bg-daw-green hover:text-white text-daw-green rounded-lg text-sm font-bold transition-colors"
            >
              <Plus className="w-4 h-4" /> Add Slide
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

      <div className="space-y-6">
        {slides.map((slide, index) => {
          const displayImage = getDisplayImageUrl(slide);
          return (
            <div
              key={slide.id}
              className="flex flex-col md:flex-row gap-6 p-5 rounded-xl border bg-slate-50 transition-all"
            >
              {/* IMAGE UPLOAD */}
              <div className="md:w-1/3 shrink-0 flex flex-col gap-2 relative">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block text-center mb-1">
                  Background Image
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
                  }`}
                >
                  {displayImage ? (
                    <>
                      <img
                        src={displayImage}
                        alt="Preview"
                        className="absolute inset-0 w-full h-full object-cover transition-transform group-hover:scale-105"
                      />
                      {isEditing && (
                        <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white">
                          <UploadCloud className="w-6 h-6 mb-1" />
                          <span className="text-xs font-bold">
                            Change Image
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
                        className={`text-xs font-bold ${isEditing ? "text-slate-500" : "text-slate-400"}`}
                      >
                        Click to Upload
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
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Headline
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
                    Subtitle
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
            No slides available. Click "Add Slide" to start.
          </div>
        )}
      </div>
    </div>
  );
}
