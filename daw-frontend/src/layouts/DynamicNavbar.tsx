import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Menu, X, Globe, ChevronDown } from "lucide-react";
import logoDaw from "@/assets/logo-daw.png";
import api from "@/lib/api";

// --- BENTUK DATA DARI BACKEND ---
interface MenuNode {
  id: string;
  label: string;
  type: "page" | "external";
  externalLink: string | null;
  Page?: { slug: string };
  children: MenuNode[];
}

export default function DynamicNavbar() {
  const [menus, setMenus] = useState<MenuNode[]>([]);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [openMobileAccordions, setOpenMobileAccordions] = useState<
    Record<string, boolean>
  >({});

  const { t, i18n } = useTranslation();
  const location = useLocation();

  // --- FETCH MENU TREE ---
  useEffect(() => {
    const fetchMenus = async () => {
      try {
        const response = await api.get("/menus/tree");
        setMenus(response.data);
      } catch (error) {
        console.error("Gagal mengambil menu navigasi:", error);
      }
    };
    fetchMenus();
  }, []);

  const toggleLanguage = () => {
    const newLang = i18n.language === "en" ? "id" : "en";
    i18n.changeLanguage(newLang);
  };

  const closeMenu = () => {
    setIsMobileMenuOpen(false);
    setOpenMobileAccordions({});
  };

  const toggleMobileAccordion = (id: string) => {
    setOpenMobileAccordions((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
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

  // --- THE MAGIC URL RESOLVER ---
  const resolveLink = (menu: MenuNode) => {
    if (menu.type === "external" && menu.externalLink) return menu.externalLink;
    if (menu.type === "page" && menu.Page?.slug)
      return `/page/${menu.Page.slug}`;
    return "#";
  };

  // 🔥 THE FIX: Deteksi apakah link ini adalah rute lokal (misal: /businesses atau #resources)
  const isLocalRoute = (url: string) =>
    url.startsWith("/") || url.startsWith("#");

  // --- STYLING LOGIC ---
  const isTransparent = !isScrolled && !isMobileMenuOpen;
  const textClass = isTransparent
    ? "text-white hover:text-slate-200"
    : "text-slate-800 hover:text-daw-green";

  const navLinkClass = `relative text-[13px] tracking-wide font-bold transition-colors pb-1 flex items-center gap-1 after:absolute after:bottom-0 after:left-0 after:h-[2px] after:w-0 after:bg-daw-green after:transition-all after:duration-300 hover:after:w-full ${textClass}`;
  const dropdownItemClass =
    "block px-6 py-3 text-[13px] tracking-wide font-bold text-slate-700 hover:text-daw-green hover:bg-slate-50 transition-colors";

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 border-b ${!isTransparent ? "bg-white/90 backdrop-blur-md border-transparent shadow-[0_2px_10px_rgba(0,0,0,0.05)] py-4" : "border-transparent bg-transparent py-6"}`}
      >
        <div className="container mx-auto px-6 relative z-20 flex items-center justify-between">
          <Link to="/" onClick={closeMenu} className="flex items-center gap-3">
            <img
              src={logoDaw}
              alt="Logo PT Dharma Agung Wijaya"
              className={`h-10 w-auto transition-all duration-300 ${isTransparent ? "brightness-0 invert" : ""}`}
            />
          </Link>

          <nav className="hidden md:flex items-center space-x-8">
            {/* 1. MENU STATIS: HOME */}
            <Link to="/" className={navLinkClass}>
              {t("nav.home", "HOME")}
            </Link>

            {/* 2. MENU STATIS: ABOUT US (Hardcoded original Abang) */}
            <div className="relative group py-2">
              <span className={`cursor-pointer ${navLinkClass}`}>
                {t("nav.about", "ABOUT US")}
                <ChevronDown
                  className={`h-4 w-4 transition-transform duration-300 group-hover:rotate-180 ${isTransparent ? "opacity-100" : "text-slate-500"}`}
                />
              </span>
              <div className="absolute top-full left-0 mt-2 w-56 bg-white shadow-xl border border-slate-100 border-t-2 border-t-daw-green rounded-b-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 transform translate-y-2 group-hover:translate-y-0 flex flex-col overflow-hidden">
                <Link to="/about?tab=company" className={dropdownItemClass}>
                  {t("nav.ourCompany", "Our Company")}
                </Link>
                <Link to="/about?tab=history" className={dropdownItemClass}>
                  {t("nav.history", "History")}
                </Link>
                <Link to="/about?tab=philosophy" className={dropdownItemClass}>
                  {t("nav.philosophy", "Philosophy")}
                </Link>
                <Link to="/about?tab=management" className={dropdownItemClass}>
                  {t("nav.management", "Our Management")}
                </Link>
              </div>
            </div>

            {/* 3. MENU STATIS: OUR BUSINESSES (Hardcoded original Abang) */}
            <div className="relative group py-2">
              <span className={`cursor-pointer ${navLinkClass}`}>
                {t("nav.businesses", "OUR BUSINESSES")}
                <ChevronDown
                  className={`h-4 w-4 transition-transform duration-300 group-hover:rotate-180 ${isTransparent ? "opacity-100" : "text-slate-500"}`}
                />
              </span>
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

            {/* 4. MENU DINAMIS: (Dari Admin, contoh: ACHIEVEMENT) */}
            {menus.map((menu) => {
              const hasChildren = menu.children && menu.children.length > 0;
              const link = resolveLink(menu);
              const isExternal = menu.type === "external";

              return (
                <div key={menu.id} className="relative group py-2">
                  {hasChildren ? (
                    <>
                      <span className={`cursor-pointer ${navLinkClass}`}>
                        {menu.label}
                        <ChevronDown
                          className={`h-4 w-4 transition-transform duration-300 group-hover:rotate-180 ${isTransparent ? "opacity-100" : "text-slate-500"}`}
                        />
                      </span>
                      <div className="absolute top-full left-0 mt-2 w-56 bg-white shadow-xl border border-slate-100 border-t-2 border-t-daw-green rounded-b-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 transform translate-y-2 group-hover:translate-y-0 flex flex-col overflow-hidden">
                        {menu.children.map((child) => (
                          <Link
                            key={child.id}
                            to={resolveLink(child)}
                            className={dropdownItemClass}
                          >
                            {child.label}
                          </Link>
                        ))}
                      </div>
                    </>
                  ) : isExternal ? (
                    isLocalRoute(link) ? (
                      <Link to={link} className={navLinkClass}>
                        {menu.label}
                      </Link>
                    ) : (
                      <a
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={navLinkClass}
                      >
                        {menu.label}
                      </a>
                    )
                  ) : (
                    <Link to={link} className={navLinkClass}>
                      {menu.label}
                    </Link>
                  )}
                </div>
              );
            })}
          </nav>

          <div className="flex items-center gap-5">
            <button
              onClick={toggleLanguage}
              className={`flex items-center gap-1.5 text-[13px] tracking-wide font-bold transition-colors ${textClass}`}
            >
              <Globe className="h-4 w-4" />
              {i18n.language === "en" ? "EN" : "ID"}
            </button>
            <Link
              to="/contact-us"
              className="hidden md:flex items-center justify-center bg-daw-green hover:bg-[#003b1c] text-white rounded-full px-6 py-3 text-[13px] tracking-wide font-bold shadow-md transition-transform hover:scale-105 border-0"
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

        {/* MENU MOBILE (HP) - HYBRID SYSTEM */}
        <div
          className={`md:hidden absolute top-full left-0 right-0 bg-white/90 backdrop-blur-md border-b border-slate-200 shadow-xl overflow-hidden transition-all duration-300 ease-in-out ${isMobileMenuOpen ? "max-h-[80vh] opacity-100 overflow-y-auto" : "max-h-0 opacity-0 pointer-events-none"}`}
        >
          <div className="flex flex-col px-6 pt-4 pb-8 space-y-2">
            {/* 1. STATIC: HOME */}
            <Link
              to="/"
              onClick={closeMenu}
              className="text-[13px] py-3 tracking-wide font-bold text-slate-800 hover:text-daw-green transition-colors uppercase"
            >
              {t("nav.home", "HOME")}
            </Link>

            {/* 2. STATIC ACCORDION: ABOUT US */}
            <div className="flex flex-col">
              <button
                onClick={() => toggleMobileAccordion("static-about")}
                className="text-[13px] py-3 tracking-wide font-bold text-slate-800 hover:text-daw-green transition-colors flex items-center justify-between uppercase"
              >
                {t("nav.about", "ABOUT US")}
                <ChevronDown
                  className={`h-5 w-5 text-slate-400 transition-transform duration-300 ${openMobileAccordions["static-about"] ? "rotate-180" : ""}`}
                />
              </button>
              <div
                className={`flex flex-col pl-4 border-l-2 border-slate-100 overflow-hidden transition-all duration-300 ${openMobileAccordions["static-about"] ? "max-h-96 mt-2" : "max-h-0"}`}
              >
                <Link
                  to="/about?tab=company"
                  onClick={closeMenu}
                  className="py-2 text-[12px] tracking-wider font-bold text-slate-500 hover:text-daw-green"
                >
                  {t("nav.ourCompany", "Our Company")}
                </Link>
                <Link
                  to="/about?tab=history"
                  onClick={closeMenu}
                  className="py-2 text-[12px] tracking-wider font-bold text-slate-500 hover:text-daw-green"
                >
                  {t("nav.history", "History")}
                </Link>
                <Link
                  to="/about?tab=philosophy"
                  onClick={closeMenu}
                  className="py-2 text-[12px] tracking-wider font-bold text-slate-500 hover:text-daw-green"
                >
                  {t("nav.philosophy", "Philosophy")}
                </Link>
                <Link
                  to="/about?tab=management"
                  onClick={closeMenu}
                  className="py-2 text-[12px] tracking-wider font-bold text-slate-500 hover:text-daw-green"
                >
                  {t("nav.management", "Our Management")}
                </Link>
              </div>
            </div>

            {/* 3. STATIC ACCORDION: OUR BUSINESSES */}
            <div className="flex flex-col">
              <button
                onClick={() => toggleMobileAccordion("static-business")}
                className="text-[13px] py-3 tracking-wide font-bold text-slate-800 hover:text-daw-green transition-colors flex items-center justify-between uppercase"
              >
                {t("nav.businesses", "OUR BUSINESSES")}
                <ChevronDown
                  className={`h-5 w-5 text-slate-400 transition-transform duration-300 ${openMobileAccordions["static-business"] ? "rotate-180" : ""}`}
                />
              </button>
              <div
                className={`flex flex-col pl-4 border-l-2 border-slate-100 overflow-hidden transition-all duration-300 ${openMobileAccordions["static-business"] ? "max-h-64 mt-2" : "max-h-0"}`}
              >
                <Link
                  to="/businesses#resources"
                  onClick={closeMenu}
                  className="py-2 text-[12px] tracking-wider font-bold text-slate-500 hover:text-daw-green"
                >
                  {t("nav.resources", "Resources")}
                </Link>
                <Link
                  to="/businesses#energy"
                  onClick={closeMenu}
                  className="py-2 text-[12px] tracking-wider font-bold text-slate-500 hover:text-daw-green"
                >
                  {t("nav.energy", "Energy")}
                </Link>
                <Link
                  to="/businesses#investments"
                  onClick={closeMenu}
                  className="py-2 text-[12px] tracking-wider font-bold text-slate-500 hover:text-daw-green"
                >
                  {t("nav.investments", "Other Investments")}
                </Link>
              </div>
            </div>

            {/* 4. DYNAMIC MENUS DARI ADMIN */}
            {menus.map((menu) => {
              const hasChildren = menu.children && menu.children.length > 0;
              const link = resolveLink(menu);
              const isExternal = menu.type === "external";
              const isOpen = openMobileAccordions[menu.id] || false;

              return (
                <div key={menu.id} className="flex flex-col">
                  {hasChildren ? (
                    <>
                      <button
                        onClick={() => toggleMobileAccordion(menu.id)}
                        className="text-[13px] py-3 tracking-wide font-bold text-slate-800 hover:text-daw-green transition-colors flex items-center justify-between uppercase"
                      >
                        {menu.label}
                        <ChevronDown
                          className={`h-5 w-5 text-slate-400 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}
                        />
                      </button>
                      <div
                        className={`flex flex-col pl-4 border-l-2 border-slate-100 overflow-hidden transition-all duration-300 ${isOpen ? "max-h-96 mt-2" : "max-h-0"}`}
                      >
                        {menu.children.map((child) => {
                          const childLink = resolveLink(child);
                          const isChildExternal = child.type === "external";

                          return isChildExternal ? (
                            isLocalRoute(childLink) ? (
                              <Link
                                key={child.id}
                                to={childLink}
                                onClick={closeMenu}
                                className="py-2 text-[12px] tracking-wider font-bold text-slate-500 hover:text-daw-green"
                              >
                                {child.label}
                              </Link>
                            ) : (
                              <a
                                key={child.id}
                                href={childLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="py-2 text-[12px] tracking-wider font-bold text-slate-500 hover:text-daw-green"
                              >
                                {child.label}
                              </a>
                            )
                          ) : (
                            <Link
                              key={child.id}
                              to={childLink}
                              onClick={closeMenu}
                              className="py-2 text-[12px] tracking-wider font-bold text-slate-500 hover:text-daw-green"
                            >
                              {child.label}
                            </Link>
                          );
                        })}
                      </div>
                    </>
                  ) : isExternal ? (
                    isLocalRoute(link) ? (
                      <Link
                        to={link}
                        onClick={closeMenu}
                        className="text-[13px] py-3 tracking-wide font-bold text-slate-800 hover:text-daw-green transition-colors uppercase"
                      >
                        {menu.label}
                      </Link>
                    ) : (
                      <a
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[13px] py-3 tracking-wide font-bold text-slate-800 hover:text-daw-green transition-colors uppercase"
                      >
                        {menu.label}
                      </a>
                    )
                  ) : (
                    <Link
                      to={link}
                      onClick={closeMenu}
                      className="text-[13px] py-3 tracking-wide font-bold text-slate-800 hover:text-daw-green transition-colors uppercase"
                    >
                      {menu.label}
                    </Link>
                  )}
                </div>
              );
            })}

            {/* 5. STATIC: CONTACT US BUTTON */}
            <div className="pt-4 mt-2 border-t border-slate-100">
              <Link
                to="/contact-us"
                onClick={closeMenu}
                className="flex items-center justify-center bg-daw-green hover:bg-[#003b1c] text-white rounded-full py-4 text-[13px] tracking-wide font-bold w-full shadow-md transition-all duration-300 transform active:scale-95"
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
