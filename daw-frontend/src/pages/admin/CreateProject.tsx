/**
 * MODULE: Create Project (Page Builder)
 * PATH: /src/pages/admin/CreateProject.tsx
 * * TECHNICAL DOCUMENTATION (FINAL AUDIT CLEAN):
 * 1. Double Append Fixed: Removed redundant payload.append for images.
 * 2. Memory Leak Guard: Sub-component handles individual gallery object URLs.
 * 3. SEO Intelligence: Optimized fallback and slug preview.
 * 4. Progress Tracking: Real-time upload percentage for large assets.
 */

import { useState, useRef, useMemo, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";
import { toast } from "sonner";
import {
  ArrowLeft,
  Image as ImageIcon,
  Images,
  Search,
  Save,
  Send,
  X,
  Link as LinkIcon,
} from "lucide-react";
import { useDropzone } from "react-dropzone";
import api, { BASE_UPLOAD_URL } from "@/lib/api";
import { compressImage } from "@/utils/imageHelper";

const GalleryPreviewItem = ({
  file,
  onRemove,
}: {
  file: File;
  onRemove: () => void;
}) => {
  const [preview, setPreview] = useState<string>("");

  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  return (
    <div className="relative aspect-square rounded-lg overflow-hidden group border border-slate-100 shadow-sm">
      <img
        src={preview}
        className="w-full h-full object-cover"
        alt="Gallery Preview"
      />
      <button
        type="button"
        onClick={onRemove}
        className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:bg-red-600 shadow-md"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
};

export default function CreateProject() {
  const navigate = useNavigate();
  const quillRef = useRef<ReactQuill>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [formData, setFormData] = useState({
    title: "",
    excerpt: "",
    content: "",
    category: "Resources",
    status: "Draft",
    cover_image: "",
    gallery: "[]",
    seo_title: "",
    meta_description: "",
  });

  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [galleryFiles, setGalleryFiles] = useState<File[]>([]);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);

  // Sync Preview untuk Cover Image
  useEffect(() => {
    if (!coverFile) {
      setCoverPreview(null);
      return;
    }
    const objectUrl = URL.createObjectURL(coverFile);
    setCoverPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [coverFile]);

  // Preview URL otomatis
  const generatedSlug = useMemo(() => {
    return formData.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "");
  }, [formData.title]);

  const removeGalleryFile = (index: number) => {
    setGalleryFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // WYSIWYG Image Handler
  const imageHandler = useCallback(() => {
    const input = document.createElement("input");
    input.setAttribute("type", "file");
    input.setAttribute("accept", "image/*");
    input.click();

    input.onchange = async () => {
      if (input.files && input.files[0]) {
        const file = input.files[0];
        const uploadData = new FormData();
        uploadData.append("inline_image", file);

        const toastId = toast.loading("Sedang mengunggah gambar...");
        try {
          const response = await api.post(
            "/projects/upload-inline",
            uploadData,
          );

          const quill = quillRef.current?.getEditor();
          if (!quill) {
            throw new Error("Quill editor is not ready");
          }

          const range = quill.getSelection(true);
          const index = range ? range.index : quill.getLength();

          const imageUrl = response.data.url;

          quill.insertEmbed(index, "image", imageUrl);
          quill.setSelection(index + 1);

          toast.success("Gambar berhasil disisipkan ke dalam isi artikel.", {
            id: toastId,
          });
        } catch (err: any) {
          console.error("Upload Error detail:", err.response?.data);

          toast.error("Upload failed", {
            id: toastId,
            description: err.response?.data?.message || "Check backend console",
          });
        }
      }
    };
  }, []);

  const modules = useMemo(
    () => ({
      toolbar: {
        container: [
          [{ header: [1, 2, 3, false] }],
          ["bold", "italic", "underline"],
          [{ list: "ordered" }, { list: "bullet" }],
          ["link", "image"],
          ["clean"],
        ],
        handlers: { image: imageHandler },
      },
    }),
    [imageHandler],
  );

  const handlePublish = async (targetStatus: string) => {
    // Validations
    if (!formData.title.trim())
      return toast.error("Mohon masukkan judul proyek sebelum melanjutkan.");
    if (!formData.content || formData.content === "<p><br></p>")
      return toast.error("Isi artikel tidak boleh kosong");
    if (targetStatus === "Published" && !coverFile)
      return toast.error("Gambar sampul wajib diunggah untuk publikasi resmi.");

    setIsLoading(true);
    const loadingToast = toast.loading(
      "Sedang mengoptimalkan gambar dan menerbitkan...",
    );

    try {
      const payload = new FormData();

      //  1. OPTIMIZED COVER
      if (coverFile) {
        const optimizedCover = await compressImage(coverFile);
        payload.append("cover_image", optimizedCover);
      }

      //  2. OPTIMIZED GALLERY
      for (const file of galleryFiles) {
        const optimizedFile = await compressImage(file);
        payload.append("gallery", optimizedFile);
      }

      //  3. DATA TEXT & SEO
      payload.append("title", formData.title.trim());
      payload.append("slug", generatedSlug);
      payload.append("excerpt", formData.excerpt.trim());
      payload.append("content", formData.content);
      payload.append("category", formData.category);
      payload.append("status", targetStatus);
      payload.append(
        "seo_title",
        formData.seo_title.trim() || formData.title.trim(),
      );
      payload.append(
        "meta_description",
        formData.meta_description.trim() || formData.excerpt.trim(),
      );

      // Safety User Fetch
      let authorName = "Admin";
      try {
        const userStr = localStorage.getItem("daw_user");
        if (userStr) {
          const userObj = JSON.parse(userStr);
          authorName = userObj.name || "Admin";
        }
      } catch (e) {
        console.warn("User parse error: ", e);
      }
      payload.append("author", authorName);

      // Execution with Progress Tracker
      const response = await api.post("/projects", payload, {
        onUploadProgress: (p) => {
          const percent = Math.round((p.loaded * 100) / (p.total || 1));
          toast.loading(`Uploading: ${percent}%...`, { id: loadingToast });
        },
      });

      if (response.status === 201 || response.status === 200) {
        toast.success(
          `Project ${targetStatus === "Draft" ? "Saved" : "Published"}!`,
          { id: loadingToast },
        );
        navigate("/admin/projects");
      }
    } catch (err: any) {
      toast.error("Error", {
        description:
          err.response?.data?.message ||
          "Terjadi kendala saat menyambungkan ke server.",
        id: loadingToast,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Dropzone Handlers
  const {
    getRootProps: getRootCoverProps,
    getInputProps: getInputCoverProps,
    isDragActive: isCoverDragActive,
  } = useDropzone({
    onDrop: (files) => {
      if (files.length > 0) setCoverFile(files[0]);
    },
    accept: { "image/*": [] },
    multiple: false,
  });

  const {
    getRootProps: getRootGalleryProps,
    getInputProps: getInputGalleryProps,
    isDragActive: isGalleryDragActive,
  } = useDropzone({
    onDrop: (files) => setGalleryFiles((prev) => [...prev, ...files]),
    accept: { "image/*": [] },
    multiple: true,
  });

  return (
    <div className="max-w-7xl mx-auto animate-in fade-in duration-500 pb-12">
      {/* TOOLBAR HEADER */}
      <div className="flex items-center justify-between mb-8 top-0 bg-slate-50/80 backdrop-blur-md z-30 py-4 border-b border-slate-200 px-1">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/admin/projects")}
            className="p-2 hover:bg-white rounded-lg transition-all border border-transparent hover:border-slate-200"
          >
            <ArrowLeft className="w-5 h-5 text-slate-500" />
          </button>
          <div>
            <h1 className="text-xl font-serif font-bold text-slate-900">
              Create New Project
            </h1>
            {formData.title && (
              <p className="text-[10px] font-mono text-slate-400 uppercase tracking-tighter mt-1 flex items-center gap-1">
                <LinkIcon className="w-2.5 h-2.5" /> daw.co.id/page/
                {generatedSlug}
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => handlePublish("Draft")}
            disabled={isLoading}
            className="px-5 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg font-bold text-sm shadow-sm transition-all active:scale-95"
          >
            <Save className="w-4 h-4 inline mr-2 text-slate-400" /> Save Draft
          </button>
          <button
            onClick={() => handlePublish("Published")}
            disabled={isLoading}
            className="px-5 py-2 bg-daw-green hover:bg-[#003b1c] text-white rounded-lg font-bold text-sm shadow-sm transition-all active:scale-95"
          >
            <Send className="w-4 h-4 inline mr-2" />{" "}
            {isLoading ? "Publishing..." : "Publish"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-8 space-y-8">
            {/* INPUT JUDUL */}
            <input
              type="text"
              placeholder="Masukkan judul proyek yang menarik..."
              className="w-full p-0 text-3xl font-serif font-bold border-none focus:ring-0 placeholder:text-slate-200 transition-all"
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
            />

            {/* INPUT EXCERPT */}
            <div className="space-y-2">
              <label className="flex justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <span>Ringkasan Konten</span>
                <span
                  className={
                    formData.excerpt.length >= 145 ? "text-red-500" : ""
                  }
                >
                  {formData.excerpt.length}/150
                </span>
              </label>
              <textarea
                placeholder="Tulis ringkasan singkat untuk tampilan kartu di halaman depan..."
                maxLength={150}
                rows={2}
                className="w-full p-4 bg-slate-50 border border-slate-100 rounded-xl outline-none text-slate-600 text-sm h-[80px] resize-none focus:ring-2 focus:ring-daw-green/5"
                value={formData.excerpt}
                onChange={(e) =>
                  setFormData({ ...formData, excerpt: e.target.value })
                }
              />
            </div>

            {/* WYSIWYG EDITOR */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Isi Artikel Utama
              </label>
              <div className="min-h-[400px] border border-slate-100 rounded-xl overflow-hidden shadow-inner">
                <ReactQuill
                  ref={quillRef}
                  theme="snow"
                  modules={modules}
                  value={formData.content}
                  onChange={(v) => setFormData({ ...formData, content: v })}
                />
              </div>
            </div>

            {/* SEO SECTION */}
            <div className="bg-slate-50/50 rounded-2xl border border-slate-200 p-8 space-y-6 shadow-inner">
              <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-2 text-slate-800">
                <Search className="w-4 h-4 text-blue-500" /> Pengaturan
                Pencarian (SEO)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <input
                    type="text"
                    placeholder="Judul Khusus Tampilan Google"
                    className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm"
                    value={formData.seo_title}
                    onChange={(e) =>
                      setFormData({ ...formData, seo_title: e.target.value })
                    }
                  />
                  <textarea
                    placeholder="Deskripsi Khusus Tampilan Google"
                    className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm h-24 resize-none"
                    value={formData.meta_description}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        meta_description: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-center">
                  <p className="text-[10px] font-black text-slate-300 uppercase mb-3">
                    Pratinjau Tampilan Google
                  </p>
                  <p className="text-[#1a0dab] text-lg font-medium truncate">
                    {formData.seo_title || formData.title || "Untitled"}
                  </p>
                  <p className="text-[#006621] text-xs truncate mb-1 font-mono">
                    daw.co.id/page/{generatedSlug}
                  </p>
                  <p className="text-[#545454] text-xs line-clamp-2 leading-relaxed">
                    {formData.meta_description ||
                      formData.excerpt ||
                      "Deskripsi belum diatur..."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SIDEBAR SETTINGS */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-800 mb-4">
              Kategori Proyek
            </h3>
            <select
              className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl font-bold text-slate-700 outline-none"
              value={formData.category}
              onChange={(e) =>
                setFormData({ ...formData, category: e.target.value })
              }
            >
              <option value="Resources">Resources Sector</option>
              <option value="Energy">Energy Sector</option>
            </select>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-xs font-black uppercase tracking-widest mb-4 flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-daw-green" /> Visual Utama
              (Sampul)
            </h3>
            <div
              {...getRootCoverProps()}
              className={`aspect-video rounded-xl border-2 border-dashed flex items-center justify-center cursor-pointer transition-all overflow-hidden ${isCoverDragActive ? "border-daw-green bg-green-50" : "border-slate-100 bg-slate-50 hover:bg-slate-100"}`}
            >
              <input {...getInputCoverProps()} />
              {coverPreview ? (
                <img
                  src={coverPreview}
                  className="w-full h-full object-cover"
                  alt="Cover Preview"
                />
              ) : formData.cover_image ? (
                <img
                  src={`${BASE_UPLOAD_URL}/${formData.cover_image}`}
                  className="w-full h-full object-cover"
                  alt="Server Image"
                />
              ) : (
                <div className="text-center">
                  <ImageIcon className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                    Upload Cover
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-xs font-black uppercase tracking-widest mb-4 flex items-center gap-2">
              <Images className="w-4 h-4 text-daw-green" /> Gallery
            </h3>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {galleryFiles.map((file, idx) => (
                <GalleryPreviewItem
                  key={idx}
                  file={file}
                  onRemove={() => removeGalleryFile(idx)}
                />
              ))}
            </div>
            <div
              {...getRootGalleryProps()}
              className={`p-6 border-2 border-dashed rounded-xl text-center cursor-pointer transition-all ${isGalleryDragActive ? "border-daw-green bg-green-50" : "border-slate-50 hover:bg-slate-100"}`}
            >
              <input {...getInputGalleryProps()} />
              <p className="text-[10px] font-black text-slate-400 uppercase">
                Tambah Foto Galeri
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
