import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  Save,
  X,
  Sparkles,
  Globe,
  FileText,
  RefreshCw,
  UploadCloud,
  LayoutTemplate,
  Link as LinkIcon,
  ImagePlus,
  PenTool,
  Search,
  Lock,
  RotateCcw,
  AlertTriangle,
} from "lucide-react";
// Tambahkan BASE_UPLOAD_URL
import api, { BASE_UPLOAD_URL } from "@/lib/api";
import imageCompression from "browser-image-compression";
import { useContent } from "@/contexts/ContentContext";
interface Page {
  id: string;
  title: string;
  slug: string;
  subtitle?: string | null;
  heroImage?: string | null;
  templateType: "classic" | "modern" | "split";
  content: string;
  showDropCap: boolean;
  sidebarLinks?: { label: string; url: string }[];
  is_locked?: boolean;
  lock_ticket?: string | null;
}

interface RejectedDraft {
  id: string;
  notrans: string;
  payload: Partial<Page>;
  rejection_reason: string;
}

export default function PageBuilder() {
  const { pages, isLoading, refreshData } = useContent();

  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isPreviewMode, setIsPreviewMode] = useState(false);

  // Approval System State
  const [activeItemLocked, setActiveItemLocked] = useState<boolean>(false);
  const [activeLockTicket, setActiveLockTicket] = useState<string | null>(null);
  const [rejectedDraft, setRejectedDraft] = useState<RejectedDraft | null>(
    null,
  );

  const [formData, setFormData] = useState({
    title: "",
    slug: "",
    subtitle: "",
    templateType: "classic",
    content: "",
    showDropCap: true,
    sidebarLinks: [] as { label: string; url: string }[],
    metaDescription: "",
    status: "Published",
  });

  const [heroFile, setHeroFile] = useState<File | null>(null);
  const [heroImage, setHeroImage] = useState<string>("");
  const quillRef = useRef<ReactQuill>(null);

  const imageHandler = useCallback(() => {
    const input = document.createElement("input");
    input.setAttribute("type", "file");
    input.setAttribute("accept", "image/*");
    input.click();

    input.onchange = async () => {
      const file = input.files?.[0];
      if (file && quillRef.current) {
        const toastId = toast.loading("Optimizing & Uploading to server...");

        try {
          const compressionOptions = {
            maxSizeMB: 0.8,
            maxWidthOrHeight: 1600,
            useWebWorker: true,
          };
          const compressedFile = await imageCompression(
            file,
            compressionOptions,
          );
          const uploadPayload = new FormData();
          uploadPayload.append("inline_image", compressedFile);

          const response = await api.post(
            "/pages/upload-inline",
            uploadPayload,
          );
          const editor = quillRef.current.getEditor();
          const range = editor.getSelection();
          const cursorIndex = range ? range.index : editor.getLength();

          if (response.data.url) {
            editor.insertEmbed(cursorIndex, "image", response.data.url);
            editor.setSelection(cursorIndex + 1);
            toast.success("Image added to document!", { id: toastId });
          } else {
            throw new Error("Invalid response from server.");
          }
        } catch (error: any) {
          const errorMsg =
            error.response?.data?.message || "Internal Upload Error";
          toast.error(`Failed to process asset: ${errorMsg}`, { id: toastId });
          console.error("Rich Text Upload Error:", error);
        }
      }
    };
  }, []);

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

  useEffect(() => {
    resetForm();
  }, []);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setFormData((prev) => {
      if (!editingId) {
        const autoSlug = newTitle
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)+/g, "");
        return { ...prev, title: newTitle, slug: autoSlug };
      } else {
        return { ...prev, title: newTitle };
      }
    });
  };

  const syncSlugWithTitle = () => {
    if (!formData.title) return toast.error("Judul masih kosong!");
    const newSlug = formData.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "");
    setFormData({ ...formData, slug: newSlug });
    toast.success("Slug synchronized / Slug berhasil disinkronkan!");
  };

  const resetForm = () => {
    setEditingId(null);
    setHeroImage("");
    setHeroFile(null);
    setActiveItemLocked(false);
    setActiveLockTicket(null);
    setRejectedDraft(null);
    setFormData({
      title: "",
      slug: "",
      subtitle: "",
      templateType: "classic",
      content: "",
      showDropCap: true,
      sidebarLinks: [],
      metaDescription: "",
      status: "Published",
    });
  };

  // Resilient Parallel Fetching & AbortController
  const handleEdit = async (pageOption: any) => {
    const toastId = toast.loading(`Membuka "${pageOption.title}"...`);
    const controller = new AbortController();
    try {
      // Parallel fetch: Data Live vs Draft Ditolak
      const [liveRes, rejectedRes] = await Promise.allSettled([
        api.get(`/pages/slug/${pageOption.slug}`, {
          signal: controller.signal,
        }),
        api.get(`/approval/rejected/${pageOption.id}?module=Page`, {
          signal: controller.signal,
        }),
      ]);

      if (liveRes.status === "rejected")
        throw new Error("Gagal mengambil data live.");

      const exactData = Array.isArray(liveRes.value.data)
        ? liveRes.value.data[0]
        : liveRes.value.data;

      setEditingId(exactData.id);
      setActiveItemLocked(exactData.is_locked || false);
      setActiveLockTicket(exactData.lock_ticket || null);

      // Load Draf Ditolak jika ada
      if (
        rejectedRes.status === "fulfilled" &&
        rejectedRes.value.data?.hasRejected
      ) {
        setRejectedDraft(rejectedRes.value.data.data);
      } else {
        setRejectedDraft(null);
      }

      setHeroImage(exactData.heroImage || "");
      setFormData({
        title: exactData.title || "",
        slug: exactData.slug || "",
        subtitle: exactData.subtitle || "",
        templateType: exactData.templateType || "classic",
        content: exactData.content || "",
        showDropCap: exactData.showDropCap ?? true,
        metaDescription: exactData.metaDescription || "",
        status: "Published",
        sidebarLinks:
          typeof exactData.sidebarLinks === "string"
            ? JSON.parse(exactData.sidebarLinks)
            : exactData.sidebarLinks || [],
      });

      toast.dismiss(toastId);
    } catch {
      toast.error("Gagal memuat detail halaman", { id: toastId });
    }
  };

  const handleRestoreDraft = () => {
    if (!rejectedDraft || !rejectedDraft.payload) return;
    const p = rejectedDraft.payload as any;

    setFormData((prev) => ({
      ...prev,
      title: p.title ?? prev.title,
      slug: p.slug ?? prev.slug,
      subtitle: p.subtitle ?? prev.subtitle,
      templateType: p.templateType ?? prev.templateType,
      content: p.content ?? prev.content,
      showDropCap: p.showDropCap ?? prev.showDropCap,
      metaDescription: p.metaDescription ?? prev.metaDescription,
      sidebarLinks:
        typeof p.sidebarLinks === "string"
          ? JSON.parse(p.sidebarLinks)
          : p.sidebarLinks || prev.sidebarLinks,
    }));

    setHeroImage(p.heroImage || "");
    setHeroFile(null);

    toast.success(
      "Draf berhasil direstorasi. Silakan perbaiki dan submit ulang.",
    );
  };

  const handleDelete = (id: string, title: string, isLocked: boolean) => {
    if (isLocked)
      return toast.error("Halaman ini sedang dikunci oleh proses approval.");

    toast(`Hapus "${title}"?`, {
      description: "Aksi ini tidak dapat dibatalkan.",
      action: {
        label: "Hapus",
        onClick: async () => {
          const toastId = toast.loading("Memproses penghapusan...");
          try {
            const res = await api.delete(`/pages/${id}`);
            if (res.status === 202) {
              toast.success("Permintaan hapus dikirim ke admin.", {
                id: toastId,
              });
            } else {
              toast.success("Halaman terhapus", { id: toastId });
            }
            refreshData();
            if (editingId === id) resetForm();
          } catch (error: any) {
            toast.error(error.response?.data?.message || "Gagal menghapus", {
              id: toastId,
            });
          }
        },
      },
      cancel: { label: "Batal", onClick: () => {} },
    });
  };

  const handleSubmit = async (
    e: React.FormEvent,
    submitStatus: "Draft" | "Published" = "Published",
  ) => {
    e.preventDefault();
    if (!formData.title || !formData.slug)
      return toast.error("Judul & Slug wajib diisi!");

    setIsSaving(true);
    const toastId = toast.loading(
      submitStatus === "Published"
        ? "Mengirim pengajuan..."
        : "Menyimpan draf lokal...",
    );

    try {
      const payload = new FormData();
      payload.append("title", formData.title);
      payload.append("slug", formData.slug);
      payload.append("subtitle", formData.subtitle || "");
      payload.append("templateType", formData.templateType);
      payload.append("content", formData.content);
      payload.append("metaDescription", formData.metaDescription || "");
      payload.append("showDropCap", String(formData.showDropCap));
      payload.append("sidebarLinks", JSON.stringify(formData.sidebarLinks));
      payload.append("status", submitStatus);

      if (rejectedDraft)
        payload.append("previous_notrans", rejectedDraft.notrans);
      if (heroFile) payload.append("heroImage", heroFile);

      const config = { timeout: 60000 };
      let res;

      if (editingId) {
        res = await api.put(`/pages/${editingId}`, payload, config);
        toast.success(res.data.message || "Berhasil!", { id: toastId });
      } else {
        res = await api.post("/pages", payload, config);
        toast.success(res.data.message || "Berhasil diterbitkan!", {
          id: toastId,
        });
      }

      if (submitStatus === "Published" && res.status === 202) {
        setActiveItemLocked(true);
        setActiveLockTicket(res.data.ticket);
      }

      if (submitStatus === "Published") setRejectedDraft(null);

      refreshData();
      if (!editingId && submitStatus === "Published") resetForm();
    } catch (error: any) {
      toast.error(
        error.response?.data?.message || "Gagal menyimpan ke server.",
        { id: toastId },
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleImageUpload = async (file: File) => {
    if (activeItemLocked)
      return toast.error("Halaman terkunci. Tidak dapat mengubah gambar.");

    if (!file) return;
    if (!file.type.startsWith("image/"))
      return toast.error("Gunakan file gambar saja.");
    if (file.size > 5 * 1024 * 1024)
      return toast.error("Maksimal ukuran file 5MB.");

    const toastId = toast.loading("Mengompresi asset...");
    try {
      const compressedFile = await imageCompression(file, {
        maxSizeMB: 0.8,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
        initialQuality: 0.7,
      });
      setHeroFile(compressedFile);
      const reader = new FileReader();
      reader.onloadend = () => {
        setHeroImage(reader.result as string);
        toast.success("Asset dioptimasi!", { id: toastId });
      };
      reader.readAsDataURL(compressedFile);
    } catch {
      toast.error("Kompresi gagal.", { id: toastId });
    }
  };

  const getDynamicSeoDescription = () => {
    if (formData.metaDescription && formData.metaDescription.trim() !== "") {
      return formData.metaDescription;
    }

    if (formData.subtitle && formData.subtitle.trim() !== "") {
      return formData.subtitle;
    }

    const plainText = formData.content.replace(/<[^>]*>?/gm, "").trim();
    return plainText.slice(0, 150) + (plainText.length > 150 ? "..." : "");
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-in fade-in duration-500 pb-20">
      {/*  LEFT: DOCUMENT REPOSITORY (Sidebar) */}
      {!isPreviewMode && (
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-slate-50 border border-slate-200 rounded-[2rem] p-6 sticky top-24 shadow-sm">
            <div className="flex justify-between items-end mb-6">
              <div>
                <h3 className="text-xl font-serif font-black text-slate-900 tracking-tight">
                  Daftar Halaman
                </h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                  Halaman Terpublikasi
                </p>
              </div>
              {!editingId && (
                <button
                  onClick={resetForm}
                  className="text-xs font-bold text-daw-green bg-daw-green/10 px-3 py-2 rounded-xl hover:bg-daw-green hover:text-white transition-all flex items-center gap-1 shadow-sm">
                  <Plus className="w-4 h-4" /> Buat Halaman Baru
                </button>
              )}
            </div>

            {isLoading ? (
              <div className="py-12 text-center animate-pulse">
                <div className="w-8 h-8 border-4 border-slate-200 border-t-daw-green rounded-full animate-spin mx-auto mb-3" />
                <p className="text-[10px] text-slate-400 font-bold tracking-widest uppercase">
                  Fetching data...
                </p>
              </div>
            ) : pages.length === 0 ? (
              <div className="text-center py-16 px-6 bg-white border border-dashed border-slate-300 rounded-[1.5rem]">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-8 h-8 text-slate-300" />
                </div>
                <h4 className="text-sm font-bold text-slate-900 mb-1">
                  No Documents Found
                </h4>
                <p className="text-xs text-slate-400 font-medium mb-6">
                  Mulai susun konten pertama Anda untuk mengisi daftar ini.{" "}
                  <br />
                  <span className="italic text-[10px]">
                    Buat artikel pertama Anda untuk mengisi repositori ini.
                  </span>
                </p>
                <button
                  onClick={resetForm}
                  className="text-xs font-bold text-white bg-daw-green px-5 py-2.5 rounded-xl hover:bg-[#003b1c] shadow-lg shadow-daw-green/20 transition-all">
                  Buat Halaman
                </button>
              </div>
            ) : (
              <div className="space-y-3 max-h-[65vh] overflow-y-auto custom-scrollbar pr-2">
                {pages.map((p) => {
                  const isLocked = p.is_locked;

                  return (
                    <div
                      key={p.id}
                      className={`p-4 rounded-2xl border transition-all group cursor-pointer hover:shadow-md
                      ${
                        editingId === p.id
                          ? "border-daw-green ring-4 ring-daw-green/10 shadow-sm bg-white"
                          : isLocked
                            ? "border-blue-200 bg-blue-50/40 hover:border-blue-300" // Visual Lockdown Background
                            : "border-slate-200 bg-white hover:border-daw-green/50"
                      }`}
                      onClick={() => handleEdit(p)}>
                      <div className="flex justify-between items-start">
                        <div className="min-w-0 pr-2">
                          <div className="flex items-center gap-2">
                            <h4
                              className={`font-bold text-sm truncate transition-colors ${
                                editingId === p.id
                                  ? "text-daw-green"
                                  : isLocked
                                    ? "text-blue-700" // Teks kebiruan untuk PENDING
                                    : "text-slate-900"
                              }`}>
                              {p.title}
                            </h4>

                            {/* Double-Badge System (PENDING) */}
                            {isLocked && (
                              <span className="flex items-center gap-1 px-1.5 py-0.5 rounded md bg-blue-100 text-blue-600 text-[8px] font-black uppercase tracking-widest shadow-sm">
                                <Lock className="w-2.5 h-2.5" /> Pending
                              </span>
                            )}
                          </div>

                          <p
                            className={`text-[10px] font-mono mt-1.5 flex items-center gap-1 truncate transition-colors ${
                              isLocked ? "text-blue-400" : "text-slate-400"
                            }`}>
                            <Globe className="w-3 h-3" /> /page/{p.slug}
                          </p>
                        </div>

                        <div
                          className={`flex gap-1 transition-opacity ${
                            isLocked
                              ? "opacity-100"
                              : "opacity-0 group-hover:opacity-100"
                          }`}>
                          {/* Disable tombol Delete jika terkunci */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(p.id, p.title, !!isLocked);
                            }}
                            disabled={isLocked}
                            className={`p-2 rounded-lg transition-all ${
                              isLocked
                                ? "text-slate-300 cursor-not-allowed bg-slate-50 opacity-50"
                                : "bg-slate-50 text-slate-400 hover:text-red-500 hover:bg-red-50"
                            }`}
                            title={
                              isLocked
                                ? "Data sedang terkunci oleh proses approval"
                                : "Hapus Halaman"
                            }>
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/*  RIGHT: EDITORIAL WORKSPACE (Main Form) */}
      <div
        className={`${isPreviewMode ? "lg:col-span-12 transition-all duration-500" : "lg:col-span-8 transition-all duration-500"}`}>
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl shadow-slate-200/50 overflow-hidden">
          {/* Header Workspace */}
          <div className="flex justify-between items-center p-8 border-b border-slate-100 bg-slate-50/50">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-daw-green/10 rounded-2xl flex items-center justify-center text-daw-green">
                {editingId ? (
                  <PenTool className="w-6 h-6" />
                ) : (
                  <Sparkles className="w-6 h-6" />
                )}
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                  {editingId ? "Edit Document" : "Create Document"}
                </h2>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">
                  {editingId
                    ? "Perbarui isi konten yang sudah ada"
                    : "Mulai menyusun publikasi baru"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsPreviewMode(!isPreviewMode)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-sm border ${
                  isPreviewMode
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-600 border-slate-200 hover:border-daw-green"
                }`}>
                {isPreviewMode ? (
                  <PenTool className="w-4 h-4" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                {isPreviewMode ? "Back to Editor" : "Live Preview"}
              </button>
              {!activeItemLocked && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-500 hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition-all flex items-center gap-2 shadow-sm"
                  title="Bersihkan Form">
                  <X className="w-4 h-4" />{" "}
                  {editingId ? "Batal Edit" : "Bersihkan Form"}
                </button>
              )}
            </div>
          </div>

          {/* The Command Center (Banners) */}
          {(activeItemLocked || rejectedDraft) && (
            <div className="px-8 pt-6 pb-0 space-y-4">
              {/* LOCK ALERT BANNER */}
              {activeItemLocked && (
                <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-2xl animate-in fade-in shadow-sm">
                  <div className="p-2 bg-blue-100 text-blue-600 rounded-xl shrink-0">
                    <Lock className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-blue-900">
                      Mode Baca (Read-Only)
                    </h4>
                    <p className="text-xs text-blue-700 mt-1 leading-relaxed">
                      Halaman ini sedang dikunci karena dalam proses peninjauan
                      Admin (Tiket:{" "}
                      <strong className="tracking-wider">
                        {activeLockTicket}
                      </strong>
                      ). Anda tidak dapat mengubah data sampai proses selesai.
                    </p>
                  </div>
                </div>
              )}

              {/* REJECTION BANNER & RESTORE ENGINE */}
              {rejectedDraft && !activeItemLocked && (
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 bg-amber-50 border border-amber-200 rounded-2xl animate-in slide-in-from-top-2 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-amber-100 text-amber-600 rounded-xl shrink-0">
                      <AlertTriangle className="w-5 h-5 animate-pulse" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-amber-900">
                        Revisi Diperlukan
                      </h4>
                      <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                        <span className="font-bold">Catatan Admin:</span> "
                        {rejectedDraft.rejection_reason}"
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleRestoreDraft}
                    className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl shadow-lg shadow-amber-500/20 transition-all shrink-0 transform hover:-translate-y-0.5">
                    <RotateCcw className="w-4 h-4" /> Pulihkan Draf
                  </button>
                </div>
              )}
            </div>
          )}

          {/* DYNAMIC WORKSPACE CONTENT */}
          <div
            className={`p-8 ${isPreviewMode ? "grid grid-cols-1 lg:grid-cols-2 gap-8 items-start" : "space-y-10"}`}>
            {/* SECTION 1: CORE IDENTITY */}
            <div className="space-y-10">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                <LayoutTemplate className="w-4 h-4 text-slate-400" />
                <h3 className="text-sm font-bold text-slate-900">
                  Informasi Utama Halaman
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                    Judul Utama *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={handleTitleChange}
                    readOnly={activeItemLocked}
                    className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-daw-green focus:ring-4 focus:ring-daw-green/10 outline-none font-bold text-slate-800 transition-all"
                    placeholder="e.g. Corporate Sustainability Report"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                    Tautan Alamat (URL)
                  </label>
                  <div className="flex items-center w-full rounded-2xl bg-slate-50 border border-slate-200 focus-within:bg-white focus-within:border-daw-green focus-within:ring-4 focus-within:ring-daw-green/10 overflow-hidden transition-all">
                    <div className="pl-5 pr-2 py-4 text-slate-400 flex items-center gap-2 border-r border-slate-200/50">
                      <Globe className="w-4 h-4" />{" "}
                      <span className="text-sm font-mono">/page/</span>
                    </div>
                    <input
                      type="text"
                      required
                      value={formData.slug}
                      readOnly={activeItemLocked}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          slug: e.target.value
                            .toLowerCase()
                            .replace(/[^a-z0-9-]+/g, ""),
                        }))
                      }
                      className="w-full p-4 bg-transparent outline-none font-mono text-sm text-slate-600"
                      placeholder="corporate-report"
                    />
                    {editingId && !activeItemLocked && (
                      <button
                        type="button"
                        onClick={syncSlugWithTitle}
                        title="Sync Slug dengan Judul"
                        className="pr-5 pl-3 text-slate-400 hover:text-daw-green transition-colors border-l border-slate-200/50">
                        <RefreshCw className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                    Subjudul Pendukung (Header)
                  </label>
                  <input
                    type="text"
                    value={formData.subtitle}
                    readOnly={activeItemLocked}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        subtitle: e.target.value,
                      }))
                    }
                    className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-daw-green focus:ring-4 focus:ring-daw-green/10 outline-none text-slate-600 transition-all"
                    placeholder="Brief overview or engaging hook for the article..."
                  />
                </div>
              </div>
            </div>

            {isPreviewMode && (
              <div className="sticky top-24 h-[80vh] overflow-y-auto rounded-[2rem] border-4 border-slate-900 bg-white shadow-2xl custom-scrollbar">
                <div className="bg-slate-900 p-3 flex justify-center gap-1.5 border-b border-slate-800">
                  <div className="w-2 h-2 rounded-full bg-red-500" />
                  <div className="w-2 h-2 rounded-full bg-amber-500" />
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                </div>

                <div className="p-8 md:p-10">
                  {(formData.subtitle || !editingId) && (
                    <p className="text-daw-green font-bold tracking-[0.3em] uppercase text-[10px] mb-5 drop-shadow-sm">
                      {formData.subtitle || "ENTER SUBTITLE HERE"}
                    </p>
                  )}
                  <h1 className="text-3xl md:text-4xl font-serif font-bold text-slate-900 mb-8 leading-[1.15] tracking-tight">
                    {formData.title || "Untitled Document"}
                  </h1>

                  <hr className="mb-8 border-slate-200" />

                  {/*  Bagian Content: Sinkronisasi 100% dengan DynamicPage.tsx */}
                  <article
                    className={`w-full text-left break-words [&>*:first-child]:mt-0
                        /* Core Prose */
                        prose prose-slate max-w-none
                        prose-p:leading-[1.8] prose-p:text-slate-600 prose-p:mb-8 prose-p:text-[1.05rem]
                        
                        /* Headings */
                        prose-headings:font-serif prose-headings:text-slate-900 prose-headings:tracking-tight prose-headings:font-bold
                        prose-h2:text-2xl prose-h2:mt-12 prose-h2:mb-6 
                        prose-h3:text-xl prose-h3:mt-8
                        
                        /* Media Styling (Images & iFrames) */
                        [&_img]:rounded-[1.5rem] [&_img]:my-10 [&_img]:shadow-sm
                        [&_iframe]:rounded-[1rem] [&_iframe]:shadow-lg [&_iframe]:my-8
                        
                        /* Lists */
                        prose-li:marker:text-daw-green prose-li:my-1.5
                        
                        /* Conditional Drop Cap (Disesuaikan proporsinya untuk layar split) */
                        ${
                          formData.showDropCap
                            ? `prose-p:first-of-type:first-letter:text-[4.5rem] 
                              prose-p:first-of-type:first-letter:font-serif 
                              prose-p:first-of-type:first-letter:font-black 
                              prose-p:first-of-type:first-letter:text-daw-green 
                              prose-p:first-of-type:first-letter:mr-4 
                              prose-p:first-of-type:first-letter:float-left 
                              prose-p:first-of-type:first-letter:leading-[0.8] 
                              prose-p:first-of-type:first-letter:mt-2 
                              prose-p:first-of-type:first-letter:drop-shadow-sm`
                            : ""
                        }`}
                    dangerouslySetInnerHTML={{
                      __html:
                        formData.content ||
                        "<p class='text-slate-400 italic font-sans'>Start drafting your content to see the preview here...</p>",
                    }}
                  />
                </div>
              </div>
            )}

            {/* SECTION 1.5: SEARCH ENGINE OPTIMIZATION (SEO) */}
            <div className="space-y-6 bg-slate-50/50 p-6 rounded-[2rem] border border-slate-200 shadow-inner">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                <Search className="w-4 h-4 text-blue-500" />
                <h3 className="text-sm font-bold text-slate-900">
                  Search Engine Optimization (SEO)
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* A. SEO Input Field */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center px-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Custom Meta Description
                      </label>
                      <span
                        className={`text-[9px] font-bold ${formData.metaDescription?.length > 160 ? "text-red-500" : "text-slate-400"}`}>
                        {formData.metaDescription?.length || 0}/160
                      </span>
                    </div>
                    <textarea
                      placeholder={
                        formData.subtitle ||
                        "Tulis deskripsi SEO manual di sini..."
                      }
                      readOnly={activeItemLocked}
                      className={`w-full p-4 rounded-2xl bg-white border outline-none text-sm text-slate-600 h-28 resize-none transition-all focus:ring-4 focus:ring-blue-500/5 ${
                        activeItemLocked ? "opacity-60 cursor-not-allowed" : ""
                      } ${
                        formData.metaDescription?.length > 160
                          ? "border-red-300 focus:border-red-500"
                          : "border-slate-200 focus:border-blue-400"
                      }`}
                      value={formData.metaDescription}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          metaDescription: e.target.value,
                        })
                      }
                    />
                    <p className="text-[9px] text-slate-400 italic ml-1 leading-relaxed">
                      *Jika dikosongkan, sistem akan otomatis menggunakan{" "}
                      <strong>Subtitle</strong> atau ringkasan{" "}
                      <strong>Konten</strong> sebagai fallback.
                    </p>
                  </div>
                </div>

                {/* B. Visual Google Preview Card */}
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-center relative overflow-hidden group">
                  {/* Dekorasi Card */}
                  <div className="absolute top-0 left-0 w-1 h-full bg-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />

                  <p className="text-[10px] font-black text-slate-300 uppercase mb-3 flex items-center gap-2">
                    <Globe className="w-3 h-3" /> Pratinjau Tampilan Google
                  </p>

                  {/* Google Search Result Simulation */}
                  <div className="space-y-1">
                    <p className="text-[#1a0dab] text-xl font-medium truncate hover:underline cursor-pointer">
                      {formData.title || "Untitled Document"}
                    </p>
                    <p className="text-[#006621] text-sm truncate mb-1 flex items-center gap-1 font-mono">
                      daw.co.id{" "}
                      <span className="text-slate-400 text-xs">› page ›</span>{" "}
                      {formData.slug || "..."}
                    </p>
                    <p className="text-[#545454] text-sm line-clamp-2 leading-relaxed break-words">
                      {getDynamicSeoDescription() ||
                        "Mulai menulis subtitle atau konten untuk melihat deskripsi otomatis di sini."}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 2: VISUAL ASSET */}
            <div className="space-y-6">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                <ImagePlus className="w-4 h-4 text-slate-400" />
                <h3 className="text-sm font-bold text-slate-900">
                  Gambar Latar Utama
                </h3>
              </div>

              <div className="mt-2">
                {heroImage ? (
                  <div className="relative w-full h-[300px] rounded-3xl overflow-hidden group border border-slate-200 shadow-sm">
                    <img
                      src={
                        heroImage.startsWith("data:")
                          ? heroImage
                          : `${BASE_UPLOAD_URL}/${heroImage}`
                      }
                      alt="Hero Preview"
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                    {!activeItemLocked && (
                      <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                        <button
                          type="button"
                          onClick={() => setHeroImage("")}
                          className="bg-red-500 text-white px-6 py-3 rounded-2xl flex items-center gap-2 font-bold shadow-lg transform hover:scale-105 transition-all">
                          <Trash2 className="w-5 h-5" /> Remove Asset
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (!activeItemLocked) setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragging(false);
                      if (!activeItemLocked && e.dataTransfer.files?.[0])
                        handleImageUpload(e.dataTransfer.files[0]);
                    }}
                    className={`relative border-2 border-dashed rounded-3xl p-14 flex flex-col items-center justify-center transition-all duration-300 group 
                      ${
                        activeItemLocked
                          ? "border-slate-200 bg-slate-100 opacity-60 cursor-not-allowed"
                          : isDragging
                            ? "border-daw-green bg-daw-green/5 scale-[0.99] ring-4 ring-daw-green/10"
                            : "border-slate-300 bg-slate-50 hover:border-daw-green hover:bg-slate-50/80"
                      }`}>
                    <input
                      type="file"
                      accept="image/*"
                      disabled={activeItemLocked}
                      onChange={(e) =>
                        e.target.files && handleImageUpload(e.target.files[0])
                      }
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 disabled:cursor-not-allowed"
                    />
                    <div
                      className={`p-5 rounded-2xl mb-4 transition-all duration-500 ${isDragging ? "bg-daw-green text-white scale-110 rotate-6" : "bg-white text-slate-400 shadow-sm group-hover:text-daw-green"}`}>
                      {activeItemLocked ? (
                        <Lock className="w-10 h-10 text-slate-300" />
                      ) : (
                        <UploadCloud
                          className={`w-10 h-10 ${isDragging ? "animate-bounce" : ""}`}
                        />
                      )}
                    </div>
                    <div className="text-center space-y-2">
                      <p className="text-base font-bold text-slate-700">
                        {activeItemLocked
                          ? "Unggah Terkunci"
                          : isDragging
                            ? "Drop asset here"
                            : "Drag & Drop cover image"}
                      </p>
                      {!activeItemLocked && (
                        <p className="text-[11px] text-slate-500 font-medium">
                          or browse from local workstation / atau pilih dari
                          folder lokal
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
            {/* 🌟 SECTION 3: WIDGET MANAGER */}
            <div className="space-y-6">
              <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2">
                  <LinkIcon className="w-4 h-4 text-slate-400" />
                  <h3 className="text-sm font-bold text-slate-900">
                    Tautan Terkait
                  </h3>
                </div>
                <button
                  type="button"
                  disabled={activeItemLocked}
                  onClick={() =>
                    setFormData((prev) => ({
                      ...prev,
                      sidebarLinks: [
                        ...prev.sidebarLinks,
                        { label: "", url: "" },
                      ],
                    }))
                  }
                  className="text-[10px] font-black uppercase tracking-widest text-daw-green bg-daw-green/10 px-3 py-1.5 rounded-lg hover:bg-daw-green hover:text-white transition-all flex items-center gap-1">
                  <Plus className="w-3 h-3" /> Insert Link
                </button>
              </div>

              <div className="space-y-3 bg-slate-50 p-6 rounded-3xl border border-slate-100">
                {formData.sidebarLinks.length === 0 ? (
                  <p className="text-xs text-slate-400 italic text-center py-6">
                    Belum ada tautan tambahan. Gunakan bagian ini jika Anda
                    ingin menampilkan referensi halaman lain di sisi samping
                    artikel.
                    <br />
                  </p>
                ) : (
                  formData.sidebarLinks.map((link, index) => (
                    <div
                      key={index}
                      className="flex gap-4 items-start bg-white p-4 rounded-2xl border border-slate-200 shadow-sm animate-in fade-in">
                      <div className="flex-1 space-y-3">
                        <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">
                            Destination Page / Halaman Tujuan
                          </label>
                          <select
                            value={link.url}
                            disabled={activeItemLocked}
                            onChange={(e) => {
                              const newLinks = [...formData.sidebarLinks];
                              const selectedUrl = e.target.value;
                              newLinks[index].url = selectedUrl;
                              if (!newLinks[index].label && selectedUrl) {
                                const staticPages = [
                                  { url: "/", label: "Homepage" },
                                  { url: "/about", label: "About Us" },
                                  {
                                    url: "/businesses",
                                    label: "Our Businesses",
                                  },
                                ];
                                const matchedStatic = staticPages.find(
                                  (sp) => sp.url === selectedUrl,
                                );
                                if (matchedStatic)
                                  newLinks[index].label = matchedStatic.label;
                                else {
                                  const matchedPage = pages.find(
                                    (p) => `/page/${p.slug}` === selectedUrl,
                                  );
                                  if (matchedPage)
                                    newLinks[index].label = matchedPage.title;
                                }
                              }
                              setFormData((prev) => ({
                                ...prev,
                                sidebarLinks: newLinks,
                              }));
                            }}
                            className="w-full text-sm p-3 bg-slate-50 outline-none font-bold text-daw-green border border-slate-200 rounded-xl focus:border-daw-green focus:ring-2 focus:ring-daw-green/10 cursor-pointer">
                            <option value="">-- Assign Destination --</option>
                            <optgroup label="Main Pages">
                              <option value="/">Homepage</option>{" "}
                              <option value="/about">About Us</option>{" "}
                              <option value="/businesses">
                                Our Businesses
                              </option>
                            </optgroup>
                            <optgroup label="Editorial Articles">
                              {pages
                                .filter((p) => p.id !== editingId)
                                .map((p) => (
                                  <option key={p.id} value={`/page/${p.slug}`}>
                                    {p.title}
                                  </option>
                                ))}
                            </optgroup>
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">
                            Display Text / Label Teks
                          </label>
                          <input
                            type="text"
                            placeholder="Auto-filled if empty..."
                            value={link.label}
                            readOnly={activeItemLocked}
                            onChange={(e) => {
                              const newLinks = [...formData.sidebarLinks];
                              newLinks[index].label = e.target.value;
                              setFormData((prev) => ({
                                ...prev,
                                sidebarLinks: newLinks,
                              }));
                            }}
                            className="w-full text-sm p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-daw-green focus:bg-white text-slate-700 font-medium transition-colors"
                          />
                        </div>
                      </div>
                      {!activeItemLocked && ( // 🛡️ BLUEPRINT: Sembunyikan tombol hapus link
                        <button
                          type="button"
                          onClick={() => {
                            const newLinks = formData.sidebarLinks.filter(
                              (_, i) => i !== index,
                            );
                            setFormData((prev) => ({
                              ...prev,
                              sidebarLinks: newLinks,
                            }));
                          }}
                          className="p-3 bg-slate-50 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors mt-6 border border-slate-200 hover:border-red-200"
                          title="Remove Link">
                          <Trash2 className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="flex items-center gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm mt-4">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${formData.showDropCap ? "bg-daw-green/10 text-daw-green" : "bg-slate-100 text-slate-400"}`}>
                <span className="text-xl font-serif font-black">A</span>
              </div>
              <div className="flex-1">
                <p className="text-xs font-bold text-slate-700">
                  Drop Cap Typography
                </p>
                <p className="text-[10px] text-slate-500 uppercase font-medium">
                  Huruf besar di awal paragraf
                </p>
              </div>
              <button
                type="button"
                disabled={activeItemLocked}
                onClick={() =>
                  setFormData((prev) => ({
                    ...prev,
                    showDropCap: !prev.showDropCap,
                  }))
                }
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${formData.showDropCap ? "bg-daw-green" : "bg-slate-300"}`}>
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formData.showDropCap ? "translate-x-6" : "translate-x-1"}`}
                />
              </button>
            </div>
            {/* 🌟 SECTION 4: TEXT EDITOR */}
            <div className="space-y-6">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                <FileText className="w-4 h-4 text-slate-400" />
                <h3 className="text-sm font-bold text-slate-900">
                  Area Penulisan Konten
                </h3>
              </div>

              <div
                className={`rounded-[1.5rem] border overflow-hidden bg-white shadow-sm transition-all
                ${activeItemLocked ? "border-slate-200 opacity-70 pointer-events-none" : "border-slate-200 focus-within:ring-4 focus-within:ring-daw-green/10 focus-within:border-daw-green"}`}>
                <ReactQuill
                  ref={quillRef}
                  theme="snow"
                  value={formData.content}
                  readOnly={activeItemLocked} // 🛡️ BLUEPRINT: Kunci Quill Editor
                  onChange={(val) =>
                    setFormData((prev) => ({ ...prev, content: val }))
                  }
                  modules={quillModules}
                  className="min-h-[500px] flex flex-col [&_.ql-editor]:p-10 [&_.ql-editor]:text-slate-700 [&_.ql-editor]:text-lg [&_.ql-toolbar]:border-0 [&_.ql-toolbar]:border-b [&_.ql-toolbar]:bg-slate-50/80 [&_.ql-container]:border-0"
                />
              </div>
            </div>
          </div>

          {/* 🛡️ BLUEPRINT: SPLIT SAVE ACTION (Footer) */}
          <div className="px-8 py-6 bg-slate-900 flex justify-between items-center mt-4">
            <div>
              <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest">
                System Status
              </p>
              <p className="text-xs text-slate-300 italic mt-0.5">
                {activeItemLocked
                  ? "Form terkunci. Menunggu hasil tinjauan."
                  : "Perubahan lokal akan ditayangkan setelah disetujui."}
              </p>
            </div>

            {/* Conditional Rendering Footer Buttons */}
            {activeItemLocked ? (
              <div className="px-8 py-4 bg-slate-800 border border-slate-700 rounded-2xl flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                <span className="text-sm font-bold text-slate-300">
                  Menunggu Review Admin
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={(e) => handleSubmit(e, "Draft")}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 px-6 py-4 rounded-2xl font-bold transition-all disabled:opacity-50">
                  {isSaving ? "..." : "Simpan Draf Lokal"}
                </button>

                <button
                  type="button"
                  disabled={isSaving}
                  onClick={(e) => handleSubmit(e, "Published")}
                  className="bg-daw-green hover:bg-emerald-500 text-white px-8 py-4 rounded-2xl font-bold shadow-xl shadow-daw-green/20 flex items-center gap-2 disabled:bg-slate-700 transition-all transform hover:-translate-y-0.5">
                  <Save className="w-5 h-5" />
                  {isSaving ? "Menyinkronkan..." : "Request Approval"}
                </button>
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
