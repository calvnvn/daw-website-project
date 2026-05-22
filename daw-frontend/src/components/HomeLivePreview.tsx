import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { ArrowRight, ChevronDown } from "lucide-react";
import * as Icons from "lucide-react";
import ScrollReveal from "./ScrollReveal";
import logoDaw from "@/assets/logo-daw.png";
import { BASE_UPLOAD_URL } from "@/lib/api";

interface HomeLivePreviewProps {
  type: "hero" | "intro" | "stats";
  data: any; 
}

// --- AnimatedNumber Helper for Stats ---
function AnimatedNumber({ text, locale }: { text: string; locale: string }) {
  const [count, setCount] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  const match = text.match(/^(\D*)(\d+(?:[.,]\d+)*)(\D*)$/);
  const target = match ? parseFloat(match[2].replace(/[,.]/g, "")) : 0;

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible || target === 0) return;
    let startTimestamp: number | null = null;
    let animationFrameId: number;
    const duration = 2000;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const easeProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setCount(easeProgress * target);

      if (progress < 1) {
        animationFrameId = window.requestAnimationFrame(step);
      } else {
        setCount(target);
      }
    };
    animationFrameId = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(animationFrameId);
  }, [isVisible, target]);

  if (!match) return <span ref={ref}>{text}</span>;

  const prefix = match[1];
  const suffix = match[3];
  const formatLocale = locale.startsWith("id") ? "id-ID" : "en-US";
  const displayNum = Math.floor(count).toLocaleString(formatLocale);

  return (
    <span ref={ref}>
      {prefix}
      {displayNum}
      {suffix}
    </span>
  );
}

