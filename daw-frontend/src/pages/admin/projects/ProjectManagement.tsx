import { useState, useEffect, useMemo } from "react";
import {
  Search,
  Plus,
  Filter,
  Edit,
  Trash2,
  Eye,
  FileText,
  AlertTriangle,
  Lock,
  X,
  RefreshCw,
} from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import api from "@/lib/api";
import { useBusiness } from "@/contexts/BusinessContext";
import { useAuth } from "@/contexts/AuthContext";
import { getErrorMessage } from "@/lib/utils";

export interface AdminProject {
  id: string;
  slug: string;
  title: string;
  category: string;
  status: string;
  author: string;
  createdAt: string;
  views: number;
  is_locked: boolean;
  lock_ticket: string | null;
  has_rejected?: boolean;
}

export default function ProjectManagement() {
  const { user } = useAuth();
  const isSuperadmin = user?.role === "superadmin" || user?.role === "admin" || user?.role === "owner";
  const [projects, setProjects] = useState<AdminProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("All");

  const { sections, isLoading: isSectionsLoading } = useBusiness();

  const validSectorIds = useMemo(
    () => new Set(sections.map((s) => s.id)),
    [sections],
  );

  const hasUncategorizedProjects = useMemo(() => {
    if (isSectionsLoading || projects.length === 0) return false;
    return projects.some((p) => !validSectorIds.has(p.category));
  }, [projects, validSectorIds, isSectionsLoading]);

  // Mesin Pencari & Filter
  const filteredProjects = useMemo(() => {
    if (isLoading) return [];
    return projects.filter((project) => {
      const normalizedSearch = searchTerm.trim().toLowerCase();
      const matchSearch = project.title
        .toLowerCase()
        .includes(normalizedSearch);

      let matchCategory = false;
      if (filterCategory === "All") {
        matchCategory = true;
      } else if (filterCategory === "Uncategorized") {
        matchCategory = !validSectorIds.has(project.category);
      } else if (filterCategory === "Rejected") {
        matchCategory = project.has_rejected === true;
      } else {
        matchCategory = project.category === filterCategory;
      }

      return matchSearch && matchCategory;
    });
  }, [projects, searchTerm, filterCategory, validSectorIds, isLoading]);

  // Fetcher Data
  const fetchProjects = async () => {
    setIsLoading(true);
    try {
      const response = await api.get("/projects");
      const data = response.data?.success ? response.data.data : response.data;
      if (Array.isArray(data)) setProjects(data);
    } catch (error: unknown) {
      console.error("[FETCH_PROJECTS_ERROR]:", error);
      toast.error("Gagal sinkronisasi data proyek", {
        description:
          getErrorMessage(error) || "Kesalahan koneksi server.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // THE DECISION HANDLERS
  const handleDeleteRequest = (
    id: string,
    title: string,
    isOverride: boolean = false,
  ) => {
    toast.warning(
      isOverride ? "Konfirmasi OVERRIDE Penghapusan" : "Konfirmasi Penghapusan",
      {
        description: isOverride
          ? `PERHATIAN: Proyek "${title}" sedang terkunci oleh draf. Melanjutkan akan membatalkan draf tersebut dan menghapus data secara permanen.`
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
        const response = await api.delete(`/projects/${id}`);

        // Pengecekan Jalur
        if (response.status === 202) {
          // Editor Path: Update baris menjadi terkunci, jangan dihapus dari state
          setProjects((prev) =>
            prev.map((p) =>
              p.id === id
                ? { ...p, is_locked: true, lock_ticket: response.data.ticket }
                : p,
            ),
          );
          return {
            type: "pending",
            message: "Permintaan hapus diajukan ke sistem.",
          };
        } else {
          // Admin Path: Hapus permanen dari state
          setProjects((prev) => prev.filter((p) => p.id !== id));
          return {
            type: "deleted",
            message: "Proyek berhasil dihapus permanen.",
          };
        }
      },
      {
        loading: "Memproses instruksi penghapusan...",
        success: (data: any) => data.message,
        error: (err) => {
          console.error("Delete Error:", err);
          return err.response?.data?.message || "Gagal memproses penghapusan.";
        },
      },
    );
  };

  // handleDiscard (Garbage Collection Trigger)
  const handleDiscard = async (lockTicket: string, targetId: string) => {
    if (!lockTicket) return;

    toast.promise(
      async () => {
        await api.patch('/approval/discard', { notrans: lockTicket });
        setProjects((prev) =>
          prev.map((p) =>
            p.id === targetId
              ? {
                  ...p,
                  has_rejected: false,
                  is_locked: false,
                  lock_ticket: null,
                }
              : p,
          ),
        );
      },
      {
        loading: "Membersihkan notifikasi draf...",
        success: "Notifikasi draf yang ditolak berhasil diabaikan.",
        error: (err) =>
          err.response?.data?.message || "Gagal mengabaikan draf.",
      },
    );
  };

  const toggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === "Published" ? "Draft" : "Published";

    toast.promise(api.put(`/projects/${id}`, { status: newStatus }), {
      loading: "Memperbarui status...",
      success: (response) => {
        // Editor Path
        if (response.status === 202) {
          setProjects((prev) =>
            prev.map((p) =>
              p.id === id
                ? { ...p, is_locked: true, lock_ticket: response.data.ticket }
                : p,
            ),
          );
          return "Status diajukan. Data dikunci menunggu persetujuan.";
        }

        // Admin Path
        setProjects((prev) =>
          prev.map((p) => (p.id === id ? { ...p, status: newStatus } : p)),
        );
        return `Proyek berhasil diubah menjadi ${newStatus}`;
      },
      error: (err) => err.response?.data?.message || "Gagal memperbarui status",
    });
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500 pb-12">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm top-0 z-20">
        <div>
          <h1 className="text-2xl font-serif font-bold text-slate-900">
            Project Management
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Kelola portofolio, artikel berita, dan aset operasional perusahaan.
          </p>
        </div>
        <Link to="/admin/projects/create">
          <button className="flex items-center justify-center gap-2 bg-daw-green hover:bg-[#003b1c] text-white px-6 py-2.5 rounded-xl font-black text-[11px] uppercase tracking-widest transition-all shadow-lg shadow-daw-green/20 active:scale-95">
            <Plus className="w-5 h-5" />
            <span>Tambah Proyek Baru</span>
          </button>
        </Link>
      </div>

      {/* QUICK STATS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Total Proyek
          </p>
          <p className="text-2xl font-serif font-bold text-slate-900">
            {projects.length}
          </p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm border-l-4 border-l-emerald-500">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Telah Terbit (Live)
          </p>
          <p className="text-2xl font-serif font-bold text-emerald-600">
            {/* REFACTORED: Hanya menghitung yang Published DAN tidak sedang dikunci (aman) */}
            {
              projects.filter((p) => p.status === "Published" && !p.is_locked)
                .length
            }
          </p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm border-l-4 border-l-amber-500">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Dalam Antrean / Revisi
          </p>
          <p className="text-2xl font-serif font-bold text-amber-600">
            {projects.filter((p) => p.is_locked || p.has_rejected).length}
          </p>
        </div>
      </div>

      {/* TOOLBAR (Search & Filter) */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search Bar */}
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="w-5 h-5 text-slate-400" />
          </div>
          <input
            type="text"
            placeholder="Cari proyek berdasarkan judul..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-daw-green/20 focus:border-daw-green transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Category Filter */}
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
            {sections.map((sec) => (
              <option key={sec.id} value={sec.id}>
                {sec.category}
              </option>
            ))}
            {/* Opsi khusus ini hanya muncul jika ada data "yatim piatu" yang sektornya terhapus */}
            {hasUncategorizedProjects && (
              <option
                value="Uncategorized"
                className="text-slate-500 font-bold">
                ✖️ Sektor Terhapus
              </option>
            )}
          </select>
        </div>
      </div>

      {/* --- DATA TABLE SECTION --- */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mt-6">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500 font-semibold">
                <th className="px-6 py-4">Project Title</th>
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
                    Loading projects...
                  </td>
                </tr>
              ) : filteredProjects.length > 0 ? (
                filteredProjects.map((project) => {
                  // const isRejected = project.has_rejected;
                  // const isLocked = project.is_locked;
                  // isNeedsRevision: Prioritas #1 (Urgensi Tinggi)
                  const isNeedsRevision = project.has_rejected;

                  // isPending: Prioritas #2 (Hanya aktif jika tidak sedang rejected)
                  const isPending = project.is_locked && !isNeedsRevision;

                  // HEURISTIC: Cek apakah ini permintaan hapus berdasarkan pola tiket
                  const isDeleting =
                    isPending && project.lock_ticket?.includes("DEL");

                  // Deteksi Otoritas
                  const isLockedForEditor = isPending && !isSuperadmin;
                  const isOverrideMode = isPending && isSuperadmin;

                  const rowStyle = isNeedsRevision
                    ? "bg-red-50/30 hover:bg-red-50/60 border-l-4 border-l-red-500 shadow-[inset_4px_0_0_0_rgba(239,68,68,1)]"
                    : isDeleting
                      ? "bg-rose-50/40 opacity-80 grayscale-[30%] border-l-4 border-l-rose-500"
                      : isPending
                        ? isOverrideMode
                          ? "bg-amber-50/40 hover:bg-amber-50/70 border-l-4 border-l-amber-500"
                          : "bg-slate-50 opacity-60 grayscale-[30%] border-l-4 border-l-blue-500"
                        : "hover:bg-slate-50 border-l-4 border-l-transparent hover:border-l-slate-300";

                  return (
                    <tr
                      key={project.id}
                      className={`transition-all duration-300 group ${rowStyle}`}>
                      {/* KOLOM 1: TITLE & IDENTIFIERS */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {/* Dynamic Icon Box */}
                          <div
                            className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border transition-transform group-hover:scale-105 ${
                              isNeedsRevision
                                ? "bg-red-100 border-red-200 text-red-600"
                                : isDeleting
                                  ? "bg-rose-100 border-rose-200 text-rose-600"
                                  : isPending
                                    ? "bg-blue-50 border-blue-100 text-blue-500"
                                    : "bg-slate-100 border-slate-200 text-slate-400"
                            }`}>
                            {isDeleting ? (
                              <Trash2 className="w-5 h-5" />
                            ) : (
                              <FileText className="w-5 h-5" />
                            )}
                          </div>

                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-bold text-slate-900 group-hover:text-daw-green transition-colors line-clamp-1">
                                {project.title}
                              </p>

                              {/* BADGE SYSTEM  (Konsisten dengan Row Style) */}
                              {isDeleting ? (
                                <span className="inline-flex items-center gap-1 text-[9px] bg-rose-100 text-rose-700 border border-rose-200 px-2 py-0.5 rounded-full font-black uppercase tracking-widest shadow-sm animate-pulse">
                                  <Trash2 className="w-2.5 h-2.5" /> PENDING
                                  DELETE
                                </span>
                              ) : isPending ? (
                                <span
                                  className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-bold border shadow-sm ${
                                    isOverrideMode
                                      ? "bg-amber-50 text-amber-600 border-amber-200"
                                      : "bg-blue-50 text-blue-600 border-blue-100"
                                  }`}>
                                  <Lock className="w-3 h-3" /> PENDING
                                </span>
                              ) : isNeedsRevision ? (
                                <span className="inline-flex items-center gap-1 text-[10px] bg-red-600 text-white px-2 py-0.5 rounded-full font-black animate-pulse shadow-sm shadow-red-200">
                                  <AlertTriangle className="w-3 h-3" /> REVISION
                                </span>
                              ) : null}
                            </div>

                            {/* TICKET IDENTIFIER */}
                            {isPending && project.lock_ticket ? (
                              <p className="text-[10px] font-mono text-slate-500 mt-1 uppercase">
                                Ticket: {project.lock_ticket}
                              </p>
                            ) : (
                              <p className="text-xs text-slate-500 mt-0.5">
                                Penulis: {project.author}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* KOLOM 2: CATEGORY */}
                      <td className="px-6 py-4">
                        {(() => {
                          const matchedSector = sections.find(
                            (sec) => sec.id === project.category,
                          );
                          return matchedSector ? (
                            <span className="text-sm text-slate-600 font-medium">
                              {matchedSector.category}
                            </span>
                          ) : (
                            <span
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-50 text-red-600 text-xs font-bold border border-red-100 cursor-help"
                              title="Sektor asal telah dihapus dari sistem">
                              <AlertTriangle className="w-3 h-3" /> Sektor
                              Terhapus
                            </span>
                          );
                        })()}
                      </td>

                      {/* KOLOM 3: STATUS */}
                      <td className="px-6 py-4">
                        <div className="flex flex-col items-start gap-1">
                          <button
                            onClick={() =>
                              toggleStatus(project.id, project.status)
                            }
                            disabled={isPending || isNeedsRevision}
                            title={
                              isPending || isNeedsRevision
                                ? "Tidak dapat diubah saat dalam proses persetujuan"
                                : "Klik untuk mengubah status"
                            }
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold tracking-wide transition-all ${
                              isPending || isNeedsRevision
                                ? "cursor-not-allowed opacity-80 " // Disable styling
                                : "cursor-pointer hover:shadow-md hover:scale-105 active:scale-95 " // Enable styling
                            } ${
                              isPending
                                ? "bg-slate-100 text-slate-400 border border-slate-200"
                                : project.status === "Published"
                                  ? "bg-green-100 text-green-700 border border-green-200 hover:bg-green-200"
                                  : "bg-amber-100 text-amber-700 border border-amber-200 hover:bg-amber-200"
                            }`}>
                            {!isPending && !isNeedsRevision && (
                              <RefreshCw className="w-3 h-3 text-slate-500 opacity-60 group-hover:rotate-180 transition-transform duration-500" />
                            )}
                            {project.status}
                          </button>
                          {!isPending && !isNeedsRevision && (
                            <span className="text-[9px] text-slate-400 font-medium px-1">
                              Klik untuk ubah status
                            </span>
                          )}
                        </div>
                      </td>
                      {/* KOLOM 4: DATE & VIEWS */}
                      <td className="px-6 py-4">
                        <p className="text-sm text-slate-600">
                          {new Date(project.createdAt).toLocaleDateString(
                            "id-ID",
                            { day: "numeric", month: "short", year: "numeric" },
                          )}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Dilihat {project.views || 0} kali
                        </p>
                      </td>

                      {/* KOLOM 5: ACTIONS (DYNAMIC UX) */}
                      <td className="px-6 py-4 text-right">
                        <div
                          className={`flex items-center justify-end gap-1 transition-opacity ${isLockedForEditor ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
                          {/* PUBLIC PREVIEW */}
                          {project.status !== "Published" ? (
                            <button
                              disabled
                              className="p-2 text-slate-200 cursor-not-allowed"
                              title="Pratinjau publik hanya tersedia untuk proyek yang sudah terbit (Published)">
                              <Eye className="w-4 h-4 opacity-50" />
                            </button>
                          ) : (
                            <Link
                            to={`/projects/${project.slug || project.id}`}
                            target="_blank"
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Pratinjau Publik">
                            <Eye className="w-4 h-4" />
                          </Link>
                          )}

                          {/* EDIT / VIEW ACTION */}
                          {isLockedForEditor ? (
                            <Link
                              to={`/admin/projects/edit/${project.id}?mode=view`}
                              title="Lihat Detail & Progress Approval"
                              className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded-lg cursor-pointer transition-colors shadow-sm bg-blue-50 border border-blue-200 inline-flex items-center justify-center">
                              <Lock className="w-4 h-4 text-blue-600" />
                            </Link>
                          ) : (
                            <Link
                              to={`/admin/projects/edit/${project.id}`}
                              className={`p-2 rounded-lg transition-colors ${
                                isOverrideMode
                                  ? "text-amber-500 hover:bg-amber-50"
                                  : "text-slate-400 hover:text-daw-green hover:bg-green-50"
                              }`}
                              title={
                                isOverrideMode
                                  ? "Override Data Terkunci"
                                  : "Edit Proyek"
                              }>
                              {isOverrideMode ? (
                                <AlertTriangle className="w-4 h-4" />
                              ) : (
                                <Edit className="w-4 h-4" />
                              )}
                            </Link>
                          )}

                          {/* FITUR YANG HILANG: TOMBOL DISCARD */}
                          {isNeedsRevision && project.lock_ticket && (
                            <button
                              onClick={() =>
                                handleDiscard(project.lock_ticket!, project.id)
                              }
                              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                              title="Abaikan & Bersihkan Notifikasi Ini">
                              <X className="w-4 h-4" />
                            </button>
                          )}

                          {/* DELETE ACTION */}
                          <button
                            onClick={() =>
                              handleDeleteRequest(
                                project.id,
                                project.title,
                                isOverrideMode,
                              )
                            }
                            disabled={isLockedForEditor}
                            className={`p-2 rounded-lg transition-all ${
                              isLockedForEditor
                                ? "text-slate-200 cursor-not-allowed"
                                : isOverrideMode
                                  ? "text-amber-500 hover:text-red-600 hover:bg-red-50"
                                  : "text-slate-400 hover:text-red-600 hover:bg-red-50"
                            }`}
                            title={
                              isOverrideMode
                                ? "Force Delete Data"
                                : "Hapus Proyek"
                            }>
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
                        Proyek tidak ditemukan
                      </h3>
                      <p className="text-sm text-slate-500">
                        Kami tidak menemukan data yang sesuai dengan pencarian
                        Anda.
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
