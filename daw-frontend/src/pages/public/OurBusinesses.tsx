import { useState, useEffect, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronRight } from "lucide-react";
import bannerImg from "@/assets/about-banner.jpg";
import DynamicBusinessSection, {
  type SectionData,
} from "@/components/businesses/DynamicBusinessSection";
import InvestmentsSection from "@/components/businesses/InvestmentsSection";
import api from "@/lib/api";
import ScrollReveal from "@/components/ScrollReveal";
import SEO from "@/components/SEO";

export default function OurBusinesses() {
  const { t } = useTranslation();
  const { hash } = useLocation();

  const [activeSection, setActiveSection] = useState("");
  const [pageData, setPageData] = useState<SectionData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [scrollProgress, setScrollProgress] = useState(0);

  /**
   * @desc Fetch dynamic business sections from the backend.
   * Removes hardcoded sorting; relies on backend's orderIndex.
   */
  useEffect(() => {
    const fetchPublicData = async () => {
      try {
        const response = await api.get("/businesses/public");
        setPageData(response.data);

        // Auto-select the first section if no URL hash is present
        if (response.data.length > 0 && !hash) {
          setActiveSection(response.data[0].id);
        }
      } catch (error) {
        console.error("[FETCH_BUSINESS_DATA_ERROR]:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchPublicData();
  }, [hash]);

  /**
   * @constant navItems
   * Dynamically merges database sections with static sections (e.g., Investments)
   * to create a unified navigation array for the Sticky Nav and Scroll Spy.
   */
  const navItems = useMemo(() => {
    const dynamicTabs = pageData.map((sec) => ({
      id: sec.id,
      label: sec.category, // Fallback label directly from the database
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
  }, [isLoading, hash]);

  /**
   * @desc Scroll Spy Engine
   * Dynamically tracks the user's scroll position against the bounds of
   * dynamically generated sections to update the active sticky nav state.
   */
  useEffect(() => {
    if (navItems.length === 0) return;

    let requestRunning = false;

    const handleScroll = () => {
      if (requestRunning) return;
      requestRunning = true;

      requestAnimationFrame(() => {
        // Calculate global scroll progress bar
        const totalHeight =
          document.documentElement.scrollHeight - window.innerHeight;
        const progress = (window.scrollY / totalHeight) * 100;
        setScrollProgress(progress);

        // Detect active section for Sticky Nav highlighting
        const scrollPosition = window.scrollY + 200;

        for (const item of navItems) {
          const element = document.getElementById(item.id);
          if (
            element &&
            element.offsetTop <= scrollPosition &&
            element.offsetTop + element.offsetHeight > scrollPosition
          ) {
            setActiveSection(item.id);
          }
        }
        requestRunning = false;
      });
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [navItems]);

  const scrollToSection = (id: string) => {
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
  };

  return (
    <>
      <SEO
        title={t("businessesPage.hero.title", "Our Businesses")}
        description="Explore PT Dharma Agung Wijaya Group's diverse business portfolio."
      />
      <div className="bg-white min-h-screen selection:bg-daw-green selection:text-white">
        {/* --- GLOBAL SCROLL PROGRESS BAR --- */}
        <div
          className="fixed top-0 left-0 h-1.5 bg-gradient-to-r from-daw-green via-emerald-400 to-daw-green z-[100] transition-all duration-150 ease-out shadow-[0_0_10px_rgba(16,185,129,0.5)]"
          style={{ width: `${scrollProgress}%` }}
        />

        {/* --- HERO BANNER --- */}
        <section className="relative h-[85vh] min-h-[600px] flex items-center justify-center overflow-hidden">
          <div
            className="absolute inset-0 bg-cover bg-center transition-transform duration-700 hover:scale-105"
            style={{
              backgroundImage: `url(${bannerImg})`,
              backgroundAttachment: "fixed",
            }}
          />
          <div className="absolute inset-0 bg-[#004B23]/70 mix-blend-multiply" />
          <div className="absolute inset-0 bg-gradient-to-b from-slate-900/60 via-slate-900/40 to-slate-900/80" />

          <ScrollReveal direction="up" delay={0}>
            <div className="relative z-10 text-center px-6 max-w-5xl mt-16 animate-in fade-in slide-in-from-bottom-12 duration-1000">
              <h1 className="text-5xl md:text-7xl lg:text-8xl font-serif font-bold text-white mb-10 leading-[1.1] tracking-tight drop-shadow-lg">
                {t("businessesPage.hero.title", "Our Businesses")}
              </h1>
              <div className="flex items-center justify-center gap-8">
                <div className="h-px w-16 bg-white/30" />
                <div className="w-3 h-3 border-2 border-daw-yellow rotate-45" />
                <div className="h-px w-16 bg-white/30" />
              </div>
            </div>
          </ScrollReveal>

          <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-white/50 animate-bounce">
            <span className="text-[10px] font-bold tracking-widest uppercase">
              Scroll to Explore
            </span>
            <ChevronRight className="rotate-90 w-4 h-4" />
          </div>
        </section>

        <div className="relative">
          {/* --- STICKY NAV: Dynamic Rendering --- */}
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
                  }`}
                >
                  {/* Intelligent i18n Fallback Mechanism */}
                  {t(`businessesPage.nav.${item.id}`, item.label)}

                  {activeSection === item.id && (
                    <div className="absolute bottom-0 left-0 w-full h-[3px] bg-daw-green animate-in fade-in zoom-in-95 duration-300" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* --- SECTIONS CONTAINER --- */}
          <div className="flex flex-col relative">
            <div className="absolute top-40 right-0 w-[500px] h-[500px] bg-daw-green/[0.03] rounded-full blur-[120px] -z-10 pointer-events-none" />

            {isLoading ? (
              <div className="py-32 text-center flex flex-col items-center justify-center gap-4">
                <div className="w-12 h-12 border-4 border-daw-green border-t-transparent rounded-full animate-spin"></div>
                <p className="text-slate-400 font-bold tracking-[0.2em] uppercase text-xs">
                  Loading Business Data...
                </p>
              </div>
            ) : (
              pageData.map((sectionData) => (
                <section
                  key={sectionData.id}
                  id={sectionData.id}
                  className="bg-transparent"
                >
                  <DynamicBusinessSection data={sectionData} />
                </section>
              ))
            )}

            {/* --- INVESTMENTS SECTION (Static Footer Bound) --- */}
            <section
              id="investments"
              className="pt-32 pb-40 bg-[#081C15] overflow-hidden relative"
            >
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
