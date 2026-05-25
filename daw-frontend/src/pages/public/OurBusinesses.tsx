import { useState, useEffect, useMemo, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import bannerImg from "@/assets/about-banner.jpg";
import InvestmentsSection from "@/components/businesses/InvestmentsSection";
import SEO from "@/components/SEO";
import { useBusiness } from "@/contexts/BusinessContext";
import DynamicBusinessSection from "@/components/businesses/DynamicBusinessSection";
import GlobalHeroBanner from "@/components/ui/GlobalHeroBanner";

export default function OurBusinesses() {
  const { t } = useTranslation();
  const { hash } = useLocation();
  const { publicSections: pageData, isLoading, refreshData } = useBusiness();

  const [activeSection, setActiveSection] = useState("");
  const [scrollProgress, setScrollProgress] = useState(0);

  const scrollToSection = useCallback((id: string) => {
    const element = document.getElementById(id);
    if (element) {
      const offset = 120; // Accounts for sticky navbar height
      const bodyRect = document.body.getBoundingClientRect().top;
      const elementRect = element.getBoundingClientRect().top;
      const elementPosition = elementRect - bodyRect;

      window.scrollTo({
        top: elementPosition - offset,
        behavior: "smooth",
      });
    }
  }, []);

  // Efek untuk sinkronisasi hash awal
  useEffect(() => {
    if (!isLoading && pageData.length > 0) {
      if (!hash) {
        setActiveSection(pageData[0].id);
      } else {
        const targetId = hash.replace("#", "");
        setActiveSection(targetId);
      }
    }
  }, [isLoading, hash, pageData]);

  // FIX 4: Masukkan refreshData ke dalam dependency array
  useEffect(() => {
    refreshData();
  }, [refreshData]);

  /**
   * @constant navItems
   * Dynamically merges database sections with static sections
   */
  const navItems = useMemo(() => {
    const dynamicTabs = pageData.map((sec) => ({
      id: sec.id,
      label: sec.category,
    }));

    return [
      ...dynamicTabs,
      {
        id: "investments",
        label: t("businessesPage.nav.investments", "Strategic Investments"),
      },
    ];
  }, [pageData, t]);

  // Handle URL hash routing on initial load
  useEffect(() => {
    if (!isLoading && hash) {
      const targetId = hash.replace("#", "");
      const timeoutId = setTimeout(() => {
        scrollToSection(targetId);
      }, 300);
      return () => clearTimeout(timeoutId);
    }
  }, [isLoading, hash, scrollToSection]);

  /**
   * @desc Scroll Spy Engine
   */
  useEffect(() => {
    if (navItems.length === 0) return;

    let requestRunning = false;

    const handleScroll = () => {
      if (requestRunning) return;
      requestRunning = true;

      requestAnimationFrame(() => {
        const winScroll =
          window.pageYOffset || document.documentElement.scrollTop;
        const height =
          document.documentElement.scrollHeight -
          document.documentElement.clientHeight;

        // Safety check untuk menghindari NaN/Infinity jika body terlalu pendek
        const scrolled = height > 0 ? (winScroll / height) * 100 : 0;
        setScrollProgress(scrolled);

        const offsetThreshold = 250;

        const currentActive = navItems.find((item) => {
          const el = document.getElementById(item.id);
          if (!el) return false;
          const rect = el.getBoundingClientRect();
          return rect.top <= offsetThreshold && rect.bottom > offsetThreshold;
        });

        if (currentActive && currentActive.id !== activeSection) {
          setActiveSection(currentActive.id);
        }
        requestRunning = false;
      });
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [navItems, activeSection]);

  return (
    <>
      <SEO
        title={t("businessesPage.hero.title", "Our Businesses")}
        description="Explore PT Dharma Agung Wijaya Group's diverse business portfolio."
      />
      <div className="bg-white min-h-screen selection:bg-daw-green selection:text-white">
        {/* GLOBAL SCROLL PROGRESS BAR */}
        <div
          className="fixed top-0 left-0 h-1.5 bg-gradient-to-r from-daw-green via-emerald-400 to-daw-green z-[100] transition-all duration-150 ease-out shadow-[0_0_10px_rgba(16,185,129,0.5)]"
          style={{ width: `${scrollProgress}%` }}
        />

        <GlobalHeroBanner
          title={t("businessesPage.hero.title", "Our Businesses")}
          targetIndex={2}
          localFallback={bannerImg}
        />

        <div className="relative">
          {/* STICKY NAV: Dynamic Rendering */}
          <div className="sticky top-[72px] z-40 bg-white/90 backdrop-blur-md border-b border-slate-200 shadow-sm transition-all duration-300">
            <div className="container mx-auto px-6 max-w-5xl flex justify-center sm:justify-between items-center overflow-x-auto hide-scrollbar">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => scrollToSection(item.id)}
                  className={`relative px-6 py-4 text-[13px] font-bold uppercase tracking-widest transition-all duration-300 whitespace-nowrap ${
                    activeSection === item.id
                      ? "text-daw-green"
                      : "text-slate-400 hover:text-slate-800"
                  }`}>
                  {/* Intelligent i18n Fallback Mechanism */}
                  {t(`businessesPage.nav.${item.id}`, item.label)}

                  {activeSection === item.id && (
                    <div className="absolute bottom-0 left-0 w-full h-[3px] bg-daw-green animate-in fade-in zoom-in-95 duration-300" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* SECTIONS CONTAINER */}
          <div className="flex flex-col relative overflow-x-clip">
            {/* Dekorasi Background */}
            <div className="absolute top-40 right-0 w-[500px] h-[500px] bg-daw-green/[0.03] rounded-full blur-[120px] -z-10 pointer-events-none" />

            {isLoading ? (
              <div className="py-40 flex flex-col items-center justify-center gap-6 min-h-[50vh]">
                <div className="relative w-16 h-16 md:w-20 md:h-20">
                  <div className="absolute inset-0 border-4 border-daw-green/10 rounded-full"></div>
                  <div className="absolute inset-0 border-4 border-daw-green border-t-transparent rounded-full animate-spin"></div>
                </div>
                <p className="text-daw-green font-bold animate-pulse tracking-[0.2em] text-[10px] md:text-xs uppercase">
                  Synchronizing Portfolio...
                </p>
              </div>
            ) : pageData.length === 0 ? (
              <div className="py-40 text-center min-h-[40vh] flex flex-col items-center justify-center">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                  <span className="text-slate-300 font-bold text-2xl">!</span>
                </div>
                <p className="text-slate-500 font-bold">
                  No divisions available.
                </p>
                <p className="text-slate-400 text-sm mt-1">
                  Please check back later for updates.
                </p>
              </div>
            ) : (
              pageData.map((sectionData) => (
                <section
                  key={sectionData.id}
                  id={sectionData.id}
                  className="bg-transparent scroll-mt-32 relative">
                  <DynamicBusinessSection data={sectionData} />
                </section>
              ))
            )}

            {/* INVESTMENTS SECTION (Static Footer Bound) */}
            <section
              id="investments"
              className="pt-32 pb-40 bg-[#081C15] overflow-hidden relative scroll-mt-10">
              <div className="container mx-auto px-6 max-w-7xl relative z-10">
                <h2 className="text-4xl md:text-5xl lg:text-6xl font-serif font-bold text-white mb-20 text-center tracking-tight">
                  {t(
                    "businessesPage.investments.title",
                    "Strategic Investments",
                  )}
                </h2>
                <InvestmentsSection />
              </div>
              <div className="absolute bottom-0 right-0 w-[800px] h-[800px] bg-emerald-900/20 rounded-full blur-[150px] pointer-events-none" />
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
