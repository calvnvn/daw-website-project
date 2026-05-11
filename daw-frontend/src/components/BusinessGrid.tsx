import { useState, useEffect, useRef, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ArrowRight, ImageIcon } from "lucide-react";
import { Link } from "react-router-dom";
import ScrollReveal from "./ScrollReveal";
import { getCleanImageUrl } from "@/lib/utils";
import { useBusiness } from "@/contexts/BusinessContext";

export type FilterOption = string;

interface BusinessGridProps {
  filter?: FilterOption;
  hideFilters?: boolean;
}

export default function BusinessGrid({
  filter = "All",
  hideFilters = false,
}: BusinessGridProps) {
  const { t } = useTranslation();

  // 1. CONNECT TO GLOBAL CONTEXT
  const {
    sections,
    publicProjects,
    isLoading: isContextLoading,
  } = useBusiness();

  // 2. INTERNAL UI STATES
  const [activeFilter, setActiveFilter] = useState<FilterOption>(filter);
  const [prevFilter, setPrevFilter] = useState<FilterOption>(filter);
  const [underlineStyle, setUnderlineStyle] = useState({ left: 0, width: 0 });
  const tabsRef = useRef<(HTMLButtonElement | null)[]>([]);

  // Sync external prop changes to internal state
  if (filter !== prevFilter) {
    setPrevFilter(filter);
    setActiveFilter(filter);
  }

  // 3. BUILD DYNAMIC FILTERS
  // Generate tab options based on the active business sections in the DB.
  const filters = useMemo(() => {
    const baseFilters = [
      { label: t("business.filterAll", "All Projects"), value: "All" },
    ];

    const dynamicFilters = sections.map((sec) => ({
      label: sec.category,
      value: sec.id,
    }));

    return [...baseFilters, ...dynamicFilters];
  }, [sections, t]);

  // 4. CATEGORY LOOKUP MAP
  const sectorLookup = useMemo(() => {
    const map: Record<string, string> = {};
    sections.forEach((s) => (map[s.id] = s.category));
    return map;
  }, [sections]);

  // 5. TAB UNDERLINE ANIMATION LOGIC
  useEffect(() => {
    if (hideFilters || isContextLoading) return;
    const activeIndex = filters.findIndex((f) => f.value === activeFilter);

    if (activeIndex !== -1) {
      const activeTab = tabsRef.current[activeIndex];
      if (activeTab) {
        setUnderlineStyle({
          left: activeTab.offsetLeft,
          width: activeTab.clientWidth,
        });
      }
    }
  }, [activeFilter, filters, hideFilters, isContextLoading]);

  // 6. PROJECT FILTERING ENGINE
  // Filters the global publicProjects array based on the selected tab/filter prop.
  const filteredProjects = useMemo(() => {
    return publicProjects.filter((project) => {
      if (activeFilter === "All") return true;
      // Use case-insensitive comparison for safety
      return project.category.toLowerCase() === activeFilter.toLowerCase();
    });
  }, [publicProjects, activeFilter]);

  const isFourItems = filteredProjects.length === 4;

  return (
    <section
      className={`pb-24 ${hideFilters ? "pt-0 bg-transparent" : "pt-12 bg-[#F8F9FA]"} overflow-hidden`}>
      <div className="container mx-auto px-6">
        {/* --- OPTIONAL HEADER & TABS --- */}
        {!hideFilters && sections.length > 0 && (
          <ScrollReveal direction="up" delay={0}>
            <div className="flex flex-col items-center text-center gap-10 mb-12">
              <h2 className="text-4xl md:text-5xl font-serif text-slate-900 tracking-tight">
                {t("business.sectionTitle", "Our Businesses")}
              </h2>

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
                          : "text-slate-400 hover:text-daw-green/60"
                      }`}>
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </ScrollReveal>
        )}

        {/* --- CONTENT AREA --- */}
        {isContextLoading ? (
          // SKELETON LOADER
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="w-full aspect-[3/2] bg-slate-100 animate-pulse rounded-lg"
              />
            ))}
          </div>
        ) : filteredProjects.length > 0 ? (
          // PROJECT GRID
          <div className="flex flex-wrap justify-center gap-8">
            {filteredProjects.map((project, index) => (
              <ScrollReveal
                key={project.id}
                direction="up"
                delay={index * 100}
                className={`w-full md:w-[calc(50%-16px)] min-w-[320px] ${
                  isFourItems
                    ? "lg:w-[calc(50%-16px)] lg:max-w-[500px]"
                    : "lg:w-[calc(33.333%-22px)]"
                }`}>
                <Link
                  to={`/projects/${project.slug || project.id}`}
                  className="group bg-white rounded-[12px] border border-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:shadow-[0_20px_40px_rgba(0,0,0,0.08)] overflow-hidden transition-all duration-500 flex flex-col h-full hover:-translate-y-2">
                  <div className="relative w-full aspect-[3/2] overflow-hidden bg-slate-100">
                    {project.cover_image ? (
                      <img
                        src={getCleanImageUrl(project.cover_image)}
                        alt={project.title}
                        className="w-full h-full object-cover transition-transform duration-[1000ms] group-hover:scale-110"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-300">
                        <ImageIcon />
                      </div>
                    )}

                    {/* DISPLAY PRETTY SECTOR NAME */}
                    <div className="absolute top-4 left-4 bg-white/95 px-3 py-1.5 rounded-md text-[10px] uppercase tracking-wider font-black text-daw-green shadow-sm border border-slate-100">
                      {sectorLookup[project.category] || "Portfolio"}
                    </div>
                  </div>

                  <div className="p-8 flex flex-col flex-1">
                    <h3 className="text-xl font-serif text-slate-900 mb-3 leading-snug group-hover:text-daw-green transition-colors duration-300 line-clamp-2">
                      {project.title}
                    </h3>
                    <p className="text-slate-500 text-[14px] leading-relaxed mb-6 line-clamp-3">
                      {project.excerpt}
                    </p>
                    <div className="mt-auto flex items-center gap-2 text-daw-green font-bold text-[12px] uppercase tracking-widest">
                      <span>{t("business.readMore", "View Details")}</span>
                      <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-2" />
                    </div>
                  </div>
                </Link>
              </ScrollReveal>
            ))}
          </div>
        ) : (
          // EMPTY STATE
          <div className="text-center py-32 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
            <ImageIcon className="w-12 h-12 text-slate-200 mx-auto mb-4" />
            <p className="text-slate-400 font-medium">
              No assets found in this sector.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
