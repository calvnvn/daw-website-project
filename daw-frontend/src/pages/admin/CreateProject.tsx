import { useState, useRef, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
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
} from "lucide-react";
import { useDropzone } from "react-dropzone";
import api from "@/lib/api";

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
  });

  const removeGalleryFile = (index: number) => {
    setGalleryFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [galleryFiles, setGalleryFiles] = useState<File[]>([]);

  // 1. Image Handler untuk WYSIWYG
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
          console.error("Inline upload error:", err); // Pakai 'err' agar satpam diam
          toast.error("Server Error", {
            description: "Failed to connect to server.",
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
    if (!formData.title.trim()) {
      return toast.error("Title Must Be Filled In", {
        description: "Please name your project.",
      });
    }

    if (!formData.content || formData.content === "<p><br></p>") {
      return toast.error("Empty Content", {
        description: "Write the content of the article first..",
      });
    }

    if (targetStatus === "Published" && !coverFile) {
      return toast.error("Cover Image Missing", {
        description: "Published projects must have a cover image..",
      });
    }
    const MAX_SIZE = 10 * 1024 * 1024;

    if (coverFile && coverFile.size > MAX_SIZE) {
      return toast.error("File Cover Terlalu Besar", {
        description: "Maksimal ukuran gambar adalah 10MB.",
      });
    }

    const bigGalleryFile = galleryFiles.find((file) => file.size > MAX_SIZE);
    if (bigGalleryFile) {
      return toast.error("File Galeri Terlalu Besar", {
        description: `File ${bigGalleryFile.name} melebihi 10MB.`,
      });
    }

    setIsLoading(true);
    const loadingToast = toast.loading("Publishing to DAW Database...");

    try {
      const payload = new FormData();
      payload.append("title", formData.title);
      payload.append("excerpt", formData.excerpt);
      payload.append("content", formData.content);
      payload.append("category", formData.category);
      payload.append("status", targetStatus);

      const userStr = localStorage.getItem("daw_user");
      const authorName = userStr ? JSON.parse(userStr).name : "Unknown Author";
      payload.append("author", authorName);

      if (coverFile) payload.append("cover_image", coverFile);
      galleryFiles.forEach((file) => payload.append("gallery", file));

      // 3. EKSEKUSI DENGAN AXIOS
      // Penjelasan: Axios menerima (URL, Data, Config)
      const response = await api.post("/projects", payload, {
        // Fitur Progress Bar
        onUploadProgress: (progressEvent) => {
          const total = progressEvent.total || 0;
          const current = progressEvent.loaded;

          if (total > 0) {
            const percent = Math.round((current * 100) / total);
            // Kita perbarui teks toast yang sama menggunakan ID loadingToast
            toast.loading(`Uploading: ${percent}% completed...`, {
              id: loadingToast,
            });
          }
        },
      });

      // 4. Handle Response Sukses
      // Axios menganggap 2xx sebagai sukses. Status create biasanya 201.
      if (response.status === 201 || response.status === 200) {
        toast.success(
          `Project ${targetStatus === "Draft" ? "Saved" : "Published"}!`,
          { id: loadingToast },
        );
        navigate("/admin/projects");
      }
    } catch (err: any) {
      // 5. Handle Error
      // Axios menyimpan pesan error dari backend di err.response.data
      console.error("Publish error:", err);
      const errorMessage =
        err.response?.data?.message || "Connection to server failed.";

      toast.error("Error", {
        description: errorMessage,
        id: loadingToast,
      });
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
    multiple: true, // Boleh banyak
  });

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
          <h1 className="text-2xl font-serif font-bold">Create New Project</h1>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => handlePublish("Draft")}
            disabled={isLoading}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg font-medium transition-colors shadow-sm disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>Save Draft</span>
          </button>
          <button
            onClick={() => handlePublish("Published")}
            disabled={isLoading}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-daw-green hover:bg-[#003b1c] text-white rounded-lg font-medium transition-colors shadow-sm disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            <span>{isLoading ? "Processing..." : "Publish"}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[600px]">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-8">
              {/* 1. TITLE INPUT */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">
                  Project Title
                </label>
                <input
                  type="text"
                  placeholder="Enter project title..."
                  className={`w-full p-4 text-2xl font-serif font-bold border rounded-lg focus:outline-none focus:ring-2 focus:ring-daw-green/50 transition-all ${
                    !formData.title
                      ? "border-red-200 bg-red-50/30"
                      : "border-slate-200 bg-slate-50/50"
                  }`}
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                />
              </div>

              {/* 2. SHORT DESCRIPTION */}
              <div>
                <label className="flex items-center justify-between text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">
                  <span>Short Description</span>
                  <span className="text-xs font-normal text-slate-400 lowercase tracking-normal">
                    {formData.excerpt.length}/150 characters
                  </span>
                </label>
                <textarea
                  placeholder="A brief summary for the homepage card (max 150 chars)..."
                  maxLength={150}
                  rows={
                    2
                  } /* 👇 Kunci 1: Paksa hanya 2 baris agar terlihat seperti 'ringkasan' */
                  className="w-full p-4 text-slate-600 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-daw-green/50 bg-slate-50/50 resize-none transition-all h-[80px]"
                  value={formData.excerpt}
                  onChange={(e) =>
                    setFormData({ ...formData, excerpt: e.target.value })
                  }
                />
              </div>

              {/* 3. MAIN ARTICLE */}
              <div className="flex flex-col flex-1">
                {" "}
                {/* Flex-1 agar dia mengisi sisa ruang */}
                <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">
                  Main Article Content
                </label>
                <div
                  className="rounded-lg overflow-hidden border border-slate-200 flex-1 flex flex-col min-h-[400px]
                  [&_.quill]:flex-1 [&_.quill]:flex [&_.quill]:flex-col
                  [&_.ql-container]:flex-1 [&_.ql-container]:flex [&_.ql-container]:flex-col
                  [&_.ql-editor]:flex-1 [&_.ql-editor]:text-lg [&_.ql-toolbar]:bg-slate-50"
                >
                  <ReactQuill
                    ref={quillRef}
                    theme="snow"
                    modules={modules}
                    value={formData.content}
                    onChange={(content) =>
                      setFormData({ ...formData, content })
                    }
                  />
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
              <ImageIcon className="w-4 h-4 text-daw-green" /> Cover Image
            </h3>
            {/* AREA PREVIEW */}
            <div
              {...getRootCoverProps()}
              className={`relative group cursor-pointer border-2 border-dashed rounded-lg transition-all
        ${isCoverDragActive ? "border-daw-green bg-green-50" : "border-slate-200 bg-slate-50"}
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
                    {/* Overlay saat Dragging atau Hover */}
                    <div
                      className={`absolute inset-0 flex items-center justify-center rounded-lg transition-opacity bg-black/40 
              ${isCoverDragActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"}
            `}
                    >
                      <span className="text-white text-xs font-medium">
                        Drop to replace image
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center text-slate-400">
                    <ImageIcon className="w-8 h-8 mb-2 opacity-20" />
                    <span className="text-xs font-medium">
                      Drag & drop or click to upload
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
            {/*  PREVIEW GALLERY GRID  */}
            {galleryFiles.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mb-4">
                {galleryFiles.map((file, idx) => (
                  <div key={idx} className="relative aspect-square group">
                    <img
                      src={URL.createObjectURL(file)}
                      className="w-full h-full object-cover rounded-md border border-slate-100"
                    />
                    {/* Tambahkan tombol hapus di tiap foto gallery */}
                    <button
                      type="button"
                      onClick={() => removeGalleryFile(idx)}
                      className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div
              {...getRootGalleryProps()}
              className={`p-6 border-2 border-dashed rounded-lg text-center cursor-pointer transition-colors
      ${isGalleryDragActive ? "border-daw-green bg-green-50" : "border-slate-200 hover:bg-slate-50"}
    `}
            >
              <input {...getInputGalleryProps()} />
              <Images className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              <p className="text-sm text-slate-600">
                Drag & drop gallery images here
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Supports: JPG, PNG, WEBP
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
