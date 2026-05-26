import { useState, useEffect, useMemo } from "react";
import {
  Search,
  Plus,
  Filter,
  Edit,
  Trash2,
  Eye,
  AlertTriangle,
  Lock,
  X,
  Newspaper,
  Tags,
  Loader2,
} from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import api from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { getErrorMessage } from "@/lib/utils";

interface NewsCategory {
  id: string;
  name: string;
  slug: string;
  color: string;
}

interface AdminArticle {
  id: string;
  slug: string;
  title: string;
  category_id: string;
  status: string;
  author: string;
  createdAt: string;
  published_at: string | null;
  views: number;
  is_locked: boolean;
  lock_ticket: string | null;
  has_rejected?: boolean;
  categoryData?: NewsCategory | null;
}

export default function NewsManagement() {
  const { user } = useAuth();
  const isSuperadmin = user?.role === "superadmin" || user?.role === "admin";
  const [articles, setArticles] = useState<AdminArticle[]>([]);
  const [categories, setCategories] = useState<NewsCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("All");

  // Category Manager Modal
  const [showCatModal, setShowCatModal] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatColor, setNewCatColor] = useState("#004B23");
  const [isCatSaving, setIsCatSaving] = useState(false);

  const filteredArticles = useMemo(() => {
    if (isLoading) return [];
    return articles.filter((a) => {
      const matchSearch = a.title
        .toLowerCase()
        .includes(searchTerm.trim().toLowerCase());
      let matchCategory = filterCategory === "All";
      if (filterCategory === "Rejected")
        matchCategory = a.has_rejected === true;
      else if (filterCategory !== "All")
        matchCategory = a.category_id === filterCategory;
      else matchCategory = true;
      return matchSearch && matchCategory;
    });
  }, [articles, searchTerm, filterCategory, isLoading]);

  const fetchArticles = async () => {
    setIsLoading(true);
    try {
      const res = await api.get("/news");
      const data = res.data?.success ? res.data.data : res.data;
      if (Array.isArray(data)) setArticles(data);
    } catch (error: unknown) {
      toast.error("Gagal memuat data artikel", {
        description: getErrorMessage(error) || "Kesalahan server.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await api.get("/news-categories");
      if (Array.isArray(res.data)) setCategories(res.data);
    } catch (e) {
      console.error("Fetch categories error:", e);
    }
  };

  useEffect(() => {
    fetchArticles();
    fetchCategories();
  }, []);

  const handleDeleteRequest = (
    id: string,
    title: string,
    isOverride: boolean = false,
  ) => {
    toast.warning(
      isOverride ? "Konfirmasi OVERRIDE Penghapusan" : "Konfirmasi Penghapusan",
      {
        description: isOverride
          ? `PERHATIAN: Artikel "${title}" sedang terkunci. Melanjutkan akan membatalkan draf dan menghapus permanen.`
          : `Apakah Anda yakin ingin menghapus "${title}"?`,
        action: {
          label: isOverride ? "Force Delete" : "Eksekusi",
          onClick: () => executeDelete(id),
        },
        cancel: { label: "Batal", onClick: () => {} },
      },
    );
  };

  const executeDelete = async (id: string) => {
    toast.promise(
      async () => {
        const response = await api.delete(`/news/${id}`);
        if (response.status === 202) {
          setArticles((prev) =>
            prev.map((a) =>
              a.id === id
                ? { ...a, is_locked: true, lock_ticket: response.data.ticket }
                : a,
            ),
          );
          return { message: "Permintaan hapus diajukan ke sistem." };
        } else {
          setArticles((prev) => prev.filter((a) => a.id !== id));
          return { message: "Artikel berhasil dihapus permanen." };
        }
      },
      {
        loading: "Memproses instruksi penghapusan...",
        success: (data: any) => data.message,
        error: (err) =>
          getErrorMessage(err) || "Gagal memproses penghapusan.",
      },
    );
  };

  const handleDiscard = async (lockTicket: string, targetId: string) => {
    if (!lockTicket) return;
    toast.promise(
      async () => {
        await api.patch("/approval/discard", { notrans: lockTicket });
        setArticles((prev) =>
          prev.map((a) =>
            a.id === targetId
              ? {
                  ...a,
                  has_rejected: false,
                  is_locked: false,
                  lock_ticket: null,
                }
              : a,
          ),
        );
      },
      {
        loading: "Membersihkan notifikasi draf...",
        success: "Notifikasi draf yang ditolak berhasil diabaikan.",
        error: (err) =>
          getErrorMessage(err) || "Gagal mengabaikan draf.",
      },
    );
  };

  const toggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === "Published" ? "Draft" : "Published";
    toast.promise(api.put(`/news/${id}`, { status: newStatus }), {
      loading: "Memperbarui status...",
      success: (response) => {
        if (response.status === 202) {
          setArticles((prev) =>
            prev.map((a) =>
              a.id === id
                ? { ...a, is_locked: true, lock_ticket: response.data.ticket }
                : a,
            ),
          );
          return "Status diajukan. Data dikunci menunggu persetujuan.";
        }
        setArticles((prev) =>
          prev.map((a) => (a.id === id ? { ...a, status: newStatus } : a)),
        );
        return `Artikel berhasil diubah menjadi ${newStatus}`;
      },
      error: (err) => getErrorMessage(err) || "Gagal memperbarui status",
    });
  };

  // Category CRUD
  const handleAddCategory = async () => {
    if (!newCatName.trim()) return toast.error("Nama kategori wajib diisi.");
    setIsCatSaving(true);
    try {
      await api.post("/news-categories", {
        name: newCatName.trim(),
        color: newCatColor,
      });
      toast.success("Kategori berhasil ditambahkan!");
      setNewCatName("");
      setNewCatColor("#004B23");
      fetchCategories();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err) || "Gagal menambah kategori.");
    } finally {
      setIsCatSaving(false);
    }
  };

  const handleDeleteCategory = async (id: string, name: string) => {
    toast.warning(`Hapus kategori "${name}"?`, {
      action: {
        label: "Hapus",
        onClick: async () => {
          try {
            await api.delete(`/news-categories/${id}`);
            toast.success("Kategori dihapus.");
            fetchCategories();
          } catch (err: unknown) {
            toast.error(getErrorMessage(err) || "Gagal menghapus.");
          }
        },
      },
      cancel: { label: "Batal", onClick: () => {} },
    });
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500 pb-12">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-serif font-bold text-slate-900">
            News & Events
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Kelola artikel berita, kegiatan, dan acara perusahaan.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowCatModal(true)}
            className="flex items-center gap-2 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 px-4 py-2.5 rounded-xl font-black text-[11px] uppercase tracking-widest transition-all shadow-sm active:scale-95">
            <Filter className="w-4 h-4" /> Kategori
          </button>
          <Link to="/admin/news/create">
            <button className="flex items-center gap-2 bg-daw-green hover:bg-[#003b1c] text-white px-6 py-2.5 rounded-xl font-black text-[11px] uppercase tracking-widest transition-all shadow-lg shadow-daw-green/20 active:scale-95">
              <Plus className="w-5 h-5" /> Tambah Artikel
            </button>
          </Link>
        </div>
      </div>

      {/* QUICK STATS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Total Artikel
          </p>
          <p className="text-2xl font-serif font-bold text-slate-900">
            {articles.length}
          </p>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm border-l-4 border-l-emerald-500">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Telah Terbit (Live)
          </p>
          <p className="text-2xl font-serif font-bold text-emerald-600">
            {
              articles.filter((a) => a.status === "Published" && !a.is_locked)
                .length
            }
          </p>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm border-l-4 border-l-amber-500">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Dalam Antrean / Revisi
          </p>
          <p className="text-2xl font-serif font-bold text-amber-600">
            {articles.filter((a) => a.is_locked || a.has_rejected).length}
          </p>
        </div>
      </div>

      {/* TOOLBAR */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="w-5 h-5 text-slate-400" />
          </div>
          <input
            type="text"
            placeholder="Cari artikel berdasarkan judul..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-daw-green/20 focus:border-daw-green transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="relative min-w-[180px]">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Filter className="w-4 h-4 text-slate-400" />
          </div>
          <select
            className="w-full pl-10 pr-8 py-2.5 bg-white border border-slate-200 rounded-lg appearance-none focus:outline-none focus:ring-2 focus:ring-daw-green/20 focus:border-daw-green cursor-pointer text-slate-700 font-medium"
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}>
            <option value="All">Semua Kategori</option>
            <option value="Rejected" className="text-red-600 font-bold">
              Butuh Revisi
            </option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* DATA TABLE */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mt-6">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500 font-semibold">
                <th className="px-6 py-4">Article Title</th>
                <th className="px-6 py-4">Category</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-12 text-center text-slate-500">
                    Loading articles...
                  </td>
                </tr>
              ) : filteredArticles.length > 0 ? (
                filteredArticles.map((article) => {
                  const isNeedsRevision = article.has_rejected;
                  const isPending = article.is_locked && !isNeedsRevision;
                  const isDeleting =
                    isPending && article.lock_ticket?.includes("DEL");
                  const isLockedForEditor = isPending && !isSuperadmin;
                  const isOverrideMode = isPending && isSuperadmin;

                  const rowStyle = isNeedsRevision
                    ? "bg-red-50/30 hover:bg-red-50/60 border-l-4 border-l-red-500"
                    : isDeleting
                      ? "bg-rose-50/40 opacity-80 grayscale-[30%] border-l-4 border-l-rose-500"
                      : isPending
                        ? isOverrideMode
                          ? "bg-amber-50/40 hover:bg-amber-50/70 border-l-4 border-l-amber-500"
                          : "bg-slate-50 opacity-60 grayscale-[30%] border-l-4 border-l-blue-500"
                        : "hover:bg-slate-50 border-l-4 border-l-transparent hover:border-l-slate-300";

                  return (
                    <tr
                      key={article.id}
                      className={`transition-all duration-300 group ${rowStyle}`}>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border transition-transform group-hover:scale-105 ${isNeedsRevision ? "bg-red-100 border-red-200 text-red-600" : isDeleting ? "bg-rose-100 border-rose-200 text-rose-600" : isPending ? "bg-blue-50 border-blue-100 text-blue-500" : "bg-slate-100 border-slate-200 text-slate-400"}`}>
                            {isDeleting ? (
                              <Trash2 className="w-5 h-5" />
                            ) : (
                              <Newspaper className="w-5 h-5" />
                            )}
                          </div>
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-bold text-slate-900 group-hover:text-daw-green transition-colors line-clamp-1">
                                {article.title}
                              </p>
                              {isDeleting ? (
                                <span className="inline-flex items-center gap-1 text-[9px] bg-rose-100 text-rose-700 border border-rose-200 px-2 py-0.5 rounded-full font-black uppercase tracking-widest animate-pulse">
                                  <Trash2 className="w-2.5 h-2.5" /> PENDING
                                  DELETE
                                </span>
                              ) : isPending ? (
                                <span
                                  className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-bold border shadow-sm ${isOverrideMode ? "bg-amber-50 text-amber-600 border-amber-200" : "bg-blue-50 text-blue-600 border-blue-100"}`}>
                                  <Lock className="w-3 h-3" /> PENDING
                                </span>
                              ) : isNeedsRevision ? (
                                <span className="inline-flex items-center gap-1 text-[10px] bg-red-600 text-white px-2 py-0.5 rounded-full font-black animate-pulse shadow-sm shadow-red-200">
                                  <AlertTriangle className="w-3 h-3" /> REVISION
                                </span>
                              ) : null}
                            </div>
                            {isPending && article.lock_ticket ? (
                              <p className="text-[10px] font-mono text-slate-500 mt-1 uppercase">
                                Ticket: {article.lock_ticket}
                              </p>
                            ) : (
                              <p className="text-xs text-slate-500 mt-0.5">
                                Penulis: {article.author}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {article.categoryData ? (
                          <span
                            className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold border"
                            style={{
                              backgroundColor: `${article.categoryData.color}15`,
                              color: article.categoryData.color,
                              borderColor: `${article.categoryData.color}30`,
                            }}>
                            {article.categoryData.name}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400 italic">
                            Tanpa Kategori
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() =>
                            toggleStatus(article.id, article.status)
                          }
                          disabled={isPending || isNeedsRevision}
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold tracking-wide transition-all ${isPending || isNeedsRevision ? "cursor-not-allowed opacity-80" : "cursor-pointer hover:shadow-md active:scale-95"} ${isPending ? "bg-slate-100 text-slate-400 border border-slate-200" : article.status === "Published" ? "bg-green-100 text-green-700 border border-green-200 hover:bg-green-200" : "bg-amber-100 text-amber-700 border border-amber-200 hover:bg-amber-200"}`}>
                          {article.status}
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-slate-600">
                          {new Date(
                            article.published_at || article.createdAt,
                          ).toLocaleDateString("id-ID", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Dilihat {article.views || 0} kali
                        </p>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div
                          className={`flex items-center justify-end gap-1 transition-opacity ${isLockedForEditor ? "opacity-50" : "opacity-0 group-hover:opacity-100"}`}>
                          <Link
                            to={`/news/${article.slug || article.id}`}
                            target="_blank"
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Pratinjau">
                            <Eye className="w-4 h-4" />
                          </Link>
                          {isLockedForEditor ? (
                            <Link
                              to={`/admin/news/edit/${article.id}?mode=view`}
                              title="Lihat Detail"
                              className="p-2 text-blue-400 hover:bg-blue-50 rounded-lg">
                              <Lock className="w-4 h-4" />
                            </Link>
                          ) : (
                            <Link
                              to={`/admin/news/edit/${article.id}`}
                              className={`p-2 rounded-lg transition-colors ${isOverrideMode ? "text-amber-500 hover:bg-amber-50" : "text-slate-400 hover:text-daw-green hover:bg-green-50"}`}
                              title={isOverrideMode ? "Override" : "Edit"}>
                              {isOverrideMode ? (
                                <AlertTriangle className="w-4 h-4" />
                              ) : (
                                <Edit className="w-4 h-4" />
                              )}
                            </Link>
                          )}
                          {isNeedsRevision && article.lock_ticket && (
                            <button
                              onClick={() =>
                                handleDiscard(article.lock_ticket!, article.id)
                              }
                              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                              title="Abaikan Notifikasi">
                              <X className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() =>
                              handleDeleteRequest(
                                article.id,
                                article.title,
                                isOverrideMode,
                              )
                            }
                            disabled={isLockedForEditor}
                            className={`p-2 rounded-lg transition-all ${isLockedForEditor ? "text-slate-200 cursor-not-allowed" : isOverrideMode ? "text-amber-500 hover:text-red-600 hover:bg-red-50" : "text-slate-400 hover:text-red-600 hover:bg-red-50"}`}
                            title="Hapus">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                        <Search className="w-8 h-8 text-slate-300" />
                      </div>
                      <h3 className="text-lg font-bold text-slate-900 mb-1">
                        Artikel tidak ditemukan
                      </h3>
                      <p className="text-sm text-slate-500">
                        Tidak ada data yang sesuai dengan pencarian Anda.
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CATEGORY MANAGER MODAL */}
      {showCatModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60  animate-in fade-in duration-200"
          onClick={() => setShowCatModal(false)}>
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-in zoom-in-95 duration-200 overflow-hidden flex flex-col max-h-[85vh]"
            onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-daw-green/10 text-daw-green rounded-lg">
                  <Tags className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Manajemen Kategori
                  </h3>
                  <p className="text-[11px] text-slate-500 uppercase tracking-widest font-bold mt-0.5">
                    Label & Warna Berita
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowCatModal(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Area */}
            <div className="p-6 flex flex-col gap-6 overflow-hidden">
              {/* Add New Form */}
              <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl shrink-0">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                  Buat Kategori Baru
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      placeholder="Misal: CSR, Awards..."
                      value={newCatName}
                      onChange={(e) => setNewCatName(e.target.value)}
                      className="w-full pl-3 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-daw-green/20 focus:border-daw-green text-sm shadow-sm transition-all"
                    />
                  </div>

                  <div className="relative group" title="Pilih Warna Kategori">
                    <input
                      type="color"
                      value={newCatColor}
                      onChange={(e) => setNewCatColor(e.target.value)}
                      className="w-[42px] h-[42px] p-1 bg-white border border-slate-200 rounded-lg cursor-pointer shadow-sm group-hover:border-daw-green transition-colors"
                    />
                  </div>

                  <button
                    onClick={handleAddCategory}
                    disabled={isCatSaving || !newCatName.trim()}
                    className="flex items-center justify-center px-4 py-2 bg-daw-green text-white rounded-lg text-sm font-bold hover:bg-[#003b1c] transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shadow-daw-green/20">
                    {isCatSaving ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Plus className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              {/* List Area */}
              <div className="flex flex-col flex-1 overflow-hidden">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 px-1">
                  Daftar Kategori Aktif
                </h4>
                <div className="overflow-y-auto pr-2 pb-2 space-y-2 custom-scrollbar">
                  {categories.map((cat) => (
                    <div
                      key={cat.id}
                      className="flex items-center justify-between p-3.5 bg-white border border-slate-100 rounded-xl hover:border-slate-200 hover:shadow-sm group transition-all">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-5 h-5 rounded-md border shadow-sm flex items-center justify-center shrink-0"
                          style={{
                            backgroundColor: cat.color,
                            borderColor: "rgba(0,0,0,0.1)",
                          }}
                        />
                        <span className="text-sm font-bold text-slate-700">
                          {cat.name}
                        </span>
                      </div>
                      <button
                        onClick={() => handleDeleteCategory(cat.id, cat.name)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-100 rounded-lg transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                        title={`Hapus kategori ${cat.name}`}>
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}

                  {categories.length === 0 && (
                    <div className="py-10 text-center border-2 border-dashed border-slate-100 rounded-xl bg-slate-50/50 flex flex-col items-center justify-center">
                      <Tags className="w-8 h-8 text-slate-300 mb-3" />
                      <p className="text-sm font-medium text-slate-500">
                        Belum ada kategori yang dibuat.
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        Gunakan form di atas untuk membuat kategori pertama.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
