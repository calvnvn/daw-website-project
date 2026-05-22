import { useMemo, memo } from "react";
import DOMPurify from "dompurify";
import ScrollReveal from "@/components/ScrollReveal";
import InteractiveMap from "@/components/businesses/InteractiveMap";
import { type SectionData } from "@/contexts/BusinessContext";

interface BusinessLivePreviewProps {
  formData: Omit<SectionData, "id">;
  categories: any[];
}

const BusinessLivePreview = memo(function BusinessLivePreview({
  formData,
  categories,
}: BusinessLivePreviewProps) {
  const safeHtmlContent = useMemo(() => {
    const raw = (formData.htmlContent || "").replace(/&nbsp;|\u00A0/g, " ");
    return DOMPurify.sanitize(raw);
  }, [formData.htmlContent]);

  return (
    <div className="flex flex-col w-full relative bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden mt-6">
      {/* 1. CINEMATIC BACKGROUND EFFECTS */}
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-daw-green/[0.04] via-transparent to-transparent pointer-events-none"></div>
      <div className="absolute top-[20%] right-[-5%] w-[400px] h-[400px] bg-[#D97706]/[0.02] rounded-full blur-[100px] pointer-events-none hidden lg:block"></div>

      {/* --- BAGIAN 1: EDITORIAL TEXT LAYOUT --- */}
      <div className="container mx-auto px-6 max-w-7xl pt-10 lg:pt-16 pb-12 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 xl:gap-24 items-start w-full">
          {/* KOLOM KIRI: Judul Utama */}
          <div className="lg:col-span-5 lg:sticky lg:top-32 relative">
            <ScrollReveal direction="up" delay={0}>
              <div className="flex items-center gap-3 mb-4 md:mb-6">
                <span className="w-10 h-[3px] bg-gradient-to-r from-daw-green to-emerald-400 rounded-full shadow-sm"></span>
                <h3 className="text-[11px] md:text-xs font-sans font-extrabold text-daw-green uppercase tracking-[0.25em]">
                  {formData.title || "Judul Utama Sektor..."}
                </h3>
              </div>

              <h2 className="text-4xl md:text-5xl lg:text-[4.5rem] xl:text-[5rem] font-serif font-bold text-transparent bg-clip-text bg-gradient-to-br from-[#004B23] via-[#006E33] to-[#10B981] leading-[1.05] tracking-tight drop-shadow-sm pb-2">
                {formData.category || "Nama Sektor"}
              </h2>
            </ScrollReveal>
          </div>

          {/* KOLOM KANAN: Rich Text Content */}
          <div className="lg:col-span-7 min-w-0 relative pt-4 lg:pt-0">
            <div className="hidden lg:block absolute left-0 top-2 bottom-8 w-[1px] bg-gradient-to-b from-daw-green/20 via-slate-200 to-transparent -ml-8 xl:-ml-12"></div>
            <ScrollReveal direction="up" delay={150}>
              <div
                className={[
                  "w-full min-w-0 max-w-[65ch] text-left selection:bg-[#004B23] selection:text-white",
                  "prose prose-lg md:prose-xl max-w-none daw-editorial-content",
                  "break-words whitespace-normal",
                  "prose-headings:font-serif prose-headings:font-bold prose-headings:tracking-tight prose-headings:mb-5 prose-headings:mt-8",
                  "prose-h2:text-transparent prose-h2:bg-clip-text prose-h2:bg-gradient-to-r prose-h2:from-[#004B23] prose-h2:to-[#10B981]",
                  "prose-h3:text-slate-800",
                  "prose-p:mb-6 prose-p:font-sans prose-p:font-normal prose-p:text-slate-600 prose-p:leading-[1.85] prose-p:!text-left",
                  "[&_img]:rounded-2xl [&_img]:shadow-md [&_img]:transition-all [&_img]:duration-700 hover:[&_img]:scale-[1.02]",
                  "prose-strong:font-bold prose-strong:text-slate-900",
                  "prose-a:font-semibold prose-a:text-daw-green hover:prose-a:text-emerald-500",
                ].join(" ")}
                dangerouslySetInnerHTML={{
                  __html: safeHtmlContent || "<p class='text-slate-400 italic'>Konten belum diisi...</p>",
                }}
              />
            </ScrollReveal>
          </div>
        </div>
      </div>

      {/* --- BAGIAN 2: INTERACTIVE MAP --- */}
      {formData.hasMap && formData.mapMarkers && formData.mapMarkers.length > 0 && (
        <div className="w-full relative py-12 z-10">
          <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:20px_20px] opacity-40 -z-10"></div>
          <div className="container mx-auto px-6 max-w-7xl">
            <ScrollReveal direction="up" delay={200}>
              <div className="relative group">
                <div className="absolute -inset-2 bg-gradient-to-r from-[#004B23]/10 via-[#10B981]/10 to-[#D97706]/10 rounded-[2.5rem] blur-[25px] opacity-40 group-hover:opacity-60 transition duration-700"></div>
                <div className="relative bg-white/95 backdrop-blur-md rounded-[2rem] shadow-[0_15px_50px_-15px_rgba(0,0,0,0.1)] border border-slate-100/50 p-6 md:p-10 transition-transform duration-500 hover:-translate-y-1">
                  <InteractiveMap
                    markers={formData.mapMarkers}
                    categories={categories}
                  />
                </div>
              </div>
            </ScrollReveal>
          </div>
        </div>
      )}
      
      {/* SIMULATED PORTFOLIO GRID PREVIEW */}
      <div className="container mx-auto px-6 max-w-7xl pt-16 pb-20 relative z-10 border-t border-slate-100">
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
              {formData.category || "Nama Sektor"} Projects
            </h2>
          </ScrollReveal>
        </div>
        <p className="text-center text-sm text-slate-400 italic">
          (Daftar proyek riil dari sektor ini akan ditampilkan di area ini pada halaman publik)
        </p>
      </div>
    </div>
  );
});

export default BusinessLivePreview;
