import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowRight,
  Globe2,
  Briefcase,
  GraduationCap,
  Coffee,
} from "lucide-react";
import ScrollReveal from "@/components/ScrollReveal";
import { useInvestments } from "@/contexts/InvestmentContext";

export default function InvestmentsSection() {
  const { t } = useTranslation();
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);

  const { settings, companies, isLoading } = useInvestments();

  const categories = [
    { id: "fnb", icon: <Coffee className="w-5 h-5" />, key: "fnb" },
    { id: "steel", icon: <Briefcase className="w-5 h-5" />, key: "steel" },
    { id: "finance", icon: <Globe2 className="w-5 h-5" />, key: "finance" },
    { id: "edu", icon: <GraduationCap className="w-5 h-5" />, key: "edu" },
  ];

  const getLogoUrl = (url: string | null) => {
    if (!url) return ""; // Bisa taruh gambar placeholder di sini
    return `http://localhost:5000${url}`;
  };

  if (isLoading)
    return (
      <div className="h-96 flex justify-center items-center text-white">
        Loading ecosystem...
      </div>
    );

  return (
    <div className="relative w-full py-10">
      {/* --- BACKGROUND EFFECTS --- */}
      {/* Efek jaring/grid halus khas teknologi */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none"></div>
      {/* Orb cahaya hijau samar di tengah */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-daw-green/20 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-16 lg:gap-20 items-center">
        {/* KIRI: Daftar Kategori (The Controller) */}
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
                  className={`group relative flex items-center gap-6 p-4 rounded-2xl cursor-pointer transition-all duration-500 overflow-hidden ${
                    hoveredCategory === cat.id
                      ? "bg-white/10 border-white/20 shadow-[0_0_30px_rgba(0,255,128,0.1)]"
                      : "bg-transparent border-transparent hover:bg-white/5"
                  } border`}
                >
                  {/* Indikator Garis Kiri Aktif */}
                  <div
                    className={`absolute left-0 top-0 bottom-0 w-1 bg-emerald-500 transition-transform duration-300 origin-left ${hoveredCategory === cat.id ? "scale-y-100" : "scale-y-0"}`}
                  ></div>

                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center backdrop-blur-md transition-colors duration-500 ${
                      hoveredCategory === cat.id
                        ? "bg-emerald-500/20 text-emerald-400"
                        : "bg-white/5 text-slate-400"
                    }`}
                  >
                    {cat.icon}
                  </div>

                  <div className="flex-1">
                    <h4
                      className={`font-serif text-lg transition-colors duration-500 ${
                        hoveredCategory === cat.id
                          ? "text-white"
                          : "text-slate-300"
                      }`}
                    >
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

        {/* KANAN: Jaringan Logo Perusahaan (The Constellation) */}
        <div className="lg:col-span-7 relative">
          <ScrollReveal direction="left" delay={300}>
            {/* Grid Box Glassmorphism */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6 p-6 md:p-8 rounded-[2.5rem] bg-white/5 border border-white/10 backdrop-blur-xl shadow-2xl">
              {companies.map((company) => {
                const isHovered = hoveredCategory === company.category;
                const isAnyHovered = hoveredCategory !== null;

                const opacityClass = isAnyHovered
                  ? isHovered
                    ? "opacity-100 scale-105"
                    : "opacity-20 grayscale scale-95"
                  : "opacity-80 grayscale hover:grayscale-0 hover:opacity-100";
                const borderClass = isHovered
                  ? "border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.15)] bg-white/10"
                  : "border-white/5 bg-white/5";

                return (
                  <div
                    key={company.id}
                    className={`relative flex flex-col items-center justify-center aspect-square md:aspect-[4/3] rounded-2xl p-4 transition-all duration-700 ease-[cubic-bezier(0.4,0,0.2,1)] ${opacityClass} ${borderClass}`}
                  >
                    <div className="w-16 h-16 mb-3 rounded-full bg-slate-300 flex items-center justify-center text-slate-500 text-xs text-center border border-white/10 font-bold overflow-hidden">
                      <img
                        src={getLogoUrl(company.logoUrl)}
                        alt={company.name}
                        className="w-full h-full object-contain p-2"
                      />
                    </div>

                    <h5 className="font-sans text-[12px] md:text-[13px] font-bold text-center text-white leading-tight">
                      {company.name}
                    </h5>
                    {company.desc && (
                      <p className="text-[9px] md:text-[10px] text-slate-400 text-center mt-1 leading-tight">
                        {company.desc}
                      </p>
                    )}
                  </div>
                );
              })}

              {companies.length === 0 && (
                <div className="col-span-full text-center text-slate-400 italic py-10">
                  No affiliated companies found.
                </div>
              )}
            </div>
          </ScrollReveal>
        </div>
      </div>
    </div>
  );
}
