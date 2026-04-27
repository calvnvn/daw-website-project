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
    <div className="max-w-7xl mx-auto animate-in fade-in duration-500">
      {/* ⚠️ 1. SOVEREIGN BYPASS BANNER (Khusus Superadmin) */}
      {/* Menandakan bahwa Admin sedang melihat data yang sedang dikunci oleh antrean Editor, dan memberikan otoritas untuk membatalkannya. */}
      {isOverrideMode && (
        <div className="mb-6 bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-center gap-4 animate-in slide-in-from-top-4 shadow-sm">
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

      {/* 2. LOCKED BANNER (Khusus Editor) */}
      {/* Jika data terkunci, Editor akan melihat peringatan dan seluruh input di bawahnya akan dinonaktifkan. */}
      {shouldLockUI && (
        <div
          className={`mb-6 p-4 rounded-xl flex items-center gap-4 shadow-sm ${
            formData.lock_ticket?.includes("DEL")
              ? "bg-rose-50 border border-rose-200 animate-pulse" // Merah redup kalau mau dihapus
              : "bg-blue-50 border border-blue-200" // Biru kalau update biasa
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

      {/* --- TOOLBAR HEADER --- */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm top-0 z-20 mb-6">
        {/* Kiri: Navigasi & Judul */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/admin/projects")}
            className="p-2 hover:bg-slate-50 rounded-lg transition-all border border-transparent hover:border-slate-200 shadow-sm">
            <ArrowLeft className="w-5 h-5 text-slate-500" />
          </button>
          <div>
            <h1 className="text-xl font-serif font-bold text-slate-900">
              {isEditMode ? "Edit Proyek" : "Buat Proyek Baru"}
            </h1>
            {/* Slug Intelligence: Menampilkan pratinjau URL yang ramah SEO secara real-time berdasarkan judul. */}
            {formData.title && (
              <p className="text-[10px] font-mono text-slate-400 uppercase tracking-tighter mt-1 flex items-center gap-1">
                <LinkIcon className="w-2.5 h-2.5" /> daw.co.id/page/
                {generatedSlug}
              </p>
            )}
          </div>
        </div>

        {/* Kanan: ACTION BUTTONS (Dynamic Labeling) */}
        <div className="flex flex-col items-end gap-1 w-full sm:w-auto">
          <div className="flex gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => handleSave("Draft")}
              disabled={isSaving || shouldLockUI || !can("manage_projects")}
              className="px-5 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg font-bold text-sm shadow-sm transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center">
              <Save className="w-4 h-4 mr-2 text-slate-400" />
              Simpan Draf Lokal
            </button>

            {/* Tombol Utama berubah warna dan label sesuai konteks Otoritas (Admin vs Editor) */}
            <button
              type="button"
              onClick={() => handleSave("Published")}
              disabled={isSaving || shouldLockUI || !can("manage_projects")}
              className={`px-5 py-2 text-white rounded-lg font-bold text-sm transition-all shadow-sm active:scale-95 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
                isSaving
                  ? "bg-slate-300 text-slate-700"
                  : shouldLockUI
                    ? "bg-slate-200 text-slate-500"
                    : isOverrideMode
                      ? "bg-amber-600 hover:bg-amber-700" // Warna khusus untuk peringatan Bypass Admin
                      : isSuperadmin
                        ? "bg-daw-green hover:bg-[#003b1c]"
                        : "bg-blue-600 hover:bg-blue-700" // Warna khusus untuk Editor (Request Approval)
              }`}>
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Memproses...
                </>
              ) : shouldLockUI ? (
                <>
                  <LockIcon className="w-4 h-4" /> Akses Terbatas
                </>
              ) : isOverrideMode ? (
                <>
                  <AlertCircle className="w-4 h-4" /> Override & Publish
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

          {/* Hint visual untuk Editor agar tahu bahwa tombol biru tidak akan mempublikasikan data secara instan */}
          {isEditor && !shouldLockUI && !isSaving && (
            <p className="text-[10px] text-blue-500 font-bold mt-1 flex items-center gap-1 animate-in slide-in-from-top-1">
              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></span>
              Pembaruan harus disetujui Manajer.
            </p>
          )}
        </div>
      </div>

      {/* ⚠️ 3. RECOVERY BANNER (DRAF DITOLAK) */}
      {/* Banner ini dipicu jika Backend mengembalikan object 'rejectedDraft' yang valid */}
      {showDraftBanner && rejectedDraft && (
        <div className="mb-8 animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="bg-amber-50 border border-amber-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-amber-100 rounded-xl text-amber-600 shrink-0">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-amber-900 mb-1">
                    ⚠️ Catatan Peninjau
                  </h4>
                  <p className="text-xs text-amber-700 leading-relaxed max-w-2xl font-bold italic">
                    "
                    {rejectedDraft.rejection_reason ||
                      "Revisi Anda memerlukan perbaikan lanjutan."}
                    "
                  </p>
                  <div className="mt-2 flex items-center gap-2 text-[10px] text-amber-500 font-medium">
                    <Clock className="w-3 h-3" />
                    Ditolak pada{" "}
                    {new Date(rejectedDraft.updatedAt).toLocaleString("id-ID", {
                      day: "numeric",
                      month: "long",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              </div>

              {/* RECOVERY ACTIONS */}
              <div className="flex items-center gap-2 w-full md:w-auto shrink-0">
                {/* Opsi 1: Restoration Logic - Memuat ulang payload JSON ke dalam form */}
                {rejectedDraft.action !== "DELETE" && (
                  <button
                    type="button"
                    onClick={handleRestoreDraft}
                    disabled={isRestoring || shouldLockUI}
                    className="flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 shadow-sm shadow-amber-200 disabled:opacity-50 disabled:grayscale">
                    <RotateCcw
                      className={`w-4 h-4 ${isRestoring ? "animate-spin" : ""}`}
                    />
                    Pulihkan Data
                  </button>
                )}
                {/* Opsi 2: Discard Logic - Memanggil fungsi handleDiscardDraft untuk menghapus notifikasi dari ERP */}
                <button
                  type="button"
                  onClick={handleDiscardDraft}
                  className="flex items-center justify-center gap-2 bg-white border border-amber-200 text-amber-600 hover:bg-amber-100 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95">
                  <X className="w-4 h-4" />
                  Abaikan Notifikasi
                </button>
              </div>
            </div>
            <div className="h-1 bg-amber-200 w-full overflow-hidden">
              <div className="h-full bg-amber-500 w-1/3 animate-pulse"></div>
            </div>
          </div>
        </div>
      )}

      {/* --- MAIN FORM GRID --- */}
      {/* lockStyles di sini akan mematikan pointer-events dan memberikan efek grayscale pada keseluruhan form jika status is_locked bernilai true */}
      <div
        className={`mt-4 grid grid-cols-1 lg:grid-cols-3 gap-8 items-start transition-all duration-500 ${lockStyles}`}>
        {/* KOLOM KIRI: CONTENT AREA */}
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
                disabled={shouldLockUI} // 🔒 Guard Lapisan 1
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
                  readOnly={shouldLockUI} // 🔒 Strict ReadOnly Integration untuk mencegah manipulasi DOM Quill
                  value={formData.content}
                  onChange={(v) => setFormData({ ...formData, content: v })}
                  className="min-h-[300px]"
                />
              </div>
            </div>
          </div>

          {/* SEO ENGINE & PREVIEW */}
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
                  disabled={shouldLockUI}
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

              {/* Google Search Simulation: Real-time visual feedback */}
              <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-center">
                <p className="text-[10px] font-black text-slate-300 uppercase mb-3">
                  Pratinjau Tampilan Google
                </p>
                <p className="text-[#1a0dab] text-lg font-medium truncate">
                  {/* Metadata Sync: Fallback ke judul utama jika SEO title kosong */}
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

        {/* KOLOM KANAN: SIDEBAR ASSET & CATEGORY */}
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
                <Link
                  to="/admin/businesses"
                  className="text-xs font-bold text-daw-green hover:underline">
                  &rarr; Kelola Sektor
                </Link>
              </div>
            ) : (
              <>
                <select
                  disabled={shouldLockUI} // 🔒 Guard Kategori
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

          {/* 2. GAMBAR SAMPUL (COVER ASSET) */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-xs font-black uppercase tracking-widest mb-4 flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-daw-green" /> Gambar Sampul
            </h3>

            <div
              {...getRootCoverProps()}
              className={`aspect-video rounded-xl flex items-center justify-center transition-all relative overflow-hidden
                ${shouldLockUI ? "border-2 border-slate-200 bg-slate-100 opacity-80 cursor-not-allowed" : "border-2 border-dashed cursor-pointer hover:bg-slate-50"}
                ${isCoverDragActive && !shouldLockUI ? "border-daw-green bg-green-50" : "border-slate-200"}
              `}>
              {/* 🔒 Menonaktifkan input file jika UI dikunci */}
              {!shouldLockUI && <input {...getInputCoverProps()} />}

              {coverPreview ? (
                <img
                  src={coverPreview}
                  className="w-full h-full object-cover"
                  alt="New Upload"
                />
              ) : formData.cover_image ? (
                <>
                  <img
                    src={
                      formData.cover_image.startsWith("http")
                        ? formData.cover_image
                        : `${BASE_UPLOAD_URL}/${formData.cover_image}`
                    }
                    className="w-full h-full object-cover"
                    alt="Cover Data"
                  />
                  {rejectedDraft && !coverPreview && (
                    <div className="absolute top-2 left-2 bg-amber-500 text-white text-[8px] font-black px-2 py-1 rounded uppercase tracking-widest shadow-lg animate-in slide-in-from-top-1">
                      Restored from Draft
                    </div>
                  )}
                </>
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

          {/* 3. GALERI FISIK (MULTIPLE ASSETS) */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-xs font-black uppercase tracking-widest mb-4 flex items-center gap-2">
              <Images className="w-4 h-4 text-daw-green" /> Galeri
            </h3>

            {(galleryFiles.length > 0 || parsedGallery.length > 0) && (
              <div className="grid grid-cols-3 gap-2 mb-4">
                {/* Me-render Gambar Tersimpan (Parsed Gallery) */}
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

                      {/* 🔒 Layer 2 Guarding: Menghilangkan tombol hapus (X) jika terkunci */}
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

                {/* Me-render File Baru yang belum dikirim ke server */}
                {galleryFiles.map((file, idx) => (
                  <GalleryPreviewItem
                    key={`new-${idx}`}
                    file={file}
                    disabled={shouldLockUI} // 🔒 Mengunci komponen anak agar tombol hapus dimatikan
                    onRemove={() =>
                      setGalleryFiles((prev) =>
                        prev.filter((_, i) => i !== idx),
                      )
                    }
                  />
                ))}
              </div>
            )}

            {/* 🔒 Layer 1 Guarding: Menyembunyikan Dropzone Tambah Galeri jika terkunci */}
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
