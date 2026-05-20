/* eslint-disable @typescript-eslint/ban-ts-comment */
import { useState, useRef, useMemo, useCallback, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";
import { toast } from "sonner";
import {
  ArrowLeft, Image as ImageIcon, Save, Send, X,
  Link as LinkIcon, AlertTriangle, LockIcon, Loader2,
  AlertCircle, RotateCcw,
} from "lucide-react";
import { useDropzone } from "react-dropzone";
import api, { BASE_UPLOAD_URL } from "@/lib/api";
import { compressImage } from "@/utils/imageHelper";
import { useAuth } from "@/contexts/AuthContext";

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

export default function NewsForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = !!id;
  const quillRef = useRef<ReactQuill>(null);

  const { user, can } = useAuth();
  const isSuperadmin = user?.role === "superadmin" || user?.role === "admin";

  const [categories, setCategories] = useState<NewsCategory[]>([]);
  const [isFetching, setIsFetching] = useState(isEditMode);
  const [isSaving, setIsSaving] = useState(false);

  const initialFormState = {
    title: "", excerpt: "", content: "", category_id: "",
    status: "Draft", cover_image: "", seo_title: "",
    meta_description: "", is_locked: false, lock_ticket: "",
    published_at: "", read_time: "", author: "",
  };

  const [formData, setFormData] = useState(initialFormState);
  const [originalData, setOriginalData] = useState(initialFormState);
  const [rejectedDraft, setRejectedDraft] = useState<RejectedDraft | null>(null);
  const [showDraftBanner, setShowDraftBanner] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  const isDataLocked = formData.is_locked;
  const shouldLockUI = isDataLocked && !isSuperadmin;
  const isOverrideMode = isDataLocked && isSuperadmin;
  const lockStyles = shouldLockUI ? "opacity-60 grayscale-[30%] pointer-events-none cursor-not-allowed select-none" : "";

  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);

  const generatedSlug = useMemo(() => {
    return formData.title.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");
  }, [formData.title]);

  useEffect(() => {
    if (!coverFile) { setCoverPreview(null); return; }
    const url = URL.createObjectURL(coverFile);
    setCoverPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [coverFile]);

  // Fetch categories
  useEffect(() => {
    api.get("/news-categories").then((res) => {
      if (Array.isArray(res.data)) setCategories(res.data);
    }).catch(console.error);
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
    if (!isEditMode) { setIsFetching(false); return; }

    const fetchData = async () => {
      setIsFetching(true);
      try {
        const [articleRes, draftRes] = await Promise.allSettled([
          api.get(`/news/${id}`, { signal: controller.signal }),
          api.get(`/approval/rejected/${id}?module=NewsArticle`, { signal: controller.signal }),
        ]);

        if (articleRes.status === "fulfilled") {
          const data = articleRes.value.data.data || articleRes.value.data;
          const normalized = {
            ...initialFormState,
            title: data.title || "", excerpt: data.excerpt || "",
            content: data.content || "", category_id: data.category_id || "",
            status: data.status || "Draft", cover_image: data.cover_image || "",
            seo_title: data.seo_title || "", meta_description: data.meta_description || "",
            is_locked: Boolean(data.is_locked), lock_ticket: data.lock_ticket || "",
            published_at: data.published_at ? new Date(data.published_at).toISOString().slice(0, 16) : "",
            read_time: data.read_time || "", author: data.author || "",
          };
          setFormData(normalized);
          setOriginalData(normalized);
        } else if (articleRes.reason.name !== "CanceledError") throw articleRes.reason;

        if (draftRes.status === "fulfilled" && draftRes.value.data?.hasRejected) {
          setRejectedDraft(draftRes.value.data.data);
          setShowDraftBanner(true);
        }
      } catch (error: any) {
        if (error.name !== "CanceledError") {
          toast.error("Gagal memuat data artikel");
          navigate("/admin/news");
        }
      } finally { if (!controller.signal.aborted) setIsFetching(false); }
    };

    fetchData();
    return () => { controller.abort(); };
  }, [id, isEditMode, navigate]);

  const handleDiscardDraft = async () => {
    if (!rejectedDraft?.notrans) return;
    const toastId = toast.loading("Mengabaikan notifikasi penolakan...");
    try {
      await api.patch("/approval/discard", { notrans: rejectedDraft.notrans });
      toast.success("Notifikasi revisi berhasil diabaikan.", { id: toastId });
      setRejectedDraft(null); setShowDraftBanner(false);
    } catch (error: any) {
      toast.error("Gagal mengabaikan draf", { id: toastId, description: error.response?.data?.message });
    }
  };

  const handleRestoreDraft = () => {
    if (!rejectedDraft?.payload) return toast.error("Data pemulihan tidak ditemukan.");
    if (rejectedDraft?.action === "DELETE") return toast.error("Permintaan hapus yang ditolak tidak bisa dipulihkan.");
    setIsRestoring(true);
    try {
      const payload = typeof rejectedDraft.payload === "string" ? JSON.parse(rejectedDraft.payload) : rejectedDraft.payload;
      setFormData((prev) => ({
        ...prev, title: payload.title ?? prev.title, excerpt: payload.excerpt ?? prev.excerpt,
        content: payload.content ?? prev.content, category_id: payload.category_id ?? prev.category_id,
        status: "Draft", cover_image: payload.cover_image ?? prev.cover_image,
        seo_title: payload.seo_title ?? prev.seo_title, meta_description: payload.meta_description ?? prev.meta_description,
        published_at: payload.published_at ? new Date(payload.published_at).toISOString().slice(0, 16) : prev.published_at,
        read_time: payload.read_time ?? prev.read_time,
      }));
      setCoverFile(null); setCoverPreview(null);
      toast.success("Konten draf berhasil dipulihkan!");
      setShowDraftBanner(false);
    } catch { toast.error("Gagal memproses data pemulihan."); }
    finally { setIsRestoring(false); }
  };

  // WYSIWYG Image Handler
  const imageHandler = useCallback(() => {
    if (shouldLockUI) return;
    const input = document.createElement("input");
    input.setAttribute("type", "file");
    input.setAttribute("accept", "image/*");
    input.click();
    input.onchange = async () => {
      if (input.files?.[0]) {
        const uploadData = new FormData();
        uploadData.append("inline_image", input.files[0]);
        const toastId = toast.loading("Mengunggah gambar...");
        try {
          const response = await api.post("/news/upload-inline", uploadData);
          const quill = quillRef.current?.getEditor();
          if (!quill) throw new Error("Editor not ready");
          const range = quill.getSelection(true);
          quill.insertEmbed(range ? range.index : quill.getLength(), "image", response.data.url);
          toast.success("Gambar disisipkan!", { id: toastId });
        } catch (err: any) {
          toast.error("Upload gagal", { id: toastId, description: err.response?.data?.message });
        }
      }
    };
  }, [shouldLockUI]);

  const modules = useMemo(() => ({
    toolbar: {
      container: [[{ header: [1, 2, 3, false] }], ["bold", "italic", "underline"], [{ list: "ordered" }, { list: "bullet" }], ["link", "image"], ["clean"]],
      handlers: { image: imageHandler },
    },
  }), [imageHandler]);

  const hasDataChanged = () => {
    if (!isEditMode) return true;
    if (coverFile !== null) return true;
    if (rejectedDraft !== null && !showDraftBanner) return true;
    for (const key of ["title", "excerpt", "content", "category_id", "seo_title", "meta_description", "published_at", "read_time"]) {
      // @ts-expect-error
      if (formData[key] !== originalData[key]) return true;
    }
    return false;
  };

  const handleSave = async (targetStatus: string) => {
    if (shouldLockUI) return toast.error("Data terkunci.");
    if (!formData.title.trim()) return toast.error("Judul artikel tidak boleh kosong.");
    const plainText = formData.content.replace(/<[^>]*>?/gm, "").trim();
    if (!formData.content || plainText.length === 0) return toast.error("Isi artikel wajib diisi.");
    if (targetStatus === "Published" && !coverFile && !formData.cover_image) return toast.error("Gambar sampul wajib untuk publikasi.");
    if (targetStatus === "Published" && !hasDataChanged()) return toast.info("Tidak ada perubahan terdeteksi.");

    setIsSaving(true);
    const loadingToast = toast.loading(`${isEditMode ? "Memperbarui" : "Menyimpan"} artikel...`);

    try {
      const payload = new FormData();
      if (coverFile) payload.append("cover_image", await compressImage(coverFile));
      payload.append("title", formData.title.trim());
      payload.append("excerpt", formData.excerpt.trim());
      payload.append("content", formData.content);
      payload.append("category_id", formData.category_id);
      payload.append("status", targetStatus);
      payload.append("seo_title", formData.seo_title.trim() || formData.title.trim());
      payload.append("meta_description", formData.meta_description.trim() || formData.excerpt.trim());
      payload.append("author", user?.name || "System Admin");
      if (formData.published_at) payload.append("published_at", new Date(formData.published_at).toISOString());
      if (formData.read_time) payload.append("read_time", formData.read_time);
      if (rejectedDraft?.notrans) payload.append("previous_notrans", rejectedDraft.notrans);

      const endpoint = isEditMode ? `/news/${id}` : "/news";
      const method = isEditMode ? api.put : api.post;
      const response = await method(endpoint, payload, { timeout: 60000 });

      if ([200, 201, 202].includes(response.status)) {
        setRejectedDraft(null); setShowDraftBanner(false);
        if (response.status === 202) {
          setFormData((prev) => ({ ...prev, is_locked: true, lock_ticket: response.data.ticket }));
          toast.success("Revisi Berhasil Diajukan!", { id: loadingToast });
        } else {
          toast.success(isSuperadmin ? "Berhasil Dipublikasikan!" : "Draf Tersimpan.", { id: loadingToast });
        }
        setTimeout(() => navigate("/admin/news"), 800);
      }
    } catch (err: any) {
      toast.error("Gagal menyimpan", { id: loadingToast, description: err.response?.data?.message || "Koneksi terganggu." });
    } finally { setIsSaving(false); }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    disabled: shouldLockUI,
    onDrop: (files) => { if (files[0]) setCoverFile(files[0]); },
    accept: { "image/jpeg": [], "image/png": [], "image/webp": [] },
    multiple: false,
  });

  if (isFetching) return (
    <div className="h-[60vh] flex items-center justify-center text-slate-500">
      <div className="animate-pulse flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-4 border-daw-green border-t-transparent rounded-full animate-spin" />
        Memuat data artikel...
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto animate-in fade-in duration-500 pb-24">
      {/* OVERRIDE BANNER */}
      {isOverrideMode && (
        <div className="mb-6 bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-center gap-4 shadow-sm">
          <div className="bg-amber-100 p-2 rounded-full text-amber-600 shrink-0"><AlertTriangle className="w-5 h-5" /></div>
          <div>
            <h4 className="text-xs font-black text-amber-900 uppercase tracking-tight">Mode Override Admin</h4>
            <p className="text-xs text-amber-700 mt-0.5">Data dikunci oleh <strong>{formData.lock_ticket}</strong>. Menyimpan akan membatalkan antrean.</p>
          </div>
        </div>
      )}

      {/* LOCKED BANNER */}
      {shouldLockUI && (
        <div className="mb-6 bg-blue-50 border border-blue-200 p-4 rounded-xl flex items-center gap-4 shadow-sm">
          <div className="bg-blue-100 p-2 rounded-full text-blue-600 shrink-0"><LockIcon className="w-5 h-5" /></div>
          <div>
            <h4 className="text-xs font-black text-blue-900 uppercase tracking-tight">Akses Dibatasi</h4>
            <p className="text-xs text-blue-700 mt-0.5">Revisi sedang ditinjau. Data tidak dapat diubah.</p>
          </div>
        </div>
      )}

      {/* RECOVERY BANNER */}
      {showDraftBanner && rejectedDraft && (
        <div className="mb-6 bg-red-50 border-l-4 border-l-red-500 border border-red-200 rounded-xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm animate-in slide-in-from-top-4">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-amber-100 rounded-xl text-amber-600 shrink-0"><AlertTriangle className="w-6 h-6" /></div>
            <div>
              <h4 className="text-sm font-black text-red-900 uppercase tracking-tighter mb-1">⚠️ Catatan Peninjau</h4>
              <p className="text-xs text-red-800 font-bold bg-white/60 p-2.5 rounded border border-red-200/50">"{rejectedDraft.rejection_reason || "Revisi memerlukan perbaikan."}"</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {rejectedDraft.action !== "DELETE" && (
              <button onClick={handleRestoreDraft} disabled={isRestoring} className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 disabled:bg-red-300">
                <RotateCcw className={`w-4 h-4 ${isRestoring ? "animate-spin" : ""}`} /> Pulihkan
              </button>
            )}
            <button onClick={handleDiscardDraft} className="flex items-center gap-2 bg-white border border-red-200 text-red-600 hover:bg-red-50 px-4 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95">
              <X className="w-4 h-4" /> Abaikan
            </button>
          </div>
        </div>
      )}

      {/* TOOLBAR HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/90 backdrop-blur-xl p-5 rounded-2xl border border-slate-200 shadow-sm mb-8">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate("/admin/news")} className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-500 rounded-lg transition-all border border-slate-200 shadow-sm"><ArrowLeft className="w-5 h-5" /></button>
          <div>
            <h1 className="text-lg font-bold text-slate-900">{isEditMode ? "Edit Artikel" : "Artikel Baru"}</h1>
            {formData.title && <p className="text-[11px] font-mono text-slate-400 mt-1 flex items-center gap-1"><LinkIcon className="w-3 h-3" /> /news/{generatedSlug}</p>}
          </div>
        </div>
        <div className="flex gap-3 w-full sm:w-auto">
          <button type="button" onClick={() => handleSave("Draft")} disabled={isSaving || shouldLockUI || !can("manage_news")} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl font-black text-[11px] uppercase tracking-widest shadow-sm transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">
            <Save className="w-4 h-4 text-slate-400" /> Simpan Draf
          </button>
          <button type="button" onClick={() => handleSave("Published")} disabled={isSaving || shouldLockUI || !can("manage_news")} className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-black text-[11px] uppercase tracking-widest transition-all shadow-lg active:scale-95 disabled:cursor-not-allowed min-w-[170px] ${isSaving ? "bg-slate-300 text-slate-700" : shouldLockUI ? "bg-slate-200 text-slate-500" : isOverrideMode ? "bg-amber-600 hover:bg-amber-700 text-white shadow-amber-600/20" : isSuperadmin ? "bg-daw-green hover:bg-[#003b1c] text-white shadow-daw-green/20" : "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20"}`}>
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : shouldLockUI ? <LockIcon className="w-4 h-4" /> : isOverrideMode ? <AlertCircle className="w-4 h-4" /> : isSuperadmin ? <Send className="w-4 h-4" /> : <Send className="w-4 h-4" />}
            {isSaving ? "Menyimpan..." : shouldLockUI ? "Terkunci" : isOverrideMode ? "Override & Publish" : isSuperadmin ? "Publikasikan" : "Ajukan Revisi"}
          </button>
        </div>
      </div>

      {/* FORM BODY */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* MAIN COLUMN */}
        <div className={`lg:col-span-2 space-y-6 ${lockStyles}`}>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-5">
            <div>
              <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-2">Judul Artikel *</label>
              <input type="text" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} placeholder="Tulis judul yang menarik..." className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-lg font-bold text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-daw-green/20 focus:border-daw-green" />
            </div>
            <div>
              <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-2">Ringkasan</label>
              <textarea value={formData.excerpt} onChange={(e) => setFormData({ ...formData, excerpt: e.target.value })} placeholder="Rangkuman singkat artikel untuk kartu berita..." rows={3} maxLength={500} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-daw-green/20 focus:border-daw-green resize-none" />
              <p className="text-right text-[10px] text-slate-400 mt-1">{formData.excerpt.length}/500</p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-3">Konten Artikel (WYSIWYG) *</label>
            <ReactQuill ref={quillRef} theme="snow" value={formData.content} onChange={(v) => setFormData({ ...formData, content: v })} modules={modules} className="bg-white rounded-lg [&_.ql-container]:min-h-[300px] [&_.ql-toolbar]:rounded-t-lg [&_.ql-container]:rounded-b-lg [&_.ql-editor]:text-sm [&_.ql-editor]:leading-relaxed" placeholder="Tulis konten artikel Anda di sini..." />
          </div>
        </div>

        {/* SIDEBAR */}
        <div className={`space-y-6 ${lockStyles}`}>
          {/* Cover Image */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-3">Gambar Sampul</label>
            {coverPreview || formData.cover_image ? (
              <div className="relative rounded-xl overflow-hidden aspect-video mb-3 group">
                <img src={coverPreview || `${BASE_UPLOAD_URL}/${formData.cover_image}`} alt="Cover" className="w-full h-full object-cover" />
                {!shouldLockUI && (
                  <button type="button" onClick={() => { setCoverFile(null); setFormData({ ...formData, cover_image: "" }); }} className="absolute top-2 right-2 bg-red-500 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"><X className="w-4 h-4" /></button>
                )}
              </div>
            ) : (
              <div {...getRootProps()} className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${isDragActive ? "border-daw-green bg-daw-green/5" : "border-slate-200 hover:border-daw-green/50 hover:bg-slate-50"}`}>
                <input {...getInputProps()} />
                <ImageIcon className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-sm text-slate-500 font-medium">Klik atau seret gambar</p>
                <p className="text-xs text-slate-400 mt-1">JPG, PNG, WebP (maks. 10MB)</p>
              </div>
            )}
          </div>

          {/* Category */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-3">Kategori</label>
            <select value={formData.category_id} onChange={(e) => setFormData({ ...formData, category_id: e.target.value })} className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-daw-green/20 focus:border-daw-green">
              <option value="">Pilih Kategori</option>
              {categories.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
            </select>
          </div>

          {/* Metadata */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
            <label className="block text-xs font-black text-slate-500 uppercase tracking-wider">Metadata</label>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Tanggal Terbit</label>
              <input type="datetime-local" value={formData.published_at} onChange={(e) => setFormData({ ...formData, published_at: e.target.value })} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-daw-green/20" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Estimasi Waktu Baca</label>
              <input type="text" value={formData.read_time} onChange={(e) => setFormData({ ...formData, read_time: e.target.value })} placeholder="e.g. 5 min read" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-daw-green/20" />
            </div>
          </div>

          {/* SEO */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
            <label className="block text-xs font-black text-slate-500 uppercase tracking-wider">SEO</label>
            <input type="text" value={formData.seo_title} onChange={(e) => setFormData({ ...formData, seo_title: e.target.value })} placeholder="SEO Title" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-daw-green/20" />
            <textarea value={formData.meta_description} onChange={(e) => setFormData({ ...formData, meta_description: e.target.value })} placeholder="Meta Description" rows={3} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-daw-green/20 resize-none" />
          </div>
        </div>
      </div>
    </div>
  );
}
