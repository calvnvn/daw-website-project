import { useState, useRef, useMemo, useCallback, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";
import { toast } from "sonner";
import {
  ChevronLeft,
  Image as ImageIcon,
  Save,
  X,
  AlertTriangle,
  Lock,
  RotateCcw,
  PenTool,
  Layout,
  Eye,
  Search,
  Globe,
  Trash2,
  UploadCloud,
  FileText,
  Calendar,
  RefreshCw,
} from "lucide-react";
import { useDropzone } from "react-dropzone";
import api, { BASE_UPLOAD_URL } from "@/lib/api";
import { compressImage } from "@/utils/imageHelper";
import { useAuth } from "@/contexts/AuthContext";
import { getErrorMessage } from "@/lib/utils";
import ImageAdjustmentModal from "@/components/admin/ImageAdjustmentModal";
import MagicTranslationField from "@/components/admin/MagicTranslationField";
import LockedStateTracker from "@/components/admin/LockedStateTracker";

interface NewsCategory {
  id: string;
  name: string;
  slug: string;
  color: string;
}

interface RejectedDraft {
  notrans: string;
  module_name: string;
  payload: any;
  action: string;
  rejection_reason: string | null;
  createdAt: string;
}

export interface GalleryImage {
  imageUrl: string;
  caption: string;
  orderIndex: number;
}

export default function NewsForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = !!id;
  const quillRef = useRef<ReactQuill>(null);

  const { user, can } = useAuth();
  const isSuperadmin = user?.role === "superadmin" || user?.role === "admin" || user?.role === "owner";

  const [categories, setCategories] = useState<NewsCategory[]>([]);
  const [isFetching, setIsFetching] = useState(isEditMode);
  const [isSaving, setIsSaving] = useState(false);
  const [isDiscarding, setIsDiscarding] = useState(false);

  // Workspace Layout State
  const [viewLayout, setViewLayout] = useState<"split" | "editor" | "preview">(
    "split",
  );
  const [isDragging, setIsDragging] = useState(false);
  const [galleryImages, setGalleryImages] = useState<GalleryImage[]>([]);
  const [isUploadingGallery, setIsUploadingGallery] = useState(false);

  // --- Image Adjustment Modal State ---
  const [cropQueue, setCropQueue] = useState<{file: File, type: "cover"|"gallery"}[]>([]);
  const [currentCropFile, setCurrentCropFile] = useState<File | null>(null);
  const [currentCropType, setCurrentCropType] = useState<"cover" | "gallery" | null>(null);

  const processCroppedFile = async (croppedFile: File) => {
    if (currentCropType === "cover") {
      setCoverFile(croppedFile);
    } else if (currentCropType === "gallery") {
      setIsUploadingGallery(true);
      const loadingToast = toast.loading(`Mengunggah foto galeri...`);
      try {
        const compressed = await compressImage(croppedFile);
        const uploadData = new FormData();
        uploadData.append("inline_image", compressed);

        const response = await api.post("/news/upload-inline", uploadData);
        if (response.data?.url) {
          setGalleryImages((prev) => [
            ...prev,
            { imageUrl: response.data.url, caption: "", orderIndex: prev.length },
          ]);
          toast.success(`Berhasil menambahkan foto galeri!`, { id: loadingToast });
        }
      } catch (err) {
        toast.error("Gagal mengunggah foto galeri.", { id: loadingToast });
      } finally {
        setIsUploadingGallery(false);
      }
    }
    
    // Check queue
    const nextQueue = [...cropQueue];
    if (nextQueue.length > 0) {
      const next = nextQueue.shift();
      setCropQueue(nextQueue);
      setCurrentCropFile(next!.file);
      setCurrentCropType(next!.type);
    } else {
      setCurrentCropFile(null);
      setCurrentCropType(null);
    }
  };

  const handleCancelCrop = () => {
    // Check queue
    const nextQueue = [...cropQueue];
    if (nextQueue.length > 0) {
      const next = nextQueue.shift();
      setCropQueue(nextQueue);
      setCurrentCropFile(next!.file);
      setCurrentCropType(next!.type);
    } else {
      setCurrentCropFile(null);
      setCurrentCropType(null);
    }
  };

  const initialFormState = {
    title: "",
    excerpt: "",
    content: "",
    category_id: "",
    status: "Draft",
    cover_image: "",
    seo_title: "",
    meta_description: "",
    is_locked: false,
    lock_ticket: "",
    published_at: "",
    gallery_images: [] as GalleryImage[],
  };

  const [formData, setFormData] = useState(initialFormState);
  const [originalData, setOriginalData] = useState(initialFormState);
  const [rejectedDraft, setRejectedDraft] = useState<RejectedDraft | null>(
    null,
  );
  const [showDraftBanner, setShowDraftBanner] = useState(false);

  const isDataLocked = formData.is_locked;
  const shouldLockUI = isDataLocked && !isSuperadmin;
  const isOverrideMode = isDataLocked && isSuperadmin;

  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);

  // Translations
  const [terjemahanTitle, setTerjemahanTitle] = useState("");
  const [terjemahanExcerpt, setTerjemahanExcerpt] = useState("");
  const [terjemahanContent, setTerjemahanContent] = useState("");
  const [originalTerjemahanTitle, setOriginalTerjemahanTitle] = useState("");
  const [originalTerjemahanExcerpt, setOriginalTerjemahanExcerpt] = useState("");
  const [originalTerjemahanContent, setOriginalTerjemahanContent] = useState("");

  // Sync title to seo_title auto
  useEffect(() => {
    if (!isEditMode && !formData.seo_title) {
      setFormData((prev) => ({ ...prev, seo_title: prev.title }));
    }
  }, [formData.title, isEditMode]);

  useEffect(() => {
    if (!coverFile) {
      setCoverPreview(null);
      return;
    }
    const url = URL.createObjectURL(coverFile);
    setCoverPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [coverFile]);

  // Fetch categories
  useEffect(() => {
    api
      .get("/news-categories")
      .then((res) => {
        if (Array.isArray(res.data)) setCategories(res.data);
      })
      .catch(console.error);
  }, []);

  // Default category
  useEffect(() => {
    if (!isEditMode && categories.length > 0 && !formData.category_id) {
      setFormData((prev) => ({ ...prev, category_id: categories[0].id }));
    }
  }, [categories, isEditMode, formData.category_id]);

  // Fetch existing data (Edit Mode)
  useEffect(() => {
    const controller = new AbortController();
    if (!isEditMode) {
      setIsFetching(false);
      return;
    }

    const fetchData = async () => {
      setIsFetching(true);
      try {
        const [articleRes, draftRes] = await Promise.allSettled([
          api.get(`/news/${id}`, { signal: controller.signal }),
          api.get(`/approval/rejected/${id}?module=NewsArticle`, {
            signal: controller.signal,
          }),
        ]);

        if (articleRes.status === "fulfilled") {
          const data = articleRes.value.data.data || articleRes.value.data;

          const normalized = {
            ...initialFormState,
            title: data.title || "",
            excerpt: data.excerpt || "",
            content: data.content || "",
            category_id: data.category_id || "",
            status: data.status || "Draft",
            cover_image: data.cover_image || "",
            seo_title: data.seo_title || "",
            meta_description: data.meta_description || "",
            is_locked: Boolean(data.is_locked),
            lock_ticket: data.lock_ticket || "",
            published_at: data.published_at
              ? new Date(data.published_at).toISOString().slice(0, 16)
              : "",
            gallery_images: Array.isArray(data.gallery_images)
              ? data.gallery_images
              : [],
          };
          setFormData(normalized);
          setOriginalData(normalized);
          setGalleryImages(
            Array.isArray(data.gallery_images) ? data.gallery_images : [],
          );
        } else if (articleRes.reason.name !== "CanceledError") {
          throw articleRes.reason;
        }

        if (
          draftRes.status === "fulfilled" &&
          draftRes.value.data?.hasRejected
        ) {
          setRejectedDraft(draftRes.value.data.data);
          setShowDraftBanner(true);
        }

        // Fetch translations
        api.get("/translation/manual", {
          params: { modelName: "NewsArticle", recordId: id },
        }).then((transRes) => {
          const transData = transRes.data?.data?.id || {};
          setTerjemahanTitle(transData.title || "");
          setTerjemahanExcerpt(transData.excerpt || "");
          setTerjemahanContent(transData.content || "");
          setOriginalTerjemahanTitle(transData.title || "");
          setOriginalTerjemahanExcerpt(transData.excerpt || "");
          setOriginalTerjemahanContent(transData.content || "");
        }).catch(() => {});
      } catch (error: unknown) {
        if (!(typeof error === "object" && error !== null && "name" in error && (error as { name?: string }).name === "CanceledError")) {
          toast.error("Gagal memuat data artikel");
          navigate("/admin/news");
        }
      } finally {
        if (!controller.signal.aborted) setIsFetching(false);
      }
    };

    fetchData();
    return () => {
      controller.abort();
    };
  }, [id, isEditMode, navigate]);

  const handleDiscardDraft = async () => {
    if (!rejectedDraft?.notrans) return;
    setIsDiscarding(true);
    const toastId = toast.loading("Mengabaikan notifikasi penolakan...");
    try {
      await api.patch("/approval/discard", { notrans: rejectedDraft.notrans });
      toast.success("Notifikasi revisi berhasil diabaikan.", { id: toastId });
      setRejectedDraft(null);
      setShowDraftBanner(false);
      setFormData((prev) => ({ ...prev, is_locked: false, lock_ticket: "" }));
    } catch (error: unknown) {
      toast.error("Gagal mengabaikan draf", {
        id: toastId,
        description: getErrorMessage(error),
      });
    } finally {
      setIsDiscarding(false);
    }
  };

  const handleRestoreDraft = () => {
    if (!rejectedDraft?.payload)
      return toast.error("Data pemulihan tidak ditemukan.");
    if (rejectedDraft?.action === "DELETE")
      return toast.error(
        "Permintaan hapus yang ditolak tidak bisa dipulihkan.",
      );
    try {
      const payload =
        typeof rejectedDraft.payload === "string"
          ? JSON.parse(rejectedDraft.payload)
          : rejectedDraft.payload;
      setFormData((prev) => ({
        ...prev,
        title: payload.title ?? prev.title,
        excerpt: payload.excerpt ?? prev.excerpt,
        content: payload.content ?? prev.content,
        category_id: payload.category_id ?? prev.category_id,
        status: "Draft",
        cover_image: payload.cover_image ?? prev.cover_image,
        seo_title: payload.seo_title ?? prev.seo_title,
        meta_description: payload.meta_description ?? prev.meta_description,
        published_at: payload.published_at
          ? new Date(payload.published_at).toISOString().slice(0, 16)
          : prev.published_at,
        read_time: payload.read_time ?? 0,
      }));
      if (Array.isArray(payload.gallery_images)) {
        setGalleryImages(payload.gallery_images);
      }
      setCoverFile(null);
      setCoverPreview(null);
      toast.success("Konten draf berhasil dipulihkan!");
    } catch {
      toast.error("Gagal memproses data pemulihan.");
    }
  };

  const imageHandler = useCallback(() => {
    if (shouldLockUI) return;
    const input = document.createElement("input");
    input.setAttribute("type", "file");
    input.setAttribute("accept", "image/*");
    input.click();
    input.onchange = async () => {
      if (input.files?.[0]) {
        const file = input.files[0];
        const toastId = toast.loading("Mengunggah gambar inline...");
        try {
          // Compress image client side before upload
          const compressed = await compressImage(file);
          const uploadData = new FormData();
          uploadData.append("inline_image", compressed);

          const response = await api.post("/news/upload-inline", uploadData);
          const quill = quillRef.current?.getEditor();
          if (!quill) throw new Error("Editor not ready");
          const range = quill.getSelection(true);
          quill.insertEmbed(
            range ? range.index : quill.getLength(),
            "image",
            response.data.url,
          );
          toast.success("Gambar disisipkan!", { id: toastId });
        } catch (err: unknown) {
          toast.error("Upload gagal", {
            id: toastId,
            description: getErrorMessage(err),
          });
        }
      }
    };
  }, [shouldLockUI]);

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
        handlers: { image: imageHandler },
      },
    }),
    [imageHandler],
  );

  const hasDataChanged = () => {
    if (!isEditMode) return true;
    if (coverFile !== null) return true;
    if (rejectedDraft !== null) return true;
    for (const key of [
      "title",
      "excerpt",
      "content",
      "category_id",
      "seo_title",
      "meta_description",
      "published_at",
    ]) {
      // @ts-expect-error dynamic access
      if (formData[key] !== originalData[key]) return true;
    }
    if (
      JSON.stringify(galleryImages) !==
      JSON.stringify(originalData.gallery_images)
    )
      return true;
      
    if (terjemahanTitle !== originalTerjemahanTitle) return true;
    if (terjemahanExcerpt !== originalTerjemahanExcerpt) return true;
    if (terjemahanContent !== originalTerjemahanContent) return true;
    return false;
  };

  const handleSave = async (targetStatus: string) => {
    if (shouldLockUI) return toast.error("Data terkunci.");
    if (!formData.title.trim())
      return toast.error("Judul artikel tidak boleh kosong.");
    const plainText = formData.content.replace(/<[^>]*>?/gm, "").trim();
    if (!formData.content || plainText.length === 0)
      return toast.error("Isi artikel wajib diisi.");
    if (targetStatus === "Published" && !coverFile && !formData.cover_image)
      return toast.error("Gambar sampul wajib untuk publikasi.");
    if (targetStatus === "Published" && !hasDataChanged())
      return toast.info("Tidak ada perubahan terdeteksi.");

    setIsSaving(true);
    const loadingToast = toast.loading(
      `${isEditMode ? "Memperbarui" : "Menyimpan"} artikel...`,
    );

    try {
      const payload = new FormData();
      if (coverFile)
        payload.append("cover_image", await compressImage(coverFile));
      payload.append("title", formData.title.trim());
      payload.append("excerpt", formData.excerpt.trim());
      payload.append("content", formData.content);
      payload.append("category_id", formData.category_id);
      payload.append("status", targetStatus);
      payload.append("seo_title", formData.seo_title.trim());
      payload.append("meta_description", formData.meta_description.trim());

      if (formData.published_at)
        payload.append(
          "published_at",
          new Date(formData.published_at).toISOString(),
        );

      // Send gallery_images even if empty, so backend knows to delete them
      payload.append("gallery_images", JSON.stringify(galleryImages));

      if (rejectedDraft?.notrans)
        payload.append("previous_notrans", rejectedDraft.notrans);

      // Translation payload
      const translationPayload: Record<string, string> = {};
      if (terjemahanTitle.trim()) translationPayload.title = terjemahanTitle.trim();
      if (terjemahanExcerpt.trim()) translationPayload.excerpt = terjemahanExcerpt.trim();
      if (terjemahanContent.trim()) translationPayload.content = terjemahanContent.trim();

      if (Object.keys(translationPayload).length > 0) {
        payload.append("_translations", JSON.stringify({ id: translationPayload }));
      }

      const endpoint = isEditMode ? `/news/${id}` : "/news";
      const method = isEditMode ? api.put : api.post;
      const response = await method(endpoint, payload, { timeout: 60000 });

      if ([200, 201, 202].includes(response.status)) {
        setRejectedDraft(null);
        setShowDraftBanner(false);
        if (response.status === 202) {
          setFormData((prev) => ({
            ...prev,
            is_locked: true,
            lock_ticket: response.data.ticket,
          }));
          toast.success("Revisi Berhasil Diajukan!", { id: loadingToast });
        } else {
          toast.success(
            isSuperadmin ? "Berhasil Dipublikasikan!" : "Draf Tersimpan.",
            { id: loadingToast },
          );
        }
        setTimeout(() => navigate("/admin/news"), 800);
      }
    } catch (err: unknown) {
      toast.error("Gagal menyimpan", {
        id: loadingToast,
        description: getErrorMessage(err) || "Koneksi terganggu.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const { getRootProps, getInputProps } = useDropzone({
    disabled: shouldLockUI,
    onDrop: (files) => {
      const validFiles = files.filter(f => f.type.startsWith("image/"));
      if (validFiles[0]) {
        if (!currentCropFile) {
          setCurrentCropFile(validFiles[0]);
          setCurrentCropType("cover");
        } else {
          setCropQueue(prev => [...prev, { file: validFiles[0], type: "cover" }]);
        }
      }
    },
    accept: { "image/jpeg": [], "image/png": [], "image/webp": [] },
    multiple: false,
    onDragEnter: () => setIsDragging(true),
    onDragLeave: () => setIsDragging(false),
    onDropAccepted: () => setIsDragging(false),
    onDropRejected: () => setIsDragging(false),
  });

  const {
    getRootProps: getGalleryProps,
    getInputProps: getGalleryInputProps,
    isDragActive: isGalleryDragging,
  } = useDropzone({
    disabled: shouldLockUI || isUploadingGallery,
    onDrop: async (files) => {
      const validFiles = files.filter((f) => f.type.startsWith("image/"));
      if (validFiles.length === 0) return;

      const queueItems = validFiles.map(f => ({ file: f, type: "gallery" as const }));
      
      if (!currentCropFile) {
        setCurrentCropFile(queueItems[0].file);
        setCurrentCropType(queueItems[0].type);
        setCropQueue(prev => [...prev, ...queueItems.slice(1)]);
      } else {
        setCropQueue(prev => [...prev, ...queueItems]);
      }
    },
    accept: { "image/jpeg": [], "image/png": [], "image/webp": [] },
  });

  const moveGalleryImage = (index: number, direction: "left" | "right") => {
    if (shouldLockUI) return;
    const newIndex = direction === "left" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= galleryImages.length) return;

    setGalleryImages((prev) => {
      const newArr = [...prev];
      const temp = newArr[index];
      newArr[index] = newArr[newIndex];
      newArr[newIndex] = temp;

      // Update orderIndex
      return newArr.map((img, i) => ({ ...img, orderIndex: i }));
    });
  };

  const removeGalleryImage = (index: number) => {
    if (shouldLockUI) return;
    setGalleryImages((prev) => {
      const newArr = [...prev];
      newArr.splice(index, 1);
      return newArr.map((img, i) => ({ ...img, orderIndex: i }));
    });
  };

  const updateGalleryCaption = (index: number, caption: string) => {
    if (shouldLockUI) return;
    setGalleryImages((prev) => {
      const newArr = [...prev];
      newArr[index].caption = caption;
      return newArr;
    });
  };

  const getDynamicSeoDescription = () => {
    if (formData.meta_description && formData.meta_description.trim() !== "")
      return formData.meta_description;
    if (formData.excerpt && formData.excerpt.trim() !== "")
      return formData.excerpt;

    if (!formData.content || formData.content.trim() === "") {
      return "Tulis excerpt atau konten artikel untuk melihat deskripsi otomatis di sini.";
    }

    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(formData.content, "text/html");
      let plainText = doc.body.textContent || "";
      plainText = plainText.replace(/\s+/g, " ").trim();
      if (plainText.length === 0) {
        return "Tulis excerpt atau konten artikel untuk melihat deskripsi otomatis di sini.";
      }
      return plainText.slice(0, 150) + (plainText.length > 150 ? "..." : "");
    } catch (e) {
      const plainText = formData.content
        .replace(/<[^>]*>?/gm, "")
        .replace(/&nbsp;|\u00A0/g, " ")
        .trim();
      return plainText.slice(0, 150) + (plainText.length > 150 ? "..." : "");
    }
  };

  const currentAutoReadTime = useMemo(() => {
    if (!formData.content) return "1 min read";
    const plainText = formData.content
      .replace(/<[^>]*>?/gm, "")
      .replace(/&nbsp;|\u00A0/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const wordCount = plainText.split(/\s+/).filter(Boolean).length;
    const minutes = Math.ceil(wordCount / 200);
    return `${Math.max(1, minutes)} min read`;
  }, [formData.content]);

  if (isFetching) {
    return (
      <div className="h-[60vh] flex items-center justify-center text-slate-500">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-daw-green border-t-transparent rounded-full animate-spin" />
          Memuat data artikel...
        </div>
      </div>
    );
  }

  const generatedSlug = formData.title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

  const activeCategory = categories.find((c) => c.id === formData.category_id);

  return (
    <div className="fixed inset-0 z-[100] bg-slate-50 flex flex-col animate-in fade-in duration-300">
      {/* IMMERSIVE TOP BAR */}
      <div className="bg-white border-b border-slate-200 px-6 py-3.5 flex items-center justify-between shadow-sm shrink-0">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => navigate("/admin/news")}
            className="p-2 hover:bg-slate-100 rounded-xl transition-all text-slate-500 hover:text-slate-800"
            title="Kembali ke Repositori">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="h-6 w-px bg-slate-200" />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                News Builder
              </span>
              {formData.is_locked && (
                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-100 text-blue-600 text-[9px] font-bold uppercase tracking-wider">
                  <Lock className="w-2.5 h-2.5" /> Locked
                </span>
              )}
            </div>
            <h2 className="text-xs font-bold text-slate-800 truncate max-w-[150px] sm:max-w-[300px] mt-0.5">
              {formData.title || "Draf Artikel Baru"}
            </h2>
          </div>
        </div>

        {/* Middle: Layout Selector */}
        <div className="hidden lg:flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/50">
          <button
            type="button"
            onClick={() => setViewLayout("editor")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
              viewLayout === "editor"
                ? "bg-white text-daw-green shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            }`}>
            <PenTool className="w-3.5 h-3.5" /> Focus Editor
          </button>
          <button
            type="button"
            onClick={() => setViewLayout("split")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
              viewLayout === "split"
                ? "bg-white text-daw-green shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            }`}>
            <Layout className="w-3.5 h-3.5" /> Split Screen
          </button>
          <button
            type="button"
            onClick={() => setViewLayout("preview")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
              viewLayout === "preview"
                ? "bg-white text-daw-green shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            }`}>
            <Eye className="w-3.5 h-3.5" /> Full Preview
          </button>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {shouldLockUI ? (
            <div className="px-4 py-2 bg-blue-50 border border-blue-200 rounded-xl flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-widest text-blue-600">
                Read Only Mode
              </span>
            </div>
          ) : (
            <>
              <button
                type="button"
                disabled={
                  isSaving ||
                  (!hasDataChanged() && !isSuperadmin) ||
                  !can("manage_news")
                }
                onClick={() => handleSave("Draft")}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed border border-slate-200">
                {isSaving ? "..." : "Simpan Draf"}
              </button>
              <button
                type="button"
                disabled={
                  isSaving ||
                  (!hasDataChanged() && !isSuperadmin) ||
                  !can("manage_news")
                }
                onClick={() => handleSave("Published")}
                className={`text-white px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed
                  ${
                    isOverrideMode
                      ? "bg-amber-500 hover:bg-amber-600 shadow-md shadow-amber-500/10"
                      : "bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-600/10"
                  }`}>
                <Save className="w-4 h-4" />
                {isSaving
                  ? "Menyimpan..."
                  : isOverrideMode
                    ? "Override & Publish"
                    : isSuperadmin
                      ? "Publish Live"
                      : "Request Approval"}
              </button>
            </>
          )}
        </div>
      </div>

      {/* WORKSPACE BODY */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* LEFT: EDITORIAL WORKSPACE (Main Form) */}
        {(viewLayout === "editor" || viewLayout === "split") && (
          <div
            className={`h-full overflow-y-auto custom-scrollbar p-6 ${
              viewLayout === "editor"
                ? "w-full max-w-7xl mx-auto"
                : "w-1/2 border-r border-slate-200"
            }`}>
            <div
              className={`bg-white rounded-2xl border transition-all duration-500 shadow-sm overflow-hidden
                ${
                  shouldLockUI
                    ? "border-blue-200"
                    : isOverrideMode
                      ? "border-amber-200"
                      : "border-slate-200"
                }`}>
              {/* THE COMMAND CENTER (Banners) */}
              {(formData.is_locked || (rejectedDraft && showDraftBanner)) && (
                <div className="px-8 pt-6 pb-0 space-y-4">
                  {/* 1. SOVEREIGN OVERRIDE BANNER */}
                  {isOverrideMode && (
                    <div className="flex items-start gap-4 p-5 bg-amber-50 border border-amber-200 rounded-2xl animate-in slide-in-from-top-4 shadow-sm">
                      <div className="p-2.5 bg-amber-100 text-amber-600 rounded-xl shrink-0">
                        <AlertTriangle className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-amber-900 uppercase tracking-tight">
                          System Intervention Required
                        </h4>
                        <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                          Data ini dikunci (Tiket:{" "}
                          <strong>{formData.lock_ticket}</strong>). Sebagai
                          Admin, Anda dapat mengabaikan birokrasi dan
                          memublikasikan secara langsung (Override).
                        </p>
                      </div>
                    </div>
                  )}



                  {/* 3. REJECTION BANNER & RESTORE */}
                  {rejectedDraft && showDraftBanner && !formData.is_locked && (
                    <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 p-5 bg-red-50/50 border border-red-200 rounded-2xl animate-in slide-in-from-top-2 shadow-sm">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-red-100 text-red-600 rounded-xl shrink-0">
                          <AlertTriangle className="w-5 h-5 animate-bounce" />
                        </div>
                        <div>
                          <h4 className="text-sm font-black text-red-900 uppercase tracking-tight">
                            Revisi Diperlukan
                          </h4>
                          <p className="text-xs text-red-800 bg-white/50 p-2 rounded-lg mt-1 italic border border-red-100">
                            "{rejectedDraft.rejection_reason}"
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={handleRestoreDraft}
                          className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl shadow-md transition-all active:scale-95">
                          <RotateCcw className="w-4 h-4" /> Pulihkan Draf
                        </button>
                        <button
                          type="button"
                          disabled={isDiscarding}
                          onClick={handleDiscardDraft}
                          className="flex items-center gap-2 px-5 py-2.5 bg-white hover:bg-red-50 text-red-600 border border-red-200 text-xs font-bold rounded-xl shadow-sm transition-all disabled:opacity-50">
                          {isDiscarding ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <X className="w-4 h-4" />
                          )}
                          Abaikan
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* DYNAMIC WORKSPACE CONTENT */}
              <div className="p-8">
                <LockedStateTracker
                  isLocked={shouldLockUI}
                  lockTicket={formData.lock_ticket}>
                  <div className="space-y-10">
                    {/* SECTION 1: CORE IDENTITY */}
                <div className="space-y-8">
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                    <FileText className="w-4 h-4 text-slate-400" />
                    <h3 className="text-sm font-bold text-slate-900">
                      Informasi Utama Artikel
                    </h3>
                  </div>
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                        Judul Artikel *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.title}
                        onChange={(e) =>
                          setFormData({ ...formData, title: e.target.value })
                        }
                        readOnly={shouldLockUI}
                        className={`w-full px-5 py-4 rounded-2xl border transition-all font-bold text-slate-800 outline-none
                          ${
                            shouldLockUI
                              ? "bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed"
                              : "bg-slate-50 border-slate-200 focus:bg-white focus:border-daw-green focus:ring-4 focus:ring-daw-green/10"
                          }`}
                        placeholder="Tulis judul yang memikat pembaca..."
                      />
                      <MagicTranslationField
                        label="Judul Artikel (Indonesian)"
                        value={terjemahanTitle}
                        onChange={setTerjemahanTitle}
                        originalText={formData.title}
                        disabled={shouldLockUI}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex justify-between">
                        <span>Ringkasan (Excerpt)</span>
                        <span>{formData.excerpt.length}/500</span>
                      </label>
                      <textarea
                        value={formData.excerpt}
                        onChange={(e) =>
                          setFormData({ ...formData, excerpt: e.target.value })
                        }
                        readOnly={shouldLockUI}
                        maxLength={500}
                        rows={3}
                        className={`w-full px-5 py-4 rounded-2xl border transition-all text-slate-600 outline-none resize-none
                          ${
                            shouldLockUI
                              ? "bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed"
                              : "bg-slate-50 border-slate-200 focus:bg-white focus:border-daw-green focus:ring-4 focus:ring-daw-green/10"
                          }`}
                        placeholder="Rangkuman singkat untuk ditampilkan di kartu halaman depan..."
                      />
                      <MagicTranslationField
                        label="Ringkasan (Indonesian)"
                        value={terjemahanExcerpt}
                        onChange={setTerjemahanExcerpt}
                        originalText={formData.excerpt}
                        disabled={shouldLockUI}
                      />
                    </div>
                  </div>
                </div>

                {/* SECTION 2: SEO ENGINE */}
                <div className="space-y-6 bg-slate-900 p-8 rounded-[2rem] shadow-2xl">
                  <div className="flex items-center gap-2 border-b border-white/10 pb-3">
                    <Search className="w-5 h-5 text-blue-400" />
                    <h3 className="text-sm font-black text-white uppercase tracking-widest">
                      Search Engine Optimization
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                          SEO Title Override
                        </label>
                        <input
                          type="text"
                          readOnly={shouldLockUI}
                          value={formData.seo_title}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              seo_title: e.target.value,
                            })
                          }
                          className={`w-full px-4 py-3 rounded-xl bg-slate-800 border outline-none text-sm text-white transition-all
                            ${
                              shouldLockUI
                                ? "opacity-60 border-white/5 cursor-not-allowed"
                                : "border-white/10 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                            }`}
                          placeholder={
                            formData.title || "Custom title untuk search engine"
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                            Meta Description
                          </label>
                          <span
                            className={`text-[9px] font-bold ${
                              formData.meta_description?.length > 160
                                ? "text-red-400"
                                : "text-slate-400"
                            }`}>
                            {formData.meta_description?.length || 0}/160
                          </span>
                        </div>
                        <textarea
                          readOnly={shouldLockUI}
                          placeholder="Tulis deskripsi meta spesifik..."
                          value={formData.meta_description}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              meta_description: e.target.value,
                            })
                          }
                          className={`w-full p-4 rounded-xl bg-slate-800 border outline-none text-sm text-slate-300 h-24 resize-none transition-all custom-scrollbar ${
                            shouldLockUI
                              ? "opacity-60 border-white/5 cursor-not-allowed"
                              : formData.meta_description?.length > 160
                                ? "border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                                : "border-white/10 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                          }`}
                        />
                        <p className="text-[9px] text-slate-500 italic leading-relaxed">
                          *Jika kosong, sistem akan menggunakan Excerpt atau
                          teks paragraf awal.
                        </p>
                      </div>
                    </div>

                    {/* Google Card Preview */}
                    <div className="bg-white p-6 rounded-2xl shadow-inner flex flex-col justify-center relative overflow-hidden group">
                      <p className="text-[10px] font-black text-slate-300 uppercase mb-3 flex items-center gap-2">
                        <Globe className="w-3 h-3" /> Live Google Search Snippet
                      </p>
                      <div className="space-y-1">
                        <p className="text-[#1a0dab] text-xl font-medium truncate hover:underline cursor-pointer">
                          {formData.seo_title ||
                            formData.title ||
                            "Judul Artikel"}
                        </p>
                        <p className="text-[#006621] text-sm truncate mb-1 flex items-center gap-1 font-mono">
                          daw.co.id{" "}
                          <span className="text-slate-400 text-xs">
                            › news ›
                          </span>{" "}
                          {generatedSlug || "..."}
                        </p>
                        <p className="text-[#545454] text-sm line-clamp-2 leading-relaxed break-words">
                          {getDynamicSeoDescription()}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* SECTION 3: EDITORIAL METADATA & COVER */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                  {/* Category & Dates */}
                  <div className="space-y-6">
                    <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                      <Layout className="w-4 h-4 text-slate-400" />
                      <h3 className="text-sm font-bold text-slate-900">
                        Editorial Settings
                      </h3>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                        Kategori Artikel *
                      </label>
                      <select
                        disabled={shouldLockUI}
                        value={formData.category_id}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            category_id: e.target.value,
                          })
                        }
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 outline-none focus:bg-white focus:border-daw-green focus:ring-2 focus:ring-daw-green/20 transition-all disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed">
                        <option value="">-- Pilih Kategori --</option>
                        {categories.map((cat) => (
                          <option key={cat.id} value={cat.id}>
                            {cat.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> Tanggal Terbit
                      </label>
                      <input
                        type="datetime-local"
                        readOnly={shouldLockUI}
                        value={formData.published_at}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            published_at: e.target.value,
                          })
                        }
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-600 outline-none focus:bg-white focus:border-daw-green focus:ring-2 focus:ring-daw-green/20 transition-all text-sm"
                      />
                    </div>
                  </div>

                  {/* Cover Image Dropzone */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                      <ImageIcon className="w-4 h-4 text-slate-400" />
                      <h3 className="text-sm font-bold text-slate-900">
                        Gambar Sampul Artikel
                      </h3>
                    </div>
                    {coverPreview || formData.cover_image ? (
                      <div className="relative w-full h-[220px] rounded-3xl overflow-hidden group border border-slate-200 shadow-sm">
                        <img
                          src={
                            coverPreview ||
                            `${BASE_UPLOAD_URL}/${formData.cover_image}`
                          }
                          alt="Cover Preview"
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                        />
                        {!shouldLockUI && (
                          <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                            <button
                              type="button"
                              onClick={() => {
                                setCoverPreview(null);
                                setCoverFile(null);
                                setFormData({ ...formData, cover_image: "" });
                              }}
                              className="bg-red-500 text-white px-6 py-3 rounded-2xl flex items-center gap-2 font-bold shadow-lg transform hover:scale-105 transition-all">
                              <Trash2 className="w-5 h-5" /> Hapus Gambar
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div
                        {...getRootProps()}
                        className={`relative border-2 border-dashed rounded-3xl h-[220px] flex flex-col items-center justify-center transition-all duration-300 group outline-none
                          ${
                            shouldLockUI
                              ? "border-slate-200 bg-slate-100 opacity-60 cursor-not-allowed"
                              : isDragging
                                ? "border-daw-green bg-daw-green/5 scale-[0.99] ring-4 ring-daw-green/10"
                                : "border-slate-300 bg-slate-50 hover:border-daw-green hover:bg-slate-50/80 cursor-pointer"
                          }`}>
                        <input {...getInputProps()} />
                        <div
                          className={`p-4 rounded-2xl mb-3 transition-all duration-500 ${
                            isDragging
                              ? "bg-daw-green text-white scale-110 rotate-6"
                              : "bg-white text-slate-400 shadow-sm group-hover:text-daw-green"
                          }`}>
                          {shouldLockUI ? (
                            <Lock className="w-8 h-8 text-slate-300" />
                          ) : (
                            <UploadCloud
                              className={`w-8 h-8 ${isDragging ? "animate-bounce" : ""}`}
                            />
                          )}
                        </div>
                        <div className="text-center space-y-1">
                          <p className="text-sm font-bold text-slate-700">
                            {shouldLockUI
                              ? "Upload Terkunci"
                              : isDragging
                                ? "Lepaskan gambar di sini"
                                : "Drag & Drop gambar sampul"}
                          </p>
                          {!shouldLockUI && (
                            <p className="text-[10px] text-slate-500 font-medium">
                              JPG, PNG, WebP (Maks. 5MB)
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* SECTION 4: TEXT EDITOR */}
                <div className="space-y-6">
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                    <PenTool className="w-4 h-4 text-slate-400" />
                    <h3 className="text-sm font-bold text-slate-900">
                      Area Penulisan Konten (WYSIWYG) *
                    </h3>
                  </div>

                  <div
                    className={`rounded-[1.5rem] border overflow-hidden bg-white shadow-sm transition-all
                      ${
                        shouldLockUI
                          ? "border-slate-200 opacity-70 pointer-events-none"
                          : "border-slate-200 focus-within:ring-4 focus-within:ring-daw-green/10 focus-within:border-daw-green"
                      }`}>
                    <ReactQuill
                      ref={quillRef}
                      theme="snow"
                      value={formData.content}
                      readOnly={shouldLockUI}
                      onChange={(val) =>
                        setFormData((prev) => ({ ...prev, content: val }))
                      }
                      modules={quillModules}
                      className="min-h-[500px] flex flex-col [&_.ql-editor]:p-10 [&_.ql-editor]:text-slate-700 [&_.ql-editor]:text-lg [&_.ql-toolbar]:border-0 [&_.ql-toolbar]:border-b [&_.ql-toolbar]:bg-slate-50/80 [&_.ql-container]:border-0"
                    />
                  </div>
                  <MagicTranslationField
                    label="Konten Artikel (Indonesian)"
                    value={terjemahanContent}
                    onChange={setTerjemahanContent}
                    originalText={formData.content}
                    isRichText
                    disabled={shouldLockUI}
                  />
                </div>

                {/* SECTION 5: EVENT GALLERY EDITOR */}
                <div className="space-y-6">
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                    <ImageIcon className="w-4 h-4 text-daw-green" />
                    <h3 className="text-sm font-bold text-slate-900">
                      Event Gallery
                    </h3>
                    <span className="ml-2 text-[9px] font-black uppercase bg-daw-green/10 text-daw-green px-2 py-0.5 rounded border border-daw-green/20">
                      Optional
                    </span>
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6 space-y-6">
                    {/* Drag and Drop Zone */}
                    <div
                      {...getGalleryProps()}
                      className={`relative border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center transition-all duration-300 outline-none
                        ${
                          shouldLockUI
                            ? "border-slate-200 bg-white opacity-60 cursor-not-allowed"
                            : isGalleryDragging
                              ? "border-daw-green bg-daw-green/5 ring-4 ring-daw-green/10 scale-[0.99]"
                              : "border-slate-300 bg-white hover:border-daw-green hover:bg-slate-50 cursor-pointer"
                        }`}>
                      <input {...getGalleryInputProps()} />
                      <div
                        className={`p-3 rounded-xl mb-3 transition-all duration-300 ${
                          isGalleryDragging || isUploadingGallery
                            ? "bg-daw-green text-white"
                            : "bg-slate-100 text-slate-400 group-hover:text-daw-green"
                        }`}>
                        {isUploadingGallery ? (
                          <RefreshCw className="w-6 h-6 animate-spin" />
                        ) : (
                          <UploadCloud
                            className={`w-6 h-6 ${isGalleryDragging ? "animate-bounce" : ""}`}
                          />
                        )}
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-bold text-slate-700">
                          {isUploadingGallery
                            ? "Sedang mengunggah..."
                            : "Drag & Drop beberapa foto sekaligus di sini"}
                        </p>
                        {!shouldLockUI && !isUploadingGallery && (
                          <p className="text-[10px] text-slate-500 font-medium mt-1">
                            Klik untuk menelusuri (JPG, PNG, WebP)
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Draggable Thumbnail Grid */}
                    {galleryImages.length > 0 && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-1.5">
                            <Layout className="w-3 h-3" /> Sortable Grid
                          </h4>
                          <span className="text-[10px] font-bold text-slate-500 bg-slate-200/50 px-2 py-1 rounded-md">
                            {galleryImages.length} Foto
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                          {galleryImages.map((img, idx) => (
                            <div
                              key={idx}
                              className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow group flex flex-col">
                              {/* Thumbnail Header */}
                              <div className="relative h-36 bg-slate-100 border-b border-slate-100">
                                <img
                                  src={
                                    img.imageUrl.startsWith("http")
                                      ? img.imageUrl
                                      : `${BASE_UPLOAD_URL}/${img.imageUrl}`
                                  }
                                  alt={`Gallery ${idx}`}
                                  className="w-full h-full object-cover"
                                />
                                <div className="absolute top-2 left-2 bg-black/60 backdrop-blur text-white text-[10px] font-bold px-2 py-1 rounded-lg">
                                  #{idx + 1}
                                </div>
                                {!shouldLockUI && (
                                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                      type="button"
                                      disabled={idx === 0}
                                      onClick={() =>
                                        moveGalleryImage(idx, "left")
                                      }
                                      className="p-1.5 bg-white text-slate-700 hover:text-daw-green rounded-lg shadow disabled:opacity-50"
                                      title="Geser Kiri">
                                      <ChevronLeft className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      disabled={
                                        idx === galleryImages.length - 1
                                      }
                                      onClick={() =>
                                        moveGalleryImage(idx, "right")
                                      }
                                      className="p-1.5 bg-white text-slate-700 hover:text-daw-green rounded-lg shadow disabled:opacity-50 rotate-180"
                                      title="Geser Kanan">
                                      <ChevronLeft className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                )}
                              </div>

                              {/* Metadata Body */}
                              <div className="p-3 flex-1 flex flex-col gap-3">
                                <div className="space-y-1">
                                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                                    Caption Hover
                                  </label>
                                  <textarea
                                    disabled={shouldLockUI}
                                    maxLength={150}
                                    value={img.caption || ""}
                                    onChange={(e) =>
                                      updateGalleryCaption(idx, e.target.value)
                                    }
                                    placeholder="Opsional keterangan foto..."
                                    className="w-full text-xs p-2 rounded-lg bg-slate-50 border border-slate-200 outline-none resize-none focus:bg-white focus:border-daw-green transition-colors disabled:opacity-60 disabled:bg-slate-100"
                                    rows={2}
                                  />
                                </div>
                                {!shouldLockUI && (
                                  <button
                                    type="button"
                                    onClick={() => removeGalleryImage(idx)}
                                    className="w-full py-1.5 text-[10px] font-bold text-red-500 hover:text-red-600 hover:bg-red-50 rounded-lg flex items-center justify-center gap-1 transition-colors">
                                    <Trash2 className="w-3 h-3" /> Hapus dari
                                    Galeri
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                  </div>
                </LockedStateTracker>
              </div>
            </div>
          </div>
        )}

        {/* RIGHT: LIVE PREVIEW PANEL */}
        {(viewLayout === "preview" || viewLayout === "split") && (
          <div
            className={`h-full overflow-y-auto custom-scrollbar bg-slate-50 ${
              viewLayout === "preview"
                ? "w-full max-w-7xl mx-auto p-8"
                : "w-1/2 p-6"
            }`}>
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden relative pb-32 min-h-full">
              <div className="sticky top-0 bg-white/80 backdrop-blur-md z-50 p-4 border-b border-slate-200 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                  <Globe className="w-4 h-4 text-daw-green" /> Live Preview
                </h3>
                <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 uppercase tracking-widest">
                  {activeCategory ? activeCategory.name : "Uncategorized"}
                </span>
              </div>

              {/* Simulation of NewsEventDetail.tsx */}
              <div className="w-full bg-white relative">
                {/* Hero Section Simulation */}
                <section className="relative h-[300px] md:h-[400px] flex items-center justify-center overflow-hidden">
                  <div
                    className="absolute inset-0 bg-cover bg-center"
                    style={{
                      backgroundImage: `url(${
                        coverPreview || formData.cover_image
                          ? coverPreview ||
                            `${BASE_UPLOAD_URL}/${formData.cover_image}`
                          : "/placeholder.jpg"
                      })`,
                    }}
                  />
                  <div className="absolute inset-0 bg-daw-green/20 mix-blend-multiply" />
                  <div className="absolute inset-0 bg-gradient-to-b from-slate-900/60 via-slate-900/40 to-slate-900/80" />

                  <div className="relative z-10 text-center px-6 max-w-3xl mt-8">
                    <h1 className="text-3xl md:text-5xl font-serif font-bold text-white leading-[1.1] tracking-tight drop-shadow-lg">
                      {formData.title || "Judul Artikel"}
                    </h1>
                  </div>
                </section>

                {/* Content Area Simulation */}
                <div className="px-6 md:px-8 py-10 max-w-[800px] mx-auto">
                  <div className="flex flex-wrap items-center gap-3 mb-8 pb-6 border-b border-slate-100">
                    <span className="px-3 py-1 bg-daw-green text-white text-[10px] font-black uppercase tracking-widest rounded-md">
                      {activeCategory ? activeCategory.name : "Kategori"}
                    </span>
                    <span className="text-slate-500 text-[11px] font-bold uppercase tracking-widest">
                      {formData.published_at
                        ? new Date(formData.published_at).toLocaleDateString(
                            "id-ID",
                            {
                              day: "numeric",
                              month: "long",
                              year: "numeric",
                            },
                          )
                        : "Hari ini"}
                    </span>
                    <span className="text-slate-500 text-[11px] font-bold uppercase tracking-widest">
                      • {currentAutoReadTime}
                    </span>
                  </div>

                  <article
                    className={`w-full text-left
                      [&>*:first-child]:mt-0
                      prose prose-slate prose-lg max-w-none
                      prose-p:leading-[1.8] prose-p:text-slate-600 prose-p:mb-5 
                      prose-headings:font-serif prose-headings:text-slate-900 
                      prose-h2:text-3xl prose-h2:mt-10 prose-h2:mb-8
                      prose-headings:tracking-tight prose-headings:font-bold
                      prose-h3:text-2xl prose-h3:mt-10
                      [&_img]:rounded-[2rem] [&_img]:my-5
                      [&_iframe]:rounded-[1.5rem] [&_iframe]:shadow-2xl [&_iframe]:my-5
                      prose-blockquote:border-l-4 prose-blockquote:border-daw-green
                      prose-blockquote:bg-slate-50 prose-blockquote:py-4 prose-blockquote:px-6
                      prose-blockquote:rounded-r-2xl prose-blockquote:text-daw-green
                      prose-blockquote:font-serif prose-blockquote:italic prose-blockquote:my-10
                      prose-li:marker:text-daw-green prose-li:my-2`}
                    dangerouslySetInnerHTML={{
                      __html: (() => {
                        const rawHtml = formData.content || "";
                        if (!rawHtml.trim()) {
                          return "<p class='text-slate-300 italic'>Konten akan muncul di sini...</p>";
                        }

                        const sanitized = rawHtml.replace(
                          /&nbsp;|\u00A0/g,
                          " ",
                        );

                        // Helper generator untuk HTML kartu putar premium
                        const getPremiumPlayCard = (videoId: string) => {
                          return `
                            <div 
                              class="relative group aspect-video rounded-[1.5rem] overflow-hidden shadow-2xl my-8 cursor-pointer bg-slate-900 border border-slate-200/60"
                              onclick="this.innerHTML = '<iframe class=\\'w-full h-full absolute inset-0 rounded-[1.5rem]\\' src=\\'https://www.youtube.com/embed/${videoId}?autoplay=1\\' frameborder=\\'0\\' allow=\\'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture\\' allowfullscreen></iframe>'"
                            >
                              <!-- Image Thumbnail -->
                              <img 
                                src="https://img.youtube.com/vi/${videoId}/maxresdefault.jpg" 
                                onerror="this.src='https://img.youtube.com/vi/${videoId}/hqdefault.jpg'"
                                class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                alt="YouTube video thumbnail"
                              />
                              <!-- Dark overlay on hover -->
                              <div class="absolute inset-0 bg-black/30 transition-colors duration-300 group-hover:bg-black/45"></div>
                              
                              <!-- Premium Glowing Play Button -->
                              <div class="absolute inset-0 flex items-center justify-center">
                                <div class="w-16 h-16 md:w-20 md:h-20 flex items-center justify-center rounded-full bg-white text-emerald-700 shadow-lg transform transition-all duration-300 group-hover:scale-110 group-hover:shadow-[0_0_35px_rgba(16,185,129,0.5)]">
                                  <svg class="w-8 h-8 md:w-10 md:h-10 fill-current translate-x-0.5" viewBox="0 0 24 24">
                                    <path d="M8 5v14l11-7z"/>
                                  </svg>
                                </div>
                              </div>
                            </div>
                          `;
                        };

                        let processedHtml = sanitized;

                        // 1. Ubah tag iframe youtube bawaan editor menjadi kartu premium
                        const iframeRegex =
                          /<iframe[^>]*src="[^"]*youtube\.com\/embed\/([^"?\s>]+)[^"]*"[^>]*><\/iframe>/g;
                        processedHtml = processedHtml.replace(
                          iframeRegex,
                          (videoId) => {
                            return getPremiumPlayCard(videoId);
                          },
                        );

                        // 2. Ubah link youtube mentah yang ditulis di dalam paragraf <p>https://www.youtube.com/... </p>
                        const pYoutubeRegex =
                          /<p>\s*https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([^"<\s?&]+)[^<]*<\/p>/g;
                        processedHtml = processedHtml.replace(
                          pYoutubeRegex,
                          (videoId) => {
                            return getPremiumPlayCard(videoId);
                          },
                        );

                        return processedHtml;
                      })(),
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <ImageAdjustmentModal
        isOpen={!!currentCropFile}
        onClose={handleCancelCrop}
        imageFile={currentCropFile}
        onSave={processCroppedFile}
        aspectRatio={currentCropType === "cover" ? 16 / 9 : 3 / 2}
        title={currentCropType === "cover" ? "Sesuaikan Sampul Artikel" : "Sesuaikan Foto Galeri"}
      />
    </div>
  );
}
