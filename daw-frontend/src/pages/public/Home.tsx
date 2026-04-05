import { useState, useEffect } from "react";
import BusinessGrid from "@/components/BusinessGrid";
import Hero from "@/components/Hero";
import ImpactStatistics from "@/components/ImpactStatistics";
import TransformationIntro from "@/components/TransformationIntro";
import OtherInvestmentsTeaser from "@/components/OtherInvestmentsTeaser";
import SEO from "@/components/SEO";
import { useHome } from "@/contexts/HomeContext";
import { getCleanImageUrl } from "@/lib/utils";

export default function Home() {
  const { slides } = useHome();
  const [scrollProgress, setScrollProgress] = useState(0);

  const firstHeroImage =
    slides.length > 0 ? getCleanImageUrl(slides[0].imageUrl) : null;

  useEffect(() => {
    const handleScroll = () => {
      const totalHeight =
        document.documentElement.scrollHeight - window.innerHeight;
      const progress = (window.scrollY / totalHeight) * 100;
      setScrollProgress(progress);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      <SEO title="Home" preloadImage={firstHeroImage} />
      <div className="bg-white selection:bg-daw-green selection:text-white">
        <div
          className="fixed top-0 left-0 h-1.5 bg-gradient-to-r from-daw-green via-emerald-400 to-daw-green z-[100] transition-all duration-150 ease-out shadow-[0_0_10px_rgba(16,185,129,0.5)]"
          style={{ width: `${scrollProgress}%` }}
        />
        <Hero />
        <div className="relative">
          {/* Dekorasi Ambient Blur (Ciri khas baru kita) */}
          <div className="absolute top-20 right-0 w-[600px] h-[600px] bg-daw-green/[0.03] rounded-full blur-[120px] -z-10 pointer-events-none" />
          <TransformationIntro />
          <ImpactStatistics />
          <BusinessGrid />
          <OtherInvestmentsTeaser />
        </div>
      </div>
    </>
  );
}
