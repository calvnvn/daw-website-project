import { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { Share2, ChevronRight } from "lucide-react";
import { Helmet } from "react-helmet-async";
import DOMPurify from "dompurify";
import api from "@/lib/api";

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
}

interface TocItem {
  id: string;
  text: string;
  level: number;
}

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

  // Security configuration for DOMPurify
  const sanitizeConfig = {
    ADD_TAGS: ["iframe"],
    ADD_ATTR: ["allow", "allowfullscreen", "frameborder", "scrolling", "id"],
    FORBID_ATTR: ["onerror", "onload", "onclick"],
  };

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
    setParsedContent(virtualDoc.body.innerHTML);

    console.log("Pre-Parsing Selesai, ID Permanen Ditanam.");
  }, [pageData?.content]);

  /**
   * Effect 3: Intersection Observer & Deep Linking
   * Monitors user scroll position to highlight active ToC items and handles initial anchor links.
   */
  useEffect(() => {
    if (toc.length === 0 || !parsedContent || !articleRef.current) return;

    const observerOptions = {
      rootMargin: "-120px 0px -50% 0px", // Offset for top header and mid-viewport detection
      threshold: 0,
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && entry.target.id) {
          console.log("🎯 Aktif:", entry.target.id);
          setActiveTocId(entry.target.id);
        }
      });
    }, observerOptions);

    const headingElements = articleRef.current.querySelectorAll("h2, h3");
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

    return () => observer.disconnect();
  }, [toc, parsedContent]);

  /**
   * Smooth scroll handler for ToC navigation
   * @param {string} id - The anchor ID to scroll to
   */
  const scrollToHeading = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      console.log("🖱️ Mencoba scroll ke:", id);
      element.scrollIntoView({ behavior: "smooth", block: "start" });
      setActiveTocId(id);

      // Update browser history without triggering page reload
      window.history.pushState(null, "", `#${id}`);
    } else {
      console.error("❌ Elemen tidak ditemukan untuk ID:", id);
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

  if (isError || !pageData) return null;

  return (
    <div className="min-h-screen bg-white selection:bg-daw-green selection:text-white">
      <Helmet>
        <title>{`${pageData.title} | DAW Group`}</title>
        <meta
          name="description"
          content={
            pageData.metaDescription || pageData.subtitle || "DAW Group Article"
          }
        />
        <meta property="og:title" content={pageData.title} />
        <meta property="og:image" content={pageData.heroImage || ""} />
        <meta property="og:type" content="article" />
      </Helmet>

      {/* Progress Bar */}
      <ScrollProgressBar />

      {/* Hero Section */}
      <section className="relative h-[85vh] min-h-[600px] flex items-center justify-center overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center transition-transform duration-700 hover:scale-105"
          style={{
            backgroundImage: `url(${pageData.heroImage || "/placeholder.jpg"})`,
            backgroundAttachment: "fixed",
          }}
        />
        <div className="absolute inset-0 bg-[#004B23]/70 mix-blend-multiply" />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900/60 via-slate-900/40 to-slate-900/80" />

        <div className="relative z-10 text-center px-6 max-w-5xl mt-16 animate-in fade-in slide-in-from-bottom-12 duration-1000">
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
            <div className="w-3 h-3 border-2 border-daw-green rotate-45" />
            <div className="h-px w-16 bg-white/30" />
          </div>
        </div>
      </section>

      {/* Main Layout Container */}
      <div className="bg-white relative z-20 shadow-[0_-20px_40px_rgba(0,0,0,0.05)] pt-18 pb-32">
        <div className="container mx-auto px-6 max-w-[90rem]">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
            {/* Sidebar Navigation: Table of Contents */}
            <aside className="hidden lg:block lg:col-span-3 sticky top-32 self-start w-full max-w-[280px]">
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
                    break-words
                    
                    /* 2. PROSE CORE */ 
                    prose prose-slate prose-lg md:prose-xl max-w-none
                    
                    /* 3. PARAGRAPH & MEDIA SAFETY: Pastikan gambar/iframe tidak meluber */
                    [&_p]:leading-[1.6] [&_p]:text-slate-700 [&_p]:mb-8 [&_p]:text-[1.125rem] 
                    [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-2xl
                    [&_iframe]:max-w-full [&_iframe]:rounded-xl
                    
                    /* 4. JUDUL & DROP CAP */
                    prose-headings:font-serif prose-headings:text-slate-900 prose-headings:tracking-tight
                    prose-h2:text-3xl md:prose-h2:text-4xl prose-h2:font-bold prose-h2:mt-16 prose-h2:mb-6 prose-h2:scroll-mt-32
                    
                    prose-p:first-of-type:first-letter:text-[5.5rem] prose-p:first-of-type:first-letter:font-serif 
                    prose-p:first-of-type:first-letter:font-black prose-p:first-of-type:first-letter:text-daw-green 
                    prose-p:first-of-type:first-letter:mr-4 prose-p:first-of-type:first-letter:float-left 
                    prose-p:first-of-type:first-letter:leading-[0.8] prose-p:first-of-type:first-letter:mt-1`}
                  dangerouslySetInnerHTML={{ __html: parsedContent }}
                />{" "}
              </div>
            </div>

            {/* Supplementary Widget (Split Template Only) */}
            {pageData.templateType === "split" ? (
              <aside className="hidden lg:block lg:col-span-3 sticky top-32">
                <div className="p-8 bg-slate-50 rounded-[2rem] border border-slate-100 shadow-sm">
                  <h4 className="text-lg font-serif font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <Share2 className="w-5 h-5 text-daw-green" /> Inside this
                    Topic
                  </h4>
                  <p className="text-xs text-slate-500 leading-relaxed mb-6">
                    Discover more about DAW Group's commitment to sustainability
                    and resource development.
                  </p>
                  <div className="flex flex-col gap-2">
                    <Link
                      to="/about"
                      className="flex items-center justify-between p-4 bg-white rounded-xl border border-slate-200 hover:border-daw-green transition-all group"
                    >
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                        About Us
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-daw-green" />
                    </Link>
                    <Link
                      to="/businesses"
                      className="flex items-center justify-between p-4 bg-white rounded-xl border border-slate-200 hover:border-daw-green transition-all group"
                    >
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                        Our Businesses
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-daw-green" />
                    </Link>
                  </div>
                </div>
              </aside>
            ) : (
              <div className="hidden lg:block lg:col-span-3" /> /* Ruang kosong penyeimbang */
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
