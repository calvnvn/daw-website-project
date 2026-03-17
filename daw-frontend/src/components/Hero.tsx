import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { ArrowRight, ChevronDown } from "lucide-react";
import { Link } from "react-router-dom";
import { useHome } from "@/contexts/HomeContext";

import fallbackSlide from "@/assets/hero-slide-1.jpg";
import ScrollReveal from "./ScrollReveal";
// 🚀 1. Import helper sakti kita
import { getCleanImageUrl } from "@/lib/utils";

export default function Hero() {
  const { t } = useTranslation();
  const { slides, isLoading } = useHome();

  const [currentSlide, setCurrentSlide] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  // const [isPaused, setIsPaused] = useState(false); // 🚀 2. State untuk Pause on Hover

  // Parallax Logic
  useEffect(() => {
    const handleScroll = () => {
      // Optimasi: Hanya render parallax jika sedang di area Hero (hemat CPU)
      if (window.scrollY < window.innerHeight) {
        requestAnimationFrame(() => setOffsetY(window.scrollY));
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // 🚀 Auto-Play Logic
  useEffect(() => {
    if (slides.length <= 1) return;

    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev === slides.length - 1 ? 0 : prev + 1));
    }, 6000);

    return () => clearInterval(timer);
  }, [slides.length]);

  const handleScrollDown = () => {
    window.scrollBy({ top: window.innerHeight, behavior: "smooth" });
  };

  // 4. getCleanImageUrl dengan fallback

  if (isLoading)
    return (
      <section className="h-screen w-full bg-slate-900 flex items-center justify-center">
        {/* Loading yang lebih elegan daripada sekadar hitam */}
        <div className="w-16 h-16 border-4 border-daw-green/30 border-t-daw-green rounded-full animate-spin"></div>
      </section>
    );

  const displaySlides =
    slides.length > 0
      ? slides
      : [
          {
            id: "default",
            title: t("hero.slide1.title", "Building a Sustainable Future"),
            subtitle: t(
              "hero.slide1.subtitle",
              "Innovating energy and resources for tomorrow.",
            ),
            imageUrl: null,
          },
        ];

  return (
    <section
      className="relative h-screen min-h-[600px] w-full overflow-hidden bg-slate-900 group"
      // 🚀 5. Pause auto-slide saat mouse di area Hero
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* --- PRELOADER HACK --- */}
      {/* Memaksa browser download gambar pertama secepat mungkin */}
      <div className="hidden">
        {displaySlides[0]?.imageUrl && (
          <img
            src={getCleanImageUrl(displaySlides[0].imageUrl)}
            alt="preload"
          />
        )}
      </div>

      {/* Layer Pict & Overlay */}
      {displaySlides.map((slide, index) => {
        const isActive = index === currentSlide;
        const imgUrl = slide.imageUrl
          ? getCleanImageUrl(slide.imageUrl)
          : fallbackSlide;

        return (
          <div
            key={slide.id}
            className={`absolute inset-0 w-full h-full transition-opacity duration-1000 ease-in-out ${
              isActive ? "opacity-100 z-0" : "opacity-0 -z-10"
            }`}
          >
            <div
              className="absolute inset-0 w-full h-full"
              style={{
                transform: `translate3d(0, ${offsetY * 0.4}px, 0)`, // Gunakan translate3d untuk Hardware Acceleration
                willChange: "transform",
              }}
            >
              {/* LAYER ZOOM */}
              <div
                className={`absolute inset-0 w-full h-[110%] -top-[5%] bg-cover bg-center bg-no-repeat transition-transform duration-[10000ms] ease-out will-change-transform ${
                  isActive ? "scale-110" : "scale-100"
                }`}
                style={{ backgroundImage: `url('${imgUrl}')` }}
              />
            </div>
            {/* OVERLAY */}
            <div className="absolute inset-0 bg-[#004B23]/20 mix-blend-multiply" />
            <div className="absolute bottom-0 left-0 right-0 h-2/3 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
            <div className="absolute top-0 left-0 right-0 h-48 bg-gradient-to-b from-black/70 to-transparent" />
          </div>
        );
      })}

      {/* Layer Content & Text */}
      <div className="container mx-auto px-10 relative z-10 h-full flex flex-col justify-center pb-20">
        <ScrollReveal direction="up" delay={0}>
          <div className="max-w-4xl mt-16 flex flex-col items-center md:items-start text-center md:text-left mx-auto md:mx-0">
            <h1
              key={`title-${currentSlide}`}
              className="text-4xl md:text-5xl lg:text-[64px] font-serif font-bold text-white leading-[1.15] mb-6 animate-fade-in-up"
              style={{ textShadow: "0 4px 20px rgba(0,0,0,0.5)" }}
            >
              {displaySlides[currentSlide].title}
            </h1>

            <p
              key={`sub-${currentSlide}`}
              className="text-lg md:text-xl text-slate-200 mb-10 leading-relaxed font-light max-w-2xl animate-fade-in-up animation-delay-200"
            >
              {displaySlides[currentSlide].subtitle}
            </p>

            <div className="flex flex-col sm:flex-row gap-4 animate-fade-in-up animation-delay-400 mt-4">
              <Link to="/businesses">
                <Button
                  size="lg"
                  className="group bg-daw-green hover:bg-[#003b1c] text-white rounded-full px-8 py-6.5 text-[13px] tracking-wide font-bold shadow-lg transition-transform hover:-translate-y-1 border-0 flex items-center"
                >
                  {t("hero.ctaPrimary", "Explore Our Businesses")}
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1.5" />
                </Button>
              </Link>
              <Link to="/about?tab=company">
                <Button
                  size="lg"
                  variant="outline"
                  className="bg-transparent border-2 border-white/80 text-white hover:bg-white hover:text-slate-900 rounded-full px-8 py-6 text-[14px] tracking-wide font-bold shadow-lg transition-all duration-300 hover:-translate-y-1 backdrop-blur-sm"
                >
                  {t("hero.ctaSecondary", "Discover Our Vision")}
                </Button>
              </Link>
            </div>
          </div>
        </ScrollReveal>
      </div>

      {/* Slider Indicator & Controls */}
      {displaySlides.length > 1 && (
        <div className="absolute bottom-20 left-0 right-0 z-20 flex flex-col items-center gap-4">
          <div className="flex justify-center gap-3">
            {displaySlides.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentSlide(index)}
                className={`h-2 rounded-full transition-all duration-500 ease-out ${
                  index === currentSlide
                    ? "w-12 bg-daw-green shadow-[0_0_10px_rgba(0,166,81,0.5)]"
                    : "w-3 bg-white/30 hover:bg-white/60"
                }`}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Scroll Down Indicator */}
      <div
        onClick={handleScrollDown}
        className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center opacity-70 hover:opacity-100 transition-opacity cursor-pointer animate-bounce"
      >
        <span className="text-[10px] uppercase tracking-widest text-white mb-1 font-semibold">
          Scroll
        </span>
        <ChevronDown className="h-5 w-5 text-white" />
      </div>
    </section>
  );
}
