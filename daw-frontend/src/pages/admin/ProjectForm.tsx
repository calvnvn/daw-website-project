/**
 * MODULE: Universal Project Form (Create & Edit)
 * PATH: /src/pages/admin/ProjectForm.tsx
 * * TECHNICAL DOCUMENTATION:
 * 1. Unified Logic: Handles both POST (Create) and PUT (Edit) seamlessly via isEditMode flag.
 * 2. Memory Leak Guard: Sub-component handles individual gallery object URLs safely.
 * 3. SEO Intelligence: Optimized fallback and slug preview.
 * 4. Progress Tracking: Real-time upload percentage for large assets.
 */

import { useState, useRef, useMemo, useCallback, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
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
  Plus,
} from "lucide-react";
import { useDropzone } from "react-dropzone";
import api, { BASE_UPLOAD_URL } from "@/lib/api";
import { compressImage } from "@/utils/imageHelper";
import { useAuth } from "@/contexts/AuthContext";
import { useBusiness } from "@/contexts/BusinessContext";

// --- SUB-COMPONENT: GALLERY PREVIEW ---
const GalleryPreviewItem = ({
  file,
  onRemove,
}: {
  file: File;
  onRemove: () => void;
}) => {
  const [preview, setPreview] = useState<string>("");

  useEffect(() => {
    let isMounted = true;
    const objectUrl = URL.createObjectURL(file);
    if (isMounted) setPreview(objectUrl);
    return () => {
      isMounted = false;
      URL.revokeObjectURL(objectUrl);
    };
  }, [file]);

  return (
    <div className="relative aspect-square rounded-lg overflow-hidden group border border-slate-100 shadow-sm">
      {preview && (
        <img
          src={preview}
          className="w-full h-full object-cover"
          alt="Preview"
        />
      )}
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

// --- MAIN COMPONENT ---
export default function ProjectForm() {
  const navigate = useNavigate();
  const { id } = useParams(); // Jika ada ID, berarti Edit Mode
  const isEditMode = !!id;
  const quillRef = useRef<ReactQuill>(null);
  const { user, can } = useAuth();
  const { sections } = useBusiness(); // FIX 1: Panggil Business Context
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(isEditMode); // Fetching hanya aktif jika Edit Mode

  const [formData, setFormData] = useState({
    title: "",
    excerpt: "",
    content: "",
    category: "",
    status: "Draft",
    cover_image: "",
    gallery: "[]",
    seo_title: "",
    meta_description: "",
  });

  const parsedGallery = useMemo(() => {
    try {
      return typeof formData.gallery === "string"
        ? JSON.parse(formData.gallery)
        : [];
    } catch {
      return [];
    }
  }, [formData.gallery]);

  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [galleryFiles, setGalleryFiles] = useState<File[]>([]);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);

  // Auto-generate Slug untuk SEO Preview
  const generatedSlug = useMemo(() => {
    return formData.title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "");
  }, [formData.title]);

  // Sync Cover Preview Memory Safe
  useEffect(() => {
    if (!coverFile) {
      setCoverPreview(null);
      return;
    }
    const objectUrl = URL.createObjectURL(coverFile);
    setCoverPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [coverFile]);

  useEffect(() => {
    if (!isEditMode && sections.length > 0 && !formData.category) {
      setFormData((prev) => ({ ...prev, category: sections[0].id }));
    }
  }, [sections, isEditMode, formData.category]);

  // --- LOGIC: FETCH EXISTING DATA (EDIT MODE ONLY) ---
  useEffect(() => {
    if (!isEditMode) {
      setFormData({
        title: "",
        excerpt: "",
        content: "",
        category: "",
        status: "Draft",
        cover_image: "",
        gallery: "[]",
        seo_title: "",
        meta_description: "",
      });
      setCoverFile(null);
      setGalleryFiles([]);
      setCoverPreview(null);
      setIsFetching(false);
      return;
    }
    const fetchProject = async () => {
      setIsFetching(true);
      try {
        const response = await api.get(`/projects/${id}`);
        const data = response.data.data || response.data;
        setFormData({
          title: data.title || "",
          excerpt: data.excerpt || "",
          content: data.content || "",
          category: data.category || "",
          status: data.status || "Draft",
          cover_image: data.cover_image || "",
          gallery:
            typeof data.gallery === "string"
              ? data.gallery
              : JSON.stringify(data.gallery || []),
          seo_title: data.seo_title || "",
          meta_description: data.meta_description || "",
        });
      } catch (error) {
        console.error("Fetch Error:", error);
        toast.error("Gagal memuat data proyek");
        navigate("/admin/projects");
      } finally {
        setIsFetching(false);
      }
    };
    fetchProject();
  }, [id, isEditMode, navigate]);

  // Remove existing gallery image (Edit Mode)
  const removeOldGalleryImage = (indexToRemove: number) => {
    const updatedGallery = parsedGallery.filter(
      (_: any, idx: number) => idx !== indexToRemove,
    );
    setFormData({ ...formData, gallery: JSON.stringify(updatedGallery) });
  };

  // --- QUILL: IMAGE HANDLER ---
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

        const toastId = toast.loading("Mengunggah gambar...");
        try {
          const response = await api.post(
            "/projects/upload-inline",
            uploadData,
          );
          const quill = quillRef.current?.getEditor();
          if (!quill) throw new Error("Quill editor is not ready");

          const range = quill.getSelection(true);
          const index = range ? range.index : quill.getLength();

          quill.insertEmbed(index, "image", response.data.url);
          quill.setSelection(index + 1);

          toast.success("Gambar disisipkan!", { id: toastId });
        } catch (err: any) {
          toast.error("Upload gagal", {
            id: toastId,
            description: err.response?.data?.message || "Error",
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

  // --- UNIFIED SAVE LOGIC ---
  const handleSave = async (targetStatus: string) => {
    if (!formData.title.trim())
      return toast.error("Judul proyek tidak boleh kosong.");

    const plainTextContent = formData.content.replace(/<[^>]*>?/gm, "").trim();
    if (!formData.content || plainTextContent.length === 0) {
      return toast.error("Isi artikel wajib diisi.");
    }

    const isCategoryValid = sections.some(
      (sec) => sec.id === formData.category,
    );
    if (!isCategoryValid) {
      return toast.error(
        "Kategori proyek tidak valid atau telah terhapus. Silakan pilih kategori yang baru.",
      );
    }

    if (targetStatus === "Published" && !coverFile && !formData.cover_image) {
      return toast.error("Gambar sampul wajib ada untuk publikasi.");
    }

    setIsLoading(true);
    const loadingToast = toast.loading(
      `${isEditMode ? "Memperbarui" : "Menyimpan"} proyek...`,
    );

    try {
      const payload = new FormData();

      // Optimize & Append Files
      if (coverFile) {
        payload.append("cover_image", await compressImage(coverFile));
      }
      for (const file of galleryFiles) {
        payload.append("gallery", await compressImage(file));
      }

      // Append Texts
      payload.append("title", formData.title.trim());
      if (generatedSlug) {
        payload.append("slug", generatedSlug);
      }
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

      // Jika Edit Mode, kirim sisa galeri lama agar tidak terhapus di backend
      if (isEditMode) {
        payload.append("existing_gallery", formData.gallery);
      }

      // Append Author (Dari Local Storage)
      payload.append("author", user?.name || "Admin DAW");

      // Dinamis menggunakan POST (Create) atau PUT (Edit)
      const endpoint = isEditMode ? `/projects/${id}` : "/projects";
      const method = isEditMode ? api.put : api.post;

      const response = await method(endpoint, payload, {
        onUploadProgress: (p) => {
          const percent = Math.round((p.loaded * 100) / (p.total || 1));
          toast.loading(`Mengunggah: ${percent}%...`, { id: loadingToast });
        },
      });

      if (response.status === 201 || response.status === 200) {
        toast.success(
          `Proyek berhasil di${isEditMode ? "perbarui" : "simpan"}!`,
          { id: loadingToast },
        );
        navigate("/admin/projects");
      }
    } catch (err: any) {
      toast.error("Gagal", {
        description: err.response?.data?.message || "Terjadi kesalahan server.",
        id: loadingToast,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // --- DROPZONE HANDLERS ---
  const {
    getRootProps: getRootCoverProps,
    getInputProps: getInputCoverProps,
    isDragActive: isCoverDragActive,
  } = useDropzone({
    onDrop: (files) => files.length > 0 && setCoverFile(files[0]),
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

  if (isFetching) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-daw-green border-t-transparent rounded-full animate-spin"></div>
          Memuat data proyek...
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto animate-in fade-in duration-500">
      {/* TOOLBAR HEADER */}
      <div className="flex items-center justify-between mb-6 top-0 bg-[#F8FAFC]/90 backdrop-blur-md z-[40] py-4 border-b border-slate-200">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/admin/projects")}
            className="p-2 hover:bg-white rounded-lg transition-all border border-transparent hover:border-slate-200 shadow-sm"
          >
            <ArrowLeft className="w-5 h-5 text-slate-500" />
          </button>
          <div>
            <h1 className="text-xl font-serif font-bold text-slate-900">
              {isEditMode ? "Edit Proyek" : "Create New Project"}
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
            onClick={() => handleSave("Draft")}
            disabled={isLoading || !can("manage_projects")}
            className="px-5 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg font-bold text-sm shadow-sm transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4 inline mr-2 text-slate-400" /> Draf
          </button>
          <button
            onClick={() => handleSave("Published")}
            disabled={isLoading || !can("manage_projects")}
            className="px-5 py-2 bg-daw-green hover:bg-[#003b1c] text-white rounded-lg font-bold text-sm shadow-sm transition-all active:scale-95 disabled:opacity-50"
          >
            <Send className="w-4 h-4 inline mr-2" />{" "}
            {isLoading
              ? "Menyimpan..."
              : isEditMode
                ? "Update & Publish"
                : "Publish"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* KIRI: CONTENT AREA */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col p-0 md:p-8 space-y-8">
            <input
              type="text"
              placeholder="Masukkan judul proyek yang menarik..."
              className="w-full px-6 pt-6 pb-4 text-3xl font-serif font-bold border-b border-slate-100 focus:outline-none placeholder:text-slate-300"
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
            />

            <div className="px-6 space-y-2">
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
                placeholder="Tulis ringkasan singkat untuk tampilan beranda (Maks. 150 karakter)..."
                maxLength={150}
                rows={2}
                className="w-full p-4 bg-slate-50 border border-slate-100 rounded-xl outline-none text-slate-600 text-sm h-[80px] resize-none focus:ring-2 focus:ring-daw-green/10"
                value={formData.excerpt}
                onChange={(e) =>
                  setFormData({ ...formData, excerpt: e.target.value })
                }
              />
            </div>

            <div className="px-6 pb-6 space-y-2 flex-1 flex flex-col">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Isi Artikel Utama
              </label>
              <div className="flex-1 min-h-[400px] max-h-[600px] border border-slate-100 rounded-xl overflow-hidden shadow-inner flex flex-col bg-white">
                <ReactQuill
                  ref={quillRef}
                  theme="snow"
                  modules={modules}
                  value={formData.content}
                  onChange={(v) => setFormData({ ...formData, content: v })}
                  className="flex-1 overflow-y-auto"
                />
              </div>
            </div>
          </div>

          {/* SEO ENGINE */}
          <div className="bg-slate-50/50 rounded-2xl border border-slate-200 p-8 space-y-6 shadow-inner">
            <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-2 text-slate-800">
              <Search className="w-4 h-4 text-blue-500" /> Pengaturan Pencarian
              (SEO)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <input
                  type="text"
                  placeholder="Judul Khusus Tampilan Google"
                  className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
                  value={formData.seo_title}
                  onChange={(e) =>
                    setFormData({ ...formData, seo_title: e.target.value })
                  }
                />
                <textarea
                  placeholder="Deskripsi SEO (Disarankan < 160 karakter)"
                  className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm h-24 resize-none outline-none focus:ring-2 focus:ring-blue-500/20"
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
                  {formData.seo_title || formData.title || "Untitled Project"}
                </p>
                <p className="text-[#006621] text-xs truncate mb-1 font-mono">
                  daw.co.id/page/{generatedSlug}
                </p>
                <p className="text-[#545454] text-xs line-clamp-2 leading-relaxed">
                  {formData.meta_description ||
                    formData.excerpt ||
                    "Masukkan deskripsi untuk membantu performa pencarian Google."}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* KANAN: SIDEBAR */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-800 mb-4">
              Kategori Proyek
            </h3>

            {/* FIX 5: Render Dropdown Dinamis & Deteksi Yatim */}
            {(() => {
              const isCurrentCategoryValid = sections.some(
                (sec) => sec.id === formData.category,
              );

              return (
                <select
                  className={`w-full p-3 bg-slate-50 border rounded-xl font-bold outline-none transition-colors ${
                    !isCurrentCategoryValid && formData.category
                      ? "border-red-500 text-red-600 focus:ring-2 focus:ring-red-200"
                      : "border-slate-100 text-slate-700 focus:ring-2 focus:ring-daw-green/20"
                  }`}
                  value={formData.category}
                  onChange={(e) =>
                    setFormData({ ...formData, category: e.target.value })
                  }
                >
                  {/* Munculkan peringatan merah HANYA jika kategori tidak valid (Yatim) */}
                  {!isCurrentCategoryValid && formData.category && (
                    <option
                      value={formData.category}
                      disabled
                      className="text-red-500 font-bold"
                    >
                      ⚠️ Sektor Terhapus (Pilih Ulang)
                    </option>
                  )}

                  {/* Render data dinamis */}
                  {sections.map((sec) => (
                    <option
                      key={sec.id}
                      value={sec.id}
                      className="text-slate-700"
                    >
                      {sec.category}
                    </option>
                  ))}
                </select>
              );
            })()}

            {!sections.some((sec) => sec.id === formData.category) &&
              formData.category && (
                <p className="text-[10px] text-red-500 font-bold mt-2 leading-tight">
                  Sektor sebelumnya telah dihapus. Anda wajib memilih sektor
                  baru sebelum menyimpan.
                </p>
              )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-xs font-black uppercase tracking-widest mb-4 flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-daw-green" /> Gambar Sampul
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
                  alt="Server Cover"
                />
              ) : (
                <div className="text-center p-4">
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
              <Images className="w-4 h-4 text-daw-green" /> Galeri
            </h3>

            {/* GRID PREVIEW: Existing Server Images + New Files */}
            {(galleryFiles.length > 0 ||
              (formData.gallery &&
                JSON.parse(formData.gallery).length > 0)) && (
              <div className="grid grid-cols-3 gap-2 mb-4">
                {/* 1. Server Images (Edit Mode) */}
                {isEditMode &&
                  formData.gallery &&
                  JSON.parse(formData.gallery || "[]").map(
                    (imgName: string, idx: number) => (
                      <div
                        key={`old-${idx}`}
                        className="relative aspect-square group rounded-xl overflow-hidden border border-slate-100 shadow-sm"
                      >
                        <img
                          src={`${BASE_UPLOAD_URL}/${imgName}`}
                          className="w-full h-full object-cover"
                          alt="Saved"
                        />
                        <div className="absolute inset-0 bg-black/10 group-hover:bg-black/20 flex items-center justify-center pointer-events-none">
                          <span className="text-[9px] text-white font-black uppercase bg-daw-green/80 px-2 py-0.5 rounded-full shadow-sm tracking-tighter">
                            Saved
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeOldGalleryImage(idx);
                          }}
                          className="absolute top-1.5 right-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full p-1.5 shadow-lg opacity-0 group-hover:opacity-100 transition-all transform hover:scale-110 z-30"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ),
                  )}

                {/* 2. New Local Images */}
                {galleryFiles.map((file, idx) => (
                  <GalleryPreviewItem
                    key={`new-${idx}`}
                    file={file}
                    onRemove={() =>
                      setGalleryFiles((prev) =>
                        prev.filter((_, i) => i !== idx),
                      )
                    }
                  />
                ))}
              </div>
            )}

            <div
              {...getRootGalleryProps()}
              className={`p-6 border-2 border-dashed rounded-lg text-center cursor-pointer transition-all ${isGalleryDragActive ? "border-daw-green bg-green-50" : "border-slate-200 hover:bg-slate-50"}`}
            >
              <input {...getInputGalleryProps()} />
              <Plus
                className={`w-6 h-6 mx-auto mb-2 transition-transform ${isGalleryDragActive ? "scale-150 text-daw-green" : "text-slate-300"}`}
              />
              <p className="text-[11px] font-bold text-slate-600 uppercase tracking-tight">
                {isGalleryDragActive
                  ? "Lepaskan gambar!"
                  : "Tambah Foto Galeri"}
              </p>
              <p className="text-[10px] text-slate-400 mt-1">
                Tarik atau klik area ini.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
