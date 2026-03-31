import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { MapPin, ChevronUp, ArrowUpRight } from "lucide-react";
import logoDaw from "@/assets/logo-daw.png";
import { useSettings } from "@/contexts/SettingsContext";
import { getCleanImageUrl } from "@/lib/utils";

export default function Footer() {
  const { t } = useTranslation();
  const { settings } = useSettings();

  // MAPPING LINK YANG BENAR
  const quickLinks = [
    { label: t("nav.home", "Home"), path: "/" },
    { label: t("nav.about", "About Us"), path: "/about" },
    { label: t("nav.businesses", "Our Businesses"), path: "/businesses" },
    { label: t("nav.contact", "Contact Us"), path: "/contact-us" },
  ];

  const businessSectors = [
    { label: "Energy", path: "/businesses#energy" },
    { label: "Resources", path: "/businesses#resources" },
    { label: "Investments", path: "/businesses#investments" },
  ];

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <footer className="bg-[#070e07] text-white overflow-hidden relative">
      {/* Background Gradient Detail */}
      <div
        className="absolute top-0 left-0 w-full h-32 z-0 pointer-events-none"
        style={{
          background: "linear-gradient(to bottom, #081C15 0%, #070e07 100%)",
        }}
      />

      <div className="relative z-10">
        <div className="container mx-auto px-6 py-20 max-w-7xl">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-12 lg:gap-16 items-start">
            {/* Column 1: Identity & Office */}
            <div className="md:col-span-5 space-y-8">
              <Link to="/" onClick={scrollToTop}>
                <img
                  src={
                    settings?.logoUrl
                      ? getCleanImageUrl(settings.logoUrl)
                      : logoDaw
                  }
                  alt="DAW Group"
                  className="h-10 md:h-12 w-auto brightness-0 invert opacity-90 transition-opacity hover:opacity-100"
                />
              </Link>
              <div className="space-y-6">
                <div className="flex items-start gap-4 group">
                  <div className="w-10 h-10 rounded-full bg-daw-green/10 flex items-center justify-center shrink-0 border border-daw-green/20 group-hover:bg-daw-green transition-colors">
                    <MapPin className="w-5 h-5 text-daw-green group-hover:text-white transition-colors" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                      {settings?.companyName || "PT Dharma Agung Wijaya"}
                    </h4>
                    <p className="text-slate-400 font-light text-sm leading-relaxed max-w-xs whitespace-pre-line">
                      {settings?.address || t("footer.address")}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Column 2: Sitemap (Quick Links) */}
            <div className="md:col-span-3">
              <h4 className="text-[11px] font-black uppercase tracking-[0.3em] text-white/40 mb-8">
                {t("footer.quickLinks", "Navigation")}
              </h4>
              <ul className="flex flex-col gap-4">
                {quickLinks.map((item) => (
                  <li key={item.path}>
                    <Link
                      to={item.path}
                      onClick={scrollToTop}
                      className="text-slate-400 hover:text-daw-green transition-all font-medium text-sm flex items-center gap-2 group"
                    >
                      <span className="h-px w-0 bg-daw-green group-hover:w-4 transition-all duration-300" />
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Column 3: Sector Presence */}
            <div className="md:col-span-4">
              <h4 className="text-[11px] font-black uppercase tracking-[0.3em] text-white/40 mb-8">
                {t("footer.sectorsTitle", "Business Sectors")}
              </h4>
              <div className="flex flex-wrap gap-3">
                {businessSectors.map((sector) => (
                  <Link
                    key={sector.label}
                    to={sector.path}
                    className="text-[11px] font-bold text-slate-400 px-5 py-2.5 bg-white/5 border border-white/10 rounded-full hover:bg-daw-green hover:border-daw-green hover:text-white transition-all flex items-center gap-2 uppercase tracking-wider"
                  >
                    {sector.label}
                    <ArrowUpRight className="w-3 h-3 opacity-50" />
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* BOTTOM FOOTER: Copyright & Back to Top */}
        <div className="border-t border-white/5 bg-[#040804]/50 backdrop-blur-sm">
          <div className="container mx-auto px-6 py-8 max-w-7xl flex flex-col md:flex-row justify-between items-center gap-6">
            <p className="text-[12px] text-slate-500 font-medium tracking-wide">
              © {new Date().getFullYear()} PT Dharma Agung Wijaya.{" "}
              {t("footer.copyright", "All rights reserved.")}
            </p>

            <button
              onClick={scrollToTop}
              className="group flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-white transition-colors"
            >
              Back to Top
              <div className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center group-hover:border-daw-green group-hover:bg-daw-green transition-all shadow-lg">
                <ChevronUp className="w-4 h-4 group-hover:-translate-y-1 transition-transform" />
              </div>
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
