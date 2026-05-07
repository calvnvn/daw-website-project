import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import OurCompany from "@/components/about/OurCompany";
import History from "@/components/about/History";
import Philosophy from "@/components/about/Philosophy";
import Management from "@/components/about/Management";
import ScrollReveal from "@/components/ScrollReveal";
import bannerImg from "@/assets/about-banner.jpg";
import SEO from "@/components/SEO";
import GlobalHeroBanner from "@/components/ui/GlobalHeroBanner";

export default function AboutUs() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "company";
  const [scrollProgress, setScrollProgress] = useState(0);

  const getTabLabel = () => {
    const current = TABS.find((t) => t.id === activeTab);
    return current ? current.label : "About Us";
  };

  const contentRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (searchParams.has("tab") && contentRef.current) {
      const offset = 100; // Jarak aman agar judul tidak tertutup Sticky Navbar
      const elementPosition = contentRef.current.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth",
      });
    }
  }, [activeTab, searchParams]);

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

  // Untuk ubah tab dan URL automatically
  const handleTabChange = (tabId: string) => {
    setSearchParams({ tab: tabId });
  };

  const TABS = [
    { id: "company", label: t("about.menu.company") },
    { id: "history", label: t("about.menu.history") },
    { id: "philosophy", label: t("about.menu.philosophy") },
    { id: "management", label: t("about.menu.management") },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case "company":
        return <OurCompany />;
      case "history":
        return <History />;
      case "philosophy":
        return <Philosophy />;
      case "management":
        return <Management />;
      default:
        return <OurCompany />;
    }
  };

  return (
    <>
      <SEO title={`${getTabLabel()} | About Us`} />
      <div className="bg-white min-h-screen overflow-x-hidden w-full relative">
        {/* Progress Scrolling Bar */}
        <div
          className="fixed top-0 left-0 h-1.5 bg-gradient-to-r from-daw-green via-emerald-400 to-daw-green z-[100] transition-all duration-150 ease-out shadow-[0_0_10px_rgba(16,185,129,0.5)]"
          style={{ width: `${scrollProgress}%` }}
        />

        <GlobalHeroBanner
          title={t("about.title", "About Us")}
          targetIndex={1}
          localFallback={bannerImg}
        />
        {/* --- MAIN CONTENT SECTION --- */}
        {/* Tambahkan padding top yang lebih besar agar lega (py-24) */}
        <section ref={contentRef} className="py-10 relative overflow-hidden">
          {/* Dekorasi blur di background */}
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-daw-green/[0.03] rounded-full blur-[120px] -z-10 pointer-events-none" />

          <div className="container mx-auto px-6 max-w-7xl">
            <div className="grid md:grid-cols-12 gap-12 lg:gap-20">
              {/* SIDEBAR NAV */}
              <div className="md:col-span-3 h-full mb-8 md:mb-0">
                <div className="sticky top-20 md:top-32 pb-2 md:pb-8 z-20 bg-white/95 md:bg-transparent">
                  <ScrollReveal direction="right" delay={100}>
                    <div className="flex flex-row md:flex-col overflow-x-auto md:overflow-visible space-x-4 md:space-x-0 md:space-y-2 border-b md:border-b-0 border-slate-100 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                      <span className="hidden md:block text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-4 pl-5">
                        Menu
                      </span>
                      {TABS.map((tab) => (
                        <button
                          key={tab.id}
                          onClick={() => handleTabChange(tab.id)}
                          className={`flex-shrink-0 whitespace-nowrap text-center md:text-left px-4 py-3 md:py-3.5 md:pl-5 text-[14px] font-medium tracking-wide transition-all duration-300 
                        border-b-[3px] md:border-b-0 md:border-l-[3px] 
                        ${
                          activeTab === tab.id
                            ? "border-daw-green text-daw-green font-bold md:bg-slate-50/80 rounded-r-xl" // Tambah rounded biar nyambung
                            : "border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-200"
                        }`}>
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  </ScrollReveal>
                </div>
              </div>

              {/* Dynamic Content */}
              <div className="md:col-span-9 animate-in fade-in slide-in-from-right-10 duration-1000">
                <div className="max-w-4xl min-h-[600px]">{renderContent()}</div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
