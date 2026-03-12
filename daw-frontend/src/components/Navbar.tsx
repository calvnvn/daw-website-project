import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Menu, X, Globe, ChevronDown } from "lucide-react";
import logoDaw from "@/assets/logo-daw.png";

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // State khusus untuk buka/tutup Sub-menu di HP
  const [isMobileAboutOpen, setIsMobileAboutOpen] = useState(false);
  const [isMobileBusinessOpen, setIsMobileBusinessOpen] = useState(false);

  const { t, i18n } = useTranslation();

  const toggleLanguage = () => {
    const newLang = i18n.language === "en" ? "id" : "en";
    i18n.changeLanguage(newLang);
  };

  const closeMenu = () => {
    setIsMobileMenuOpen(false);
    setIsMobileAboutOpen(false);
    setIsMobileBusinessOpen(false);
  };

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
  }, [isMobileMenuOpen]);

  const isTransparent = !isScrolled && !isMobileMenuOpen;

  const textClass = isTransparent
    ? "text-white hover:text-slate-200"
    : "text-slate-800 hover:text-daw-green";

  // CLASS TIPOGRAFI PREMIUM (13px, Uppercase, Tracking-wide)
  const navLinkClass = `relative text-[13px]   tracking-wide font-bold transition-colors pb-1 flex items-center gap-1 after:absolute after:bottom-0 after:left-0 after:h-[2px] after:w-0 after:bg-daw-green after:transition-all after:duration-300 hover:after:w-full ${textClass}`;

  // CLASS UNTUK ITEM SUB-MENU DROPDOWN
  const dropdownItemClass =
    "block px-6 py-3 text-[13px]   tracking-wide font-bold text-slate-700 hover:text-daw-green hover:bg-slate-50 transition-colors";

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 border-b ${
          !isTransparent
            ? "bg-white/90 backdrop-blur-md border-transparent shadow-[0_2px_10px_rgba(0,0,0,0.05)] py-4"
            : "border-transparent bg-transparent py-6"
        }`}
      >
        <div className="container mx-auto px-6 relative z-20 flex items-center justify-between">
          {/* KIRI: Logo */}
          <Link to="/" onClick={closeMenu} className="flex items-center gap-3">
            <img
              src={logoDaw}
              alt="Logo PT Dharma Agung Wijaya"
              className={`h-10 w-auto transition-all duration-300 ${
                isTransparent ? "brightness-0 invert" : ""
              }`}
            />
          </Link>

          {/* TENGAH: Menu Desktop */}
          <nav className="hidden md:flex items-center space-x-8">
            <Link to="/" className={navLinkClass}>
              {t("nav.home", "HOME")}
            </Link>

            {/* DROPDOWN DESKTOP: About Us */}
            <div className="relative group py-2">
              <span className={`cursor-pointer ${navLinkClass}`}>
                {t("nav.about", "ABOUT US")}
                <ChevronDown
                  className={`h-4 w-4 transition-transform duration-300 group-hover:rotate-180 ${isTransparent ? "opacity-100" : "text-slate-500"}`}
                />
              </span>

              {/* Kotak Sub-menu (Muncul saat di-hover) */}
              <div className="absolute top-full left-0 mt-2 w-56 bg-white shadow-xl border border-slate-100 border-t-2 border-t-daw-green rounded-b-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 transform translate-y-2 group-hover:translate-y-0 flex flex-col overflow-hidden">
                <Link
                  to="/about?tab=company"
                  onClick={closeMenu}
                  className={dropdownItemClass}
                >
                  {t("nav.ourCompany", "Our Company")}
                </Link>
                <Link
                  to="/about?tab=history"
                  state={{ tab: "history" }}
                  className={dropdownItemClass}
                >
                  {t("nav.history", "History")}
                </Link>
                <Link
                  to="/about?tab=philosophy"
                  state={{ tab: "philosophy" }}
                  className={dropdownItemClass}
                >
                  {t("nav.philosophy", "Philosophy")}
                </Link>
                <Link
                  to="/about?tab=management"
                  state={{ tab: "management" }}
                  className={dropdownItemClass}
                >
                  {t("nav.management", "Our Management")}
                </Link>
              </div>
            </div>

            {/* DROPDOWN DESKTOP: Our Businesses */}
            <div className="relative group py-2">
              <span className={`cursor-pointer ${navLinkClass}`}>
                {t("nav.businesses", "OUR BUSINESSES")}
                <ChevronDown
                  className={`h-4 w-4 transition-transform duration-300 group-hover:rotate-180 ${isTransparent ? "opacity-100" : "text-slate-500"}`}
                />
              </span>

              {/* Kotak Sub-menu */}
              <div className="absolute top-full left-0 mt-2 w-64 bg-white shadow-xl border border-slate-100 border-t-2 border-t-daw-green rounded-b-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 transform translate-y-2 group-hover:translate-y-0 flex flex-col overflow-hidden">
                <Link to="/businesses#resources" className={dropdownItemClass}>
                  {t("nav.resources", "Resources")}
                </Link>
                <Link to="/businesses#energy" className={dropdownItemClass}>
                  {t("nav.energy", "Energy")}
                </Link>
                <Link
                  to="/businesses#investments"
                  className={dropdownItemClass}
                >
                  {t("nav.investments", "Other Investments")}
                </Link>
              </div>
            </div>
          </nav>

          {/* KANAN: Tombol Bahasa, CTA & Hamburger */}
          <div className="flex items-center gap-5">
            <button
              onClick={toggleLanguage}
              className={`flex items-center gap-1.5 text-[13px]   tracking-wide font-bold transition-colors ${textClass}`}
            >
              <Globe className="h-4 w-4" />
              {i18n.language === "en" ? "EN" : "ID"}
            </button>

            <Link
              to="/contact-us"
              className="hidden md:flex items-center justify-center bg-daw-green hover:bg-daw-green-hover text-white rounded-full px-6 py-3 text-[13px] tracking-wide font-bold shadow-md transition-transform hover:scale-105 border-0"
            >
              {t("nav.contact", "CONTACT US")}
            </Link>

            <button
              className={`md:hidden p-2 focus:outline-none ${textClass}`}
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              <div className="relative h-6 w-6 transform transition-transform duration-300">
                {isMobileMenuOpen ? (
                  <X className="absolute inset-0 h-6 w-6 rotate-90 scale-100 transition-all duration-300" />
                ) : (
                  <Menu className="absolute inset-0 h-6 w-6 rotate-0 scale-100 transition-all duration-300" />
                )}
              </div>
            </button>
          </div>
        </div>

        {/* MENU MOBILE (HP) */}
        <div
          className={`md:hidden absolute top-full left-0 right-0 bg-white/90 backdrop-blur-md border-b border-slate-200 shadow-xl overflow-hidden transition-all duration-300 ease-in-out ${
            isMobileMenuOpen
              ? "max-h-[800px] opacity-100"
              : "max-h-0 opacity-0 pointer-events-none"
          }`}
        >
          <div className="flex flex-col px-6 pt-4 pb-8 space-y-2">
            <Link
              to="/"
              onClick={closeMenu}
              className="text-[13px] py-3   tracking-wide font-bold text-slate-800 hover:text-daw-green transition-colors"
            >
              {t("nav.home", "HOME")}
            </Link>

            {/* ACCORDION MOBILE: About Us */}
            <div className="flex flex-col">
              <button
                onClick={() => setIsMobileAboutOpen(!isMobileAboutOpen)}
                className="text-[13px] py-3   tracking-wide font-bold text-slate-800 hover:text-daw-green transition-colors flex items-center justify-between"
              >
                {t("nav.about", "ABOUT US")}
                <ChevronDown
                  className={`h-5 w-5 text-slate-400 transition-transform duration-300 ${isMobileAboutOpen ? "rotate-180" : ""}`}
                />
              </button>

              <div
                className={`flex flex-col pl-4 border-l-2 border-slate-100 overflow-hidden transition-all duration-300 ${isMobileAboutOpen ? "max-h-64 mt-2" : "max-h-0"}`}
              >
                <Link
                  to="/about?tab=company"
                  state={{ tab: "company" }}
                  onClick={closeMenu}
                  className="py-2 text-[12px] tracking-wider font-bold text-slate-500 hover:text-daw-green"
                >
                  {t("nav.ourCompany", "Our Company")}
                </Link>
                <Link
                  to="/about?tab=history"
                  state={{ tab: "history" }}
                  onClick={closeMenu}
                  className="py-2 text-[12px] tracking-wider font-bold text-slate-500 hover:text-daw-green"
                >
                  {t("nav.history", "History")}
                </Link>
                <Link
                  to="/about?tab=philosophy"
                  state={{ tab: "philosophy" }}
                  onClick={closeMenu}
                  className="py-2 text-[12px]   tracking-wider font-bold text-slate-500 hover:text-daw-green"
                >
                  {t("nav.philosophy", "Philosophy")}
                </Link>
                <Link
                  to="/about?tab=management"
                  state={{ tab: "management" }}
                  onClick={closeMenu}
                  className="py-2 text-[12px]   tracking-wider font-bold text-slate-500 hover:text-daw-green"
                >
                  {t("nav.management", "Our Management")}
                </Link>
              </div>
            </div>

            {/* ACCORDION MOBILE: Our Businesses */}
            <div className="flex flex-col">
              <button
                onClick={() => setIsMobileBusinessOpen(!isMobileBusinessOpen)}
                className="text-[13px] py-3   tracking-wide font-bold text-slate-800 hover:text-daw-green transition-colors flex items-center justify-between"
              >
                {t("nav.businesses", "OUR BUSINESSES")}
                <ChevronDown
                  className={`h-5 w-5 text-slate-400 transition-transform duration-300 ${isMobileBusinessOpen ? "rotate-180" : ""}`}
                />
              </button>

              <div
                className={`flex flex-col pl-4 border-l-2 border-slate-100 overflow-hidden transition-all duration-300 ${isMobileBusinessOpen ? "max-h-64 mt-2" : "max-h-0"}`}
              >
                <Link
                  to="/businesses"
                  onClick={closeMenu}
                  className="py-2 text-[12px]   tracking-wider font-bold text-slate-500 hover:text-daw-green"
                >
                  {t("nav.resources", "Resources")}
                </Link>
                <Link
                  to="/businesses"
                  onClick={closeMenu}
                  className="py-2 text-[12px]   tracking-wider font-bold text-slate-500 hover:text-daw-green"
                >
                  {t("nav.energy", "Energy")}
                </Link>
                <Link
                  to="/businesses"
                  onClick={closeMenu}
                  className="py-2 text-[12px]   tracking-wider font-bold text-slate-500 hover:text-daw-green"
                >
                  {t("nav.investments", "Other Investments")}
                </Link>
              </div>
            </div>

            <div className="pt-4 mt-2 border-t border-slate-100">
              <Link
                to="/contact-us"
                onClick={closeMenu}
                className="flex items-center justify-center bg-daw-green hover:bg-daw-green-hover text-white rounded-full py-4 text-[13px] tracking-wide font-bold w-full shadow-md transition-all duration-300 transform active:scale-95"
              >
                {t("nav.contact", "CONTACT US")}
              </Link>
            </div>
          </div>
        </div>
      </header>

      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 md:hidden transition-opacity"
          onClick={closeMenu}
        />
      )}
    </>
  );
}
