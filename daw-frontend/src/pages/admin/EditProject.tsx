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
} from "lucide-react";
import { useDropzone } from "react-dropzone";

export default function EditProject() {
  const navigate = useNavigate();
  const { id } = useParams();
  const quillRef = useRef<ReactQuill>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);

  const [formData, setFormData] = useState({
    title: "",
    excerpt: "",
    content: "",
    category: "Resources",
    status: "Draft",
    cover_image: "",
    gallery: "[]",
  });

  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [galleryFiles, setGalleryFiles] = useState<File[]>([]);
  const removeOldGalleryImage = (indexToRemove: number) => {
    const currentGallery = JSON.parse(formData.gallery);
    const updatedGallery = currentGallery.filter(
      (_: any, idx: number) => idx !== indexToRemove,
    );
    setFormData({ ...formData, gallery: JSON.stringify(updatedGallery) });
  };

  useEffect(() => {
    const fetchProject = async () => {
      try {
        const token = localStorage.getItem("daw_token");
        const response = await fetch(
          `http://localhost:5000/api/projects/${id}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );

        const data = await response.json();

        if (response.ok) {
          setFormData({
            title: data.title,
            excerpt: data.excerpt || "", // 👈 2. TAMBAHKAN BARIS INI
            content: data.content,
            category: data.category,
            status: data.status,
            cover_image: data.cover_image || "",
            gallery: data.gallery || "[]",
          });
        } else {
          toast.error("Gagal memuat data", { description: data.message });
          navigate("/admin/projects");
        }
      } catch {
        toast.error("Error", { description: "Koneksi ke server gagal." });
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

        try {
          const token = localStorage.getItem("daw_token");
          const response = await fetch(
            "http://localhost:5000/api/projects/upload-inline",
            {
              method: "POST",
              headers: { Authorization: `Bearer ${token}` },
              body: uploadData,
            },
          );

          const data = await response.json();
          if (response.ok) {
            const quill = quillRef.current?.getEditor();
            const range = quill?.getSelection();
            quill?.insertEmbed(range?.index || 0, "image", data.url);
          } else {
            toast.error("Upload Failed", { description: data.message });
          }
        } catch (err) {
          console.error(err);
          toast.error("Server Error");
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
    if (!formData.title || !formData.content) {
      toast.error("Data is incomplete", {
        description: "Title and content must be filled in.",
      });
      return;
    }

    setIsLoading(true);
    const loadingToast = toast.loading("Updating project...");

    try {
      const payload = new FormData();
      payload.append("title", formData.title);
      payload.append("excerpt", formData.excerpt);
      payload.append("content", formData.content);
      payload.append("category", formData.category);
      payload.append("status", targetStatus);
      payload.append("existing_gallery", formData.gallery);

      if (coverFile) payload.append("cover_image", coverFile);
      if (galleryFiles.length > 0) {
        galleryFiles.forEach((file) => payload.append("gallery", file));
      }

      const token = localStorage.getItem("daw_token");

      const response = await fetch(`http://localhost:5000/api/projects/${id}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
        body: payload,
      });

      if (response.ok) {
        toast.success("Update Successful!", { id: loadingToast });
        navigate("/admin/projects");
      } else {
        const errData = await response.json();
        toast.error("Update Failed", {
          id: loadingToast,
          description: errData.message,
        });
      }
    } catch {
      toast.error("Network Error", { id: loadingToast });
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
        Loading project data...
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
          <h1 className="text-2xl font-serif font-bold">Edit Project</h1>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => handleUpdate("Draft")}
            disabled={isLoading}
            className="px-5 py-2.5 bg-white border border-slate-200 rounded-lg flex items-center gap-2"
          >
            <Save className="w-4 h-4" /> Save as Draft
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
              placeholder="Project Title..."
              className="p-6 text-3xl font-serif font-bold border-b border-slate-100 focus:outline-none"
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
            />
            <textarea
              placeholder="Short description for homepage..."
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
            <h3 className="font-bold mb-1 flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-daw-green" /> Cover Image
            </h3>
            {/* AREA PREVIEW COVER */}
            <div
              {...getRootCoverProps()}
              className={`relative group cursor-pointer border-2 border-dashed rounded-lg transition-all duration-200
      ${isCoverDragActive ? "border-daw-green bg-green-50 scale-[1.02]" : "border-slate-200 bg-slate-50"}
    `}
            >
              <input {...getInputCoverProps()} />

              <div className="h-40 flex flex-col items-center justify-center">
                {coverFile || formData.cover_image ? (
                  <div className="relative w-full h-full">
                    <img
                      src={
                        coverFile
                          ? URL.createObjectURL(coverFile)
                          : `http://localhost:5000/uploads/${formData.cover_image}`
                      }
                      className="w-full h-full object-cover rounded-lg"
                      alt="Preview"
                    />

                    {/* Overlay saat Hover atau Dragging */}
                    <div
                      className={`absolute inset-0 flex flex-col items-center justify-center rounded-lg bg-black/40 transition-opacity
            ${isCoverDragActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"}
          `}
                    >
                      <ImageIcon className="w-6 h-6 text-white mb-1" />
                      <span className="text-white text-[10px] font-bold uppercase tracking-wider">
                        {isCoverDragActive ? "Drop Now" : "Change Image"}
                      </span>
                    </div>

                    {/* Tombol X tetap berfungsi untuk reset */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation(); // Biar gak buka file picker
                        setCoverFile(null);
                        setFormData({ ...formData, cover_image: "" });
                      }}
                      className="absolute -top-2 -right-2 p-1.5 bg-red-500 text-white rounded-full shadow-lg z-10 hover:bg-red-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center text-slate-400">
                    <ImageIcon className="w-8 h-8 mb-2 opacity-20" />
                    <span className="text-xs font-medium">
                      Drag & drop or click
                    </span>
                    <span className="text-[10px] opacity-60 italic">
                      PNG, JPG up to 5MB
                    </span>
                  </div>
                )}
              </div>
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
                          src={`http://localhost:5000/uploads/${imgName}`}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 opacity-90"
                          alt="Saved Gallery"
                        />
                        <div className="absolute inset-0 bg-black/10 group-hover:bg-black/20 transition-colors flex items-center justify-center pointer-events-none">
                          <span className="text-[9px] text-white font-black uppercase bg-daw-green/80 backdrop-blur-sm px-2 py-0.5 rounded-full shadow-sm tracking-tighter">
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
                  <div
                    key={`new-${idx}`}
                    className="relative aspect-square group"
                  >
                    <img
                      src={URL.createObjectURL(file)}
                      className="w-full h-full object-cover rounded-md border border-daw-green/30"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setGalleryFiles((prev) =>
                          prev.filter((_, i) => i !== idx),
                        )
                      }
                      className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 shadow-sm"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
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
                  ? "Drop them here!"
                  : "Add or Replace Gallery"}
              </p>
              <p className="text-[10px] text-slate-400">
                Drag multiple images here
              </p>
            </div>
          </div>
          ;
        </div>
      </div>
    </div>
  );
}
