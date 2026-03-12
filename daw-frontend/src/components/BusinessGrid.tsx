import { useState, useEffect, useRef, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ArrowRight, ImageIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import ScrollReveal from "./ScrollReveal";

type FilterOption = "All" | "Resources" | "Energy";

interface BusinessGridProps {
  filter?: FilterOption;
  hideFilters?: boolean;
}

// Interface untuk data dari backend
interface ProjectData {
  id: string;
  title: string;
  category: FilterOption;
  excerpt: string;
  cover_image: string | null;
  createdAt: string;
}

export default function BusinessGrid({
  filter = "All",
  hideFilters = false,
}: BusinessGridProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 👇 2. Pasang tipe data di state
  const [activeFilter, setActiveFilter] = useState<FilterOption>(filter);
  const [prevFilter, setPrevFilter] = useState<FilterOption>(filter);

  if (filter !== prevFilter) {
    setPrevFilter(filter);
    setActiveFilter(filter);
  }

  const [underlineStyle, setUnderlineStyle] = useState({ left: 0, width: 0 });
  const tabsRef = useRef<(HTMLButtonElement | null)[]>([]);

  // 👇 3. Pasang tipe data di array useMemo
  const filters = useMemo<{ label: string; value: FilterOption }[]>(
    () => [
      { label: t("business.filterAll", "All Projects"), value: "All" },
      { label: t("business.filterResources", "Resources"), value: "Resources" },
      { label: t("business.filterEnergy", "Energy"), value: "Energy" },
    ],
    [t],
  );

  useEffect(() => {
    fetch("http://localhost:5000/api/projects/public")
      .then((res) => res.json())
      .then((data: ProjectData[]) => setProjects(data))
      .catch((err) => console.error("Gagal memuat projects:", err))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    if (hideFilters) return;
    const activeIndex = filters.findIndex((f) => f.value === activeFilter);
    const activeTab = tabsRef.current[activeIndex];
    if (activeTab) {
      setUnderlineStyle({
        left: activeTab.offsetLeft,
        width: activeTab.clientWidth,
      });
    }
  }, [activeFilter, filters, hideFilters]);

  const filteredProjects = projects.filter(
    (project) => activeFilter === "All" || project.category === activeFilter,
  );

  const isFourItems = filteredProjects.length === 4;

  return (
    <section
      className={`pb-24 ${hideFilters ? "pt-0 bg-transparent" : "pt-12 bg-[#F8F9FA]"} overflow-hidden`}
    >
      <div className="container mx-auto px-6">
        {!hideFilters && (
          <ScrollReveal direction="up" delay={0}>
            <div className="flex flex-col items-center text-center gap-10 mb-12">
              <div className="max-w-3xl">
                <h2 className="text-4xl md:text-5xl font-serif text-slate-900 tracking-tight">
                  {t("business.sectionTitle", "Our Businesses")}
                </h2>
              </div>

              <div className="relative flex justify-center">
                <div className="relative flex items-center gap-10 border-b border-slate-200">
                  <span
                    className="absolute bottom-[-1px] h-[2.5px] bg-daw-green transition-all duration-500 ease-[cubic-bezier(0.45,0,0.55,1)]"
                    style={{
                      left: `${underlineStyle.left}px`,
                      width: `${underlineStyle.width}px`,
                    }}
                  />

                  {filters.map((f, index) => (
                    <button
                      key={f.value}
                      ref={(el) => {
                        tabsRef.current[index] = el;
                      }}
                      onClick={() => setActiveFilter(f.value)}
                      className={`relative pb-4 text-[14px] font-bold uppercase tracking-[0.15em] transition-colors duration-300 z-10 ${
                        activeFilter === f.value
                          ? "text-daw-green"
                          : "text-slate-400 hover:text-slate-900"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </ScrollReveal>
        )}

        {isLoading ? (
          <div className="text-center py-20 text-slate-500">
            Loading projects...
          </div>
        ) : (
          <div className="flex flex-wrap justify-center gap-8">
            {filteredProjects.map((project, index) => {
              // 👇 Excerpt
              <p className="text-slate-500 text-[14px] font-light leading-relaxed mb-6 flex-1 line-clamp-3">
                {project.excerpt || "No description available."}
              </p>;

              return (
                <ScrollReveal
                  key={project.id}
                  direction="up"
                  delay={index * 150}
                  className={`w-full md:w-[calc(50%-16px)] min-w-[320px] ${
                    isFourItems
                      ? "lg:w-[calc(50%-16px)] lg:max-w-[500px]"
                      : "lg:w-[calc(33.333%-22px)]"
                  }`}
                >
                  <div
                    onClick={() => navigate(`/projects/${project.id}`)}
                    className="group bg-white rounded-[8px] border border-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] overflow-hidden transition-all duration-500 flex flex-col h-full cursor-pointer hover:-translate-y-1"
                  >
                    <div className="relative w-full aspect-[3/2] overflow-hidden bg-slate-100 flex items-center justify-center">
                      {project.cover_image ? (
                        <img
                          src={`http://localhost:5000/uploads/${project.cover_image}`}
                          alt={project.title}
                          className="w-full h-full object-cover transition-transform duration-[800ms] ease-out group-hover:scale-105"
                        />
                      ) : (
                        <ImageIcon className="w-10 h-10 text-slate-300" />
                      )}
                      <div className="absolute top-4 left-4 bg-white/95 backdrop-blur-sm px-3 py-1.5 rounded-[4px] text-[11px] uppercase tracking-wider font-bold text-slate-700 shadow-sm">
                        {project.category}
                      </div>
                    </div>

                    <div className="p-6 flex flex-col flex-1">
                      <h3 className="text-xl font-serif text-slate-900 mb-3 leading-snug group-hover:text-daw-green transition-colors duration-300 line-clamp-2">
                        {project.title}
                      </h3>
                      <p className="text-slate-500 text-[14px] font-light leading-relaxed mb-6 flex-1 line-clamp-3">
                        {project.excerpt}
                      </p>
                      <div className="mt-auto inline-flex items-center gap-2 text-daw-green font-semibold text-[14px]">
                        <span>{t("business.readMore", "Read More")}</span>
                        <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1.5 transition-transform duration-300" />
                      </div>
                    </div>
                  </div>
                </ScrollReveal>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
