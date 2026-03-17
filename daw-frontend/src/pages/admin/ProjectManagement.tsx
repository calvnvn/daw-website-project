import { useState, useEffect } from "react";
import {
  Search,
  Plus,
  Filter,
  MoreVertical,
  Edit,
  Trash2,
  Eye,
  FileText,
} from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import api from "@/lib/api";

// 1. Sesuaikan Interface dengan kolom tabel MySQL kita
interface AdminProject {
  id: string;
  title: string;
  category: string;
  status: string;
  author: string;
  createdAt: string; // Di DB kita namanya createdAt, bukan lastModified
  views: number;
}

export default function ProjectManagement() {
  // 2. Gunakan Interface pada State
  const [projects, setProjects] = useState<AdminProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState<
    "All" | "Resources" | "Energy"
  >("All");

  // 3. Logika Filter SEKARANG MENGGUNAKAN DATA ASLI (projects)
  const filteredProjects = projects.filter((project) => {
    const matchSearch = project.title
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    const matchCategory =
      filterCategory === "All" || project.category === filterCategory;
    return matchSearch && matchCategory;
  });

  // 4. Fetch Data dari Backend
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const response = await api.get("/projects");

        // Handle double nesting dari backend DAW Group
        if (response.data && response.data.success) {
          setProjects(response.data.data);
        } else if (Array.isArray(response.data)) {
          setProjects(response.data);
        }
      } catch (error: any) {
        console.error("Fetch Projects Error:", error);
        toast.error("Connection Error", {
          description:
            error.response?.data?.message || "Cannot connect to server.",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchProjects();
  }, []);

  const handleDeleteRequest = (id: string, title: string) => {
    toast.warning("Confirm Deletion", {
      description: `Are you sure you want to delete "${title}"?`,
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
        loading: "Deleting project and cleaning up storage...",
        success: "Project successfully removed!",
        error: (err) => {
          console.error("Delete Error:", err);
          return err.response?.data?.message || "Failed to delete project.";
        },
      },
    );
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
            Manage portfolios, articles, and operating assets.
          </p>
        </div>
        <Link to="/admin/projects/create">
          {" "}
          {/* Pastikan path ini benar ada slash di depan */}
          <button className="flex items-center gap-2 bg-daw-green hover:bg-[#003b1c] text-white px-5 py-2.5 rounded-lg font-medium transition-colors shadow-sm shadow-daw-green/20">
            <Plus className="w-5 h-5" />
            <span>Add New Project</span>
          </button>
        </Link>
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
            placeholder="Search projects by title..."
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
            onChange={(e) =>
              setFilterCategory(
                e.target.value as "All" | "Resources" | "Energy",
              )
            }
          >
            <option value="All">All Categories</option>
            <option value="Resources">Resources</option>
            <option value="Energy">Energy</option>
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
                <th className="px-6 py-4">Last Modified</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-12 text-center text-slate-500"
                  >
                    Loading projects...
                  </td>
                </tr>
              ) : filteredProjects.length > 0 ? (
                // 5. Render dari FILTERED PROJECTS, bukan mockProjects atau projects biasa
                filteredProjects.map((project) => (
                  <tr
                    key={project.id}
                    className="hover:bg-slate-50/80 transition-colors group"
                  >
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
                            By {project.author}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-slate-600 font-medium">
                        {project.category}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold tracking-wide ${
                          project.status === "Published"
                            ? "bg-green-100 text-green-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {project.status}
                      </span>
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
                        {project.views || 0} views
                      </p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Link
                          to={`/projects/${project.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="View Article Live"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>

                        {/* --- EDIT ARTICLE --- */}
                        <Link
                          to={`/admin/projects/edit/${project.id}`}
                          className="p-2 text-slate-400 hover:text-daw-green hover:bg-green-50 rounded-lg transition-colors inline-block"
                          title="Edit Article"
                        >
                          <Edit className="w-4 h-4" />
                        </Link>
                        {/* --- DELETE ACTION --- */}
                        <button
                          onClick={() =>
                            handleDeleteRequest(project.id, project.title)
                          } // 🚀 Panggil fungsi trigger
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                          title="Delete Record"
                        >
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
                        No projects found
                      </h3>
                      <p className="text-sm text-slate-500">
                        We couldn't find anything matching your search criteria.
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
