import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Menu, X, ChevronDown } from "lucide-react";
import logoDaw from "@/assets/logo-daw.png";
import api from "@/lib/api";
import { useSettings } from "@/contexts/SettingsContext";
import { getCleanImageUrl } from "@/lib/utils";
import { useBusiness } from "@/contexts/BusinessContext";

const resolveLink = (menu: any) => {
  if (menu.type === "external" && menu.externalLink) return menu.externalLink;
  if (menu.type === "page" && menu.Page?.slug) return `/page/${menu.Page.slug}`;
  return "#";
};

const isLocalRoute = (url: string) =>
  url.startsWith("/") || url.startsWith("#");

export default function DynamicNavbar() {
  const { settings } = useSettings();
  const { t } = useTranslation();

  // FIX 2: Destructuring dengan Alias untuk sinkronisasi sektor bisnis
  const { sections: businessSections } = useBusiness();

  const [menus, setMenus] = useState<any[]>([]);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [openMobileAccordions, setOpenMobileAccordions] = useState<
    Record<string, boolean>
  >({});

  const displayLogo = settings?.logoUrl
    ? getCleanImageUrl(settings.logoUrl)
    : logoDaw;

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

  // const toggleLanguage = () => {
  //   const newLang = i18n.language === "en" ? "id" : "en";
  //   i18n.changeLanguage(newLang);
  // };

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
    const handleScroll = () => {
      const scrolled = window.scrollY > 20;
      setIsScrolled((prev) => (prev !== scrolled ? scrolled : prev));
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    // Cleanup function untuk berjaga-jaga jika komponen unmount
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobileMenuOpen]);

  useEffect(() => {
    const handleResize = () => {
      // Jika layar ditarik jadi desktop (>= 768px) saat menu mobile masih terbuka, paksa tutup!
      if (window.innerWidth >= 768 && isMobileMenuOpen) {
        closeMenu();
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isMobileMenuOpen]);

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
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 border-b ${!isTransparent ? "bg-white/90 backdrop-blur-md border-transparent shadow-[0_2px_10px_rgba(0,0,0,0.05)] py-2" : "border-transparent bg-transparent py-4"}`}>
        <div className="container mx-auto px-6 relative z-20 flex items-center justify-between">
          <Link to="/" onClick={closeMenu} className="flex items-center gap-3">
            <img
              src={displayLogo}
              alt={settings?.companyName || "PT Dharma Agung Wijaya"}
              width="180"
              height="56"
              fetchPriority="high"
              loading="eager"
              className={`w-auto transition-all duration-300 object-contain ${
                isScrolled ? "h-12 lg:h-14" : "h-12 lg:h-14"
              } ${isTransparent ? "brightness-0 invert" : ""}`}
            />
          </Link>

          <nav className="hidden md:flex items-center space-x-8">
            {/* 1. MENU STATIS: HOME */}
            <Link to="/" className={navLinkClass}>
              {t("nav.home", "HOME")}
            </Link>

            {/* 2. MENU STATIS: ABOUT US (Hardcoded original Abang) */}
            <div className="relative group py-2">
              {/*  Split Target Statis Desktop */}
              <div className="flex items-center cursor-pointer">
                <Link to="/about" className={navLinkClass}>
                  {t("nav.about", "ABOUT US")}
                </Link>
                <ChevronDown
                  className={`h-4 w-4 ml-1 transition-transform duration-300 group-hover:rotate-180 ${isTransparent ? "opacity-100 text-white" : "text-slate-500"}`}
                />
              </div>
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
              <span
                tabIndex={0}
                className={`cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-daw-green rounded-sm ${navLinkClass}`}>
                {t("nav.businesses", "OUR BUSINESSES")}
                <ChevronDown
                  className={`h-4 w-4 ml-1 transition-transform duration-300 group-hover:rotate-180 ${isTransparent ? "opacity-100" : "text-slate-500"}`}
                />
              </span>
              {/* FIX 3: Tambahkan focus-within untuk Aksesibilitas Keyboard */}
              <div className="absolute top-full left-0 mt-2 w-64 bg-white shadow-xl border border-slate-100 border-t-2 border-t-daw-green rounded-b-md opacity-0 invisible group-hover:opacity-100 group-hover:visible focus-within:opacity-100 focus-within:visible transition-all duration-300 transform translate-y-2 group-hover:translate-y-0 focus-within:translate-y-0 flex flex-col overflow-hidden">
                {/* Looping Sektor dari Database */}
                {businessSections.map((sec) => (
                  <Link
                    key={sec.id}
                    to={`/businesses#${sec.id}`}
                    className={dropdownItemClass}>
                    {sec.category}
                  </Link>
                ))}

                {/* Fallback Static Menu (Jika dibutuhkan) */}
                <Link
                  to="/businesses#investments"
                  className={dropdownItemClass}>
                  {t("nav.investments", "Strategic Investments")}
                </Link>
              </div>
            </div>
            {/* 4. MENU DINAMIS: (Dari Admin, contoh: ACHIEVEMENT) */}
            {menus.map((menu) => {
              const hasChildren = menu.children && menu.children.length > 0;
              const link = resolveLink(menu);
              const isExternal = menu.type === "external"; //  FIX: Deklarasi isExternal ditambahkan

              return (
                <div key={menu.id} className="relative group py-2">
                  {hasChildren ? (
                    <>
                      {/* Split Target Desktop (Link & Hover) */}
                      <div className="flex items-center cursor-pointer">
                        <Link to={link} className={navLinkClass}>
                          {menu.label}
                        </Link>
                        <ChevronDown
                          className={`h-4 w-4 ml-1 transition-transform duration-300 group-hover:rotate-180 ${isTransparent ? "opacity-100 text-white" : "text-slate-500"}`}
                        />
                      </div>

                      {/* Dropdown Desktop */}
                      <div className="absolute top-full left-0 mt-2 w-56 bg-white shadow-xl border border-slate-100 border-t-2 border-t-daw-green rounded-b-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 transform translate-y-2 group-hover:translate-y-0 flex flex-col overflow-hidden">
                        {menu.children.map((child) => {
                          const childLink = resolveLink(child);
                          const isChildExternal = child.type === "external";

                          return isChildExternal ? (
                            isLocalRoute(childLink) ? (
                              <Link
                                key={child.id}
                                to={childLink}
                                className={dropdownItemClass}>
                                {child.label}
                              </Link>
                            ) : (
                              <a
                                key={child.id}
                                href={childLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={dropdownItemClass}>
                                {child.label}
                              </a>
                            )
                          ) : (
                            <Link
                              key={child.id}
                              to={childLink}
                              className={dropdownItemClass}>
                              {child.label}
                            </Link>
                          );
                        })}
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
                        className={navLinkClass}>
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
            {/* <button
              onClick={toggleLanguage}
              className={`flex items-center gap-1.5 text-[13px] tracking-wide font-bold transition-colors ${textClass}`}
            >
              <Globe className="h-4 w-4" />
              {i18n.language === "en" ? "EN" : "ID"}
            </button> */}
            <Link
              to="/contact-us"
              className="hidden md:flex items-center justify-center bg-daw-green hover:bg-[#003b1c] text-white rounded-full px-6 py-3 text-[13px] tracking-wide font-bold shadow-md transition-transform hover:scale-105 border-0">
              {t("nav.contact", "CONTACT US")}
            </Link>
            <button
              aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
              className={`md:hidden p-2 focus:outline-none ${textClass}`}
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
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
          className={`md:hidden absolute top-full left-0 right-0 bg-white/90  border-b border-slate-200 shadow-xl overflow-hidden transition-all duration-300 ease-in-out ${isMobileMenuOpen ? "max-h-[80vh] opacity-100 overflow-y-auto" : "max-h-0 opacity-0 pointer-events-none"}`}>
          <div className="flex flex-col px-6 pt-4 pb-8 space-y-2">
            {/* 1. STATIC: HOME */}
            <Link
              to="/"
              onClick={closeMenu}
              className="text-[13px] py-3 tracking-wide font-bold text-slate-800 hover:text-daw-green transition-colors uppercase">
              {t("nav.home", "HOME")}
            </Link>

            {/* 2. STATIC ACCORDION: ABOUT US */}
            <div className="flex flex-col w-full">
              {/*  Split Target Statis Mobile */}
              <div className="flex items-center justify-between border-b border-slate-50/50">
                <Link
                  to="/about"
                  onClick={closeMenu}
                  className="flex-1 text-[13px] py-3 tracking-wide font-bold text-slate-800 hover:text-daw-green transition-colors uppercase">
                  {t("nav.about", "ABOUT US")}
                </Link>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    toggleMobileAccordion("static-about");
                  }}
                  className="p-2 ml-2 transition-colors active:scale-95">
                  <ChevronDown
                    className={`h-5 w-5 text-slate-500 transition-transform duration-300 ${openMobileAccordions["static-about"] ? "rotate-180" : ""}`}
                  />
                </button>
              </div>{" "}
              <div
                className={`flex flex-col pl-4 border-l-2 border-slate-100 overflow-hidden transition-all duration-500 ease-in-out ${openMobileAccordions["static-about"] ? "max-h-[1000px] mt-2" : "max-h-0"}`}>
                <Link
                  to="/about?tab=company"
                  onClick={closeMenu}
                  className="py-2 text-[12px] tracking-wider font-bold text-slate-500 hover:text-daw-green">
                  {t("nav.ourCompany", "Our Company")}
                </Link>
                <Link
                  to="/about?tab=history"
                  onClick={closeMenu}
                  className="py-2 text-[12px] tracking-wider font-bold text-slate-500 hover:text-daw-green">
                  {t("nav.history", "History")}
                </Link>
                <Link
                  to="/about?tab=philosophy"
                  onClick={closeMenu}
                  className="py-2 text-[12px] tracking-wider font-bold text-slate-500 hover:text-daw-green">
                  {t("nav.philosophy", "Philosophy")}
                </Link>
                <Link
                  to="/about?tab=management"
                  onClick={closeMenu}
                  className="py-2 text-[12px] tracking-wider font-bold text-slate-500 hover:text-daw-green">
                  {t("nav.management", "Our Management")}
                </Link>
              </div>
            </div>

            {/* 3. STATIC ACCORDION: OUR BUSINESSES */}
            <div className="flex flex-col">
              <div className="flex items-center justify-between border-b border-slate-50/50">
                <span className="text-[13px] py-3 tracking-wide font-bold text-slate-800 uppercase">
                  {t("nav.businesses", "OUR BUSINESSES")}
                </span>
                <button
                  aria-label="Toggle Our Businesses Submenu"
                  onClick={() => toggleMobileAccordion("static-business")}
                  className="p-2 ml-2 text-slate-400 hover:text-daw-green transition-colors active:scale-95">
                  <ChevronDown
                    className={`h-5 w-5 transition-transform duration-300 ${
                      openMobileAccordions["static-business"]
                        ? "rotate-180"
                        : ""
                    }`}
                  />
                </button>
              </div>
              <div
                className={`flex flex-col pl-4 border-l-2 border-slate-100 overflow-hidden transition-all duration-500 ease-in-out ${openMobileAccordions["static-business"] ? "max-h-[1000px] mt-2" : "max-h-0"}`}>
                <Link
                  to="/businesses#resources"
                  onClick={closeMenu}
                  className="py-2 text-[12px] tracking-wider font-bold text-slate-500 hover:text-daw-green">
                  {t("nav.resources", "Resources")}
                </Link>
                <Link
                  to="/businesses#energy"
                  onClick={closeMenu}
                  className="py-2 text-[12px] tracking-wider font-bold text-slate-500 hover:text-daw-green">
                  {t("nav.energy", "Energy")}
                </Link>
                <Link
                  to="/businesses#investments"
                  onClick={closeMenu}
                  className="py-2 text-[12px] tracking-wider font-bold text-slate-500 hover:text-daw-green">
                  {t("nav.investments", "Other Investments")}
                </Link>
              </div>
            </div>

            {/* 4. DYNAMIC MENUS DARI ADMIN */}
            {menus.map((menu) => {
              const hasChildren = menu.children && menu.children.length > 0;
              const link = resolveLink(menu);
              const isExternal = menu.type === "external"; //  FIX: Deklarasi isExternal ditambahkan
              const isOpen = openMobileAccordions[menu.id] || false;

              return (
                <div key={menu.id} className="flex flex-col">
                  {hasChildren ? (
                    <>
                      {/* Split Target Mobile (Link & Accordion Toggle) */}
                      <div className="flex items-center justify-between border-b border-slate-50/50">
                        <Link
                          to={link}
                          onClick={closeMenu}
                          className="flex-1 text-[13px] py-3 tracking-wide font-bold text-slate-800 hover:text-daw-green transition-colors uppercase">
                          {menu.label}
                        </Link>
                        <button
                          aria-label="Toggle About Us Submenu"
                          onClick={(e) => {
                            e.preventDefault();
                            toggleMobileAccordion(menu.id);
                          }}
                          className="p-2 ml-2 transition-colors active:scale-95">
                          <ChevronDown
                            className={`h-5 w-5 text-slate-500 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}
                          />
                        </button>
                      </div>

                      {/* Dropdown / Accordion Anak Mobile */}
                      <div
                        className={`flex flex-col pl-4 border-l-2 border-slate-100 overflow-hidden transition-all duration-500 ease-in-out ${isOpen ? "max-h-[1000px] mt-2" : "max-h-0"}`}>
                        {menu.children.map((child) => {
                          const childLink = resolveLink(child);
                          const isChildExternal = child.type === "external";

                          return isChildExternal ? (
                            isLocalRoute(childLink) ? (
                              <Link
                                key={child.id}
                                to={childLink}
                                onClick={closeMenu}
                                className="py-2 text-[12px] tracking-wider font-bold text-slate-500 hover:text-daw-green">
                                {child.label}
                              </Link>
                            ) : (
                              <a
                                key={child.id}
                                href={childLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="py-2 text-[12px] tracking-wider font-bold text-slate-500 hover:text-daw-green">
                                {child.label}
                              </a>
                            )
                          ) : (
                            <Link
                              key={child.id}
                              to={childLink}
                              onClick={closeMenu}
                              className="py-2 text-[12px] tracking-wider font-bold text-slate-500 hover:text-daw-green">
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
                        className="text-[13px] py-3 tracking-wide font-bold text-slate-800 hover:text-daw-green transition-colors uppercase">
                        {menu.label}
                      </Link>
                    ) : (
                      <a
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[13px] py-3 tracking-wide font-bold text-slate-800 hover:text-daw-green transition-colors uppercase">
                        {menu.label}
                      </a>
                    )
                  ) : (
                    <Link
                      to={link}
                      onClick={closeMenu}
                      className="text-[13px] py-3 tracking-wide font-bold text-slate-800 hover:text-daw-green transition-colors uppercase">
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
                className="flex items-center justify-center bg-daw-green hover:bg-[#003b1c] text-white rounded-full py-4 text-[13px] tracking-wide font-bold w-full shadow-md transition-all duration-300 transform active:scale-95">
                {t("nav.contact", "CONTACT US")}
              </Link>
            </div>
          </div>
        </div>
      </header>

      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-40 md:hidden transition-opacity"
          onClick={closeMenu}
        />
      )}
    </>
  );
}
