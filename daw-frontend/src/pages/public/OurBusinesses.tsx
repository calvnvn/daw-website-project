import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import bannerImg from "@/assets/about-banner.jpg"; // Sesuaikan path banner Anda
import DynamicBusinessSection, {
  type SectionData,
} from "@/components/businesses/DynamicBusinessSection";
import InvestmentsSection from "@/components/businesses/InvestmentsSection";
import api from "@/lib/api"; // Pastikan import Axios/API client Anda

export default function OurBusinesses() {
  const { t } = useTranslation();

  const [activeSection, setActiveSection] = useState("resources");

  // 1. STATE UNTUK DATA DATABASE
  const [pageData, setPageData] = useState<SectionData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 2. FETCH DATA DARI API PUBLIC
  // 2. FETCH DATA DARI API PUBLIC
  useEffect(() => {
    const fetchPublicData = async () => {
      try {
        const response = await api.get("/businesses/public");

        // KUNCI LIMIT BREAK: Paksa urutannya secara manual!
        const desiredOrder = ["resources", "energy"];

        const sortedData = response.data.sort(
          (a: SectionData, b: SectionData) => {
            return desiredOrder.indexOf(a.id) - desiredOrder.indexOf(b.id);
          },
        );

        setPageData(sortedData);
      } catch (error) {
        console.error("Failed to fetch business data", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchPublicData();
  }, []);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      const y = element.getBoundingClientRect().top + window.scrollY - 100;
      window.scrollTo({ top: y, behavior: "smooth" });
    }
  };

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
          className="absolute inset-0 w-full h-full bg-cover bg-center"
          style={{ backgroundImage: `url(${bannerImg})` }}
        />
        <div className="absolute inset-0 bg-[#004B23]/80 mix-blend-multiply" />
        <div className="relative z-10 text-center px-6 mt-20 max-w-4xl">
          <h1 className="text-5xl md:text-7xl font-serif text-white tracking-tight drop-shadow-lg mb-6">
            {t("businessesPage.hero.title")}
          </h1>
        </div>
      </section>

      {/* --- STICKY NAV --- */}
      <div className="sticky top-[72px] z-40 bg-white/90 backdrop-blur-md border-b border-slate-200">
        <div className="container mx-auto px-6 max-w-5xl flex justify-center sm:justify-between items-center overflow-x-auto">
          {["resources", "energy", "investments"].map((section) => (
            <button
              key={section}
              onClick={() => scrollToSection(section)}
              className={`relative px-6 py-4 text-[13px] font-bold uppercase tracking-widest ${activeSection === section ? "text-[#004B23]" : "text-slate-400"}`}
            >
              {t(`businessesPage.nav.${section}`)}
            </button>
          ))}
        </div>
      </div>

      {/* --- SECTIONS CONTAINER --- */}
      <div className="flex flex-col">
        {/* SKELETON LOADING (Jika data masih ditarik) */}
        {isLoading ? (
          <div className="py-32 text-center text-slate-400 animate-pulse font-bold tracking-widest">
            LOADING SECTIONS...
          </div>
        ) : (
          /* LOOPING DATA DINAMIS DARI MYSQL UNTUK RESOURCES & ENERGY */
          pageData.map((sectionData) => (
            <section
              key={sectionData.id}
              id={sectionData.id}
              className="bg-white border-b border-slate-100"
            >
              {/* Komponen Anda yang Super Mewah Tadi Dipanggil Di Sini */}
              <DynamicBusinessSection data={sectionData} />
            </section>
          ))
        )}

        {/* INVESTMENTS SECTION (Bawaan Anda) */}
        <section
          id="investments"
          className="pt-24 pb-32 bg-[#081C15] overflow-hidden"
        >
          <div className="container mx-auto px-6 max-w-7xl">
            <h2 className="text-4xl md:text-5xl font-serif text-white mb-16 text-center">
              {t("businessesPage.investments.title")}
            </h2>
            <InvestmentsSection />
          </div>
        </section>
      </div>
    </div>
  );
}
