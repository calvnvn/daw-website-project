import { useState, useRef, useMemo, useCallback, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";
import { toast } from "sonner";
import {
  ArrowLeft,
  Image as ImageIcon,
  Images,
  Save,
  Send,
  X,
  Plus,
  Search,
} from "lucide-react";
import { useDropzone } from "react-dropzone";
import api, { BASE_UPLOAD_URL } from "@/lib/api";
import { compressImage } from "@/utils/imageHelper"; //  Import yang hilang

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
        className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity z-10"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
};

export default function EditProject() {
  const navigate = useNavigate();
  const { id } = useParams();
  const quillRef = useRef<ReactQuill>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);

  //  FIXED: Definisi state awal lengkap dengan SEO
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

  const generatedSlug = useMemo(() => {
    return formData.title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "");
  }, [formData.title]);

  // Sync Cover Preview
  useEffect(() => {
    if (!coverFile) {
      setCoverPreview(null);
      return;
    }
    const objectUrl = URL.createObjectURL(coverFile);
    setCoverPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [coverFile]);

  //  FIXED: Ganti any dengan type string pada gallery mapping
  const removeOldGalleryImage = (indexToRemove: number) => {
    try {
      const currentGallery: string[] = JSON.parse(formData.gallery);
      const updatedGallery = currentGallery.filter(
        (_, idx) => idx !== indexToRemove,
      );
      setFormData({ ...formData, gallery: JSON.stringify(updatedGallery) });
    } catch (e) {
      console.error("Gallery parse error", e);
    }
  };

  useEffect(() => {
    const fetchProject = async () => {
      try {
        const response = await api.get(`/projects/${id}`);
        const data = response.data.data || response.data;

        setFormData({
          title: data.title || "",
          excerpt: data.excerpt || "",
          content: data.content || "",
          category: data.category || "Resources",
          status: data.status || "Draft",
          cover_image: data.cover_image || "",
          gallery:
            typeof data.gallery === "string"
              ? data.gallery
              : JSON.stringify(data.gallery || []),
          seo_title: data.seo_title || "",
          meta_description: data.meta_description || "",
        });
      } catch {
        toast.error("Gagal memuat data");
        navigate("/admin/projects");
      } finally {
        setIsFetching(false);
      }
    };
    fetchProject();
  }, [id, navigate]);

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

        const toastId = toast.loading("Uploading image...");
        try {
          // Pakai api instance, bukan fetch manual
          const response = await api.post(
            "/projects/upload-inline",
            uploadData,
          );
          const quill = quillRef.current?.getEditor();
          const range = quill?.getSelection();
          quill?.insertEmbed(range?.index || 0, "image", response.data.url);
          toast.success("Image uploaded", { id: toastId });
        } catch (err) {
          toast.error("Upload Failed", { id: toastId });
          console.error(err);
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

  // 3. Update Logic (Pakai method PUT)
  const handleUpdate = async (targetStatus: string) => {
    setIsLoading(true);
    const loadingToast = toast.loading("Saving changes...");

    try {
      const payload = new FormData();

      if (coverFile) {
        const optimizedCover = await compressImage(coverFile);
        payload.append("cover_image", optimizedCover);
      }

      for (const file of galleryFiles) {
        const optimizedFile = await compressImage(file);
        payload.append("gallery", optimizedFile);
      }

      // Append sisanya
      payload.append("title", formData.title);
      payload.append("excerpt", formData.excerpt);
      payload.append("content", formData.content);
      payload.append("category", formData.category);
      payload.append("status", targetStatus);
      payload.append("existing_gallery", formData.gallery);
      payload.append("seo_title", formData.seo_title);
      payload.append("meta_description", formData.meta_description);

      await api.put(`/projects/${id}`, payload);

      toast.success("Project updated!", { id: loadingToast });
      navigate("/admin/projects");
    } catch (err) {
      toast.error("Update failed", { id: loadingToast });
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const onDropCover = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setCoverFile(acceptedFiles[0]);
    }
  }, []);

  const {
    getRootProps: getRootCoverProps,
    getInputProps: getInputCoverProps,
    isDragActive: isCoverDragActive,
  } = useDropzone({
    onDrop: onDropCover,
    accept: { "image/*": [] },
    multiple: false,
  });

  const onDropGallery = useCallback((acceptedFiles: File[]) => {
    setGalleryFiles((prev) => [...prev, ...acceptedFiles]);
  }, []);

  const {
    getRootProps: getRootGalleryProps,
    getInputProps: getInputGalleryProps,
    isDragActive: isGalleryDragActive,
  } = useDropzone({
    onDrop: onDropGallery,
    accept: { "image/*": [] },
    multiple: true,
  });

  if (isFetching) {
    return (
      <div className="p-12 text-center text-slate-500">
        Sedang memuat data proyek...
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto animate-in fade-in duration-500 pb-12">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/admin/projects")}
            className="p-2 hover:bg-slate-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5 text-slate-500" />
          </button>
          <h1 className="text-2xl font-serif font-bold">Edit Proyek</h1>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => handleUpdate("Draft")}
            disabled={isLoading}
            className="px-5 py-2.5 bg-white border border-slate-200 rounded-lg flex items-center gap-2"
          >
            <Save className="w-4 h-4" /> Simpan sebagai Draf
          </button>
          <button
            onClick={() => handleUpdate("Published")}
            disabled={isLoading}
            className="px-5 py-2.5 bg-daw-green text-white rounded-lg flex items-center gap-2 disabled:opacity-50"
          >
            <Send className="w-4 h-4" />{" "}
            {isLoading ? "Updating..." : "Update & Publish"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[600px]">
            <input
              type="text"
              placeholder="Masukkan Judul Proyek..."
              className="p-6 text-3xl font-serif font-bold border-b border-slate-100 focus:outline-none"
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
            />
            <textarea
              placeholder="Ringkasan singkat untuk tampilan beranda (Maks. 150 karakter)."
              maxLength={150}
              rows={2}
              className="w-full p-6 text-slate-500 text-lg border-b border-slate-100 focus:outline-none resize-none bg-slate-50/50"
              value={formData.excerpt}
              onChange={(e) =>
                setFormData({ ...formData, excerpt: e.target.value })
              }
            />
            <div className="flex-1 bg-white">
              <ReactQuill
                ref={quillRef}
                theme="snow"
                modules={modules}
                value={formData.content}
                onChange={(content) => setFormData({ ...formData, content })}
                className="h-full min-h-[400px]"
              />
            </div>
            {/* --- SEO & METADATA ENGINE --- */}
            <div className="bg-slate-50/50 rounded-2xl border border-slate-200 p-8 mt-12 space-y-6 shadow-inner">
              <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-2 text-slate-800">
                <Search className="w-4 h-4 text-blue-500" /> Pengaturan
                Pencarian (SEO)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase block mb-2">
                      Judul Custom Pencarian Google
                    </label>
                    <input
                      type="text"
                      placeholder="Kosongkan jika ingin menggunakan judul proyek di atas."
                      className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
                      value={formData.seo_title}
                      onChange={(e) =>
                        setFormData({ ...formData, seo_title: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase block mb-2">
                      Deskripsi Pencarian (SEO)
                    </label>
                    <textarea
                      placeholder="Disarankan: Kurang dari 160 karakter"
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
                </div>

                {/* Live Google Snippet Preview */}
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
        </div>

        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <h3 className="font-bold mb-4">Settings</h3>
            <div className="space-y-4">
              <label className="block text-xs font-bold text-slate-500 uppercase">
                Category
              </label>
              <select
                className="w-full p-2.5 bg-slate-50 border rounded-lg"
                value={formData.category}
                onChange={(e) =>
                  setFormData({ ...formData, category: e.target.value })
                }
              >
                <option value="Resources">Resources</option>
                <option value="Energy">Energy</option>
              </select>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <h3 className="font-bold mb-3 flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-daw-green" /> Gambar Sampul
              Utama
            </h3>
            <div
              {...getRootCoverProps()}
              className={`aspect-video rounded-xl border-2 border-dashed flex items-center justify-center cursor-pointer transition-all overflow-hidden ${
                isCoverDragActive
                  ? "border-daw-green bg-green-50"
                  : "border-slate-100 bg-slate-50 hover:bg-slate-100"
              }`}
            >
              <input {...getInputCoverProps()} />
              {coverPreview ? (
                // Preview file yang baru di-drop
                <img
                  src={coverPreview}
                  className="w-full h-full object-cover"
                  alt="New Preview"
                />
              ) : formData.cover_image ? (
                //  FIXED: Gambar lama dari server (PASTIKAN ABSOLUT)
                <img
                  src={`${BASE_UPLOAD_URL}/${formData.cover_image}`}
                  className="w-full h-full object-cover"
                  alt="Current Server Image"
                  onError={(e) => {
                    // Jika masih gagal, kita paksa cek apakah ada double slash
                    console.error(
                      "Gagal load gambar:",
                      (e.target as HTMLImageElement).src,
                    );
                  }}
                />
              ) : (
                <div className="text-center p-4">
                  <ImageIcon className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                  <p className="text-[10px] font-bold text-slate-400 uppercase">
                    Gambar belum dipilih
                  </p>
                </div>
              )}
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <h3 className="font-bold mb-3 flex items-center gap-2">
              <Images className="w-4 h-4 text-daw-green" /> Gallery
            </h3>

            {/* Preview Grid */}
            {(galleryFiles.length > 0 ||
              (formData.gallery &&
                JSON.parse(formData.gallery).length > 0)) && (
              <div className="grid grid-cols-3 gap-2 mb-4">
                {/* Gambar Lama dari Server */}
                {formData.gallery &&
                  JSON.parse(formData.gallery).map(
                    (imgName: string, idx: number) => (
                      <div
                        key={`added-${idx}`}
                        className="relative aspect-square group rounded-xl overflow-hidden border border-slate-100 shadow-sm"
                      >
                        <img
                          src={`${BASE_UPLOAD_URL}/${imgName}`}
                          className="..."
                          alt="Saved Gallery"
                        />
                        <div className="absolute inset-0 bg-black/10 group-hover:bg-black/20 transition-colors flex items-center justify-center pointer-events-none">
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
                          className="absolute top-1.5 right-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full p-1.5 shadow-lg opacity-0 group-hover:opacity-100 transition-all duration-200 transform hover:scale-110 z-30"
                          title="Remove this image"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ),
                  )}

                {/* Gambar Baru yang di-Drop/Pilih */}
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

            {/* Dropzone Area untuk Gallery */}
            <div
              {...getRootGalleryProps()}
              className={`p-6 border-2 border-dashed rounded-lg text-center cursor-pointer transition-all
      ${isGalleryDragActive ? "border-daw-green bg-green-50" : "border-slate-200 hover:bg-slate-50"}
    `}
            >
              <input {...getInputGalleryProps()} />
              <Plus
                className={`w-6 h-6 mx-auto mb-2 transition-transform ${isGalleryDragActive ? "scale-150 text-daw-green" : "text-slate-300"}`}
              />
              <p className="text-[11px] font-bold text-slate-600 uppercase tracking-tight">
                {isGalleryDragActive
                  ? "Lepaskan gambar di sini!"
                  : "Tambah atau Ganti Foto Galeri"}
              </p>
              <p className="text-[10px] text-slate-400">
                Tarik beberapa gambar ke sini atau klik untuk memilih file.
              </p>
            </div>
          </div>
          ;
        </div>
      </div>
    </div>
  );
}
