import { useState, useEffect, useMemo } from "react";
import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";
import { toast } from "sonner";
import {
  Plus,
  Edit2,
  Trash2,
  Save,
  Layout,
  Image as ImageIcon,
  Sparkles,
  Globe,
  Layers,
  Monitor,
} from "lucide-react";
import api from "@/lib/api";

interface Page {
  id: string;
  title: string;
  slug: string;
  subtitle: string;
  heroImage: string;
  templateType: "classic" | "modern" | "split";
  content: string;
}

export default function PageManager() {
  const [pages, setPages] = useState<Page[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // State Formulir
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    slug: "",
    subtitle: "",
    heroImage: "",
    templateType: "classic",
    content: "",
  });

  const quillModules = useMemo(
    () => ({
      toolbar: [
        [{ header: [1, 2, 3, false] }],
        ["bold", "italic", "underline", "strike", "blockquote"],
        [{ list: "ordered" }, { list: "bullet" }],
        [{ align: [] }, { color: [] }, { background: [] }],
        ["link", "image", "video"], // Mendukung Media In-text
        ["clean"],
      ],
    }),
    [],
  );

  // --- FETCH DATA ---
  const fetchPages = async () => {
    setIsLoading(true);
    try {
      const response = await api.get("/pages");
      setPages(response.data);
    } catch (error) {
      toast.error("Failed to fetch page data.");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPages();
  }, []);

  // --- LOGIKA SLUG OTOMATIS ---
  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    if (!editingId) {
      const autoSlug = newTitle
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)+/g, "");
      setFormData({ ...formData, title: newTitle, slug: autoSlug });
    } else {
      setFormData({ ...formData, title: newTitle });
    }
  };

  // --- LOGIKA FORMULIR ---
  const resetForm = () => {
    setEditingId(null);
    setFormData({
      title: "",
      slug: "",
      subtitle: "",
      heroImage: "",
      templateType: "classic",
      content: "",
    });
  };

  const handleEdit = async (page: Page) => {
    const toastId = toast.loading("Memuat detail halaman...");
    try {
      const response = await api.get(`/pages/slug/${page.slug}`);
      const data = response.data;
      setFormData({
        title: data.title || "",
        slug: data.slug || "",
        subtitle: data.subtitle || "",
        heroImage: data.heroImage || "",
        templateType: data.templateType || "classic",
        content: data.content || "",
      });
      setEditingId(page.id);
      toast.dismiss(toastId);
    } catch (error) {
      toast.error("Gagal memuat data", { id: toastId });
      console.log(error);
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (
      !confirm(
        `Yakin ingin menghapus halaman "${title}"? Tindakan ini tidak bisa dibatalkan.`,
      )
    )
      return;

    const toastId = toast.loading("Menghapus halaman...");
    try {
      await api.delete(`/pages/${id}`);
      toast.success("Halaman berhasil dihapus", { id: toastId });
      fetchPages();
      if (editingId === id) resetForm();
    } catch (error) {
      toast.error("Gagal menghapus halaman", { id: toastId });
      console.log(error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.slug)
      return toast.error("Judul & Slug wajib diisi!");

    setIsSaving(true);
    const toastId = toast.loading("Sedang menyimpan...");

    try {
      if (editingId) {
        await api.put(`/pages/${editingId}`, formData);
        toast.success("Halaman diperbarui!", { id: toastId });
      } else {
        await api.post("/pages", formData);
        toast.success("Halaman baru dipublikasi!", { id: toastId });
      }
      resetForm();
      fetchPages();
    } catch (error: any) {
      toast.error("Gagal menyimpan perubahan", { id: toastId });
      console.log(error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-700 pb-20">
      {/* 1. TOP ACTION BAR */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-daw-green/10 rounded-xl">
            <Layers className="w-6 h-6 text-daw-green" />
          </div>
          <div>
            <h1 className="text-2xl font-serif font-bold text-slate-900">
              Advanced Page Builder
            </h1>
            <p className="text-sm text-slate-500">
              Rancang pengalaman digital unik per halaman
            </p>
          </div>
        </div>
        {!editingId && (
          <button
            onClick={resetForm}
            className="bg-daw-green hover:bg-[#003b1c] text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all shadow-md active:scale-95"
          >
            <Plus className="w-4 h-4" /> New Page
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* 2. SIDEBAR: LIST HALAMAN */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 sticky top-24">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mb-4">
              Page List
            </h3>
            {isLoading ? (
              <div className="py-10 text-center animate-pulse text-slate-400 font-bold">
                Loading...
              </div>
            ) : (
              <div className="space-y-3">
                {pages.map((p) => (
                  <div
                    key={p.id}
                    className={`p-4 rounded-xl border bg-white transition-all group ${editingId === p.id ? "border-daw-green ring-4 ring-daw-green/5 shadow-sm" : "border-slate-200"}`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="min-w-0">
                        <h4 className="font-bold text-slate-900 text-sm truncate">
                          {p.title}
                        </h4>
                        <p className="text-[10px] text-slate-400 font-mono mt-1">
                          /page/{p.slug}
                        </p>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleEdit(p)}
                          className="p-1.5 hover:bg-daw-green/10 text-slate-400 hover:text-daw-green rounded-md"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(p.id, p.title)}
                          className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-md"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 3. EDITOR FORM */}
        <div className="lg:col-span-8">
          <form
            onSubmit={handleSubmit}
            className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden"
          >
            {/* TAB HEADER: CONFIGURATION */}
            <div className="p-8 border-b border-slate-100 bg-slate-50/30">
              <div className="flex items-center gap-2 mb-6 text-daw-green uppercase text-[10px] font-black tracking-widest">
                <Sparkles className="w-4 h-4" /> Professional Layout Engine
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">
                    Main Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={handleTitleChange}
                    className="w-full p-4 rounded-xl bg-white border border-slate-200 focus:border-daw-green outline-none font-bold text-slate-800 shadow-sm"
                    placeholder="Contoh: Sejarah DAW Group"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">
                    Hero Subtitle
                  </label>
                  <input
                    type="text"
                    value={formData.subtitle}
                    onChange={(e) =>
                      setFormData({ ...formData, subtitle: e.target.value })
                    }
                    className="w-full p-4 rounded-xl bg-white border border-slate-200 focus:border-daw-green outline-none text-slate-600 shadow-sm"
                    placeholder="Slogan kecil di bawah judul..."
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">
                    URL Slug *
                  </label>
                  <div className="flex items-center gap-2 p-4 rounded-xl bg-white border border-slate-200 text-slate-400 font-mono text-sm">
                    <Globe className="w-4 h-4" /> /page/{formData.slug}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">
                    Hero Background Image
                  </label>
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
                    <ImageIcon className="w-4 h-4 text-slate-300" />
                    <input
                      type="text"
                      value={formData.heroImage}
                      onChange={(e) =>
                        setFormData({ ...formData, heroImage: e.target.value })
                      }
                      className="w-full outline-none text-sm text-slate-600"
                      placeholder="Paste image URL (Unsplash/Direct Link)..."
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* TEMPLATE SELECTOR */}
            <div className="p-8 border-b border-slate-100">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-4">
                Pilih Template Layout
              </label>
              <div className="grid grid-cols-3 gap-4">
                {(["classic", "modern", "split"] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() =>
                      setFormData({ ...formData, templateType: type })
                    }
                    className={`p-6 border-2 rounded-2xl flex flex-col items-center gap-3 transition-all ${formData.templateType === type ? "border-daw-green bg-daw-green/5" : "border-slate-100 hover:border-slate-200"}`}
                  >
                    {type === "classic" && (
                      <Monitor
                        className={`w-6 h-6 ${formData.templateType === type ? "text-daw-green" : "text-slate-400"}`}
                      />
                    )}
                    {type === "modern" && (
                      <Layers
                        className={`w-6 h-6 ${formData.templateType === type ? "text-daw-green" : "text-slate-400"}`}
                      />
                    )}
                    {type === "split" && (
                      <Layout
                        className={`w-6 h-6 ${formData.templateType === type ? "text-daw-green" : "text-slate-400"}`}
                      />
                    )}
                    <span className="text-xs font-bold capitalize">{type}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* CONTENT EDITOR */}
            <div className="p-8">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-4">
                Isi Konten Editorial
              </label>
              <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white shadow-inner">
                <ReactQuill
                  theme="snow"
                  value={formData.content}
                  onChange={(val) => setFormData({ ...formData, content: val })}
                  modules={quillModules}
                  className="min-h-[450px] flex flex-col [&_.ql-editor]:p-8 [&_.ql-editor]:text-slate-700 [&_.ql-editor]:text-lg [&_.ql-toolbar]:border-0 [&_.ql-toolbar]:border-b [&_.ql-container]:border-0"
                  placeholder="Ceritakan transformasi DAW Group di sini..."
                />
              </div>
            </div>

            {/* SAVE ACTION */}
            <div className="px-8 py-6 bg-slate-50 flex justify-between items-center">
              <p className="text-[10px] text-slate-400 font-bold uppercase italic">
                Semua perubahan akan langsung terlihat di website publik.
              </p>
              <div className="flex gap-3">
                {editingId && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-6 py-3 rounded-xl border border-slate-200 font-bold text-slate-500 hover:bg-white transition-all"
                  >
                    Batal
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isSaving}
                  className="bg-daw-green hover:bg-[#003b1c] text-white px-10 py-3 rounded-xl font-bold shadow-lg shadow-daw-green/20 flex items-center gap-2 disabled:bg-slate-300"
                >
                  <Save className="w-5 h-5" />{" "}
                  {isSaving
                    ? "Menyimpan..."
                    : editingId
                      ? "Update Halaman"
                      : "Publish Halaman"}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
