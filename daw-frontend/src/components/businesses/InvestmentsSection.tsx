import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowRight,
  Globe2,
  Briefcase,
  GraduationCap,
  Coffee,
  X,
  Maximize2,
} from "lucide-react";
import ScrollReveal from "@/components/ScrollReveal";
import { useInvestments } from "@/contexts/InvestmentContext";
import { getCleanImageUrl } from "@/lib/utils";

export default function InvestmentsSection() {
  const { t } = useTranslation();
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<any | null>(null);
  const { settings, companies, isLoading } = useInvestments();
  const sortedCompanies = useMemo(() => {
    if (!companies) return [];

    return [...companies].sort((a, b) => {
      // Prioritas 1: Kelompokkan berdasarkan Sektor (Sesuai urutan yang kamu minta)
      const categoryWeight: Record<string, number> = {
        finance: 3,
        fnb: 1,
        steel: 2,
        edu: 4,
      };

      const weightA = categoryWeight[a.category] || 99;
      const weightB = categoryWeight[b.category] || 99;

      if (weightA !== weightB) return weightA - weightB;

      // Prioritas 2: Urutkan berdasarkan Abjad Nama (A - Z)
      return (a.name || "").localeCompare(b.name || "");
    });
  }, [companies]);
  const categories = [
    { id: "fnb", icon: <Coffee className="w-5 h-5" />, key: "fnb" },
    { id: "steel", icon: <Briefcase className="w-5 h-5" />, key: "steel" },
    { id: "finance", icon: <Globe2 className="w-5 h-5" />, key: "finance" },
    { id: "edu", icon: <GraduationCap className="w-5 h-5" />, key: "edu" },
  ];

  if (isLoading)
    return (
      <div className="h-96 flex flex-col justify-center items-center text-white gap-6">
        <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
        <p className="animate-pulse tracking-[0.3em] text-[10px] uppercase font-bold text-emerald-500/60">
          Syncing Ecosystem
        </p>
      </div>
    );

  return (
    <div className="relative w-full py-10 overflow-hidden max-w-full">
      {/* --- BACKGROUND EFFECTS --- */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none"></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] md:w-[600px] h-[300px] md:h-[600px] bg-daw-green/20 rounded-full blur-[80px] md:blur-[120px] pointer-events-none z-0"></div>

      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-16 lg:gap-20 items-center">
        {/* KIRI: Daftar Kategori */}
        <div className="lg:col-span-5 space-y-10">
          <ScrollReveal direction="up" delay={0}>
            <div className="space-y-6 mb-12">
              <h3 className="text-sm font-sans font-bold text-emerald-400 uppercase tracking-[0.2em]">
                Diversified Ecosystem
              </h3>
              <p className="font-sans text-slate-300 text-[16px] leading-relaxed font-light">
                {settings?.sectionIntro ||
                  t("businessesPage.investments.intro")}
              </p>
            </div>
          </ScrollReveal>

          <ScrollReveal direction="up" delay={200}>
            <div className="flex flex-col space-y-2">
              {categories.map((cat) => (
                <div
                  key={cat.id}
                  onMouseEnter={() => setHoveredCategory(cat.id)}
                  onMouseLeave={() => setHoveredCategory(null)}
                  className={`group relative flex items-center gap-6 p-4 rounded-2xl cursor-pointer transition-all duration-500 overflow-hidden border ${
                    hoveredCategory === cat.id
                      ? "bg-white/10 border-white/20 shadow-[0_0_30px_rgba(16,185,129,0.15)]"
                      : "bg-white/5 border-white/10 lg:bg-transparent lg:border-transparent lg:hover:bg-white/5"
                  }`}>
                  <div
                    className={`absolute left-0 top-0 bottom-0 w-1 bg-emerald-500 transition-transform duration-300 origin-left ${hoveredCategory === cat.id ? "scale-y-100" : "scale-y-0"}`}></div>

                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center backdrop-blur-md transition-colors duration-500 ${
                      hoveredCategory === cat.id
                        ? "bg-emerald-500/20 text-emerald-400"
                        : "bg-white/5 text-slate-400"
                    }`}>
                    {cat.icon}
                  </div>

                  <div className="flex-1">
                    <h4
                      className={`font-serif text-lg transition-colors duration-500 ${
                        hoveredCategory === cat.id
                          ? "text-white"
                          : "text-slate-300"
                      }`}>
                      {t(`businessesPage.investments.categories.${cat.key}`)}
                    </h4>
                  </div>

                  <ArrowRight
                    className={`w-5 h-5 transition-all duration-500 ${
                      hoveredCategory === cat.id
                        ? "text-emerald-400 translate-x-0 opacity-100"
                        : "text-slate-600 -translate-x-4 opacity-0"
                    }`}
                  />
                </div>
              ))}
            </div>
          </ScrollReveal>
        </div>

        {/* KANAN: Jaringan Logo Perusahaan */}
        <div className="lg:col-span-7 relative">
          <ScrollReveal direction="left" delay={300}>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6 p-6 md:p-8 rounded-[2.5rem] bg-white/5 border border-white/10 backdrop-blur-xl shadow-2xl">
              {sortedCompanies.map((company) => {
                const isHovered = hoveredCategory === company.category;
                const isAnyHovered = hoveredCategory !== null;

                const opacityClass = isAnyHovered
                  ? isHovered
                    ? "opacity-100 scale-105"
                    : "opacity-30 scale-95"
                  : "opacity-100";

                const borderClass = isHovered
                  ? "border-emerald-500/50 shadow-[0_0_25px_rgba(16,185,129,0.2)] bg-white/10"
                  : "border-white/5 bg-white/5 hover:border-white/20";

                return (
                  <div
                    key={company.id}
                    onClick={() => setSelectedCompany(company)}
                    className={`group/card relative flex flex-col items-center justify-center aspect-square md:aspect-[4/3] rounded-2xl p-4 cursor-pointer hover:-translate-y-1.5 transition-all duration-700 ease-[cubic-bezier(0.4,0,0.2,1)] overflow-hidden ${opacityClass} ${borderClass}`}>
                    {/* --- NEW: VISUAL HINT OVERLAY (HOVER EFFECT) --- */}
                    <div className="absolute inset-0 bg-emerald-950/60 opacity-0 group-hover/card:opacity-100 transition-opacity duration-500 z-10 flex items-center justify-center backdrop-blur-[2px]">
                      <div className="bg-emerald-500 text-white p-3 rounded-full shadow-[0_0_20px_rgba(16,185,129,0.5)] transform translate-y-8 group-hover/card:translate-y-0 transition-transform duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]">
                        <Maximize2 className="w-5 h-5" />
                      </div>
                    </div>

                    <div className="w-16 h-16 mb-3 rounded-full bg-white flex items-center justify-center shadow-lg overflow-hidden border border-white/20 relative z-0">
                      {company.logoUrl ? (
                        <img
                          src={getCleanImageUrl(company.logoUrl)}
                          alt={company.name}
                          className="w-full h-full object-contain p-3"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                        />
                      ) : (
                        <div className="text-[10px] text-slate-300 font-bold">
                          NO LOGO
                        </div>
                      )}
                    </div>

                    <h5 className="font-sans text-[12px] md:text-[13px] font-bold text-center text-white leading-tight relative z-0">
                      {company.name}
                    </h5>
                    {company.desc && (
                      <p className="text-[9px] md:text-[10px] text-slate-400 text-center mt-1 leading-tight relative z-0">
                        {company.desc}
                      </p>
                    )}
                  </div>
                );
              })}

              {sortedCompanies.length === 0 && (
                <div className="col-span-full text-center text-slate-400 italic py-10">
                  No affiliated companies found.
                </div>
              )}
            </div>
          </ScrollReveal>
        </div>
      </div>

      {/* --- LEVEL UP: PREMIUM ENLARGE LOGO MODAL (DARK DAW GREEN EDITION) --- */}
      {selectedCompany && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#000a03]/95 animate-in fade-in duration-200"
          onClick={() => setSelectedCompany(null)}>
          <div
            // GANTI: Box menggunakan solid background agar tidak mentransparansi elemen di belakangnya
            className="relative bg-[#001a0a] border border-daw-green/30 p-8 md:p-14 rounded-[3rem] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)] max-w-sm md:max-w-lg w-full flex flex-col items-center animate-in zoom-in-95 slide-in-from-bottom-4 duration-400 ease-out"
            onClick={(e) => e.stopPropagation()}>
            {/* Ambient Lighting - Disederhanakan: Pakai radial gradient saja (lebih ringan dari blur filter) */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,rgba(0,75,35,0.15)_0%,transparent_50%)] pointer-events-none"></div>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_100%_100%,rgba(0,75,35,0.1)_0%,transparent_50%)] pointer-events-none"></div>

            {/* Interactive Close Button */}
            <button
              onClick={() => setSelectedCompany(null)}
              className="absolute top-6 right-6 p-2.5 rounded-full bg-white/5 hover:bg-daw-green/20 border border-white/10 hover:border-daw-green/40 text-emerald-100/50 hover:text-white transition-all duration-200 group z-20">
              <X className="w-5 h-5 group-hover:rotate-90 transition-transform duration-200" />
            </button>

            {/* Logo Container with Pulsating Rings */}
            <div className="relative w-36 h-36 md:w-52 md:h-52 mb-8 mt-2 z-10 flex items-center justify-center">
              {/* Ring statis (Pengganti ping animation jika masih dirasa berat) */}
              <div className="absolute inset-0 rounded-full border border-daw-green/20"></div>
              <div className="absolute -inset-3 rounded-full border border-daw-green/5"></div>

              {/* Core Logo Wrapper */}
              <div className="relative w-full h-full rounded-full bg-white flex items-center justify-center shadow-2xl overflow-hidden p-8 border border-white/10 transition-transform duration-300 hover:scale-105 active:scale-95">
                {selectedCompany?.logoUrl ? (
                  <img
                    src={getCleanImageUrl(selectedCompany.logoUrl)}
                    alt={selectedCompany?.name || "Company Logo"}
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                ) : (
                  <div className="text-slate-200">No Image</div>
                )}
              </div>
            </div>

            {/* Typography Section */}
            <h3 className="text-3xl md:text-4xl font-serif font-bold text-white mb-4 text-center z-10 tracking-tight">
              {selectedCompany?.name}
            </h3>

            {selectedCompany?.websiteUrl && (
              <a
                href={selectedCompany.websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="z-10 mb-8 flex items-center gap-2 px-8 py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full font-bold text-sm transition-all shadow-[0_10px_25px_-5px_rgba(16,185,129,0.4)] active:scale-95 group/btn">
                <Globe2 className="w-4 h-4 group-hover/btn:rotate-12 transition-transform" />
                VISIT WEBSITE
              </a>
            )}

            {/* Premium Category Badge */}
            <div className="z-10 px-6 py-2 rounded-full bg-daw-green/20 border border-daw-green/40 text-emerald-300 text-[10px] md:text-xs font-bold uppercase tracking-[0.2em]">
              {t(
                `businessesPage.investments.categories.${selectedCompany?.category}`,
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
