import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import SEO from "@/components/SEO";
import { useHome } from "@/contexts/HomeContext";
import { getCleanImageUrl } from "@/lib/utils";

// Fallback jika API Hero gagal/belum selesai load
import fallbackSlide from "@/assets/hero-slide-1.jpg";

export default function NotFound() {
  const { slides } = useHome();
  const bgImage =
    slides && slides.length > 0 && slides[0].imageUrl
      ? getCleanImageUrl(slides[0].imageUrl)
      : fallbackSlide;

  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // Kalkulasi pergeseran maksimal 15px dari titik tengah layar
      const x = (e.clientX / window.innerWidth - 0.5) * 15;
      const y = (e.clientY / window.innerHeight - 0.5) * 15;
      requestAnimationFrame(() => setMousePos({ x, y }));
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return (
    <>
      <SEO
        title="404 - Page Not Found | DAW Group"
        description="The page you are looking for cannot be found."
      />
      <section className="relative flex min-h-[100dvh] w-full items-center justify-center overflow-hidden bg-slate-900 selection:bg-daw-green selection:text-white">
        {/* LAYER 1: THE PARALLAX BACKGROUND */}
        <div
          className="absolute inset-0 z-0 h-[110%] w-[110%] -left-[5%] -top-[5%] transition-transform duration-300 ease-out will-change-transform"
          style={{
            transform: `translate3d(${-mousePos.x}px, ${-mousePos.y}px, 0) scale(1.02)`,
          }}>
          <img
            src={bgImage}
            alt="DAW Group Background"
            className="h-full w-full object-cover opacity-60 filter grayscale-[20%]"
          />
        </div>

        {/* LAYER 2: CINEMATIC OVERLAYS & VIGNETTE */}
        <div className="absolute inset-0 z-0 bg-[#004B23]/40 mix-blend-multiply" />
        <div className="absolute inset-0 z-0 bg-gradient-to-b from-slate-900/90 via-slate-900/40 to-slate-900/90" />
        <div className="absolute inset-0 z-0 bg-[url('/grid-pattern.svg')] opacity-10 mix-blend-overlay" />

        {/* LAYER 3: THE GLASSMORPHISM CONTENT CARD */}
        <div className="relative z-10 w-full max-w-4xl px-4 sm:px-6 md:px-8">
          <div className="relative overflow-hidden border border-white/10 bg-white/5 px-6 py-12 text-center shadow-2xl backdrop-blur-xl sm:px-12 sm:py-16 md:p-20">
            <div className="absolute left-0 top-0 h-[1px] w-full bg-gradient-to-r from-transparent via-daw-green to-transparent opacity-70" />
            <div className="absolute bottom-0 left-0 h-[1px] w-full bg-gradient-to-r from-transparent via-daw-yellow to-transparent opacity-30" />

            {/* Typography 404 Responsif */}
            <h1 className="font-serif text-[5rem] font-bold leading-none tracking-tighter text-white drop-shadow-2xl sm:text-[8rem] md:text-[10rem]">
              404
            </h1>

            <div className="mx-auto my-6 h-[1px] w-12 bg-daw-yellow/60 shadow-[0_0_10px_rgba(226,149,4,0.5)] sm:my-8 sm:w-16" />

            <h2 className="mb-3 font-serif text-xl font-medium tracking-wide text-white sm:text-3xl md:mb-4 md:text-4xl drop-shadow-md">
              Not found
            </h2>
            <p className="mx-auto max-w-lg text-xs font-light leading-relaxed text-slate-300 sm:text-sm md:text-base">
              The page you are trying to access cannot be found.
            </p>

            {/* LAYER 4: EXECUTIVE ACTION BUTTONS */}
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:mt-12 sm:flex-row sm:gap-4 md:gap-6">
              <Link
                to="/"
                className="group relative flex w-full items-center justify-center gap-3 border border-transparent bg-daw-green px-6 py-3.5 text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.2em] text-white transition-all duration-300 hover:border-[#004B23] hover:bg-daw-green/90 hover:shadow-[0_0_20px_rgba(0,75,35,0.4)] active:scale-[0.98] sm:w-auto rounded-sm">
                <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
                Back to Homepage
              </Link>

              <Link
                to="/businesses"
                className="group flex w-full items-center justify-center border border-white/30 bg-transparent px-6 py-3.5 text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.2em] text-white transition-all duration-300 hover:border-white hover:bg-white/10 active:scale-[0.98] sm:w-auto rounded-sm">
                Explore Our Businesses
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
