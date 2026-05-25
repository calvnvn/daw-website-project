import { useState, useEffect, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom"; // Tambahkan useSearchParams
import { useTranslation } from "react-i18next";
import { ArrowRight, ImageIcon, Filter } from "lucide-react";
import api from "@/lib/api";
import { getCleanImageUrl } from "@/lib/utils";
import { useBusiness } from "@/contexts/BusinessContext";
import SEO from "@/components/SEO";

export default function PublicProjects() {
  const { i18n } = useTranslation();
  const [projects, setProjects] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { sections, isLoading: isSectionsLoading } = useBusiness();

  // FIX 1: URL Sync - Ambil filter dari URL jika ada
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryParam = searchParams.get("category") || "All";

  useEffect(() => {
    const fetchProjects = async () => {
      setIsLoading(true);
      try {
        const response = await api.get("/projects/public", {
          params: { lang: i18n.language === "id" ? "id" : "en" }
        });
        setProjects(response.data);
      } catch (err) {
        console.error("Failed to load projects:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchProjects();
  }, [i18n.language]);

  // FIX 2: Indexing Sektor untuk Performa (O(1) lookup)
  const sectorLookup = useMemo(() => {
    const lookup: Record<string, string> = {};
    sections.forEach((s) => {
      lookup[s.id] = s.category;
    });
    return lookup;
  }, [sections]);

  // FIX 3: Memoized Filtering
  const filteredProjects = useMemo(() => {
    return projects.filter(
      (p) => categoryParam === "All" || p.category === categoryParam,
    );
  }, [projects, categoryParam]);

  const handleFilterChange = (id: string) => {
    if (id === "All") {
      searchParams.delete("category");
    } else {
      searchParams.set("category", id);
    }
    setSearchParams(searchParams);
  };

  return (
    <>
      <SEO
        title={`Projects - ${categoryParam !== "All" ? sectorLookup[categoryParam] : "Portfolios"}`}
        description="Explore PT Dharma Agung Wijaya Group's latest operational assets and sustainable solutions."
      />

      <div className="max-w-7xl mx-auto px-6 py-16 animate-in fade-in duration-500">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-serif font-bold text-slate-900 mb-4">
            DAW Projects & Portfolios
          </h1>
          <p className="text-slate-500 max-w-2xl mx-auto">
            Explore our latest operational assets, energy solutions, and
            resource management projects.
          </p>
        </div>

        {/* FIX 4: UI Filter Bar (PENTING!) */}
        {!isSectionsLoading && sections.length > 0 && (
          <div className="flex flex-wrap justify-center gap-3 mb-16">
            <button
              onClick={() => handleFilterChange("All")}
              className={`px-6 py-2.5 rounded-full text-xs font-black uppercase tracking-widest transition-all ${
                categoryParam === "All"
                  ? "bg-daw-green text-white shadow-lg shadow-green-900/20 scale-105"
                  : "bg-slate-100 text-slate-500 hover:bg-slate-200"
              }`}
            >
              All Sectors
            </button>
            {sections.map((sec) => (
              <button
                key={sec.id}
                onClick={() => handleFilterChange(sec.id)}
                className={`px-6 py-2.5 rounded-full text-xs font-black uppercase tracking-widest transition-all ${
                  categoryParam === sec.id
                    ? "bg-daw-green text-white shadow-lg shadow-green-900/20 scale-105"
                    : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                }`}
              >
                {sec.category}
              </button>
            ))}
          </div>
        )}

        {isLoading ? (
          <div className="py-20 text-center flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-4 border-daw-green border-t-transparent rounded-full animate-spin"></div>
            <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">
              Gathering Assets...
            </p>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="text-center text-slate-400 py-32 border-2 border-dashed border-slate-100 rounded-3xl">
            <Filter className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p className="font-bold">No projects found in this category.</p>
            <button
              onClick={() => handleFilterChange("All")}
              className="text-daw-green text-sm underline mt-2"
            >
              Clear all filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredProjects.map((project) => (
              <Link
                key={project.id}
                to={`/projects/${project.slug || project.id}`}
                className="group flex flex-col bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-sm hover:shadow-2xl transition-all duration-500 hover:-translate-y-2"
              >
                <div className="aspect-[4/3] w-full bg-slate-100 overflow-hidden relative">
                  {project.cover_image ? (
                    <img
                      src={getCleanImageUrl(project.cover_image)}
                      alt={project.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                      loading="lazy" // FIX 5: Performance Optimization
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300">
                      <ImageIcon className="w-10 h-10" />
                    </div>
                  )}
                  {/* FIX 6: Robust Category Badge */}
                  <div className="absolute top-4 left-4 bg-white/95 backdrop-blur-sm px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.15em] text-daw-green rounded-lg shadow-sm">
                    {sectorLookup[project.category] || "General Project"}
                  </div>
                </div>

                <div className="p-8 flex flex-col flex-1">
                  <p className="text-[10px] font-bold text-slate-400 mb-3 uppercase tracking-widest">
                    {new Date(project.createdAt).toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                  <h3 className="text-xl font-bold text-slate-900 mb-4 group-hover:text-daw-green transition-colors line-clamp-2 leading-snug">
                    {project.title}
                  </h3>

                  <div className="mt-auto pt-6 flex items-center text-xs font-black uppercase tracking-widest text-daw-green border-t border-slate-50">
                    Read Case Study
                    <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-2 transition-transform" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
