import { useTranslation } from "react-i18next";
import ScrollReveal from "../ScrollReveal";
import { useAbout } from "@/contexts/AboutContext";
import { getCleanImageUrl } from "@/lib/utils";
import { useEffect, useState } from "react";
import { Maximize2, X } from "lucide-react";

export default function Management() {
  const { t } = useTranslation();
  const { managementTeam, isLoading } = useAbout();

  const [selectedPerson, setSelectedPerson] = useState<any | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedPerson(null);
    };
    if (selectedPerson) window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedPerson]);

  const getInitials = (name: string) => {
    if (!name) return "DW";
    const parts = name.split(" ");
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
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
                  <div
                    onClick={() => setSelectedPerson(chairman)}
                    className="aspect-[3/4] overflow-hidden rounded-xl border border-slate-100 shadow-lg group relative cursor-pointer"
                  >
                    {/* Overlay Hover Icon */}
                    <div className="absolute inset-0 bg-[#002411]/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10 flex items-center justify-center backdrop-blur-[2px]">
                      <div className="bg-daw-green text-white p-4 rounded-full shadow-lg transform translate-y-4 group-hover:translate-y-0 transition-all duration-300">
                        <Maximize2 className="w-6 h-6" />
                      </div>
                    </div>
                    <img
                      src={getCleanImageUrl(chairman.photoUrl)}
                      alt={chairman.name}
                      className="w-full h-full object-cover transition-all duration-700 transform group-hover:scale-105 relative z-0"
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
                    <div
                      onClick={() => setSelectedPerson(person)}
                      className="w-20 h-20 mb-8 rounded-full overflow-hidden border-[3px] border-slate-50 shadow-md flex-shrink-0 bg-daw-green/5 flex items-center justify-center relative group/avatar cursor-pointer"
                    >
                      {/* Overlay Hover */}
                      <div className="absolute inset-0 bg-[#002411]/70 opacity-0 group-hover/avatar:opacity-100 transition-opacity duration-300 z-10 flex items-center justify-center">
                        <Maximize2 className="w-4 h-4 text-white" />
                      </div>
                      {person.photoUrl ? (
                        <img
                          src={getCleanImageUrl(person.photoUrl)}
                          alt={person.name}
                          className="w-full h-full object-cover transition-all duration-500 relative z-0"
                        />
                      ) : (
                        <span className="font-serif font-bold text-2xl text-daw-green/70 tracking-wider relative z-0">
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
                    <div
                      onClick={() => setSelectedPerson(person)}
                      className="w-16 h-16 mb-6 rounded-2xl overflow-hidden shadow-sm flex-shrink-0 bg-white border border-slate-100 flex items-center justify-center transform group-hover:-rotate-3 transition-transform duration-300 relative cursor-pointer group/avatar"
                    >
                      {/* Overlay Hover Icon (Consistent with Board) */}
                      <div className="absolute inset-0 bg-daw-green/60 opacity-0 group-hover/avatar:opacity-100 transition-opacity duration-300 z-10 flex items-center justify-center">
                        <Maximize2 className="w-4 h-4 text-white" />
                      </div>
                      {person.photoUrl ? (
                        <img
                          src={getCleanImageUrl(person.photoUrl)}
                          alt={person.name}
                          className="w-full h-full object-cover transition-all duration-500"
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
      {/* =========================================
          ULTRA PREMIUM: THE ONYX DOSSIER (DARK MODE PORTFOLIO STYLE)
          (Bleeding Edge Photo, Gradient Masking, Cinematic Dark Theme)
          ========================================= */}
      {selectedPerson && (
        <div
          // Backdrop super gelap pekat (Nyaris hitam pekat dengan hint hijau)
          className="fixed inset-0 z-[100] flex items-center justify-center p-0 md:p-8 bg-[#000502]/75 animate-in fade-in duration-500"
          onClick={() => setSelectedPerson(null)}
        >
          {/* THE MONOLITHIC DARK CONTAINER */}
          <div
            // Di mobile full screen (p-0), di desktop jadi floating card melengkung
            className="relative bg-[#001206] w-full max-w-6xl h-full md:h-auto md:max-h-[85vh] md:rounded-[2rem] shadow-[0_30px_100px_rgba(0,0,0,0.8)] flex flex-col md:flex-row overflow-y-auto custom-scrollbar border-0 md:border md:border-white/5 animate-in zoom-in-[0.98] slide-in-from-bottom-12 duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Minimalist Glass Close Button */}
            <button
              onClick={() => setSelectedPerson(null)}
              className="absolute top-4 right-4 md:top-8 md:right-8 p-3 bg-black/20 hover:bg-daw-green/40 backdrop-blur-md rounded-full text-white/70 hover:text-white transition-all duration-300 z-50 group border border-white/10"
            >
              <X className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
            </button>

            {/* LEFT SIDE: Bleeding Edge Portrait */}
            <div className="w-full md:w-1/2 h-[55vh] md:h-auto shrink-0 relative md:sticky md:top-0 md:h-[85vh]">
              {selectedPerson.photoUrl ? (
                <>
                  {/* Foto full mentok ke ujung layar/container */}
                  <img
                    src={getCleanImageUrl(selectedPerson.photoUrl)}
                    alt={selectedPerson.name}
                    className="w-full h-full object-cover object-top"
                  />
                  {/* Gradient Masking: Ilusi foto melebur ke kegelapan teks */}
                  {/* Fade ke bawah untuk mobile */}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#001206] via-[#001206]/40 to-transparent md:hidden"></div>
                  {/* Fade ke kanan untuk desktop */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#001206]/20 to-[#001206] hidden md:block"></div>
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#003B1C] to-[#001206] relative">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.05)_0%,transparent_60%)]"></div>
                  <span className="font-serif font-bold text-8xl text-white/20">
                    {getInitials(selectedPerson.name)}
                  </span>
                </div>
              )}
            </div>

            {/* RIGHT SIDE: Dark Themed Executive Typography */}
            <div className="relative w-full md:w-1/2 p-8 md:p-12 lg:p-20 flex flex-col justify-center min-h-min -mt-20 md:mt-0 z-10">
              {/* Outline Watermark (Gaya tipografi brutalism/modern) */}
              <div className="absolute top-0 right-0 p-8 md:p-12 pointer-events-none select-none z-0 opacity-20">
                <span
                  className="font-serif font-bold text-8xl md:text-[12rem] text-transparent"
                  style={{ WebkitTextStroke: "2px rgba(255,255,255,0.1)" }}
                >
                  {getInitials(selectedPerson.name)}
                </span>
              </div>

              {/* Content Wrapper */}
              <div className="relative z-10 flex flex-col">
                {/* Jabatan */}
                <div className="flex items-center gap-4 mb-6 animate-in fade-in slide-in-from-right-8 duration-700 [animation-delay:300ms] [animation-fill-mode:both]">
                  <span className="w-12 h-[1px] bg-emerald-400/50"></span>
                  <p className="text-emerald-400 tracking-[0.4em] uppercase text-xs font-bold drop-shadow-[0_0_10px_rgba(16,185,129,0.5)]">
                    {selectedPerson.role}
                  </p>
                </div>

                {/* Nama */}
                <h3 className="font-serif text-5xl md:text-6xl lg:text-7xl font-bold text-white leading-[1.05] tracking-tight mb-10 animate-in fade-in slide-in-from-right-10 duration-700 [animation-delay:450ms] [animation-fill-mode:both]">
                  {selectedPerson.name}
                </h3>

                {/* Deskripsi */}
                <div className="animate-in fade-in slide-in-from-bottom-8 duration-700 [animation-delay:600ms] [animation-fill-mode:both]">
                  <p className="text-slate-300/90 font-sans text-base md:text-lg leading-[1.9] md:leading-[2.1] whitespace-pre-line font-light">
                    {selectedPerson.description}
                  </p>
                </div>

                {/* Aesthetic Detail Box (Makin terlihat seperti portofolio interaktif) */}
                <div className="mt-12 flex gap-4 animate-in fade-in duration-1000 [animation-delay:800ms] [animation-fill-mode:both]">
                  <div className="h-10 w-[2px] bg-daw-green"></div>
                  <div className="flex flex-col justify-between py-0.5">
                    <span className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">
                      Executive Profile
                    </span>
                    <span className="text-[10px] text-emerald-500 uppercase tracking-widest">
                      DAW Group
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
