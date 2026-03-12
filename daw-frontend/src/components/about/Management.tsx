import { useTranslation } from "react-i18next";
import ScrollReveal from "../ScrollReveal";
import { useAbout } from "@/contexts/AboutContext";

export default function Management() {
  const { t } = useTranslation();
  const { managementTeam, isLoading } = useAbout();

  const getInitials = (name: string) => {
    if (!name) return "DW";
    const parts = name.split(" ");
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };

  const getImageUrl = (url: string | null) => {
    if (!url) return "";
    return `http://localhost:5000${url}`;
  };

  if (isLoading) {
    return (
      <div className="space-y-12 pb-20">
        <div className="animate-pulse flex flex-col md:flex-row gap-8">
          <div className="w-full md:w-1/3 aspect-[3/4] bg-slate-100 rounded-2xl"></div>
          <div className="w-full md:w-2/3 space-y-4 py-8">
            <div className="h-10 bg-slate-100 rounded w-1/2"></div>
            <div className="h-4 bg-slate-100 rounded w-1/4 mb-8"></div>
            <div className="h-4 bg-slate-100 rounded w-full"></div>
            <div className="h-4 bg-slate-100 rounded w-full"></div>
            <div className="h-4 bg-slate-100 rounded w-3/4"></div>
          </div>
        </div>
      </div>
    );
  }

  const chairman = managementTeam.find((p) => p.level === "chairman");
  const executiveDirectors = managementTeam
    .filter((p) => p.level === "director")
    .sort((a, b) => a.order - b.order);
  const divisionHeads = managementTeam
    .filter((p) => p.level === "division")
    .sort((a, b) => a.order - b.order);

  return (
    <div className="pb-20">
      {/* SECTION 1: CHAIRMAN (TOP) */}
      {chairman && (
        <div className="mb-12">
          <ScrollReveal direction="up" delay={0}>
            <h2 className="font-serif text-4xl text-slate-900 mb-12">
              {t("about.management.titleDirectors", "Board of Directors")}
            </h2>
          </ScrollReveal>

          <ScrollReveal direction="up" delay={150}>
            <div
              className={`grid grid-cols-1 ${chairman.photoUrl ? "md:grid-cols-12" : ""} gap-8 lg:gap-12 items-center`}
            >
              {/* Kiri: Tampil hanya jika ada foto */}
              {chairman.photoUrl && (
                <div className="md:col-span-5 lg:col-span-4">
                  <div className="aspect-[3/4] overflow-hidden rounded-xl border border-slate-100 shadow-lg group">
                    <img
                      src={getImageUrl(chairman.photoUrl)}
                      alt={chairman.name}
                      className="w-full h-full object-cover grayscale transition-all duration-700 transform group-hover:scale-105 group-hover:grayscale-0"
                    />
                  </div>
                </div>
              )}

              {/* Kanan: Deskripsi Dinamis */}
              <div
                className={`${chairman.photoUrl ? "md:col-span-7 lg:col-span-8" : "col-span-1"} flex flex-col justify-center`}
              >
                <h3 className="font-serif font-bold text-3xl lg:text-4xl text-slate-900 mb-2">
                  {chairman.name}
                </h3>
                <p className="font-sans text-[14px] font-bold text-daw-green uppercase tracking-[0.2em] mb-6">
                  {chairman.role}
                </p>
                <div className="w-12 h-1 bg-daw-green mb-8 rounded-full"></div>
                <p className="font-sans text-slate-600 text-[15px] lg:text-[16px] leading-relaxed whitespace-pre-line">
                  {chairman.description}
                </p>
              </div>
            </div>
          </ScrollReveal>
        </div>
      )}

      {/* =========================================
          SECTION 2: EXECUTIVE DIRECTORS (Premium Cards)
          ========================================= */}
      {executiveDirectors.length > 0 && (
        <div className="mb-5">
          <ScrollReveal direction="up" delay={0}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-10">
              {executiveDirectors.map((person, index) => (
                <ScrollReveal
                  key={person.id}
                  direction="up"
                  delay={index * 100}
                >
                  <div className="bg-white p-8 md:p-10 rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] hover:shadow-[0_20px_40px_rgb(0,0,0,0.06)] transition-all duration-500 hover:-translate-y-1.5 flex flex-col h-full group relative overflow-hidden">
                    {/* Top Accent Line */}
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-daw-green to-daw-green/40 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

                    {/* Avatar System (Photo or Initials) */}
                    <div className="w-20 h-20 mb-8 rounded-full overflow-hidden border-[3px] border-slate-50 shadow-md flex-shrink-0 bg-daw-green/5 flex items-center justify-center relative">
                      {person.photoUrl ? (
                        <img
                          src={getImageUrl(person.photoUrl)}
                          alt={person.name}
                          className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500"
                        />
                      ) : (
                        <span className="font-serif font-bold text-2xl text-daw-green/70 tracking-wider">
                          {getInitials(person.name)}
                        </span>
                      )}
                    </div>

                    <h3 className="font-serif font-bold text-2xl text-slate-900 mb-2 transition-colors group-hover:text-daw-green">
                      {person.name}
                    </h3>
                    <p className="font-sans text-[12px] font-bold text-daw-green uppercase tracking-[0.2em] mb-6">
                      {person.role}
                    </p>
                    <p className="font-sans text-slate-600 text-[15px] leading-relaxed flex-1 whitespace-pre-line">
                      {person.description}
                    </p>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </ScrollReveal>
        </div>
      )}

      {/* =========================================
          SECTION 3: DIVISION HEADS (Compact Grid)
          ========================================= */}
      {divisionHeads.length > 0 && (
        <div className="pt-16 border-t border-slate-100 relative">
          <ScrollReveal direction="up" delay={0}>
            <div className="flex items-center gap-4 mb-5">
              <h2 className="font-serif text-3xl lg:text-4xl text-slate-900">
                {t("about.management.titleDivision", "Division Heads")}
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 lg:gap-8">
              {divisionHeads.map((person, index) => (
                <ScrollReveal
                  key={person.id}
                  direction="up"
                  delay={index * 100}
                >
                  <div className="flex flex-col group bg-slate-50/50 hover:bg-white p-8 rounded-2xl border border-transparent hover:border-slate-100 hover:shadow-[0_10px_30px_rgba(0,0,0,0.04)] transition-all duration-300 h-full">
                    {/* Compact Avatar */}
                    <div className="w-16 h-16 mb-6 rounded-2xl overflow-hidden shadow-sm flex-shrink-0 bg-white border border-slate-100 flex items-center justify-center transform group-hover:-rotate-3 transition-transform duration-300">
                      {person.photoUrl ? (
                        <img
                          src={getImageUrl(person.photoUrl)}
                          alt={person.name}
                          className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500"
                        />
                      ) : (
                        <span className="font-serif font-bold text-lg text-slate-400 group-hover:text-daw-green transition-colors duration-300">
                          {getInitials(person.name)}
                        </span>
                      )}
                    </div>

                    <h3 className="font-serif font-bold text-xl text-slate-900 mb-1.5 transition-colors group-hover:text-daw-green">
                      {person.name}
                    </h3>
                    <p className="font-sans text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-4 group-hover:text-daw-green/70 transition-colors">
                      {person.role}
                    </p>
                    <p className="font-sans text-slate-600 text-[14px] leading-relaxed whitespace-pre-line">
                      {person.description}
                    </p>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </ScrollReveal>
        </div>
      )}
    </div>
  );
}
