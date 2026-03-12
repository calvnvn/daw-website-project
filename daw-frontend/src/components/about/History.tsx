import { useTranslation } from "react-i18next";
import ScrollReveal from "../ScrollReveal";
import { useAbout } from "@/contexts/AboutContext";
import { Calendar } from "lucide-react";

export default function History() {
  const { t } = useTranslation();
  const { companyHistory, isLoading } = useAbout();

  if (isLoading) {
    return (
      <div className="space-y-8">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="animate-pulse h-40 bg-slate-50 rounded-2xl border border-slate-100"
          ></div>
        ))}
      </div>
    );
  }

  return (
    <div className="pb-12">
      <ScrollReveal direction="up" delay={0}>
        <div className="flex items-center gap-4 mb-14">
          <h2 className="font-serif text-4xl md:text-5xl text-slate-900">
            {t("about.history.title", "Our Journey")}
          </h2>
        </div>
      </ScrollReveal>

      {/* MAIN TIMELINE CONTAINER */}
      <div className="relative pl-4 md:pl-8 space-y-10 md:space-y-14">
        {/* THE GLOWING GRADIENT LINE */}
        {companyHistory.length > 0 && (
          <div className="absolute left-[23px] md:left-[39px] top-6 bottom-0 w-[2px] bg-gradient-to-b from-daw-green via-daw-green/40 to-transparent rounded-full"></div>
        )}

        <ScrollReveal direction="up" delay={150}>
          {companyHistory.length > 0 ? (
            <div className="space-y-10 md:space-y-14">
              {companyHistory.map((item) => (
                <div key={item.id} className="relative pl-12 md:pl-20 group">
                  {/* 1. THE NODE (Glowing Dot on Hover) */}
                  <div className="absolute left-0 md:left-4 top-2 md:top-4 w-10 h-10 rounded-full bg-white border-[3px] border-slate-100 flex items-center justify-center group-hover:border-daw-green/30 transition-all duration-500 z-10 shadow-[0_0_15px_rgba(0,0,0,0.03)] group-hover:shadow-[0_0_20px_rgba(0,75,35,0.15)] group-hover:scale-110">
                    <div className="w-3 h-3 rounded-full bg-slate-300 group-hover:bg-daw-green transition-colors duration-500"></div>
                  </div>

                  {/* 2. THE CARD (Interactive Hover State) */}
                  <div className="relative bg-white p-8 md:p-10 rounded-3xl border border-slate-100 shadow-sm hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] transition-all duration-500 transform group-hover:-translate-y-1.5 overflow-hidden">
                    {/* Watermark Year (Giant Background Text) */}
                    <div className="absolute -right-6 -bottom-10 text-[100px] md:text-[140px] font-serif font-bold text-slate-50 opacity-60 select-none pointer-events-none group-hover:text-daw-green/5 group-hover:scale-110 transition-all duration-700 origin-bottom-right">
                      {item.year}
                    </div>

                    <div className="relative z-10">
                      {/* Year Badge */}
                      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-daw-green/5 text-daw-green font-bold text-sm tracking-widest mb-5 border border-daw-green/10 group-hover:bg-daw-green group-hover:text-white transition-colors duration-300">
                        <Calendar className="w-4 h-4" />
                        <span>{item.year}</span>
                      </div>

                      {/* Description Content */}
                      <p className="font-sans text-slate-600 leading-relaxed text-[15px] md:text-lg whitespace-pre-line group-hover:text-slate-800 transition-colors duration-300 relative z-10">
                        {item.description}
                      </p>
                    </div>

                    {/* Decorative corner accent on hover */}
                    <div className="absolute top-0 left-0 w-1.5 h-0 bg-daw-green group-hover:h-full transition-all duration-500 rounded-l-3xl"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="pl-12 text-slate-500 italic bg-slate-50 p-8 rounded-2xl border border-dashed border-slate-200 text-center">
              The journey is about to begin. No timeline data available yet.
            </div>
          )}
        </ScrollReveal>
      </div>
    </div>
  );
}
