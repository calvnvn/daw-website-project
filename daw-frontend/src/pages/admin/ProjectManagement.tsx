import { useState, useEffect, useMemo } from "react";
import {
  Search,
  Plus,
  Filter,
  MoreVertical,
  Edit,
  Trash2,
  Eye,
  FileText,
  AlertTriangle,
} from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import api from "@/lib/api";
import { useBusiness } from "@/contexts/BusinessContext";

// 1. Sesuaikan Interface dengan kolom tabel MySQL kita
interface AdminProject {
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
}

export default function ProjectManagement() {
  // 2. Gunakan Interface pada State
  // --- STATE & HOOKS ---
  const [projects, setProjects] = useState<AdminProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("All");

  // Get business context data
  const { sections, isLoading: isSectionsLoading } = useBusiness();

  /**
   * @memo validSectorIds
   * Optimization: Converts sections array to a Set for O(1) lookup performance.
   * This prevents expensive array traversal inside the filter loops.
   */
  const validSectorIds = useMemo(
    () => new Set(sections.map((s) => s.id)),
    [sections],
  );

  /**
   * @memo hasUncategorizedProjects
   * Integrity Check: Detects if any existing project belongs to a sector
   * that has been deleted from the database.
   * Guard: Returns false if sections are still loading to prevent UI flickering.
   */
  const hasUncategorizedProjects = useMemo(() => {
    if (isSectionsLoading || projects.length === 0) return false;
    return projects.some((p) => !validSectorIds.has(p.category));
  }, [projects, validSectorIds, isSectionsLoading]);

  /**
   * @memo filteredProjects
   * Primary Filtering Engine:
   * 1. Search: Matches trimmed, case-insensitive title.
   * 2. Category: Supports 'All', 'Uncategorized' (Orphaned data), and specific slugs.
   */
  const filteredProjects = useMemo(() => {
    // Return empty if data is still fetching to avoid mismatched calculations
    if (isLoading) return [];

    return projects.filter((project) => {
      // 1. Search logic
      const normalizedSearch = searchTerm.trim().toLowerCase();
      const matchSearch = project.title
        .toLowerCase()
        .includes(normalizedSearch);

      // 2. Category logic
      let matchCategory = false;
      if (filterCategory === "All") {
        matchCategory = true;
      } else if (filterCategory === "Uncategorized") {
        matchCategory = !validSectorIds.has(project.category);
      } else {
        // Standard slug comparison
        matchCategory = project.category === filterCategory;
      }

      return matchSearch && matchCategory;
    });
  }, [projects, searchTerm, filterCategory, validSectorIds, isLoading]);

  // --- DATA FETCHING ---
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const response = await api.get("/projects");

        // Data Normalization for different backend response structures
        const data = response.data?.success
          ? response.data.data
          : response.data;
        if (Array.isArray(data)) {
          setProjects(data);
        }
      } catch (error: any) {
        console.error("[FETCH_PROJECTS_ERROR]:", error);
        toast.error("Gagal sinkronisasi data proyek", {
          description:
            error.response?.data?.message || "Kesalahan koneksi server.",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchProjects();
  }, []);

  const handleDeleteRequest = (id: string, title: string) => {
    toast.warning("Konfirmasi Penghapusan", {
      description: `Apakah Anda yakin ingin menghapus "${title}"? Tindakan ini tidak dapat dibatalkan.`,
      action: {
        label: "Delete",
        onClick: () => executeDelete(id),
      },
      cancel: {
        label: "Cancel",
        onClick: () => {},
      },
    });
  };

  const executeDelete = async (id: string) => {
    // Kita gunakan toast.promise agar loading bar dan status tersinkronisasi
    toast.promise(
      async () => {
        // A. Panggil API Backend (yang sudah kita pasangi logic hapus file fisik)
        const response = await api.delete(`/projects/${id}`);

        // B. Cek apakah backend berhasil (biasanya status 200)
        setProjects((prev) => prev.filter((p) => p.id !== id));

        return response.data;
      },
      {
        loading: "Menghapus proyek dan membersihkan data terkait...",
        success: "Proyek berhasil dihapus dari sistem.",
        error: (err) => {
          console.error("Delete Error:", err);
          return err.response?.data?.message || "Failed to delete project.";
        },
      },
    );
  };

  const toggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === "Published" ? "Draft" : "Published";

    toast.promise(api.put(`/projects/${id}`, { status: newStatus }), {
      loading: "Memperbarui status...",
      success: () => {
        // Update state lokal biar UI langsung berubah tanpa reload
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
      {/* --- HEADER --- */}
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
          {" "}
          {/* Pastikan path ini benar ada slash di depan */}
          <button className="flex items-center gap-2 bg-daw-green hover:bg-[#003b1c] text-white px-5 py-2.5 rounded-lg font-medium transition-colors shadow-sm shadow-daw-green/20">
            <Plus className="w-5 h-5" />
            <span>Tambah Proyek Baru</span>
          </button>
        </Link>
      </div>
      {/* --- QUICK STATS --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Total Proyek
          </p>
          <p className="text-2xl font-serif font-bold text-slate-900">
            {projects.length}
          </p>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm border-l-4 border-l-green-500">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Telah Terbit
          </p>
          <p className="text-2xl font-serif font-bold text-green-600">
            {projects.filter((p) => p.status === "Published").length}
          </p>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm border-l-4 border-l-amber-500">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Draf / Revisi
          </p>
          <p className="text-2xl font-serif font-bold text-amber-600">
            {projects.filter((p) => p.status === "Draft").length}
          </p>
        </div>
      </div>
      {/* --- TOOLBAR (Search & Filter) --- */}
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
            className="w-full pl-10 pr-8 py-2.5 bg-white border border-slate-200 rounded-lg appearance-none focus:outline-none focus:ring-2 focus:ring-daw-green/20 focus:border-daw-green cursor-pointer text-slate-700"
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}>
            <option value="All">Semua Kategori</option>
            {sections.map((sec) => (
              <option key={sec.id} value={sec.id}>
                {sec.category}
              </option>
            ))}
            {hasUncategorizedProjects && (
              <option value="Uncategorized" className="text-red-500 font-bold">
                ⚠️ Sektor Terhapus
              </option>
            )}
          </select>
        </div>
      </div>

      {/* --- DATA TABLE SECTION --- */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
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
                // 5. Render dari FILTERED PROJECTS, bukan mockProjects atau projects biasa
                filteredProjects.map((project) => (
                  <tr
                    key={project.id}
                    className="hover:bg-slate-50/80 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded bg-slate-100 flex items-center justify-center shrink-0 border border-slate-200">
                          <FileText className="w-5 h-5 text-slate-400" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900 group-hover:text-daw-green transition-colors line-clamp-1">
                            {project.title}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Penulis: {project.author}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {(() => {
                        const matchedSector = sections.find(
                          (sec) => sec.id === project.category,
                        );
                        if (matchedSector) {
                          return (
                            <span className="text-sm text-slate-600 font-medium">
                              {matchedSector.category}
                            </span>
                          );
                        } else {
                          return (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-50 text-red-600 text-xs font-bold border border-red-100">
                              <AlertTriangle className="w-3 h-3" />
                              Sektor Terhapus
                            </span>
                          );
                        }
                      })()}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => toggleStatus(project.id, project.status)}
                        title="Klik untuk ubah status"
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold tracking-wide transition-all active:scale-95 hover:brightness-90 ${
                          project.status === "Published"
                            ? "bg-green-100 text-green-700 border border-green-200"
                            : "bg-amber-100 text-amber-700 border border-amber-200"
                        }`}>
                        {project.status}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-slate-600">
                        {/* 6. Format Tanggal dari MySQL (createdAt) */}
                        {new Date(project.createdAt).toLocaleDateString(
                          "id-ID",
                          {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          },
                        )}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Dilihat {project.views || 0} kali
                      </p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Link
                          to={`/projects/${project.slug || project.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="View Article Live">
                          <Eye className="w-4 h-4" />
                        </Link>

                        {/* --- EDIT ARTICLE --- */}
                        <Link
                          to={`/admin/projects/edit/${project.id}`}
                          className="p-2 text-slate-400 hover:text-daw-green hover:bg-green-50 rounded-lg transition-colors inline-block"
                          title="Edit Article">
                          <Edit className="w-4 h-4" />
                        </Link>
                        {/* --- DELETE ACTION --- */}
                        <button
                          onClick={() =>
                            handleDeleteRequest(project.id, project.title)
                          } //  Panggil fungsi trigger
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                          title="Delete Record">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <button className="p-2 text-slate-400 md:hidden">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                /* Empty State (Kalau data kosong / tidak ditemukan saat search) */
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
