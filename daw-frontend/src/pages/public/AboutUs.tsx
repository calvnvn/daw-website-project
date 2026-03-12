import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import OurCompany from "@/components/about/OurCompany";
import History from "@/components/about/History";
import Philosophy from "@/components/about/Philosophy";
import Management from "@/components/about/Management";
import ScrollReveal from "@/components/ScrollReveal";
import bannerImg from "@/assets/about-banner.jpg";

export default function AboutUs() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "company";
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
    <div className="bg-white min-h-screen">
      {/* --- BANNER SECTION --- */}
      <section className="relative w-full h-[50vh] min-h-[400px] flex items-center justify-center overflow-hidden">
        {/* Background Image with Slow Zoom Animation */}
        <div
          className="absolute inset-0 w-full h-full bg-cover bg-center transform scale-100 hover:scale-110 transition-transform duration-[15000ms] ease-out"
          style={{ backgroundImage: `url(${bannerImg})` }}
        />

        {/* DAW Green Overlay (Multiply for rich color blending) */}
        <div className="absolute inset-0 bg-daw-green/70 mix-blend-multiply" />

        {/* Gradient Overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30" />

        {/* Text Content */}
        <div className="relative z-10 text-center px-6 mt-16">
          <ScrollReveal direction="up" delay={0}>
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-serif text-white tracking-tight drop-shadow-lg mb-6">
              {t("about.title", "About Us")}
            </h1>
          </ScrollReveal>

          <ScrollReveal direction="up" delay={200}>
            <div className="w-20 h-1.5 bg-white/80 mx-auto rounded-full shadow-sm"></div>
          </ScrollReveal>
        </div>
      </section>
      {/* --- END BANNER SECTION --- */}

      {/* --- MAIN CONTENT SECTION --- */}
      <section className="py-15">
        <div className="container mx-auto px-6 max-w-7xl">
          <div className="grid md:grid-cols-12 gap-12 lg:gap-20">
            {/* SIDEBAR NAV */}
            <div className="md:col-span-3 h-full mb-8 md:mb-0">
              <div className="sticky top-20 md:top-32 pb-2 md:pb-8 z-20 bg-white/95 backdrop-blur-sm md:bg-transparent">
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
                            ? "border-daw-green text-daw-green font-bold md:bg-slate-50/80"
                            : "border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-200"
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </ScrollReveal>
              </div>
            </div>
            {/* Dynamic Content */}
            <div className="md:col-span-9">
              <div className="max-w-4xl min-h-[600px]">{renderContent()}</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