export default function HomeLivePreview({ type, data }: HomeLivePreviewProps) {
  const { t, i18n } = useTranslation();

  // --- 1. HERO PREVIEW ---
  if (type === "hero") {
    const slides = data || [];
    const displaySlides = slides.filter((s: any) => !s.isDeleting);
    
    // Auto-slide simulasi
    const [currentSlide, setCurrentSlide] = useState(0);
    useEffect(() => {
      if (displaySlides.length <= 1) return;
      const timer = setInterval(() => {
        setCurrentSlide((prev) => (prev === displaySlides.length - 1 ? 0 : prev + 1));
      }, 5000);
      return () => clearInterval(timer);
    }, [displaySlides.length]);

    const getImageUrl = (slide: any) => {
      if (slide.previewUrl) return slide.previewUrl;
      if (slide.imageUrl) {
        const filename = slide.imageUrl.split("/").pop();
        const cleanBase = BASE_UPLOAD_URL.replace(/\/$/, "");
        return `${cleanBase}/${filename}`;
      }
      return null;
    };

    if (displaySlides.length === 0) {
      return (
        <div className="h-[500px] bg-slate-900 rounded-xl flex items-center justify-center border border-slate-200">
          <p className="text-white/50 uppercase tracking-widest font-bold text-sm">Belum ada slide aktif</p>
        </div>
      );
    }

    return (
      <div className="relative h-[600px] w-full overflow-hidden bg-slate-900 rounded-xl border border-slate-200 shadow-md group">
        {displaySlides.map((slide: any, index: number) => {
          const isActive = index === currentSlide;
          const imgUrl = getImageUrl(slide);

          return (
            <div
              key={slide.id || index}
              className={`absolute inset-0 w-full h-full transition-opacity duration-1000 ease-in-out ${
                isActive ? "opacity-100 z-0" : "opacity-0 -z-10"
              }`}
            >
              <div className="absolute inset-0 w-full h-full">
                {imgUrl ? (
                  <img
                    src={imgUrl}
                    alt={slide.title}
                    className={`absolute inset-0 w-full h-full object-cover object-center transition-transform duration-[10000ms] ease-out ${
                      isActive ? "scale-110" : "scale-100"
                    }`}
                  />
                ) : (
                  <div className="absolute inset-0 w-full h-full bg-slate-800" />
                )}
              </div>
              <div className="absolute inset-0 bg-[#004B23]/20 mix-blend-multiply" />
              <div className="absolute bottom-0 left-0 right-0 h-2/3 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
              <div className="absolute top-0 left-0 right-0 h-48 bg-gradient-to-b from-black/70 to-transparent" />
            </div>
          );
        })}

        <div className="container mx-auto px-10 relative z-10 h-full flex flex-col justify-center pb-10">
          <div className="max-w-3xl mt-16 flex flex-col items-center md:items-start text-center md:text-left mx-auto md:mx-0">
            <h1
              key={`title-${currentSlide}`}
              className="text-4xl md:text-5xl font-serif font-bold text-white leading-[1.15] mb-6 animate-fade-in-up"
              style={{ textShadow: "0 4px 20px rgba(0,0,0,0.5)" }}
            >
              {displaySlides[currentSlide]?.title || "Judul Utama Slide"}
            </h1>
            <p
              key={`sub-${currentSlide}`}
              className="text-lg text-slate-200 mb-10 leading-relaxed font-light max-w-2xl animate-fade-in-up animation-delay-200"
            >
              {displaySlides[currentSlide]?.subtitle || "Deskripsi singkat sub-judul slide ini."}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 animate-fade-in-up animation-delay-400">
              <Button
                size="lg"
                className="group bg-daw-green hover:bg-[#003b1c] text-white rounded-full px-8 py-6 text-[13px] tracking-wide font-bold shadow-lg flex items-center pointer-events-none"
              >
                Explore Our Businesses
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Indicators */}
        {displaySlides.length > 1 && (
          <div className="absolute bottom-10 left-0 right-0 z-20 flex flex-col items-center gap-4">
            <div className="flex justify-center gap-3">
              {displaySlides.map((_: any, index: number) => (
                <button
                  key={index}
                  onClick={() => setCurrentSlide(index)}
                  className={`h-2 rounded-full transition-all duration-500 ease-out ${
                    index === currentSlide
                      ? "w-12 bg-daw-green shadow-[0_0_10px_rgba(0,166,81,0.5)]"
                      : "w-3 bg-white/30 hover:bg-daw-yellow"
                  }`}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- 2. INTRO PREVIEW ---
  if (type === "intro") {
    const settings = data || {};
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden relative">
        <div className="absolute top-20 right-0 w-[400px] h-[400px] bg-daw-green/[0.03] rounded-full blur-[80px] -z-10 pointer-events-none" />
        <section className="py-20 lg:py-24">
          <div className="container mx-auto px-6 max-w-6xl">
            <div className="flex flex-col lg:flex-row gap-12 lg:gap-24 items-center">
              <div className="lg:w-1/3 pt-5 items-center mx-auto text-center">
                <ScrollReveal direction="up" delay={0}>
                  <img src={logoDaw} alt="DAW Logo" className="h-32 md:h-40 w-auto object-contain mb-2 opacity-90 mx-auto" />
                </ScrollReveal>
                <ScrollReveal direction="up" delay={150}>
                  <div className="w-40 h-1 bg-daw-green mb-4 rounded-full mx-auto"></div>
                  <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] text-center">
                    {t("intro.tagline", "Our Logo")}
                  </h3>
                </ScrollReveal>
              </div>

              <div className="lg:w-2/3">
                <ScrollReveal direction="up" delay={100}>
                  <h2 className="text-3xl md:text-4xl lg:text-[46px] font-serif text-slate-900 tracking-tight leading-[1.15] mb-8">
                    {settings.introHeadline || "Judul Sambutan Utama Akan Muncul di Sini"}
                  </h2>
                </ScrollReveal>
                <ScrollReveal direction="up" delay={250}>
                  <p className="text-lg md:text-xl text-slate-500 font-light leading-relaxed mb-12 max-w-3xl whitespace-pre-line">
                    {settings.introBody || "Paragraf narasi dan isi dari teks sambutan akan mengisi ruang ini secara proporsional. Spasi enter atau baris baru akan dihormati oleh komponen ini."}
                  </p>
                </ScrollReveal>
                <ScrollReveal direction="up" delay={400}>
                  <div className="group inline-flex items-center gap-3 text-daw-green text-[14px] font-bold uppercase tracking-wide transition-colors">
                    <span>{t("intro.cta", "Learn More")}</span>
                    <ArrowRight className="w-4 h-4 transform group-hover:translate-x-2 transition-transform duration-300" />
                  </div>
                </ScrollReveal>
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  }

  // --- 3. STATS PREVIEW ---
  if (type === "stats") {
    const stats = data || [];
    
    if (stats.length === 0) {
      return (
        <div className="py-20 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center">
          <p className="text-slate-400 uppercase tracking-widest font-bold text-xs">Belum ada data statistik aktif</p>
        </div>
      );
    }

    const getGridLayout = (count: number) => {
      switch (count) {
        case 1: return "grid-cols-1 max-w-sm mx-auto";
        case 2: return "grid-cols-1 md:grid-cols-2 max-w-3xl mx-auto";
        case 3: return "grid-cols-1 md:grid-cols-3 max-w-5xl mx-auto";
        case 4: default: return "grid-cols-2 md:grid-cols-2 lg:grid-cols-4";
      }
    };
    const gridClass = getGridLayout(stats.length);

    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden py-16 lg:py-24">
        <div className="container mx-auto px-6 max-w-7xl">
          <div className={`grid gap-y-12 gap-x-6 lg:gap-y-0 lg:gap-x-0 lg:divide-x divide-slate-200 ${gridClass}`}>
            {stats.map((stat: any, index: number) => {
              const Icon = (Icons as any)[stat.icon] || Icons.HelpCircle;
              return (
                <ScrollReveal
                  key={stat.id || index}
                  direction="up"
                  delay={index * 150}
                  className={`group flex flex-col items-center text-center px-2 lg:px-8 xl:px-12 ${index !== 0 ? "lg:pt-0" : ""}`}
                >
                  <Icon className="w-10 h-10 text-daw-green mb-6 stroke-[1.5px] opacity-80 transition-all duration-300 group-hover:-translate-y-1 group-hover:opacity-100 group-hover:drop-shadow-md" />
                  <h3 className="text-3xl lg:text-4xl font-serif text-slate-900 mb-4 tracking-tight">
                    <AnimatedNumber text={stat.value || "0"} locale={i18n.language} />
                  </h3>
                  <p className="text-[13px] font-bold text-slate-800 uppercase tracking-wide mb-3">
                    {stat.label || "STATISTIC LABEL"}
                  </p>
                  <p className="text-[14px] text-slate-500 font-light leading-relaxed max-w-[250px]">
                    {stat.desc || "A short description of this particular impact statistic."}
                  </p>
                </ScrollReveal>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return null;
}
