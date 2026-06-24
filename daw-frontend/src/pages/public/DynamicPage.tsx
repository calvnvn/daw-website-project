import { useState, useEffect, useRef, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Share2, ChevronRight, AlertTriangle, RefreshCw } from "lucide-react";
import DOMPurify from "dompurify";
import api, { BASE_UPLOAD_URL } from "@/lib/api";
import ScrollReveal from "@/components/ScrollReveal";
import { getCleanImageUrl } from "@/lib/utils";
import SEO from "@/components/SEO";
import { t } from "i18next";

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
  const { i18n } = useTranslation();
  const lang = i18n.language || "en";

  // STATES
  const [pageData, setPageData] = useState<PageData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [isNotFound, setIsNotFound] = useState(false);

  // Table of Contents & Content Processing States
  const [toc, setToc] = useState<TocItem[]>([]);
  const [activeTocId, setActiveTocId] = useState<string>("");
  const [parsedContent, setParsedContent] = useState<string>("");

  const articleRef = useRef<HTMLElement>(null);
  const isManualScrolling = useRef(false);

  // HELPERS
  // Safe JSON Parser
  const safeSidebarLinks = useMemo(() => {
    const links = pageData?.sidebarLinks;
    if (!links) return [];
    if (Array.isArray(links)) return links;
    try {
      if (typeof links === "string") {
        const parsed = JSON.parse(links);
        return Array.isArray(parsed) ? parsed : [];
      }
    } catch (e) {
      console.error("🚨 JSON Parsing SidebarLinks Failed", e);
    }
    return [];
  }, [pageData?.sidebarLinks]);

  // Effect 1: Data Acquisition. Fetches page data based on the URL slug and resets scroll position.
  useEffect(() => {
    const controller = new AbortController();
    const fetchPage = async () => {
      setIsLoading(true);
      setIsError(false);
      setIsNotFound(false);

      try {
        const res = await api.get(`/pages/slug/${slug}?lang=${lang}`);
        const data = res.data;
        if (!data || data.status === "Draft") {
          setIsNotFound(true);
          return;
        }

        setPageData(data);
      } catch (error: unknown) {
        if (
          typeof error === "object" &&
          error !== null &&
          "name" in error &&
          (error as { name?: string }).name === "CanceledError"
        )
          return; // Abaikan jika request dibatalkan
        if (
          (typeof error === "object" && error !== null && "response" in error
            ? (error as any).response?.status
            : undefined) === 404
        )
          setIsNotFound(true);
        else setIsError(true);
        console.error("Fetch Page Failure:", error);
      } finally {
        setIsLoading(false);
      }
    };
    if (slug) fetchPage();
    window.scrollTo(0, 0);
    return () => controller.abort();
  }, [slug, lang]);

  /**
   * Effect 2: Content Pre-Parsing & Persistent ID Injection
   */
  useEffect(() => {
    if (!pageData?.content) return;

    const transformContent = () => {
      const cleanHtml = DOMPurify.sanitize(pageData.content, sanitizeConfig);
      const parser = new DOMParser();
      const virtualDoc = parser.parseFromString(cleanHtml, "text/html");

      const walker = document.createTreeWalker(
        virtualDoc.body,
        NodeFilter.SHOW_TEXT,
      );
      let currentNode = walker.nextNode();
      while (currentNode) {
        if (currentNode.textContent) {
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
        items.push({
          id: baseId,
          text,
          level: heading.tagName === "H2" ? 2 : 3,
        });
      });

      try {
        virtualDoc.querySelectorAll("img").forEach((img) => {
          const src = img.getAttribute("src");
          if (src?.includes("/uploads/")) {
            const filename = src.split("/uploads/").pop();
            img.src = `${BASE_UPLOAD_URL}/${filename}`;
          }
        });
      } catch (e) {
        console.error("Image Path Normalization Failed", e);
      }
      setToc(items);
      setParsedContent(virtualDoc.body.innerHTML);
    };

    transformContent();
  }, [pageData?.content]);

  /**
   * Effect 3: Intersection Observer & Deep Linking (PRODUCTION-READY 🚀)
   * Monitors user scroll position to highlight active ToC items and handles initial anchor links.
   */
  useEffect(() => {
    if (toc.length === 0 || !parsedContent || !articleRef.current) return;

    const headingElements = Array.from(
      articleRef.current.querySelectorAll("h2, h3"),
    );
    if (headingElements.length === 0) return;

    const observerOptions = {
      root: null,
      rootMargin: "-20% 0px -75% 0px",
      threshold: 0,
    };

    const observer = new IntersectionObserver((entries) => {
      if (isManualScrolling.current) return;

      entries.forEach((entry) => {
        if (entry.isIntersecting && entry.target.id) {
          setActiveTocId(entry.target.id);
        }
      });
    }, observerOptions);

    headingElements.forEach((el) => observer.observe(el));

    if (window.location.hash) {
      const hashId = window.location.hash.substring(1);
      requestAnimationFrame(() => {
        const element = document.getElementById(hashId);
        if (element) {
          const yOffset = -100;
          const y =
            element.getBoundingClientRect().top + window.scrollY + yOffset;
          window.scrollTo({ top: y, behavior: "smooth" });
          setActiveTocId(hashId);
        }
      });
    }

    return () => {
      observer.disconnect();
    };
  }, [toc, parsedContent]);

  // EVENT HANDLERS
  const scrollToHeading = (id: string) => {
    const element = document.getElementById(id);
    if (!element) return;
    isManualScrolling.current = true;
    setActiveTocId(id);
    const yOffset = -100;
    const y = element.getBoundingClientRect().top + window.scrollY + yOffset;
    window.scrollTo({ top: y, behavior: "smooth" });
    window.history.pushState(null, "", `#${id}`);
    setTimeout(() => {
      isManualScrolling.current = false;
    }, 800);
  };

  // RENDER GUARDS
  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-4 border-slate-100 border-t-daw-green rounded-full animate-spin mb-4" />
        <p className="text-xs font-black uppercase tracking-widest text-slate-400">
          Loading Article...
        </p>
      </div>
    );
  }

  if (isNotFound) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center">
        <h2 className="text-4xl font-serif font-bold text-slate-900 mb-4">
          Page Not Found
        </h2>
        <p className="text-slate-500 mb-8 max-w-md">
          Sorry, the content you are looking for is not available.
        </p>
        <Link
          to="/"
          className="px-6 py-3 bg-daw-green text-white font-bold rounded-xl hover:bg-emerald-700 transition-all">
          Return to Home
        </Link>
      </div>
    );
  }

  if (isError || !pageData) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center">
        <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
        <h2 className="text-xl font-bold text-slate-900 mb-2">
          Network Error Occurred
        </h2>
        <p className="text-slate-500 mb-6">
          Failed to load content. Please check your internet connection.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="text-daw-green font-bold flex items-center gap-2">
          <RefreshCw className="w-4 h-4" /> Try Again
        </button>
      </div>
    );
  }

  // SMART GRID LOGIC
  const hasToc = toc.length > 0;
  const hasSidebar = safeSidebarLinks.length > 0;

  let mainColClass = "lg:col-span-12 max-w-4xl mx-auto"; 
  if (hasToc && hasSidebar) mainColClass = "lg:col-span-9 xl:col-span-6 max-w-[720px]";
  else if (hasToc && !hasSidebar) mainColClass = "lg:col-span-9 max-w-4xl w-full";
  else if (!hasToc && hasSidebar) mainColClass = "lg:col-span-9 max-w-4xl w-full";

  // Generate SEO Description Fallback
  let seoFallback = "DAW Group Article";
  if (pageData) {
    seoFallback = pageData.content
        .replace(/<[^>]*>?/gm, " ")
        .replace(/&nbsp;|\u00A0/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/&quot;/gi, '"')
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 150) + "...";
  }

  return (
    <>
      <SEO
        title={`${pageData.title} | DAW Group`}
        description={
          pageData.metaDescription || pageData.subtitle || seoFallback
        }
        image={pageData.heroImage || undefined}
        type="article"
      />
      <div className="min-h-screen bg-white selection:bg-daw-green selection:text-white">
        <ScrollProgressBar />
        {/* Hero Section */}
        <section className="relative h-[85vh] flex items-center justify-center overflow-hidden">
          <div
            className={`absolute inset-0 bg-cover bg-center transition-transform duration-1000 hover:scale-105 ${
              !pageData.heroImage ? "bg-slate-800" : ""
            }`}
            style={
              pageData.heroImage
                ? {
                    backgroundImage: `url(${getCleanImageUrl(pageData.heroImage)})`,
                    backgroundAttachment: "fixed",
                  }
                : {}
            }
          />
          
          {/* MESH PATTERN FALLBACK */}
          {!pageData.heroImage && (
            <div 
              className="absolute inset-0 opacity-20 mix-blend-overlay" 
              style={{ backgroundImage: "radial-gradient(#10b981 1.5px, transparent 1.5px)", backgroundSize: "32px 32px" }} 
            />
          )}

          <div className="absolute inset-0 bg-daw-green/20 mix-blend-multiply" />
          <div className="absolute inset-0 bg-gradient-to-b from-slate-900/60 via-slate-900/40 to-slate-900/80" />

          {/* Text Content */}
          <div className="relative z-10 text-center px-6 max-w-5xl mt-16 animate-in fade-in slide-in-from-bottom-12 duration-1000">
            <ScrollReveal direction="up" delay={0}>
              {pageData.subtitle && (
                <p className="text-emerald-400 font-bold tracking-[0.4em] uppercase text-[11px] mb-6 drop-shadow-md">
                  {pageData.subtitle}
                </p>
              )}
              <h1 className="text-5xl md:text-7xl lg:text-8xl font-serif font-bold text-white mb-10 leading-[1.1] tracking-tight drop-shadow-2xl mix-blend-normal">
                {pageData.title}
              </h1>
            </ScrollReveal>

            <ScrollReveal direction="up" delay={200}>
              {/* Dekorasi Garis */}
              <div className="flex items-center justify-center gap-8">
                <div className="h-px w-16 bg-white/30" />
                <div className="w-3 h-3 border-2 border-daw-yellow rotate-45" />
                <div className="h-px w-16 bg-white/30" />
              </div>
            </ScrollReveal>
          </div>

          {/* Scroll Down Indicator */}
          <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-slate-500 animate-bounce">
            <span className="text-[10px] font-bold tracking-widest uppercase text-slate-400">
              {t("ui.scroll", "Scroll to Explore")}
            </span>
            <ChevronRight className="rotate-90 w-4 h-4 text-slate-400" />
          </div>
        </section>

        {/* Main Layout Container */}
        <div className="bg-white relative z-20 shadow-[0_-20px_40px_rgba(0,0,0,0.05)] pt-18 pb-32">
          <div className="container mx-auto px-6 max-w-[90rem]">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
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
                            }`}>
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
              <div className={`${mainColClass} min-w-0 overflow-hidden`}>
                <div className="w-full">
                  <article
                    ref={articleRef}
                    className={`w-full text-left
                    /* 1. KUNCI ANTI OVERFLOW: Gunakan break-words sebagai jaring pengaman */
                    break-words
                    
                    [&>*:first-child]:mt-0
                    /* 2. PROSE CORE */ 
                    prose prose-slate prose-lg md:prose-xl max-w-none
                    prose-p:leading-[1.9] prose-p:text-slate-600 prose-p:mb-6 
                    prose-p:text-[1.125rem] md:prose-p:text-[1.2rem]
                    prose-headings:font-serif prose-headings:text-slate-900 prose-headings:scroll-mt-32 
                    
                    /* 3. HEADINGS - Serif Elegance */
                    prose-h2:text-3xl md:prose-h2:text-5xl prose-h2:mt-12 prose-h2:mb-8
                    prose-headings:tracking-tight prose-headings:font-bold
                    prose-h3:text-2xl md:prose-h3:text-3xl prose-h3:mt-10
                    
                    /* 4. MEDIA - Round & Polished */
                    [&_img]:rounded-[2rem] [&_img]:my-8 [&_img]:shadow-xl
                    [&_iframe]:rounded-[1.5rem] [&_iframe]:shadow-2xl [&_iframe]:my-8
                    
                    /* 5. DROP CAP - The "Vogue" Style */
                    ${
                      pageData.showDropCap
                        ? `prose-p:first-of-type:first-letter:text-[6rem] 
                         prose-p:first-of-type:first-letter:font-serif 
                         prose-p:first-of-type:first-letter:font-black 
                         prose-p:first-of-type:first-letter:text-daw-green 
                         prose-p:first-of-type:first-letter:mr-5 
                         prose-p:first-of-type:first-letter:float-left 
                         prose-p:first-of-type:first-letter:leading-[0.75] 
                         prose-p:first-of-type:first-letter:mt-3
                         prose-p:first-of-type:first-letter:drop-shadow-sm`
                        : ""
                    }

                    /* 6. LISTS & BULLETS */
                    prose-li:marker:text-daw-green prose-li:my-2
                    
                    /* 7. BLOCKQUOTE - Premium Editorial */
                    prose-blockquote:border-l-[6px] prose-blockquote:border-daw-green 
                    prose-blockquote:bg-slate-50/80 prose-blockquote:py-4 prose-blockquote:px-8 
                    prose-blockquote:rounded-r-2xl prose-blockquote:font-serif 
                    prose-blockquote:text-2xl prose-blockquote:italic prose-blockquote:text-slate-700
                    prose-blockquote:shadow-sm prose-blockquote:my-10
                    
                    /* 8. STRONG & LINKS */
                    prose-strong:text-slate-900 prose-strong:font-bold
                    prose-a:text-daw-green prose-a:no-underline hover:prose-a:text-emerald-700 hover:prose-a:underline hover:prose-a:decoration-2 hover:prose-a:underline-offset-4 transition-all
                    
                    /* 9. TABLES */
                    prose-table:w-full prose-table:rounded-xl prose-table:overflow-hidden prose-table:shadow-sm
                    prose-thead:bg-slate-50 prose-th:px-6 prose-th:py-4 prose-th:text-slate-800 prose-th:font-bold
                    prose-td:px-6 prose-td:py-4 prose-td:border-b prose-td:border-slate-100`}
                    dangerouslySetInnerHTML={{
                      __html: parsedContent.replace(/&nbsp;|\u00A0/g, " "),
                    }}
                  />
                </div>
              </div>

              {/* Supplementary Widget */}
              {hasSidebar && (
                <aside className="lg:col-span-3 sticky top-32">
                  <div className="p-8 bg-slate-50 rounded-[2rem] border border-slate-100 shadow-sm">
                    <h4 className="text-lg font-serif font-bold text-slate-900 mb-4 flex items-center gap-2">
                      <Share2 className="w-5 h-5 text-daw-green" /> Inside this
                      Topic
                    </h4>
                    <p className="text-xs text-slate-500 leading-relaxed mb-6">
                      Discover more about this topic.
                    </p>
                    <div className="flex flex-col gap-2">
                      {safeSidebarLinks.map((link, index) => (
                        <Link
                          key={`sidebar-link-${index}`}
                          to={link.url}
                          className="flex items-center justify-between p-4 bg-white rounded-xl border border-slate-200 hover:border-daw-green hover:shadow-md transition-all group">
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-700 group-hover:text-daw-green transition-colors">
                            {link.label}
                          </span>
                          <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-daw-green group-hover:translate-x-1 transition-transform" />
                        </Link>
                      ))}
                    </div>
                  </div>
                </aside>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
