import ScrollReveal from "@/components/ScrollReveal";
import BusinessGrid from "@/components/BusinessGrid";
import InteractiveMap, { type MapMarker } from "./InteractiveMap";

export interface SectionData {
  id: string;
  category: "Resources" | "Energy";
  title: string;
  htmlContent: string;
  hasMap: boolean;
  mapMarkers?: MapMarker[];
}

export default function DynamicBusinessSection({
  data,
}: {
  data: SectionData;
}) {
  return (
    <div className="flex flex-col w-full relative bg-white">
      {/* 1. CINEMATIC BACKGROUND EFFECTS */}
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-daw-green/[0.04] via-transparent to-transparent pointer-events-none"></div>
      <div className="absolute top-[20%] right-[-5%] w-[400px] h-[400px] bg-[#D97706]/[0.02] rounded-full blur-[100px] pointer-events-none hidden lg:block"></div>

      {/* --- BAGIAN 1: EDITORIAL TEXT LAYOUT (THE FIX) --- */}
      <div className="container mx-auto px-6 max-w-7xl pt-16 pb-12 relative z-10 overflow-hidden lg:overflow-visible">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 xl:gap-24 items-start w-full">
          {/* KOLOM KIRI: Judul Utama (Sticky, Bold, & Premium Gradient) */}
          <div className="lg:col-span-5 lg:sticky lg:top-32 relative">
            <ScrollReveal direction="up" delay={0}>
              <div className="flex items-center gap-3 mb-4 md:mb-6">
                <span className="w-10 h-[3px] bg-gradient-to-r from-daw-green to-emerald-400 rounded-full shadow-sm"></span>
                <h3 className="text-[11px] md:text-xs font-sans font-extrabold text-daw-green uppercase tracking-[0.25em]">
                  {data.title}
                </h3>
              </div>

              {/* H2 GRADIENT SUPER MEWAH */}
              <h2 className="text-5xl md:text-6xl lg:text-[4.5rem] xl:text-[5rem] font-serif font-bold text-transparent bg-clip-text bg-gradient-to-br from-[#004B23] via-[#006E33] to-[#10B981] leading-[1.05] tracking-tight drop-shadow-sm pb-2">
                {data.category}
                <span className="block text-3xl md:text-4xl lg:text-5xl xl:text-6xl text-slate-300 italic font-light mt-2 md:mt-3">
                  Division
                </span>
              </h2>
            </ScrollReveal>
          </div>
          {/* KOLOM KANAN: Rich Text Content (Tipografi Editorial) */}
          {/* FIX KRUSIAL: min-w-0 wajib ada untuk mencegah CSS Grid Blowout! */}
          <div className="lg:col-span-7 min-w-0 relative pt-4 lg:pt-0">
            <div className="hidden lg:block absolute left-0 top-2 bottom-8 w-[1px] bg-gradient-to-b from-daw-green/20 via-slate-200 to-transparent -ml-8 xl:-ml-12"></div>
            <ScrollReveal direction="up" delay={150}>
              <div
                // PERUBAHAN 2 (KUNCI UTAMA): max-w-[65ch] untuk panjang baris bacaan yang sempurna!
                className="w-full min-w-0 max-w-[65ch] selection:bg-[#004B23] selection:text-white
                  [&_*]:break-words [&_*]:max-w-full [&_img]:rounded-2xl [&_img]:shadow-md [&_img]:transition-all [&_img]:duration-700 hover:[&_img]:scale-[1.02] hover:[&_img]:shadow-2xl [&_img]:ring-1 [&_img]:ring-slate-100
                  
                  prose prose-lg md:prose-xl max-w-none 
                  prose-headings:font-serif prose-headings:font-bold prose-headings:tracking-tight prose-headings:mb-5 prose-headings:mt-8
                  prose-h2:text-transparent prose-h2:bg-clip-text prose-h2:bg-gradient-to-r prose-h2:from-[#004B23] prose-h2:to-[#10B981]
                  prose-h3:text-slate-800 prose-p:mb-12
                  
                  /* Jarak antar baris (leading) dilegakan jadi 1.85 agar tidak sumpek */
                  prose-p:font-sans prose-p:font-normal prose-p:text-slate-600 prose-p:leading-[1.85] prose-p:mb-6 prose-p:text-justify prose-p:hyphens-auto
                  
                  prose-strong:font-bold prose-strong:text-slate-900 
                  prose-a:font-semibold prose-a:text-daw-green hover:prose-a:text-emerald-500 prose-a:transition-colors prose-a:underline-offset-4
                  prose-ul:list-disc prose-ul:pl-5 prose-li:text-slate-600 prose-li:marker:text-[#10B981]
                  prose-blockquote:border-l-4 prose-blockquote:border-daw-green prose-blockquote:bg-slate-50/80 prose-blockquote:py-4 prose-blockquote:px-6 prose-blockquote:text-slate-800 prose-blockquote:font-serif prose-blockquote:text-xl prose-blockquote:italic prose-blockquote:rounded-r-2xl prose-blockquote:shadow-sm"
                dangerouslySetInnerHTML={{ __html: data.htmlContent }}
              />
            </ScrollReveal>
          </div>
        </div>
      </div>

      {/* --- BAGIAN 2: INTERACTIVE MAP (TETAP SAMA, SUDAH SEMPURNA) --- */}
      {data.hasMap && data.mapMarkers && data.mapMarkers.length > 0 && (
        <div className="w-full relative py-12 z-10">
          <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:20px_20px] opacity-40 -z-10"></div>
          <div className="container mx-auto px-6 max-w-7xl">
            <ScrollReveal direction="up" delay={200}>
              <div className="relative group">
                <div className="absolute -inset-2 bg-gradient-to-r from-[#004B23]/10 via-[#10B981]/10 to-[#D97706]/10 rounded-[2.5rem] blur-[25px] opacity-40 group-hover:opacity-60 transition duration-700"></div>
                <div className="relative bg-white/95 backdrop-blur-md rounded-[2rem] shadow-[0_15px_50px_-15px_rgba(0,0,0,0.1)] border border-slate-100/50 p-6 md:p-10 transition-transform duration-500 hover:-translate-y-1">
                  <InteractiveMap markers={data.mapMarkers} />
                </div>
              </div>
            </ScrollReveal>
          </div>
        </div>
      )}

      {/* --- BAGIAN 3: PORTFOLIO GRID --- */}
      <div className="container mx-auto px-6 max-w-7xl pt-16 pb-24 relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <ScrollReveal direction="up" delay={0}>
            <div className="flex items-center justify-center gap-4 mb-4">
              <span className="w-16 h-[2px] bg-gradient-to-l from-daw-green to-transparent rounded-l-full"></span>
              <h3 className="text-[11px] md:text-xs font-extrabold text-slate-400 uppercase tracking-[0.3em]">
                Discover Our Work
              </h3>
              <span className="w-16 h-[2px] bg-gradient-to-r from-daw-green to-transparent rounded-r-full"></span>
            </div>
            <h2 className="text-4xl md:text-5xl font-serif font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-[#004B23] to-[#006E33] tracking-tight pb-2">
              {data.category} Projects
            </h2>
          </ScrollReveal>
        </div>

        <ScrollReveal direction="up" delay={200}>
          <BusinessGrid filter={data.category} hideFilters />
        </ScrollReveal>
      </div>
    </div>
  );
}
