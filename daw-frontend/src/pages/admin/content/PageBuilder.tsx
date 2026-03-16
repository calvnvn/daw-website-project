import { useState, useEffect, useMemo, useCallback } from "react";
import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";
import { toast } from "sonner";
import {
  Plus,
  Edit2,
  Trash2,
  Save,
  X,
  Layout,
  Sparkles,
  Globe,
  Layers,
  Monitor,
  UploadCloud,
  FileText,
} from "lucide-react";
import api from "@/lib/api";
import imageCompression from "browser-image-compression";
interface Page {
  id: string;
  title: string;
  slug: string;
  subtitle: string;
  heroImage: string;
  templateType: "classic" | "modern" | "split";
  content: string;
}

export default function PageBuilder() {
  const [pages, setPages] = useState<Page[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    slug: "",
    subtitle: "",
    templateType: "classic",
    content: "",
  });

  const [heroImage, setHeroImage] = useState<string>("");
  const imageHandler = useCallback(() => {
    const input = document.createElement("input");
    input.setAttribute("type", "file");
    input.setAttribute("accept", "image/*");
    input.click();

    input.onchange = async () => {
      const file = input.files?.[0];
      if (file) {
        const toastId = toast.loading("Optimizing article image...");
        try {
          const options = {
            maxSizeMB: 0.5, //  Kompres sampai di bawah 500KB
            maxWidthOrHeight: 1200, // Ukuran ideal untuk artikel web
            useWebWorker: true,
          };
          const compressedFile = await imageCompression(file, options);
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64data = reader.result as string;

            // Masukkan ke posisi kursor di Quill
            const quill = document.querySelector(".ql-editor") as any;
            if (quill) {
              const range = window.getSelection()?.getRangeAt(0);
              const img = document.createElement("img");
              img.src = base64data;
              range?.insertNode(img);
            }
            toast.success("Image added & optimized!", { id: toastId });
          };
          reader.readAsDataURL(compressedFile);
        } catch (error) {
          toast.error("Failed to process image", { id: toastId });
          console.error(error);
        }
      }
    };
  }, []);

  // 2. Daftarkan imageHandler ke dalam Quill Modules
  const quillModules = useMemo(
    () => ({
      toolbar: {
        container: [
          [{ header: [1, 2, 3, false] }],
          ["bold", "italic", "underline", "strike", "blockquote"],
          [{ list: "ordered" }, { list: "bullet" }],
          [{ align: [] }, { color: [] }, { background: [] }],
          ["link", "image", "video"],
          ["clean"],
        ],
        handlers: {
          image: imageHandler, //  Override fungsi upload gambar bawaan
        },
      },
    }),
    [imageHandler],
  );

  const fetchPages = async () => {
    setIsLoading(true);
    try {
      const response = await api.get("/pages");
      setPages(response.data);
    } catch (error) {
      toast.error("Failed to fetch page data.");
      console.log(error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPages();
  }, []);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    if (!editingId) {
      const autoSlug = newTitle
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)+/g, "");
      setFormData({ ...formData, title: newTitle, slug: autoSlug });
    } else {
      setFormData({ ...formData, title: newTitle });
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setHeroImage("");
    setFormData({
      title: "",
      slug: "",
      subtitle: "",
      templateType: "classic",
      content: "",
    });
  };

  const handleEdit = async (page: Page) => {
    const toastId = toast.loading("Loading page details...");
    try {
      const response = await api.get(`/pages/slug/${page.slug}`);
      const data = response.data;
      setFormData({
        title: data.title || "",
        slug: data.slug || "",
        subtitle: data.subtitle || "",
        templateType: data.templateType || "classic",
        content: data.content || "",
      });
      setHeroImage(data.heroImage || "");
      setEditingId(page.id);
      toast.dismiss(toastId);
    } catch (error) {
      toast.error("Failed to load page", { id: toastId });
      console.error(error);
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    const toastId = toast.loading("Deleting page...");
    try {
      await api.delete(`/pages/${id}`);
      toast.success("Page deleted", { id: toastId });
      fetchPages();
      if (editingId === id) resetForm();
    } catch (error) {
      toast.error("Failed to delete page", { id: toastId });
      console.error(error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.slug)
      return toast.error("Title & Slug are required!");

    setIsSaving(true);
    const toastId = toast.loading("Saving...");
    try {
      const payload = {
        ...formData,
        heroImage: heroImage,
      };
      if (editingId) {
        await api.put(`/pages/${editingId}`, payload);
        toast.success("Page updated!", { id: toastId });
      } else {
        await api.post("/pages", payload);
        toast.success("Page published!", { id: toastId });
      }
      resetForm();
      fetchPages();
    } catch (error) {
      console.error(error);
      toast.error("Failed to save page", { id: toastId });
    } finally {
      setIsSaving(false);
    }
  };

  const handleImageUpload = async (file: File) => {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      return toast.error("Hanya file gambar yang diperbolehkan!");
    }

    if (file.size > 5 * 1024 * 1024) {
      return toast.error("Ukuran gambar terlalu besar! Maksimal 5MB.");
    }

    const toastId = toast.loading("Compressing image...");
    try {
      const options = {
        maxSizeMB: 0.8,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
        initialQuality: 0.7,
      };

      const compressedFile = await imageCompression(file, options);

      console.log(`Original: ${(file.size / 1024 / 1024).toFixed(2)} MB`);
      console.log(
        `Compressed: ${(compressedFile.size / 1024 / 1024).toFixed(2)} MB`,
      );

      const reader = new FileReader();
      reader.onloadend = () => {
        setHeroImage(reader.result as string);
        toast.success("Image optimized & uploaded!", { id: toastId });
      };
      reader.readAsDataURL(compressedFile);
    } catch (error) {
      console.error(error);
      toast.error("Failed to compress image.", { id: toastId });
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-in fade-in duration-500">
      {/* Sidebar: Page List */}
      <div className="lg:col-span-4 space-y-4">
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 sticky top-24">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">
              Your Pages
            </h3>
            {!editingId && (
              <button
                onClick={resetForm}
                className="text-xs font-bold text-daw-green hover:underline flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> New
              </button>
            )}
          </div>
          {isLoading ? (
            <div className="py-10 text-center animate-pulse text-slate-400 font-bold">
              Loading...
            </div>
          ) : pages.length === 0 ? (
            <div className="text-center py-12 px-6 bg-white border border-dashed border-slate-300 rounded-2xl">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="w-8 h-8 text-slate-300" />
              </div>
              <h4 className="text-sm font-bold text-slate-900 mb-1">
                No Pages Created
              </h4>
              <p className="text-xs text-slate-500 mb-4">
                Start building your website by creating your first editorial
                page.
              </p>
              <button
                onClick={resetForm}
                className="text-xs font-bold text-daw-green bg-daw-green/5 px-4 py-2 rounded-lg hover:bg-daw-green hover:text-white transition-all"
              >
                + Create Page
              </button>
            </div>
          ) : (
            <div className="space-y-3 max-h-[60vh] overflow-y-auto custom-scrollbar pr-2">
              {pages.map((p) => (
                <div
                  key={p.id}
                  className={`p-4 rounded-xl border bg-white transition-all group ${editingId === p.id ? "border-daw-green ring-4 ring-daw-green/5 shadow-sm" : "border-slate-200"}`}
                >
                  <div className="flex justify-between items-start">
                    <div className="min-w-0">
                      <h4 className="font-bold text-slate-900 text-sm truncate">
                        {p.title}
                      </h4>
                      <p className="text-[10px] text-slate-400 font-mono mt-1">
                        /page/{p.slug}
                      </p>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleEdit(p)}
                        className="p-1.5 hover:bg-daw-green/10 text-slate-400 hover:text-daw-green rounded-md"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(p.id, p.title)}
                        className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-md"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main: Page Editor */}
      <div className="lg:col-span-8">
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden"
        >
          <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50/30">
            <div className="flex items-center gap-2 text-daw-green uppercase text-[10px] font-black tracking-widest">
              <Sparkles className="w-4 h-4" />{" "}
              {editingId ? "Edit Page" : "Create New Page"}
            </div>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="text-xs font-bold text-slate-400 hover:text-red-500 flex items-center gap-1"
              >
                <X className="w-3 h-3" /> Cancel Edit
              </button>
            )}
          </div>

          <div className="p-8 border-b border-slate-100">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">
                  Main Title *
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={handleTitleChange}
                  className="w-full p-4 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-daw-green outline-none font-bold text-slate-800"
                  placeholder="e.g. Company History"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">
                  URL Slug *
                </label>
                <div className="flex items-center w-full rounded-xl bg-slate-50 border border-slate-200 focus-within:bg-white focus-within:border-daw-green overflow-hidden transition-colors">
                  <div className="pl-4 pr-2 py-4 text-slate-400 flex items-center gap-2 border-r border-slate-200/50">
                    <Globe className="w-4 h-4" />
                    <span className="text-sm font-mono">/page/</span>
                  </div>
                  <input
                    type="text"
                    required
                    value={formData.slug}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        slug: e.target.value
                          .toLowerCase()
                          .replace(/[^a-z0-9-]+/g, ""),
                      })
                    }
                    className="w-full p-4 bg-transparent outline-none font-mono text-sm text-slate-600"
                    placeholder="company-history"
                  />
                </div>
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-xs font-bold text-slate-500 uppercase">
                  Hero Subtitle
                </label>
                <input
                  type="text"
                  value={formData.subtitle}
                  onChange={(e) =>
                    setFormData({ ...formData, subtitle: e.target.value })
                  }
                  className="w-full p-4 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-daw-green outline-none text-slate-600"
                  placeholder="Small text under title..."
                />
              </div>

              {/* Area Drag n Drop Image */}
              <div className="space-y-2 md:col-span-2 mt-2">
                <label className="text-xs font-bold text-slate-500 uppercase">
                  Hero Background Image
                </label>

                {heroImage ? (
                  <div className="relative w-full h-56 rounded-2xl overflow-hidden group border border-slate-200 shadow-sm">
                    <img
                      src={heroImage}
                      alt="Hero Preview"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center backdrop-blur-sm">
                      <button
                        type="button"
                        onClick={() => setHeroImage("")} // 🚀 Panggil fungsi yang benar
                        className="bg-red-500 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 font-bold text-sm hover:bg-red-600 transition-colors shadow-lg transform hover:scale-105"
                      >
                        <Trash2 className="w-4 h-4" /> Remove Image
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragging(false);
                      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                        handleImageUpload(e.dataTransfer.files[0]);
                      }
                    }}
                    className={`relative border-2 border-dashed rounded-3xl p-12 flex flex-col items-center justify-center transition-all duration-300 group 
                      ${
                        isDragging
                          ? "border-daw-green bg-daw-green/5 scale-[0.99] ring-4 ring-daw-green/10"
                          : "border-slate-300 bg-slate-50 hover:border-daw-green hover:bg-slate-100/50"
                      }`}
                  >
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) =>
                        e.target.files && handleImageUpload(e.target.files[0])
                      }
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <div
                      className={`p-5 rounded-2xl mb-4 transition-all duration-500 ${isDragging ? "bg-daw-green text-white scale-110 rotate-6" : "bg-white text-slate-400 shadow-sm group-hover:text-daw-green"}`}
                    >
                      <UploadCloud
                        className={`w-10 h-10 ${isDragging ? "animate-bounce" : ""}`}
                      />
                    </div>
                    <div className="text-center space-y-1">
                      <p className="text-base font-bold text-slate-700">
                        {isDragging
                          ? "Drop to optimize"
                          : "Drag & drop hero image"}
                      </p>
                      <p className="text-sm text-slate-500 font-medium">
                        or click to browse your workstation
                      </p>
                    </div>
                    <div className="mt-6 flex gap-2">
                      <span className="px-3 py-1 rounded-full bg-white border border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                        PNG, JPG, WEBP (Max 5MB)
                      </span>
                    </div>
                  </div>
                )}
              </div>
              {/* 🚀 END AREA DRAG AND DROP */}
            </div>
          </div>

          <div className="p-8 border-b border-slate-100">
            <label className="block text-xs font-bold text-slate-500 uppercase mb-4">
              Select Template Layout
            </label>
            <div className="grid grid-cols-3 gap-4">
              {(["classic", "modern", "split"] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() =>
                    setFormData({ ...formData, templateType: type })
                  }
                  className={`p-6 border-2 rounded-2xl flex flex-col items-center gap-3 transition-all ${formData.templateType === type ? "border-daw-green bg-daw-green/5" : "border-slate-100 hover:border-slate-200"}`}
                >
                  {type === "classic" && (
                    <Monitor
                      className={`w-6 h-6 ${formData.templateType === type ? "text-daw-green" : "text-slate-400"}`}
                    />
                  )}
                  {type === "modern" && (
                    <Layers
                      className={`w-6 h-6 ${formData.templateType === type ? "text-daw-green" : "text-slate-400"}`}
                    />
                  )}
                  {type === "split" && (
                    <Layout
                      className={`w-6 h-6 ${formData.templateType === type ? "text-daw-green" : "text-slate-400"}`}
                    />
                  )}
                  <span className="text-xs font-bold capitalize">{type}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="p-8">
            <label className="block text-xs font-bold text-slate-500 uppercase mb-4">
              Editorial Content
            </label>
            <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white">
              <ReactQuill
                theme="snow"
                value={formData.content}
                onChange={(val) => setFormData({ ...formData, content: val })}
                modules={quillModules}
                className="min-h-[450px] flex flex-col [&_.ql-editor]:p-8 [&_.ql-editor]:text-slate-700 [&_.ql-editor]:text-lg [&_.ql-toolbar]:border-0 [&_.ql-toolbar]:border-b [&_.ql-container]:border-0"
              />
            </div>
          </div>

          <div className="px-8 py-6 bg-slate-50 flex justify-between items-center">
            <p className="text-[10px] text-slate-400 font-bold uppercase italic">
              Changes are live upon saving.
            </p>
            <button
              type="submit"
              disabled={isSaving}
              className="bg-daw-green hover:bg-[#003b1c] text-white px-10 py-3 rounded-xl font-bold shadow-lg shadow-daw-green/20 flex items-center gap-2 disabled:bg-slate-300"
            >
              <Save className="w-5 h-5" />
              {isSaving
                ? "Saving..."
                : editingId
                  ? "Update Page"
                  : "Publish Page"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
