import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import ScrollReveal from "@/components/ScrollReveal";
import bannerImg from "@/assets/about-banner.jpg";
import ResourcesSection from "@/components/businesses/ResourcesSection";
import EnergySection from "@/components/businesses/EnergySection";
import InvestmentsSection from "@/components/businesses/InvestmentsSection";

export default function OurBusinesses() {
  const { t } = useTranslation();
  const [activeSection, setActiveSection] = useState("resources");
  const location = useLocation();

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      const y = element.getBoundingClientRect().top + window.scrollY - 100;
      window.scrollTo({ top: y, behavior: "smooth" });
    }
  };
  useEffect(() => {
    if (location.hash) {
      const id = location.hash.replace("#", "");

      // Gunakan setTimeout agar DOM sudah siap render sebelum scroll
      const timer = setTimeout(() => {
        scrollToSection(id);
      }, 300); // 300ms lebih aman untuk render peta/grid

      return () => clearTimeout(timer); // Cleanup timer
    }
  }, [location]);
  useEffect(() => {
    const handleScroll = () => {
      const sections = ["resources", "energy", "investments"];
      const scrollPosition = window.scrollY + 200;

      for (const section of sections) {
        const element = document.getElementById(section);
        if (
          element &&
          element.offsetTop <= scrollPosition &&
          element.offsetTop + element.offsetHeight > scrollPosition
        ) {
          setActiveSection(section);
        }
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="bg-white min-h-screen">
      {/* --- HERO BANNER --- */}
      <section className="relative w-full h-[60vh] min-h-[500px] flex items-center justify-center overflow-hidden">
        <div
          className="absolute inset-0 w-full h-full bg-cover bg-center transform scale-100 hover:scale-105 transition-transform duration-[20000ms] ease-out"
          style={{ backgroundImage: `url(${bannerImg})` }}
        />
        <div className="absolute inset-0 bg-[#004B23]/80 mix-blend-multiply" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#081C15] via-transparent to-transparent" />

        <div className="relative z-10 text-center px-6 mt-20 max-w-4xl">
          <ScrollReveal direction="up" delay={0}>
            <h1 className="text-5xl md:text-7xl font-serif text-white tracking-tight drop-shadow-lg mb-6">
              {t("businessesPage.hero.title")}
            </h1>
          </ScrollReveal>
          <ScrollReveal direction="up" delay={200}>
            <p className="text-lg md:text-xl text-slate-300 font-light leading-relaxed">
              {t("businessesPage.hero.subtitle")}
            </p>
          </ScrollReveal>
        </div>
      </section>

      {/* --- STICKY SECTION NAVIGATION --- */}
      <div className="sticky top-[72px] md:top-[72px] z-40 bg-white/90 backdrop-blur-md border-b border-slate-200 shadow-sm transition-all duration-300">
        <div className="container mx-auto px-6 max-w-5xl">
          <div className="flex justify-center sm:justify-between items-center overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {["resources", "energy", "investments"].map((section) => (
              <button
                key={section}
                onClick={() => scrollToSection(section)}
                className={`relative px-6 py-4 text-[13px] font-bold uppercase tracking-widest whitespace-nowrap transition-colors duration-300 ${
                  activeSection === section
                    ? "text-[#004B23]"
                    : "text-slate-400 hover:text-slate-800"
                }`}
              >
                {t(`businessesPage.nav.${section}`)}
                {/* Underline Indicator */}
                {activeSection === section && (
                  <span className="absolute bottom-0 left-0 w-full h-[3px] bg-[#004B23] rounded-t-md" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* --- SECTIONS CONTAINER --- */}
      <div className="flex flex-col">
        {/* 1. RESOURCES SECTION */}
        <section id="resources" className="py-24 bg-white">
          <div className="container mx-auto px-6 max-w-7xl">
            <ResourcesSection />
          </div>
        </section>

        {/* 2. ENERGY SECTION */}
        <section
          id="energy"
          className="pt-24 pb-32 bg-slate-50 border-t border-slate-200"
        >
          <div className="container mx-auto px-6 max-w-7xl">
            {/* Cukup panggil komponennya di sini */}
            <EnergySection />
          </div>
        </section>

        {/* 3. OTHER INVESTMENTS SECTION */}
        <section
          id="investments"
          className="pt-24 pb-32 bg-[#081C15] overflow-hidden"
        >
          <div className="container mx-auto px-6 max-w-7xl">
            <ScrollReveal direction="up" delay={0}>
              <h2 className="text-4xl md:text-5xl font-serif text-white mb-16 text-center">
                {t("businessesPage.investments.title")}
              </h2>
            </ScrollReveal>

            {/* Panggil The Constellation UI di sini */}
            <InvestmentsSection />
          </div>
        </section>
      </div>
    </div>
  );
}
