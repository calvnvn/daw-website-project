import { ChevronRight } from "lucide-react"; // useMemo dihapus dari import
import { useHome } from "@/contexts/HomeContext";
import { getCleanImageUrl } from "@/lib/utils";
import ScrollReveal from "@/components/ScrollReveal";
import { t } from "i18next";

interface GlobalHeroBannerProps {
  title: string;
  targetIndex: number;
  localFallback: string;
  dynamicImageUrl?: string; // Database-driven override for article-specific banners
}

export default function GlobalHeroBanner({
  title,
  targetIndex,
  localFallback,
  dynamicImageUrl,
}: GlobalHeroBannerProps) {
  const { slides, isLoading } = useHome();

  const activeImageUrl = (() => {
    // Priority 1: Database-driven dynamic image (e.g. article cover)
    if (dynamicImageUrl) return dynamicImageUrl;

    if (isLoading || !slides || slides.length === 0) {
      return localFallback;
    }

    const startIndex = Math.min(targetIndex, slides.length - 1);

    for (let i = startIndex; i >= 0; i--) {
      if (slides[i]?.imageUrl) {
        return getCleanImageUrl(slides[i].imageUrl!);
      }
    }

    return localFallback;
  })();

  return (
    <section className="relative h-[85vh] flex items-center justify-center overflow-hidden">
      {/* Background Image with Slow Zoom Animation & Parallax */}
      <div
        className="absolute inset-0 bg-cover bg-center transition-transform duration-700 hover:scale-105"
        style={{
          backgroundImage: `url(${activeImageUrl})`,
          backgroundAttachment: "fixed",
        }}
      />

      {/* DAW Green Overlay (Multiply for rich color blending) */}
      <div className="absolute inset-0 bg-daw-green/20 mix-blend-multiply" />

      {/* Gradient Overlay untuk keterbacaan teks */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-900/60 via-slate-900/40 to-slate-900/80" />

      {/* Text Content */}
      <div className="relative z-10 text-center px-6 max-w-5xl mt-16 animate-in fade-in slide-in-from-bottom-12 duration-1000">
        <ScrollReveal direction="up" delay={0}>
          <h1 className="text-5xl md:text-6xl lg:text-6xl font-serif font-bold text-white mb-10 leading-[1.1] tracking-tight drop-shadow-lg">
            {title}
          </h1>
        </ScrollReveal>

        <ScrollReveal direction="up" delay={200}>
          {/* Dekorasi Garis */}
          <div className="flex items-center justify-center gap-8">
            <div className="h-px w-16 bg-white/30" />
            <div className="w-3 h-3 border-2 border-daw-yellow rotate-45" />
            <div className="h-px w-16 bg-white/30" />
          </div>
        </ScrollReveal>
      </div>

      {/* Scroll Down Indicator */}
      <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-white/50 animate-bounce">
        <span className="text-[10px] font-bold tracking-widest uppercase">
          {t("ui.scroll", "Scroll to Explore")}
        </span>
        <ChevronRight className="rotate-90 w-4 h-4" />
      </div>
    </section>
  );
}
