/* eslint-disable @typescript-eslint/ban-ts-comment */
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
  AlertTriangle,
  LockIcon,
  Loader2,
  AlertCircle,
  RotateCcw,
} from "lucide-react";
import { useDropzone } from "react-dropzone";
import api, { BASE_UPLOAD_URL } from "@/lib/api";
import { compressImage } from "@/utils/imageHelper";
import { useAuth } from "@/contexts/AuthContext";
import { useBusiness } from "@/contexts/BusinessContext";

interface RejectedDraft {
  notrans: string;
  module_name: string;
  payload: any;
  action: string;
  rejection_reason: string | null;
  createdAt: string;
  updatedAt: string;
}

// --- SUB-COMPONENT: GALLERY PREVIEW ---
const GalleryPreviewItem = ({
  file,
  onRemove,
  disabled = false,
}: {
  file: File;
  onRemove: () => void;
  disabled?: boolean;
}) => {
  const [preview, setPreview] = useState<string>("");

  useEffect(() => {
    let isMounted = true;
    const objectUrl = URL.createObjectURL(file);
    if (isMounted) setPreview(objectUrl);

    // Mencegah memory leak saat komponen di-unmount
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
      {!disabled && (
        <button
          type="button"
          onClick={onRemove}
          className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:bg-red-600 shadow-md">
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
};

// --- MAIN COMPONENT ---
export default function ProjectForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  console.log("Current ID from URL:", id);

  const isEditMode = !!id;
  const quillRef = useRef<ReactQuill>(null);

  const { user, can } = useAuth();
  const isSuperadmin = user?.role === "superadmin" || user?.role === "admin";
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

  // Pratinjau Slug Otomatis (Hanya untuk UI, validasi akhir di Backend)
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
        console.log("Hitting API with ID:", id);
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
  const handleDiscardDraft = async () => {
    if (!rejectedDraft?.notrans) return;

    const toastId = toast.loading("Mengabaikan notifikasi penolakan...");
    try {
      // FIX: Gunakan encodeURIComponent karena notrans mengandung karakter '/'
      const safeTicket = encodeURIComponent(rejectedDraft.notrans);
      await api.patch(`/approval/discard/${safeTicket}`);

      toast.success("Notifikasi revisi berhasil diabaikan.", { id: toastId });

      setRejectedDraft(null);
      setShowDraftBanner(false);
    } catch (error: any) {
      toast.error("Gagal mengabaikan draf", {
        id: toastId,
        description:
          error.response?.data?.message ||
          "Kesalahan komunikasi dengan server.",
      });
    }
  };

  // 2. RESTORATION FUNCTION (FIXED PARSING & SAFETY)
  const handleRestoreDraft = () => {
    // Pastikan draf ada
    if (!rejectedDraft?.payload) {
      toast.error("Data pemulihan tidak ditemukan.");
      return;
    }

    if (rejectedDraft?.action === "DELETE") {
      toast.error(
        "Permintaan penghapusan yang ditolak tidak dapat dipulihkan ke dalam form.",
      );
      return;
    }

    setIsRestoring(true);

    try {
      const rawPayload = rejectedDraft.payload;
      const payload =
        typeof rawPayload === "string" ? JSON.parse(rawPayload) : rawPayload;

      setFormData((prev) => ({
        ...prev,
        title: payload.title ?? prev.title,
        excerpt: payload.excerpt ?? prev.excerpt,
        content: payload.content ?? prev.content,
        category: payload.category ?? prev.category,
        status: "Draft", // Paksa ke Draft agar user bisa review dulu
        cover_image: payload.cover_image ?? prev.cover_image,
        // Pastikan gallery terformat string JSON untuk input hidden
        gallery: Array.isArray(payload.gallery)
          ? JSON.stringify(payload.gallery)
          : (payload.gallery ?? "[]"),
        seo_title: payload.seo_title ?? prev.seo_title,
        meta_description: payload.meta_description ?? prev.meta_description,
      }));

      // Bersihkan file picker (karena kita memulihkan path file draf lama)
      setCoverFile(null);
      setGalleryFiles([]);
      setCoverPreview(null);

      toast.success("Konten draf berhasil dipulihkan!", {
        description: "Silakan periksa kembali sebelum mengirim ulang.",
      });

      setShowDraftBanner(false);
    } catch (err) {
      console.error("Restore Error:", err);
      toast.error("Gagal memproses data pemulihan.");
    } finally {
      setIsRestoring(false);
    }
  };

  // Remove existing gallery image (Edit Mode)
  const removeOldGalleryImage = (indexToRemove: number) => {
    if (shouldLockUI) return;
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
            description:
              err.response?.data?.message || "Kesalahan pada server.",
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
    // 1. SECURITY & AUTHORITY CHECK
    if (shouldLockUI) {
      return toast.error("Akses Dibatasi.", {
        description:
          "Data ini sedang dalam proses peninjauan dan tidak dapat diubah.",
      });
    }

    // 2. DATA INTEGRITY VALIDATION
    if (!formData.title.trim()) {
      return toast.error("Judul proyek tidak boleh kosong.");
    }

    // Mendeteksi konten kosong (regex menghapus tag HTML untuk validasi panjang teks asli)
    const plainTextContent = formData.content.replace(/<[^>]*>?/gm, "").trim();
    if (!formData.content || plainTextContent.length === 0) {
      return toast.error("Isi artikel wajib diisi.");
    }

    // Validasi integritas referensi kategori
    const isCategoryValid = sections.some(
      (sec) => sec.id === formData.category,
    );
    if (!isCategoryValid) {
      return toast.error("Kategori proyek tidak valid atau telah terhapus.");
    }

    // Validasi aset wajib untuk publikasi
    if (targetStatus === "Published" && !coverFile && !formData.cover_image) {
      return toast.error("Gambar sampul wajib ada untuk publikasi.");
    }

    // SPAM PREVENTION
    if (targetStatus === "Published" && !hasDataChanged()) {
      return toast.info("Tidak ada perubahan terdeteksi.", {
        description:
          "Data saat ini masih identik dengan versi yang sudah tayang.",
        duration: 4000,
      });
    }

    setIsSaving(true);
    const loadingToast = toast.loading(
      `${isEditMode ? "Memperbarui" : "Menyimpan"} proyek dan sinkronisasi...`,
    );

    try {
      const payload = new FormData();

      // 3. ASSET PROCESSING (Cover & Gallery)
      if (coverFile) {
        // Kasus: User mengunggah file baru
        payload.append("cover_image", await compressImage(coverFile));
      } else if (formData.cover_image) {
        // Kasus: Menggunakan referensi file lama atau file dari draf restorasi
        payload.append("cover_image", formData.cover_image);
      }

      if (galleryFiles.length > 0) {
        for (const file of galleryFiles) {
          payload.append("gallery", await compressImage(file));
        }
      }

      // 4. PAYLOAD CONSTRUCTION
      payload.append("title", formData.title.trim());
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

      // Metadata Identitas
      payload.append("author", user?.name || "System Admin");

      // Menautkan ID tiket lama jika ini adalah pengajuan ulang (re-submission)
      if (rejectedDraft?.notrans) {
        payload.append("previous_notrans", rejectedDraft.notrans);
      }

      // 5. API EXECUTION
      const endpoint = isEditMode ? `/projects/${id}` : "/projects";
      const method = isEditMode ? api.put : api.post;

      const response = await method(endpoint, payload, {
        timeout: 60000,
        onUploadProgress: (p) => {
          const percent = Math.round((p.loaded * 100) / (p.total || 1));
          toast.loading(`Sinkronisasi Aset: ${percent}%...`, {
            id: loadingToast,
          });
        },
      });

      // 6. RESPONSE ORCHESTRATION (Handling Baton Pass vs Direct)
      if ([200, 201, 202].includes(response.status)) {
        // Bersihkan state draf karena sudah berhasil diproses/diajukan
        setRejectedDraft(null);
        setShowDraftBanner(false);

        if (response.status === 202) {
          // Jalur Editor: Menunggu persetujuan (Locked State)
          setFormData((prev) => ({
            ...prev,
            is_locked: true,
            lock_ticket: response.data.ticket,
          }));
          toast.success("Revisi Berhasil Diajukan!", {
            id: loadingToast,
            description: "Tiket approval telah diterbitkan ke sistem.",
            duration: 5000,
          });
        } else {
          // Jalur Admin: Eksekusi Langsung
          toast.success(
            isSuperadmin
              ? "Perubahan Berhasil Dipublikasikan!"
              : "Draf Lokal Tersimpan.",
            { id: loadingToast },
          );
        }

        // Delay sedikit agar user sempat membaca toast sebelum redirect
        setTimeout(() => navigate("/admin/projects"), 800);
      }
    } catch (err: any) {
      console.error("🚨 [FORM_SAVE_ERROR]:", err);
      toast.error("Gagal melakukan penyimpanan", {
        id: loadingToast,
        description: err.response?.data?.message || "Koneksi server terganggu.",
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
    disabled: shouldLockUI,
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
    <div className="max-w-7xl mx-auto animate-in fade-in duration-500 pb-24">
      {/* ⚠️ 1. SOVEREIGN BYPASS BANNER */}
      {isOverrideMode && (
        <div className="mb-6 bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-center gap-4 shadow-sm">
          <div className="bg-amber-100 p-2 rounded-full text-amber-600 shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-black text-amber-900 uppercase tracking-tight">
              Mode Override Admin
            </h4>
            <p className="text-xs text-amber-700 leading-relaxed mt-0.5">
              Data ini sedang dikunci oleh antrean{" "}
              <strong>{formData.lock_ticket}</strong>.
              <span className="font-bold underline ml-1">
                Menyimpan akan otomatis membatalkan antrean tersebut.
              </span>
            </p>
          </div>
        </div>
      )}

      {/* 🔒 2. LOCKED BANNER */}
      {shouldLockUI && (
        <div
          className={`mb-6 p-4 rounded-xl flex items-center gap-4 shadow-sm ${
            formData.lock_ticket?.includes("DEL")
              ? "bg-rose-50 border border-rose-200 animate-pulse"
              : "bg-blue-50 border border-blue-200"
          }`}>
          <div
            className={`p-2 rounded-full shrink-0 ${formData.lock_ticket?.includes("DEL") ? "bg-rose-100 text-rose-600" : "bg-blue-100 text-blue-600"}`}>
            <LockIcon className="w-5 h-5" />
          </div>
          <div>
            <h4
              className={`text-xs font-black uppercase tracking-tight ${formData.lock_ticket?.includes("DEL") ? "text-rose-900" : "text-blue-900"}`}>
              {formData.lock_ticket?.includes("DEL")
                ? "Menunggu Penghapusan"
                : "Akses Dibatasi"}
            </h4>
            <p
              className={`text-xs leading-relaxed mt-0.5 ${formData.lock_ticket?.includes("DEL") ? "text-rose-700" : "text-blue-700"}`}>
              {formData.lock_ticket?.includes("DEL")
                ? "Permintaan penghapusan data ini sedang ditinjau."
                : "Revisi sedang ditinjau. Anda tidak dapat mengubah data ini sampai ada keputusan."}
            </p>
          </div>
        </div>
      )}

      {/* ⚠️ 3. RECOVERY BANNER */}
      {showDraftBanner && rejectedDraft && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-2xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-amber-100 rounded-xl text-amber-600 shrink-0">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-amber-900 mb-1">
                ⚠️ Catatan Peninjau
              </h4>
              <p className="text-xs text-amber-700 leading-relaxed font-bold italic">
                "
                {rejectedDraft.rejection_reason ||
                  "Revisi Anda memerlukan perbaikan lanjutan."}
                "
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {rejectedDraft.action !== "DELETE" && (
              <button
                type="button"
                onClick={handleRestoreDraft}
                disabled={isRestoring || shouldLockUI}
                className="flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm">
                <RotateCcw
                  className={`w-4 h-4 ${isRestoring ? "animate-spin" : ""}`}
                />
                Pulihkan Data
              </button>
            )}
            <button
              type="button"
              onClick={handleDiscardDraft}
              className="flex items-center justify-center gap-2 bg-white border border-amber-200 text-amber-600 hover:bg-amber-100 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm">
              <X className="w-4 h-4" /> Abaikan
            </button>
          </div>
        </div>
      )}

      {/* --- STICKY TOOLBAR HEADER --- */}
      <div className="sticky top-4 z-40 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/90 backdrop-blur-xl p-5 rounded-2xl border border-slate-200 shadow-sm mb-8 transition-all">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/admin/projects")}
            className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-500 rounded-lg transition-all border border-slate-200 shadow-sm">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-slate-900 leading-none">
              {isEditMode ? "Edit Dokumen Proyek" : "Dokumen Proyek Baru"}
            </h1>
            {formData.title && (
              <p className="text-[11px] font-mono text-slate-400 mt-1 flex items-center gap-1">
                <LinkIcon className="w-3 h-3" /> daw.co.id/projects/
                {generatedSlug}
              </p>
            )}
          </div>
        </div>

        <div className="flex gap-3 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => handleSave("Draft")}
            disabled={isSaving || shouldLockUI || !can("manage_projects")}
            className="px-5 py-2.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 rounded-xl font-bold text-[13px] shadow-sm transition-all disabled:opacity-50 flex items-center gap-2">
            <Save className="w-4 h-4 text-slate-400" /> Simpan Draf
          </button>

          <button
            type="button"
            onClick={() => handleSave("Published")}
            disabled={isSaving || shouldLockUI || !can("manage_projects")}
            className={`px-6 py-2.5 text-white rounded-xl font-bold text-[13px] transition-all shadow-sm flex items-center gap-2 ${
              isSaving
                ? "bg-slate-300"
                : shouldLockUI
                  ? "bg-slate-200 text-slate-500"
                  : isOverrideMode
                    ? "bg-amber-600 hover:bg-amber-700"
                    : isSuperadmin
                      ? "bg-daw-green hover:bg-[#003b1c]"
                      : "bg-blue-600 hover:bg-blue-700"
            }`}>
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {!isSaving && shouldLockUI && <LockIcon className="w-4 h-4" />}
            {!isSaving && !shouldLockUI && isOverrideMode && (
              <AlertCircle className="w-4 h-4" />
            )}
            {!isSaving && !shouldLockUI && !isOverrideMode && isSuperadmin && (
              <Send className="w-4 h-4" />
            )}
            {!isSaving && !shouldLockUI && !isOverrideMode && !isSuperadmin && (
              <Send className="w-4 h-4" />
            )}

            {isSaving
              ? "Memproses..."
              : shouldLockUI
                ? "Terkunci"
                : isOverrideMode
                  ? "Override & Publish"
                  : isSuperadmin
                    ? "Publikasikan"
                    : "Ajukan Persetujuan"}
          </button>
        </div>
      </div>

      {/* --- MAIN FORM GRID --- */}
      <div
        className={`grid grid-cols-1 lg:grid-cols-12 gap-8 items-start transition-all duration-500 ${lockStyles}`}>
        {/* KOLOM KIRI: EDITORIAL CANVAS (span 8) */}
        <div className="lg:col-span-8 space-y-8">
          {/* THE CANVAS */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col pt-12 pb-8 px-8 md:px-14">
            {/* Seamless Title Input */}
            <textarea
              placeholder="Ketik Judul Proyek..."
              disabled={shouldLockUI}
              rows={1}
              className="w-full text-4xl md:text-5xl lg:text-[52px] font-serif font-bold text-slate-900 placeholder:text-slate-200 outline-none resize-none leading-[1.15] bg-transparent disabled:text-slate-400 overflow-hidden"
              value={formData.title}
              onChange={(e) => {
                setFormData({ ...formData, title: e.target.value });
                e.target.style.height = "auto";
                e.target.style.height = e.target.scrollHeight + "px";
              }}
            />

            {/* Subtle Divider */}
            <div className="w-16 h-1 bg-daw-green rounded-full my-8"></div>

            {/* Editorial Excerpt */}
            <div className="relative mb-8 group">
              <span
                className={`absolute -left-4 top-1 text-[10px] font-mono tracking-widest -rotate-90 origin-bottom-left uppercase opacity-0 group-hover:opacity-100 transition-opacity ${formData.excerpt.length >= 145 ? "text-red-500" : "text-slate-300"}`}>
                Lead Paragraph ({formData.excerpt.length}/150)
              </span>
              <textarea
                placeholder="Tulis ringkasan singkat atau pengantar artikel di sini..."
                maxLength={150}
                disabled={shouldLockUI}
                className="w-full text-lg md:text-xl font-light leading-relaxed text-slate-600 placeholder:text-slate-300 border-l-4 border-slate-100 focus:border-daw-green bg-transparent pl-5 outline-none resize-none h-[90px] transition-colors disabled:text-slate-400"
                value={formData.excerpt}
                onChange={(e) =>
                  setFormData({ ...formData, excerpt: e.target.value })
                }
              />
            </div>

            {/* Quill Editor - Modernized via Tailwind Arbitrary Variants */}
            <div
              className={`editor-container min-h-[400px] 
              [&_.ql-toolbar]:border-none [&_.ql-toolbar]:border-y [&_.ql-toolbar]:border-slate-100 [&_.ql-toolbar]:py-3 [&_.ql-toolbar]:px-0
              [&_.ql-container]:border-none [&_.ql-container]:text-lg [&_.ql-editor]:px-0 [&_.ql-editor]:py-8
              [&_.ql-editor_p]:text-slate-700 [&_.ql-editor_p]:leading-loose [&_.ql-editor_p]:mb-6
              [&_.ql-editor_h1]:font-serif [&_.ql-editor_h2]:font-serif [&_.ql-editor_h2]:text-2xl [&_.ql-editor_h2]:mb-4
              [&_.ql-editor_h3]:font-bold [&_.ql-editor_h3]:text-xl [&_.ql-editor_h3]:mb-3
              [&_.ql-editor_strong]:font-semibold [&_.ql-editor_strong]:text-slate-900
              [&_.ql-editor_img]:rounded-xl [&_.ql-editor_img]:my-8 [&_.ql-editor_img]:shadow-sm
              ${shouldLockUI ? "opacity-80" : ""}
            `}>
              <ReactQuill
                ref={quillRef}
                theme="snow"
                modules={modules}
                readOnly={shouldLockUI}
                value={formData.content}
                onChange={(v) => setFormData({ ...formData, content: v })}
                placeholder="Mulai menulis cerita proyek di sini..."
              />
            </div>
          </div>

          {/* EXACT GOOGLE SERP PREVIEW ENGINE */}
          <div className="bg-white rounded-3xl border border-slate-200 p-8 md:p-10 shadow-sm">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-800 mb-6 flex items-center gap-2">
              <Search className="w-4 h-4 text-daw-green" /> Pengoptimalan Mesin
              Pencari (SEO)
            </h3>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-10 items-start">
              <div className="space-y-5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                    SEO Title
                  </label>
                  <input
                    type="text"
                    placeholder="Judul Khusus untuk Google..."
                    disabled={shouldLockUI}
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:bg-white focus:border-daw-green focus:ring-4 focus:ring-daw-green/10 transition-all disabled:text-slate-400"
                    value={formData.seo_title}
                    onChange={(e) =>
                      setFormData({ ...formData, seo_title: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                    Meta Description
                  </label>
                  <textarea
                    placeholder="Tulis deskripsi memikat maksimal 160 karakter..."
                    disabled={shouldLockUI}
                    maxLength={160}
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none resize-none h-[120px] focus:bg-white focus:border-daw-green focus:ring-4 focus:ring-daw-green/10 transition-all disabled:text-slate-400"
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

              {/* Real Google SERP UI Clone */}
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.03)] flex flex-col justify-center">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center p-1.5 border border-slate-200">
                    <img
                      src="/favicon.png"
                      alt="Icon"
                      className="w-full h-full object-contain opacity-80"
                    />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[14px] text-[#202124] font-normal leading-tight">
                      PT Dharma Agung Wijaya
                    </span>
                    <span className="text-[12px] text-[#4d5156] leading-tight">
                      daw.co.id &gt; projects &gt; {generatedSlug}
                    </span>
                  </div>
                </div>
                <h3 className="text-[20px] text-[#1a0dab] font-normal leading-[1.3] hover:underline cursor-pointer mb-1">
                  {formData.seo_title ||
                    formData.title ||
                    "Judul Proyek DAW Group"}
                </h3>
                <p className="text-[14px] text-[#4d5156] line-clamp-2 leading-[1.58]">
                  {formData.meta_description ||
                    formData.excerpt ||
                    "Masukkan ringkasan atau meta deskripsi proyek di sini agar Google dapat menampilkannya dengan sempurna di hasil pencarian."}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* KOLOM KANAN: ASSETS & METADATA (span 4) */}
        <div className="lg:col-span-4 space-y-6">
          {/* CATEGORY SELECTOR */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-4">
              Sektor Bisnis
            </h3>
            {sections.length === 0 ? (
              <div className="p-4 border border-dashed border-slate-200 rounded-xl text-center bg-slate-50">
                <p className="text-xs text-slate-500 mb-2">
                  Sektor belum dikonfigurasi
                </p>
                <Link
                  to="/admin/businesses"
                  className="text-xs font-bold text-daw-green hover:underline">
                  Kelola Sektor &rarr;
                </Link>
              </div>
            ) : (
              <select
                disabled={shouldLockUI}
                className={`w-full p-3.5 bg-slate-50 border rounded-xl text-sm font-bold outline-none cursor-pointer hover:bg-slate-100 transition-colors focus:ring-4 focus:ring-daw-green/10 disabled:opacity-70 disabled:cursor-not-allowed ${
                  formData.category && !validSectorIds.has(formData.category)
                    ? "border-red-300 text-red-600"
                    : "border-slate-200 text-slate-700"
                }`}
                value={formData.category}
                onChange={(e) =>
                  setFormData({ ...formData, category: e.target.value })
                }>
                {sections.map((sec) => (
                  <option key={sec.id} value={sec.id}>
                    {sec.category}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* COVER IMAGE HERO */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-[11px] font-black uppercase tracking-widest mb-4 flex items-center justify-between text-slate-400">
              <span>Gambar Utama</span>
              <span className="text-slate-300 font-normal">Wajib</span>
            </h3>

            <div
              {...getRootCoverProps()}
              className={`aspect-[4/3] rounded-2xl flex flex-col items-center justify-center transition-all relative overflow-hidden group
                ${shouldLockUI ? "border-2 border-slate-100 bg-slate-50 cursor-not-allowed" : "border-2 border-dashed border-slate-200 hover:border-daw-green/50 hover:bg-daw-green/5 cursor-pointer"}
                ${isCoverDragActive && !shouldLockUI ? "border-daw-green bg-green-50" : ""}
              `}>
              {!shouldLockUI && <input {...getInputCoverProps()} />}

              {coverPreview ? (
                <img
                  src={coverPreview}
                  className="w-full h-full object-cover"
                  alt="New Cover"
                />
              ) : formData.cover_image ? (
                <>
                  <img
                    src={
                      formData.cover_image.startsWith("http")
                        ? formData.cover_image
                        : `${BASE_UPLOAD_URL}/${formData.cover_image}`
                    }
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    alt="Cover Data"
                  />
                  {!shouldLockUI && (
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="text-white text-xs font-bold uppercase tracking-widest bg-daw-green px-4 py-2 rounded-full">
                        Ubah Cover
                      </span>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center p-6">
                  <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3 group-hover:scale-110 group-hover:bg-daw-green/10 transition-all">
                    <ImageIcon className="w-5 h-5 text-slate-400 group-hover:text-daw-green" />
                  </div>
                  <p className="text-xs font-bold text-slate-600 mb-1">
                    Tarik & Lepas Gambar
                  </p>
                  <p className="text-[10px] text-slate-400">
                    Maks. 10MB (JPG, PNG, WEBP)
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* PROJECT GALLERY */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-[11px] font-black uppercase tracking-widest mb-4 flex items-center justify-between text-slate-400">
              <span>Galeri Proyek</span>
              <span className="text-slate-300 font-normal">Opsional</span>
            </h3>

            {(galleryFiles.length > 0 || parsedGallery.length > 0) && (
              <div className="grid grid-cols-3 gap-3 mb-4">
                {isEditMode &&
                  parsedGallery.map((imgName: string, idx: number) => (
                    <div
                      key={`old-${idx}`}
                      className="relative aspect-square group rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
                      <img
                        src={`${BASE_UPLOAD_URL}/${imgName}`}
                        className="w-full h-full object-cover"
                        alt="Saved"
                      />
                      {!shouldLockUI && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeOldGalleryImage(idx);
                          }}
                          className="absolute inset-0 w-full h-full bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all backdrop-blur-sm z-30">
                          <X className="w-6 h-6 text-white" />
                        </button>
                      )}
                    </div>
                  ))}
                {galleryFiles.map((file, idx) => (
                  <GalleryPreviewItem
                    key={`new-${idx}`}
                    file={file}
                    disabled={shouldLockUI}
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
                className={`p-6 border-2 border-dashed rounded-xl text-center cursor-pointer transition-all group ${
                  isGalleryDragActive
                    ? "border-daw-green bg-green-50"
                    : "border-slate-200 hover:border-daw-green/50 hover:bg-daw-green/5"
                }`}>
                <input {...getInputGalleryProps()} />
                <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3 group-hover:scale-110 group-hover:bg-daw-green/10 transition-all">
                  <Images className="w-4 h-4 text-slate-400 group-hover:text-daw-green" />
                </div>
                <p className="text-[11px] font-bold text-slate-600 uppercase tracking-tight">
                  {isGalleryDragActive
                    ? "Lepaskan di sini!"
                    : "Tambah Foto Ekstra"}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
