import { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { Share2, ChevronRight } from "lucide-react";
import { Helmet } from "react-helmet-async";
import DOMPurify from "dompurify";
import api, { API_URL } from "@/lib/api"; // <-- KUNCI 1: Import API_URL
import ScrollReveal from "@/components/ScrollReveal";
import { getCleanImageUrl } from "@/lib/utils"; // <-- KUNCI 2: Pastikan ini di-import
import SEO from "@/components/SEO";

// Data structures for Page and Table of Contents
interface PageData {
  id: string;
  title: string;
  subtitle: string | null;
  slug: string;
  content: string;
  heroImage: string | null;
  templateType: "classic" | "modern" | "split";
  metaDescription: string | null;
  showDropCap: boolean;
  sidebarLinks?: { label: string; url: string }[];
}

interface TocItem {
  id: string;
  text: string;
  level: number;
}

// Security configuration for DOMPurify
const sanitizeConfig = {
  ADD_TAGS: ["iframe"],
  ADD_ATTR: ["allow", "allowfullscreen", "frameborder", "scrolling", "id"],
  FORBID_ATTR: ["onerror", "onload", "onclick"],
};

/**
 * @component ScrollProgressBar
 * Isolated component to manage scroll state independently.
 * Decoupled from the main DynamicPage to prevent unnecessary re-renders of the article content.
 */
const ScrollProgressBar = () => {
  const [scrollProgress, setScrollProgress] = useState(0);
  useEffect(() => {
    const handleScroll = () => {
      const totalHeight =
        document.documentElement.scrollHeight - window.innerHeight;
      const progress =
        totalHeight > 0 ? (window.scrollY / totalHeight) * 100 : 0;
      setScrollProgress(progress);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);
  return (
    <div
      className="fixed top-0 left-0 h-1.5 bg-gradient-to-r from-daw-green via-emerald-400 to-daw-green z-[100] transition-all duration-150 ease-out"
      style={{ width: `${scrollProgress}%` }}
    />
  );
};

export default function DynamicPage() {
  const { slug } = useParams<{ slug: string }>();

  // Page States
  const [pageData, setPageData] = useState<PageData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  // Table of Contents & Content Processing States
  const [toc, setToc] = useState<TocItem[]>([]);
  const [activeTocId, setActiveTocId] = useState<string>("");
  const [parsedContent, setParsedContent] = useState<string>("");

  const articleRef = useRef<HTMLElement>(null);
  const isManualScrolling = useRef(false);

  // Effect 1: Data Acquisition. Fetches page data based on the URL slug and resets scroll position.
  useEffect(() => {
    let isMounted = true;
    const fetchPage = async () => {
      setIsLoading(true);
      try {
        const res = await api.get(`/pages/slug/${slug}`);
        if (isMounted) setPageData(res.data);
      } catch (error) {
        if (isMounted) setIsError(true);
        console.error(error);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    if (slug) fetchPage();
    window.scrollTo(0, 0);
    return () => {
      isMounted = false;
    };
  }, [slug]);

  /**
   * Effect 2: Content Pre-Parsing & Persistent ID Injection
   * Processes raw HTML string to:
   * 1. Sanitize content for security.
   * 2. Generate a structured Table of Contents (ToC).
   * 3. Inject persistent anchor IDs into headings before rendering to the DOM.
   */
  useEffect(() => {
    if (!pageData?.content) return;

    // Sanitize raw HTML from database
    const cleanHtml = DOMPurify.sanitize(pageData.content, sanitizeConfig);

    // Initialize virtual DOM parser to manipulate content without triggering layout shifts
    const parser = new DOMParser();
    const virtualDoc = parser.parseFromString(cleanHtml, "text/html");

    const walker = document.createTreeWalker(
      virtualDoc.body,
      NodeFilter.SHOW_TEXT,
      null,
    );
    let currentNode = walker.nextNode();

    while (currentNode) {
      if (currentNode.textContent) {
        // Regex: Cari "-" yang diapit oleh huruf/angka (compound words)
        // Ubah menjadi Unicode \u2011 (Non-Breaking Hyphen)
        currentNode.textContent = currentNode.textContent.replace(
          /(\w)-(\w)/g,
          "$1\u2011$2",
        );
      }
      currentNode = walker.nextNode();
    }
    const headings = Array.from(virtualDoc.querySelectorAll("h2, h3"));

    const items: TocItem[] = [];
    const idTracker: Record<string, number> = {};

    headings.forEach((heading, index) => {
      const text = heading.textContent || "";
      // Generate URL-friendly slug for the ID
      let baseId =
        text
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)+/g, "") || `sec-${index}`;

      // Handle duplicate IDs to ensure DOM uniqueness
      if (idTracker[baseId] !== undefined) {
        idTracker[baseId] += 1;
        baseId = `${baseId}-${idTracker[baseId]}`;
      } else {
        idTracker[baseId] = 0;
      }

      heading.id = baseId;
      items.push({ id: baseId, text, level: heading.tagName === "H2" ? 2 : 3 });
    });
    setToc(items);
    let backendBaseUrl = "";
    try {
      backendBaseUrl = new URL(API_URL).origin;
    } catch (e) {
      console.error("CRITICAL: Format API_URL di .env tidak valid!", e);
    }
    // Cari SEMUA gambar di dalam artikel
    const contentImages = virtualDoc.querySelectorAll("img");
    contentImages.forEach((img) => {
      const src = img.getAttribute("src");
      // Jika src-nya relatif (berawalan /uploads), gabungkan dengan URL Backend
      if (src && src.startsWith("/uploads")) {
        img.src = `${backendBaseUrl}${src}`;
      }
    });
    // ==========================================

    // Baris terakhir di Effect 2 (tetap seperti ini):
    setParsedContent(virtualDoc.body.innerHTML);
    console.log("Pre-Parsing Selesai, ID Permanen & URL Gambar Ditanam.");
  }, [pageData?.content]);

  /**
   * Effect 3: Intersection Observer & Deep Linking (SUPERCHARGED 🚀)
   * Monitors user scroll position to highlight active ToC items and handles initial anchor links.
   */
  useEffect(() => {
    if (toc.length === 0 || !parsedContent || !articleRef.current) return;

    // KUNCI 1: Beri jeda 100ms untuk memastikan dangerouslySetInnerHTML selesai mencetak elemen HTML ke layar
    const timer = setTimeout(() => {
      if (!articleRef.current) return;

      const headingElements = articleRef.current.querySelectorAll("h2, h3");
      console.log(`🔍 Satpam siap menjaga ${headingElements.length} Heading!`); // Cek apakah heading benar-benar terdeteksi

      const observerOptions = {
        root: null,
        rootMargin: "-120px 0px -70% 0px",
        threshold: 0,
      };

      const observer = new IntersectionObserver((entries) => {
        // FASE 3 (ANTI-FLICKER): Kalau bendera ToC lagi diangkat, Satpam tutup mata!
        if (isManualScrolling.current) return;

        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.target.id) {
            console.log("🎯 Aktif saat Scroll:", entry.target.id);
            setActiveTocId(entry.target.id);
          }
        });
      }, observerOptions);

      headingElements.forEach((el) => observer.observe(el));

      // Handle initial deep linking from URL hash
      if (window.location.hash) {
        const hashId = window.location.hash.substring(1);
        setTimeout(() => {
          const element = document.getElementById(hashId);
          if (element) {
            element.scrollIntoView({ behavior: "smooth", block: "start" });
            setActiveTocId(hashId);
          }
        }, 100);
      }

      // Cleanup
      return () => observer.disconnect();
    }, 100);

    return () => clearTimeout(timer);
  }, [toc, parsedContent]);

  /**
   * Smooth scroll handler for ToC navigation
   * @param {string} id - The anchor ID to scroll to
   */
  const scrollToHeading = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      console.log("Mencoba scroll ke:", id);

      isManualScrolling.current = true;
      setActiveTocId(id);

      element.scrollIntoView({ behavior: "smooth", block: "start" });
      // Update browser history without triggering page reload
      window.history.pushState(null, "", `#${id}`);

      setTimeout(() => {
        isManualScrolling.current = false;
      }, 800);
    } else {
      console.error("Elemen tidak ditemukan untuk ID:", id);
    }
  };

  // --- Render Conditions ---
  if (isLoading) {
    return (
      <div className="min-h-screen bg-white">
        <div className="h-[85vh] bg-slate-100 animate-pulse" />
        <div className="max-w-prose mx-auto py-24 px-6 space-y-6">
          <div className="h-4 bg-slate-100 rounded w-full animate-pulse" />
        </div>
      </div>
    );
  }
  const safeSidebarLinks =
    typeof pageData?.sidebarLinks === "string"
      ? JSON.parse(pageData.sidebarLinks)
      : pageData?.sidebarLinks || [];
  if (isError || !pageData) return null;

  return (
    <>
      <SEO
        title={pageData.title}
        description={pageData.metaDescription || pageData.subtitle || undefined}
        image={pageData.heroImage || undefined}
        type="article"
      />
      <div className="min-h-screen bg-white selection:bg-daw-green selection:text-white">
        <Helmet>
          <title>{`${pageData.title} | DAW Group`}</title>
          <meta
            name="description"
            content={
              pageData.metaDescription ||
              pageData.subtitle ||
              "DAW Group Article"
            }
          />
          <meta property="og:title" content={pageData.title} />
          <meta property="og:image" content={pageData.heroImage || ""} />
          <meta property="og:type" content="article" />
        </Helmet>

        {/* Progress Bar */}
        <ScrollProgressBar />

        {/* Hero Section */}
        <section className="relative h-[85vh] flex items-center justify-center overflow-hidden">
          <div
            className="absolute inset-0 bg-cover bg-center transition-transform duration-700 hover:scale-105"
            style={{
              backgroundImage: `url(${
                pageData.heroImage
                  ? getCleanImageUrl(pageData.heroImage)
                  : "/placeholder.jpg"
              })`,
              backgroundAttachment: "fixed",
            }}
          />
          <div className="absolute inset-0 bg-[#004B23]/70 mix-blend-multiply" />
          <div className="absolute inset-0 bg-gradient-to-b from-slate-900/60 via-slate-900/40 to-slate-900/80" />

          <div className="relative z-10 text-center px-6 max-w-5xl mt-16 animate-in fade-in slide-in-from-bottom-12 duration-1000">
            <ScrollReveal direction="up" delay={0}>
              {pageData.subtitle && (
                <p className="text-emerald-400 font-bold tracking-[0.4em] uppercase text-[11px] mb-6 drop-shadow-md">
                  {pageData.subtitle}
                </p>
              )}
              <h1 className="text-5xl md:text-7xl lg:text-8xl font-serif font-bold text-white mb-10 leading-[1.1] tracking-tight drop-shadow-lg">
                {pageData.title}
              </h1>
              <div className="flex items-center justify-center gap-8">
                <div className="h-px w-16 bg-white/30" />
                <div className="w-3 h-3 border-2 border-daw-yellow rotate-45" />
                <div className="h-px w-16 bg-white/30" />
              </div>
            </ScrollReveal>
          </div>
        </section>

        {/* Main Layout Container */}
        <div className="bg-white relative z-20 shadow-[0_-20px_40px_rgba(0,0,0,0.05)] pt-18 pb-32">
          <div className="container mx-auto px-6 max-w-[90rem]">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
              {/* Sidebar Navigation: Table of Contents */}
              <aside className="hidden lg:block lg:col-span-3 sticky top-22 self-start w-full max-w-[280px]">
                {toc.length > 0 && (
                  <div className="pr-4 flex flex-col">
                    {/* Header ToC */}
                    <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.25em] mb-8 flex items-center gap-3">
                      <span className="w-8 h-[2px] bg-slate-200 rounded-full"></span>
                      Table of Contents
                    </h4>

                    {/* Navigasi List */}
                    <nav className="flex flex-col relative border-l-2 border-slate-100 ml-1">
                      {toc.map((item) => {
                        const isActive = activeTocId === item.id;

                        return (
                          <button
                            key={item.id}
                            onClick={() => scrollToHeading(item.id)}
                            title={item.text}
                            aria-current={isActive ? "true" : "false"}
                            className={`group text-left py-3 pr-4 relative transition-all duration-300 ease-out flex items-center w-full
                            /* Hierarki Indentasi & Tipografi */
                            ${item.level === 3 ? "pl-8 text-[12px]" : "pl-5 text-[13px] font-bold"}
                            
                            /* Status Aktif vs Inaktif (Tanpa Scale!) */
                            ${
                              isActive
                                ? "text-daw-green bg-gradient-to-r from-daw-green/[0.06] to-transparent"
                                : "text-slate-400 hover:text-slate-700 hover:bg-slate-50/80"
                            }`}
                          >
                            {/* Indikator Garis Aktif (Neon Glow) */}
                            {isActive && (
                              <span className="absolute left-[-2px] top-0 bottom-0 w-[2px] bg-daw-green rounded-full shadow-[0_0_10px_rgba(16,185,129,0.7)]" />
                            )}

                            {/* Text Constraint */}
                            <span className="line-clamp-2 leading-[1.4] w-full tracking-tight">
                              {item.text}
                            </span>
                          </button>
                        );
                      })}
                    </nav>
                  </div>
                )}
              </aside>

              {/* Dynamic Content Area */}
              <div className="lg:col-span-9 xl:col-span-6 min-w-0 w-full overflow-hidden">
                <div className="max-w-[720px] mx-auto">
                  <article
                    ref={articleRef}
                    className={`w-full text-left
                    /* 1. KUNCI ANTI OVERFLOW: Gunakan break-words sebagai jaring pengaman */
                    
                    [&>*:first-child]:mt-0
                    /* 2. PROSE CORE */ 
                    prose prose-slate prose-lg md:prose-xl max-w-none
                    prose-p:leading-[1.8] prose-p:text-slate-600 prose-p:mb-10 
                    prose-p:text-[1.125rem] md:prose-p:text-[1.2rem]
                    prose-headings:font-serif prose-headings:text-slate-900 prose-headings:scroll-mt-32 
                    
                    /* 3. HEADINGS - Serif Elegance */
                    prose-h2:text-3xl md:prose-h2:text-5xl prose-h2:mt-20 prose-h2:mb-8
                    prose-headings:tracking-tight prose-headings:font-bold
                    prose-h3:text-2xl md:prose-h3:text-3xl prose-h3:mt-12
                    
                    /* 4. MEDIA - Round & Polished */
                    [&_img]:rounded-[2rem] [&_img]:my-16
                    [&_iframe]:rounded-[1.5rem] [&_iframe]:shadow-2xl [&_iframe]:my-12
                    
                    /* 5. DROP CAP - The "Vogue" Style */
                    ${
                      pageData.showDropCap
                        ? `prose-p:first-of-type:first-letter:text-[6rem] 
                         prose-p:first-of-type:first-letter:font-serif 
                         prose-p:first-of-type:first-letter:font-black 
                         prose-p:first-of-type:first-letter:text-daw-green 
                         prose-p:first-of-type:first-letter:mr-5 
                         prose-p:first-of-type:first-letter:float-left 
                         prose-p:first-of-type:first-letter:leading-[0.7] 
                         prose-p:first-of-type:first-letter:mt-3
                         prose-p:first-of-type:first-letter:drop-shadow-sm`
                        : ""
                    }

                    /* 6. LISTS & BULLETS */
                    prose-li:marker:text-daw-green prose-li:my-2`}
                    dangerouslySetInnerHTML={{
                      __html: parsedContent.replace(/&nbsp;|\u00A0/g, " "),
                    }}
                  />
                </div>
              </div>

              {/* Supplementary Widget */}
              {safeSidebarLinks.length > 0 ? (
                <aside className="hidden lg:block lg:col-span-3 sticky top-32">
                  <div className="p-8 bg-slate-50 rounded-[2rem] border border-slate-100 shadow-sm">
                    <h4 className="text-lg font-serif font-bold text-slate-900 mb-4 flex items-center gap-2">
                      <Share2 className="w-5 h-5 text-daw-green" /> Inside this
                      Topic
                    </h4>
                    <p className="text-xs text-slate-500 leading-relaxed mb-6">
                      Discover more about DAW Group's related initiatives and
                      resources.
                    </p>

                    {/* Looping Link Dinamis */}
                    <div className="flex flex-col gap-2">
                      {safeSidebarLinks.map(
                        (
                          link: { url: string; label: string },
                          index: number,
                        ) => (
                          <Link
                            key={index}
                            to={link.url}
                            className="flex items-center justify-between p-4 bg-white rounded-xl border border-slate-200 hover:border-daw-green hover:shadow-md transition-all group"
                          >
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 group-hover:text-daw-green transition-colors">
                              {link.label}
                            </span>
                            <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-daw-green group-hover:translate-x-1 transition-transform" />
                          </Link>
                        ),
                      )}
                    </div>
                  </div>
                </aside>
              ) : (
                <div className="hidden lg:block lg:col-span-3" />
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
