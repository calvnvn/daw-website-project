/* eslint-disable @typescript-eslint/ban-ts-comment */
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
import { Link, useNavigate, useParams } from "react-router-dom";
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
  AlertTriangle,
  LockIcon,
  Loader2,
  AlertCircle,
  Clock,
  RotateCcw,
} from "lucide-react";
import { useDropzone } from "react-dropzone";
import api, { BASE_UPLOAD_URL } from "@/lib/api";
import { compressImage } from "@/utils/imageHelper";
import { useAuth } from "@/contexts/AuthContext";
import { useBusiness } from "@/contexts/BusinessContext";

// Tambahkan di bagian atas file jika Anda menggunakan TypeScript yang ketat
interface RejectedDraft {
  notrans: string;
  module_name: string;
  payload: any;
  rejection_reason: string | null; // Kolom baru dari backend
  createdAt: string;
  updatedAt: string;
}

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
        className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:bg-red-600 shadow-md">
        <X className="w-3 h-3" />
      </button>
    </div>
  );
};

// --- MAIN COMPONENT ---
export default function ProjectForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = !!id;
  const quillRef = useRef<ReactQuill>(null);
  const { user, can } = useAuth();
  const isSuperadmin = user?.role === "Superadmin" || user?.role === "admin";
  const isEditor = !isSuperadmin;
  const { sections } = useBusiness();

  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(isEditMode);
  const [isSaving, setIsSaving] = useState(false);

  // State Data
  const initialFormState = {
    title: "",
    excerpt: "",
    content: "",
    category: "",
    status: "Draft",
    cover_image: "",
    gallery: "[]",
    seo_title: "",
    meta_description: "",
    is_locked: false,
    lock_ticket: "",
  };

  const [formData, setFormData] = useState(initialFormState);

  // Diff Engine
  const [originalData, setOriginalData] = useState(initialFormState);

  const [rejectedDraft, setRejectedDraft] = useState<RejectedDraft | null>(
    null,
  );
  const [showDraftBanner, setShowDraftBanner] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  // Sovereign Bypass Constants
  const isDataLocked = formData.is_locked;
  const shouldLockUI = isDataLocked && !isSuperadmin;
  const isOverrideMode = isDataLocked && isSuperadmin;

  // Locked State Tailwind CLass
  const lockStyles = shouldLockUI
    ? "opacity-60 grayscale-[30%] pointer-events-none cursor-not-allowed select-none"
    : "";

  /**
   * @memo validSectorIds
   * Optimization: Converts sections array into a Set for O(1) validation.
   * Essential for detecting if a project's existing category has been deleted.
   */
  const validSectorIds = useMemo(
    () => new Set(sections.map((s) => s.id)),
    [sections],
  );

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

  // Default Category Initialization
  useEffect(() => {
    if (!isEditMode && sections.length > 0 && !formData.category) {
      setFormData((prev) => ({ ...prev, category: sections[0].id }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections, isEditMode]);

  // Fetch Existing Data & Lock State (Edit Mode Only)
  useEffect(() => {
    const controller = new AbortController();

    if (!isEditMode) {
      setFormData(initialFormState);
      setOriginalData(initialFormState);
      setCoverFile(null);
      setGalleryFiles([]);
      setCoverPreview(null);
      setIsFetching(false);
      return;
    }

    const fetchInitialData = async () => {
      setIsFetching(true);

      try {
        const [projectRes, draftRes] = await Promise.allSettled([
          api.get(`/projects/${id}`, { signal: controller.signal }),
          api.get(`/approval/rejected/${id}?module=Project`, {
            signal: controller.signal,
          }),
        ]);

        if (projectRes.status === "fulfilled") {
          const data = projectRes.value.data.data || projectRes.value.data;

          // Normalisasi Payload
          const normalizedData = {
            ...initialFormState,
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
            is_locked: Boolean(data.is_locked),
            lock_ticket: data.lock_ticket || "",
          };

          setFormData(normalizedData);
          setOriginalData(normalizedData);
        } else if (projectRes.reason.name !== "CanceledError") {
          throw projectRes.reason;
        }

        // Logic Restoration Engine (Draft Rejected)
        if (
          draftRes.status === "fulfilled" &&
          draftRes.value.data?.hasRejected
        ) {
          setRejectedDraft(draftRes.value.data.data);
          setShowDraftBanner(true);
        } else if (
          draftRes.status === "rejected" &&
          draftRes.reason.response?.status !== 404 &&
          draftRes.reason.name !== "CanceledError"
        ) {
          console.error("Recovery Data Fetch Error:", draftRes.reason);
        }
      } catch (error: any) {
        if (error.name !== "CanceledError") {
          console.error("Fetch Error:", error);
          toast.error("Gagal memuat data proyek", {
            description: "Mohon periksa koneksi atau hubungi IT.",
          });
          navigate("/admin/projects");
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsFetching(false);
        }
      }
    };

    fetchInitialData();

    return () => {
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isEditMode, navigate]);

  // Restoration Function
  const handleRestoreDraft = () => {
    if (!rejectedDraft?.payload) return;
    setIsRestoring(true);

    const payload = rejectedDraft.payload;

    setFormData((prev) => ({
      ...prev,
      title: payload.title ?? prev.title,
      excerpt: payload.excerpt ?? prev.excerpt,
      content: payload.content ?? prev.content,
      category: payload.category ?? prev.category,
      status: "Draft",
      cover_image: payload.cover_image ?? prev.cover_image,
      gallery:
        typeof payload.gallery === "string"
          ? payload.gallery
          : JSON.stringify(payload.gallery || []),
      seo_title: payload.seo_title ?? prev.seo_title,
      meta_description: payload.meta_description ?? prev.meta_description,
    }));

    setCoverFile(null);
    setGalleryFiles([]);
    setCoverPreview(null);

    toast.success("Konten berhasil dipulihkan!", {
      description: "Silakan periksa kembali sebelum mengirim ulang.",
    });

    setShowDraftBanner(false);
    setIsRestoring(false);
  };

  // Remove existing gallery image (Edit Mode)
  const removeOldGalleryImage = (indexToRemove: number) => {
    const updatedGallery = parsedGallery.filter(
      (_: any, idx: number) => idx !== indexToRemove,
    );
    setFormData({ ...formData, gallery: JSON.stringify(updatedGallery) });
  };

  // Quill Image Handler
  const imageHandler = useCallback(() => {
    if (shouldLockUI) {
      toast.error("Akses Dibatasi", {
        description: "Data terkunci, tidak dapat mengunggah gambar.",
      });
      return;
    }

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
  }, [shouldLockUI]);

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

  // The Diff Function (Spam Prevention)
  const hasDataChanged = () => {
    if (!isEditMode) return true;
    if (coverFile !== null || galleryFiles.length > 0) return true;
    if (rejectedDraft !== null && !showDraftBanner) return true;

    const keysToCheck = [
      "title",
      "excerpt",
      "content",
      "category",
      "seo_title",
      "meta_description",
      "gallery",
    ];

    for (const key of keysToCheck) {
      // @ts-expect-error
      if (formData[key] !== originalData[key]) {
        return true;
      }
    }

    return false;
  };

  // Unified Save Logic
  const handleSave = async (targetStatus: string) => {
    if (shouldLockUI) {
      return toast.error("Akses Dibatasi.", {
        description:
          "Data ini sedang dalam proses peninjauan dan tidak dapat diubah.",
      });
    }

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
      return toast.error("Kategori proyek tidak valid atau telah terhapus.");
    }

    if (targetStatus === "Published" && !coverFile && !formData.cover_image) {
      return toast.error("Gambar sampul wajib ada untuk publikasi.");
    }

    if (targetStatus === "Published" && !hasDataChanged()) {
      return toast.info("Tidak ada perubahan terdeteksi.", {
        description: "Data masih sama dengan versi live.",
        duration: 4000,
      });
    }

    setIsSaving(true);
    const loadingToast = toast.loading(
      `${isEditMode ? "Memperbarui" : "Menyimpan"} proyek dan sinkronisasi...`,
    );

    try {
      const payload = new FormData();

      if (coverFile) {
        payload.append("cover_image", await compressImage(coverFile));
      } else if (formData.cover_image) {
        payload.append("cover_image", formData.cover_image);
      }

      if (rejectedDraft?.notrans) {
        payload.append("previous_notrans", rejectedDraft.notrans);
      }

      for (const file of galleryFiles) {
        payload.append("gallery", await compressImage(file));
      }

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

      if (isEditMode) {
        payload.append("existing_gallery", formData.gallery);
      }

      payload.append("author", user?.name || "Admin DAW");

      const endpoint = isEditMode ? `/projects/${id}` : "/projects";
      const method = isEditMode ? api.put : api.post;

      const response = await method(endpoint, payload, {
        timeout: 60000,
        onUploadProgress: (p) => {
          const percent = Math.round((p.loaded * 100) / (p.total || 1));
          toast.loading(`Mengunggah: ${percent}%...`, { id: loadingToast });
        },
      });

      if ([200, 201, 202].includes(response.status)) {
        setRejectedDraft(null);
        setShowDraftBanner(false);

        if (response.status === 202) {
          setFormData((prev) => ({
            ...prev,
            is_locked: true,
            lock_ticket: response.data.ticket,
          }));
          toast.success(
            "Revisi berhasil diajukan! Menunggu persetujuan.",
            {
              id: loadingToast,
              duration: 5000,
            },
          );
        } else {
          toast.success(
            isSuperadmin
              ? "Perubahan berhasil di-publish secara live!"
              : "Draf berhasil disimpan.",
            { id: loadingToast },
          );
        }

        setTimeout(() => navigate("/admin/projects"), 800);
      }
    } catch (err: any) {
      console.error("Save Error:", err);
      toast.error("Gagal menyimpan", {
        id: loadingToast,
        description:
          err.response?.data?.message ||
          "Koneksi server mungkin lambat atau terputus.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // DROPZONE HANDLERS
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // Limit 10MB per file
  const {
    getRootProps: getRootCoverProps,
    getInputProps: getInputCoverProps,
    isDragActive: isCoverDragActive,
  } = useDropzone({
    disabled: shouldLockUI,
    onDrop: (files) => {
      if (files.length === 0) return;
      if (files[0].size > MAX_FILE_SIZE) {
        toast.error("Ukuran gambar sampul maksimal 10MB.");
        return;
      }
      setCoverFile(files[0]);
    },
    accept: { "image/jpeg": [], "image/png": [], "image/webp": [] },
    multiple: false,
  });

  const {
    getRootProps: getRootGalleryProps,
    getInputProps: getInputGalleryProps,
    isDragActive: isGalleryDragActive,
  } = useDropzone({
    disabled: shouldLockUI, // 👈 Guard Dropzone
    onDrop: (files) => {
      if (files.length === 0) return;

      const validFiles = files.filter((f) => f.size <= MAX_FILE_SIZE);
      if (validFiles.length < files.length) {
        toast.error("Beberapa gambar diabaikan karena lebih dari 10MB.");
      }

      setGalleryFiles((prev) => {
        const newFiles = validFiles.filter(
          (vf) => !prev.some((pf) => pf.name === vf.name),
        );
        if (newFiles.length < validFiles.length) {
          toast.warning("Gambar duplikat dibuang dari antrean.");
        }
        return [...prev, ...newFiles];
      });
    },
    accept: { "image/jpeg": [], "image/png": [], "image/webp": [] },
    multiple: true,
  });

  if (isFetching) {
    return (
      <div className="h-[60vh] flex items-center justify-center text-slate-500">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-daw-green border-t-transparent rounded-full animate-spin"></div>
          Memuat data proyek...
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto animate-in fade-in duration-500">
      {/* Warning Banner (Superadmin Only) */}
      {isOverrideMode && (
        <div className="mb-6 bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-center gap-4 animate-in slide-in-from-top-4 shadow-sm">
          <div className="bg-amber-100 p-2 rounded-full text-amber-600 shrink-0">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-black text-amber-900 uppercase tracking-tight">
              Mode Override Superadmin
            </h4>
            <p className="text-xs text-amber-700 leading-relaxed mt-0.5">
              Data ini sedang dikunci oleh tiket peninjauan{" "}
              <strong>{formData.lock_ticket}</strong>. Anda dapat melakukan
              perubahan langsung.
              <span className="font-bold underline ml-1">
                Menyimpan akan otomatis membatalkan draf tersebut.
              </span>
            </p>
          </div>
        </div>
      )}

      {/* Locked Banner (Editor Only) */}
      {shouldLockUI && (
        <div className="mb-6 bg-blue-50 border border-blue-200 p-4 rounded-xl flex items-center gap-4 animate-pulse shadow-sm">
          <div className="bg-blue-100 p-2 rounded-full text-blue-600 shrink-0">
            <LockIcon className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-black text-blue-900 uppercase tracking-tight">
              Sedang Ditinjau
            </h4>
            <p className="text-xs text-blue-700 leading-relaxed mt-0.5">
              Anda tidak dapat mengubah data ini karena revisi sebelumnya sedang
              menunggu persetujuan.
            </p>
          </div>
        </div>
      )}
      {/* TOOLBAR HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm top-0 z-20 mb-6">
        {/* Kiri: Back Button & Title */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/admin/projects")}
            className="p-2 hover:bg-slate-50 rounded-lg transition-all border border-transparent hover:border-slate-200 shadow-sm">
            <ArrowLeft className="w-5 h-5 text-slate-500" />
          </button>
          <div>
            <h1 className="text-xl font-serif font-bold text-slate-900">
              {isEditMode ? "Edit Proyek" : "Create New Project"}
            </h1>
            {formData.title && (
              <p className="text-[10px] font-mono text-slate-400 uppercase tracking-tighter mt-1 flex items-center gap-1">
                <LinkIcon className="w-2.5 h-2.5" /> preview: daw.co.id/page/
                {generatedSlug}
              </p>
            )}
          </div>
        </div>

        {/* Kanan: STANDARDIZED ACTION BUTTONS */}
        <div className="flex flex-col items-end gap-1 w-full sm:w-auto">
          <div className="flex gap-3 w-full sm:w-auto">
            {/* Tombol Simpan Draf Lokal */}
            <button
              type="button"
              onClick={() => handleSave("Draft")}
              disabled={isSaving || shouldLockUI || !can("manage_projects")}
              className="px-5 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg font-bold text-sm shadow-sm transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center">
              <Save className="w-4 h-4 mr-2 text-slate-400" />
              Simpan Draf Lokal
            </button>

            {/* Tombol Aksi Utama (Berdasarkan Kasta & State) */}
            <button
              type="button"
              onClick={() => handleSave("Published")}
              disabled={isSaving || shouldLockUI || !can("manage_projects")}
              className={`px-5 py-2 text-white rounded-lg font-bold text-sm transition-all shadow-sm active:scale-95 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
                isSaving
                  ? "bg-slate-300 text-slate-700"
                  : shouldLockUI
                    ? "bg-slate-200 text-slate-500"
                    : isSuperadmin
                      ? "bg-daw-green hover:bg-[#003b1c]"
                      : "bg-blue-600 hover:bg-blue-700"
              }`}>
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Memproses...
                </>
              ) : shouldLockUI ? (
                <>
                  <LockIcon className="w-4 h-4" /> Akses Terbatas
                </>
              ) : isSuperadmin ? (
                <>
                  <Save className="w-4 h-4" /> Publish Live
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" /> Request Approval
                </>
              )}
            </button>
          </div>

          {/* Hint Khusus Editor (Hanya muncul jika tidak dilock dan bukan admin) */}
          {isEditor && !shouldLockUI && !isSaving && (
            <p className="text-[10px] text-blue-500 font-bold mt-1 flex items-center gap-1 animate-in slide-in-from-top-1">
              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></span>
              Pembaruan akan dikirim untuk disetujui.
            </p>
          )}
        </div>
      </div>

      {/* ⚠️ 3. RECOVERY BANNER SYSTEM (DRAF DITOLAK) */}
      {showDraftBanner && rejectedDraft && (
        <div className="mb-8 animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="bg-amber-50 border border-amber-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-amber-100 rounded-xl text-amber-600 shrink-0">
                  <AlertTriangle className="w-6 h-6" />{" "}
                  {/* Icon disesuaikan dengan status warning */}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-amber-900 mb-1">
                    ⚠️ Catatan Peninjau
                  </h4>
                  <p className="text-xs text-amber-700 leading-relaxed max-w-2xl font-bold italic">
                    "
                    {rejectedDraft.rejection_reason ||
                      "Tidak ada alasan spesifik yang diberikan."}
                    "
                  </p>
                  <div className="mt-2 flex items-center gap-2 text-[10px] text-amber-500 font-medium">
                    <Clock className="w-3 h-3" />
                    Ditolak pada{" "}
                    {new Date(rejectedDraft.updatedAt).toLocaleString("id-ID", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto shrink-0">
                <button
                  type="button"
                  onClick={handleRestoreDraft}
                  disabled={isRestoring || shouldLockUI}
                  title={
                    shouldLockUI
                      ? "Selesaikan proses peninjauan aktif untuk memulihkan draf lama"
                      : "Pulihkan data draf"
                  }
                  className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 shadow-sm shadow-amber-200 disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed">
                  <RotateCcw
                    className={`w-4 h-4 ${isRestoring ? "animate-spin" : ""}`}
                  />
                  Pulihkan Data
                </button>

                <button
                  type="button"
                  onClick={() => setShowDraftBanner(false)}
                  className="p-2.5 text-amber-400 hover:text-amber-600 hover:bg-amber-100 rounded-xl transition-colors"
                  title="Abaikan">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Visual Progress Bar - Memberikan kesan dinamis */}
            <div className="h-1 bg-amber-200 w-full overflow-hidden">
              <div className="h-full bg-amber-500 w-1/3 animate-pulse"></div>
            </div>
          </div>
        </div>
      )}

      {/* MAIN FORM GRID */}
      <div
        className={`mt-4 grid grid-cols-1 lg:grid-cols-3 gap-8 items-start transition-all duration-500 ${lockStyles}`}>
        {/* KIRI: CONTENT AREA */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col p-0 md:p-8 space-y-8">
            <input
              type="text"
              placeholder="Masukkan judul proyek yang menarik..."
              disabled={shouldLockUI}
              className="w-full px-6 pt-6 pb-4 text-3xl font-serif font-bold border-b border-slate-100 focus:outline-none placeholder:text-slate-300 disabled:bg-transparent disabled:text-slate-500"
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
                  }>
                  {formData.excerpt.length}/150
                </span>
              </label>
              <textarea
                placeholder="Tulis ringkasan singkat untuk tampilan beranda..."
                maxLength={150}
                disabled={shouldLockUI} // 🔒 Guard
                rows={2}
                className="w-full p-4 bg-slate-50 border border-slate-100 rounded-xl outline-none text-slate-600 text-sm h-[80px] resize-none focus:ring-2 focus:ring-daw-green/10 disabled:bg-slate-100 disabled:text-slate-500"
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
              <div
                className={`min-h-[400px] border border-slate-100 rounded-xl overflow-hidden shadow-inner flex flex-col bg-white ${shouldLockUI ? "bg-slate-50 opacity-80" : ""}`}>
                <ReactQuill
                  ref={quillRef}
                  theme="snow"
                  modules={modules}
                  readOnly={shouldLockUI} // 🔒 Guard khusus untuk ReactQuill
                  value={formData.content}
                  onChange={(v) => setFormData({ ...formData, content: v })}
                  className="min-h-[300px]"
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
                  disabled={shouldLockUI} // 🔒 Guard
                  className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-100 disabled:text-slate-500"
                  value={formData.seo_title}
                  onChange={(e) =>
                    setFormData({ ...formData, seo_title: e.target.value })
                  }
                />
                <textarea
                  placeholder="Deskripsi SEO (Disarankan < 160 karakter)"
                  disabled={shouldLockUI}
                  className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm h-24 resize-none outline-none focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-100 disabled:text-slate-500"
                  value={formData.meta_description}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      meta_description: e.target.value,
                    })
                  }
                />
              </div>

              {/* Pratinjau SEO */}
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
        {/* FIX: Wrapped all sidebar elements inside a single column container to prevent grid breaking */}
        <div className="space-y-6">
          {/* 1. KATEGORI PROYEK */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-800 mb-4">
              Kategori Proyek
            </h3>

            {isLoading || sections.length === 0 ? (
              <div className="p-4 border-2 border-dashed border-slate-200 rounded-xl text-center bg-slate-50">
                <p className="text-sm font-bold text-slate-500">
                  Belum ada sektor aktif
                </p>
                <p className="text-xs text-slate-400 mt-1 mb-3">
                  Buat sektor bisnis terlebih dahulu.
                </p>
                <Link
                  to="/admin/businesses"
                  className="text-xs font-bold text-daw-green hover:underline">
                  &rarr; Kelola Sektor
                </Link>
              </div>
            ) : (
              <>
                <select
                  disabled={shouldLockUI} // 🔒 Guard
                  className={`w-full p-3 bg-slate-50 border rounded-xl font-bold outline-none transition-all disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed ${
                    formData.category && !validSectorIds.has(formData.category)
                      ? "border-red-500 text-red-600 ring-2 ring-red-100"
                      : "border-slate-100 text-slate-700 focus:ring-2 focus:ring-daw-green/20"
                  }`}
                  value={formData.category}
                  onChange={(e) =>
                    setFormData({ ...formData, category: e.target.value })
                  }>
                  {formData.category &&
                    !validSectorIds.has(formData.category) && (
                      <option
                        value={formData.category}
                        disabled
                        className="text-red-500 font-bold">
                        ⚠️ Sektor Terhapus
                      </option>
                    )}
                  {sections.map((sec) => (
                    <option
                      key={sec.id}
                      value={sec.id}
                      className="text-slate-700">
                      {sec.category}
                    </option>
                  ))}
                </select>
                {formData.category &&
                  !validSectorIds.has(formData.category) && (
                    <p className="text-[10px] text-red-500 font-bold mt-2 leading-tight">
                      Sektor asal telah dihapus. Anda wajib memilih sektor baru.
                    </p>
                  )}
              </>
            )}
          </div>

          {/* 2. GAMBAR SAMPUL */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-xs font-black uppercase tracking-widest mb-4 flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-daw-green" /> Gambar Sampul
            </h3>

            {/* Guard UI ditambahkan pada class Dropzone */}
            <div
              {...getRootCoverProps()}
              className={`aspect-video rounded-xl flex items-center justify-center transition-all relative overflow-hidden
                ${shouldLockUI ? "border-2 border-slate-200 bg-slate-100 opacity-80 cursor-not-allowed" : "border-2 border-dashed cursor-pointer hover:bg-slate-50"}
                ${isCoverDragActive && !shouldLockUI ? "border-daw-green bg-green-50" : "border-slate-200"}
              `}>
              {!shouldLockUI && <input {...getInputCoverProps()} />}{" "}
              {/* Kasus A: Ada File Baru yang baru saja di-drop */}
              {coverPreview ? (
                <img
                  src={coverPreview}
                  className="w-full h-full object-cover"
                  alt="New Upload"
                />
              ) : /* Kasus B: Menggunakan data dari Database (Live atau Recovered Draft) */
              formData.cover_image ? (
                <>
                  <img
                    src={
                      formData.cover_image.startsWith("http")
                        ? formData.cover_image // Jika sudah URL lengkap
                        : `${BASE_UPLOAD_URL}/${formData.cover_image}` // Jika hanya nama file
                    }
                    className="w-full h-full object-cover"
                    alt="Cover Data"
                  />

                  {/* Indikator visual jika ini adalah data yang di-restore */}
                  {rejectedDraft && !coverPreview && (
                    <div className="absolute top-2 left-2 bg-amber-500 text-white text-[8px] font-black px-2 py-1 rounded uppercase tracking-widest shadow-lg animate-in slide-in-from-top-1">
                      Restored from Draft
                    </div>
                  )}
                </>
              ) : (
                /* Kasus C: Kosong */
                <div className="text-center p-4">
                  <ImageIcon className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                    Upload Cover
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* 3. GALERI */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-xs font-black uppercase tracking-widest mb-4 flex items-center gap-2">
              <Images className="w-4 h-4 text-daw-green" /> Galeri
            </h3>

            {(galleryFiles.length > 0 || parsedGallery.length > 0) && (
              <div className="grid grid-cols-3 gap-2 mb-4">
                {isEditMode &&
                  parsedGallery.map((imgName: string, idx: number) => (
                    <div
                      key={`old-${idx}`}
                      className="relative aspect-square group rounded-xl overflow-hidden border border-slate-100 shadow-sm">
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

                      {!shouldLockUI && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeOldGalleryImage(idx);
                          }}
                          className="absolute top-1.5 right-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full p-1.5 shadow-lg opacity-0 group-hover:opacity-100 transition-all transform hover:scale-110 z-30">
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ))}

                {/* File Baru yang belum disave */}
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

            {!shouldLockUI && (
              <div
                {...getRootGalleryProps()}
                className={`p-6 border-2 border-dashed rounded-lg text-center cursor-pointer transition-all ${
                  isGalleryDragActive
                    ? "border-daw-green bg-green-50"
                    : "border-slate-200 hover:bg-slate-50"
                }`}>
                <input {...getInputGalleryProps()} />
                <Plus
                  className={`w-6 h-6 mx-auto mb-2 transition-transform ${
                    isGalleryDragActive
                      ? "scale-150 text-daw-green"
                      : "text-slate-300"
                  }`}
                />
                <p className="text-[11px] font-bold text-slate-600 uppercase tracking-tight">
                  {isGalleryDragActive
                    ? "Lepaskan gambar!"
                    : "Tambah Foto Galeri"}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
