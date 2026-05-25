import { useState, useRef, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import ScrollReveal from "../ScrollReveal";
import {
  ArrowRight,
  Calendar,
  ChevronDown,
  Trophy,
  Heart,
  Briefcase,
  Globe,
  Zap,
  Lightbulb,
  Shield,
  Star,
  Leaf,
  Target,
} from "lucide-react";
import { useAbout } from "@/contexts/AboutContext";
import { getCleanImageUrl } from "@/lib/utils";

const ICON_MAP: Record<string, React.ElementType> = {
  human: Heart,
  ethics: Briefcase,
  unity: Globe,
  speed: Zap,
  smart: Lightbulb,
  shield: Shield,
  star: Star,
  leaf: Leaf,
};

const toDisplayDate = (dateStr: string) => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
};

export default function Achievement() {
  const { t } = useTranslation();
  const { achievements } = useAbout();

  const [activeYear, setActiveYear] = useState("All Time");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Client-Side Sorting Engine
  const sortedAchievements = useMemo(() => {
    return [...achievements].sort((a, b) => {
      // Descending by year
      const yearDiff = Number(b.year) - Number(a.year);
      if (yearDiff !== 0) return yearDiff;
      // Ascending by title (alphabetical) as fallback
      return a.title.localeCompare(b.title);
    });
  }, [achievements]);

  // Derive available years dynamically from actual data
  const availableYears = useMemo(() => {
    return Array.from(new Set(sortedAchievements.map((a) => a.year)));
  }, [sortedAchievements]);

  const filteredData =
    activeYear === "All Time"
      ? sortedAchievements
      : sortedAchievements.filter((item) => item.year === activeYear);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="pb-16 w-full">
      {/*
        HEADER — With elegant stat counter integrated.
        The counter acts as a subtle, sophisticated data point.
      */}
      <ScrollReveal direction="up" delay={0}>
        <div className="flex items-start justify-between gap-4 md:gap-6 mb-3">
          <h2 className="font-serif text-3xl md:text-5xl text-slate-900 leading-tight">
            {t("about.achievement.title", "Achievements")}
          </h2>

          {/* STAT COUNTER — Editorial style, like a magazine pull quote */}
          <div className="hidden md:flex flex-col items-end shrink-0 pt-2">
            <span
              className="font-serif font-bold leading-none text-slate-900"
              style={{ fontSize: "clamp(2.5rem, 5vw, 3.5rem)" }}>
              {String(filteredData.length).padStart(2, "0")}
            </span>
            <span className="font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mt-1">
              {activeYear === "All Time"
                ? t("about.achievement.total")
                : t("about.achievement.inYear", { year: activeYear })}
            </span>
          </div>
        </div>
      </ScrollReveal>

      {/*
        THE FILTER BAR
        NOTE: Intentionally NOT wrapped in ScrollReveal.
        ScrollReveal uses CSS `transform` which creates a new stacking context,
        causing the dropdown popover to be clipped behind sibling elements.
        The `relative z-20` here ensures the dropdown always floats above the cards below.
      */}
      <div className="relative z-20 mb-14" ref={dropdownRef}>
        {/* TOP ROW: Divider line with floating pill */}
        <div className="flex items-center gap-4 border-b border-slate-200 pb-4">
          <span className="font-sans text-xs font-bold uppercase tracking-[0.2em] text-slate-400 shrink-0">
            {t("about.achievement.period")}
          </span>

          {/* PILL TRIGGER */}
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full border text-xs font-sans font-bold uppercase tracking-[0.18em] transition-all duration-300 ${
              isDropdownOpen
                ? "bg-daw-green text-white border-daw-green shadow-[0_6px_16px_-4px_rgba(0,75,35,0.35)]"
                : "bg-white text-daw-green border-daw-green/40 hover:border-daw-green hover:shadow-sm"
            }`}>
            <span>{activeYear === "All Time" ? t("about.achievement.allTime") : activeYear}</span>
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] ${isDropdownOpen ? "rotate-180" : ""}`}
            />
          </button>

          {/* Spacer to push count to the right */}
          <div className="flex-1" />

          {/* Mobile count (hidden on md+) */}
          <span className="md:hidden font-sans text-xs font-bold text-slate-500">
            <span className="text-slate-900">
              {String(filteredData.length).padStart(2, "0")}
            </span>{" "}
            {t("about.achievement.countLabel")}
          </span>
        </div>

        {/* DROPDOWN POPOVER */}
        <div
          className={`absolute top-full mt-2 left-0 w-52 bg-white border border-slate-100 rounded-2xl shadow-[0_30px_60px_-10px_rgba(0,0,0,0.12)] overflow-hidden z-50 transform origin-top-left transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] ${
            isDropdownOpen
              ? "opacity-100 scale-100 translate-y-0"
              : "opacity-0 scale-95 -translate-y-1 pointer-events-none"
          }`}>
          {/* All Time Option */}
          <button
            onClick={() => {
              setActiveYear("All Time");
              setIsDropdownOpen(false);
            }}
            className={`w-full text-left px-5 py-3.5 text-xs font-sans font-bold uppercase tracking-[0.18em] transition-colors duration-200 flex items-center justify-between ${
              activeYear === "All Time"
                ? "text-daw-green bg-daw-green/5"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}>
            <span>{t("about.achievement.allTime")}</span>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                activeYear === "All Time"
                  ? "bg-daw-green text-white"
                  : "bg-slate-100 text-slate-400"
              }`}>
              {sortedAchievements.length}
            </span>
          </button>

          <div className="mx-4 border-t border-slate-100" />

          {/* Dynamically generated — only years with actual data */}
          <div className="max-h-[220px] overflow-y-auto [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full">
            {availableYears.map((year) => {
              const count = sortedAchievements.filter(
                (a) => a.year === year,
              ).length;
              return (
                <button
                  key={year}
                  onClick={() => {
                    setActiveYear(year);
                    setIsDropdownOpen(false);
                  }}
                  className={`w-full text-left px-5 py-3 text-xs font-sans font-bold uppercase tracking-[0.18em] transition-colors duration-200 flex items-center justify-between group/item ${
                    activeYear === year
                      ? "text-daw-green bg-daw-green/5"
                      : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                  }`}>
                  <span>{year}</span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      activeYear === year
                        ? "bg-daw-green text-white"
                        : "bg-slate-100 text-slate-400 group-hover/item:bg-slate-200"
                    }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 
        MAIN LIST (THE PREMIUM HORIZONTAL LIST)
        Strictly neat, highly professional, easy to read.
      */}
      <div className="flex flex-col gap-6 md:gap-8">
        {filteredData.length > 0 ? (
          filteredData.map((item, index) => (
            <ScrollReveal key={item.id} direction="up" delay={index * 100}>
              <div className="relative bg-white p-5 md:p-8 rounded-2xl md:rounded-3xl border border-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.02)] hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.06)] transition-all duration-500 transform group-hover:-translate-y-1 flex flex-col md:flex-row gap-5 md:gap-8 lg:gap-10 group overflow-hidden items-center">
                {/* DECORATIVE ELEMENTS */}
                <div className="absolute top-0 left-0 w-1.5 h-0 bg-daw-green group-hover:h-full transition-all duration-500 rounded-l-3xl z-20"></div>
                <div className="absolute -right-4 -bottom-8 text-[120px] font-serif font-bold text-slate-50 opacity-60 pointer-events-none group-hover:text-daw-green/5 group-hover:scale-105 transition-all duration-700 z-0">
                  {item.year}
                </div>

                {/* IMAGE MEDIA */}
                <div className="w-full md:w-[35%] lg:w-[30%] shrink-0 z-10">
                  <div className="aspect-[16/10] md:aspect-[4/3] rounded-xl md:rounded-2xl overflow-hidden border border-slate-100 relative group-hover:shadow-lg transition-all duration-500">
                    <div className="absolute inset-0 bg-daw-green/0 group-hover:bg-daw-green/5 transition-colors duration-500 z-10 mix-blend-overlay" />
                    <img
                      src={item.imageUrl ? getCleanImageUrl(item.imageUrl) : ""}
                      alt={item.title}
                      className="w-full h-full object-cover transform scale-100 group-hover:scale-105 transition-transform duration-700 ease-[cubic-bezier(0.25,1,0.5,1)]"
                    />
                  </div>
                </div>

                {/* CONTENT NARRATIVE */}
                <div className="w-full md:w-[65%] lg:w-[70%] flex flex-col justify-center py-2 z-10">
                  {/* Meta Tags Row */}
                  <div className="flex flex-wrap items-center gap-4 mb-4 md:mb-5">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-daw-green/5 text-daw-green font-bold text-[11px] tracking-widest uppercase border border-daw-green/10 group-hover:bg-daw-green group-hover:text-white transition-colors duration-300">
                      {(() => {
                        const Icon = ICON_MAP[item.iconId || "star"] || Target;
                        return <Icon className="w-3.5 h-3.5" />;
                      })()}
                      <span>{item.category}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-400 text-xs font-sans font-bold tracking-widest uppercase">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{toDisplayDate(item.date)}</span>
                    </div>
                  </div>

                  {/* Title */}
                  <h3 className="font-serif text-xl md:text-3xl text-slate-900 leading-[1.3] mb-2 md:mb-4 group-hover:text-daw-green transition-colors duration-300 pr-0 lg:pr-8">
                    {item.title}
                  </h3>

                  {/* Description */}
                  <p className="font-sans text-slate-600 leading-relaxed text-sm md:text-base">
                    {item.description}
                  </p>

                  {/* Conditional: Read More link (only if a published article is linked) */}
                  {item.newsArticle &&
                    item.newsArticle.slug &&
                    item.newsArticle.status === "Published" && (
                      <div className="mt-5 pt-5 border-t border-slate-100">
                        <Link
                          to={`/news/${item.newsArticle.slug}`}
                          className="inline-flex items-center gap-2 px-5 py-2.5 border-2 border-daw-green text-daw-green hover:bg-daw-green hover:text-white rounded-xl text-[11px] font-black uppercase tracking-[0.15em] transition-all duration-300 shadow-sm hover:shadow-md group/btn">
                          <span>{t("ui.readMore")}</span>
                          <ArrowRight className="w-3.5 h-3.5 group-hover/btn:translate-x-1 transition-transform" />
                        </Link>
                      </div>
                    )}
                </div>
              </div>
            </ScrollReveal>
          ))
        ) : (
          <div className="py-20 text-center bg-slate-50/50 rounded-3xl border border-dashed border-slate-200">
            <Trophy className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500 font-sans tracking-wide">
              {t("about.achievement.noAwards")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
