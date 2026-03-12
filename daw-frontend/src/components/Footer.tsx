import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { MapPin } from "lucide-react";
import logoDaw from "@/assets/logo-daw.png";
import { useSettings } from "@/contexts/SettingsContext";

export default function Footer() {
  const { t } = useTranslation();
  const { settings } = useSettings();

  return (
    <footer className="bg-[#070e07] text-white overflow-hidden relative">
      <div
        className="absolute top-0 left-0 w-full h-32 z-0 pointer-events-none"
        style={{
          background: "linear-gradient(to bottom, #081C15 0%, #070e07 100%)",
        }}
      ></div>
      <div className="relative z-10">
        {/* 2. MIDDLE FOOTER: Corporate Info & Sitemap */}
        <div className="container mx-auto px-6 py-20 max-w-7xl">
          <div className="grid grid-cols-3 gap-4 md:gap-8 lg:grid-cols-12 items-start">
            {/* Column 1: Identity & Office */}
            <div className="col-span-1 lg:col-span-5 space-y-8">
              <img
                src={logoDaw}
                alt="DAW Group"
                className="h-8 md:h-12 w-auto brightness-0 invert opacity-90"
              />
              <div className="space-y-6 hidden md:block">
                {" "}
                {/* Hide Detail on Mobile Screen */}
                <div className="flex items-start gap-4">
                  <MapPin className="w-5 h-5 text-daw-green mt-1 shrink-0" />
                  <div className="space-y-1">
                    <h4 className="text-[10px] md:text-xs font-bold uppercase tracking-widest text-slate-500">
                      {settings?.companyName || t("footer.officeTitle")}
                    </h4>
                    <p className="text-slate-400 font-light text-xs md:text-sm leading-relaxed max-w-xs whitespace-pre-line">
                      {settings?.address || t("footer.address")}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Column 2: Sitemap  */}
            <div className="col-span-1 lg:col-span-3 text-center">
              <h4 className="text-[10px] md:text-xs font-bold uppercase tracking-[0.2em] text-white mb-6 md:mb-10">
                {t("footer.quickLinks")}
              </h4>
              <ul className="flex flex-col gap-2 md:gap-4">
                {["Home", "About", "Businesses", "Contact"].map((item) => (
                  <li key={item}>
                    <Link
                      to={`/${item.toLowerCase()}`}
                      className="text-slate-400 hover:text-daw-green transition-colors font-light text-[11px] md:text-[15px]"
                    >
                      {item}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Column 3: Sector Presence */}
            <div className="col-span-1 lg:col-span-4">
              <h4 className="text-[10px] md:text-xs font-bold uppercase tracking-[0.2em] text-white mb-6 md:mb-10">
                {t("footer.sectorsTitle")}
              </h4>
              <div className="flex flex-col md:flex-row md:flex-wrap gap-2 md:gap-3 ">
                {["Energy", "Resources", "Investments"].map((tag) => (
                  <span
                    key={tag}
                    className="text-[10px] md:text-[12px] text-slate-500 md:text-slate-400 md:px-4 md:py-2 md:bg-white/5 md:border md:border-white/10 md:rounded-full font-medium"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 3. BOTTOM FOOTER: Copyright */}
        <div className="border-t border-white/5 bg-[#070e07]">
          <div className="container mx-auto px-6 py-8 max-w-7xl flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-[13px] text-slate-300 font-light whitespace-pre-line">
              {t("footer.copyright")}
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
