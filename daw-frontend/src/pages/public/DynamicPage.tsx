import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Share2, ChevronRight } from "lucide-react";
import api from "@/lib/api";

export default function DynamicPage() {
  const { slug } = useParams();
  const navigate = useNavigate();

  const [pageData, setPageData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);

  // --- FETCH PAGE DATA ---
  useEffect(() => {
    const fetchPage = async () => {
      setIsLoading(true);
      try {
        const res = await api.get(`/pages/slug/${slug}`);
        setPageData(res.data);
        document.title = `${res.data.title} | DAW Group`;
      } catch (error) {
        console.error("Page not found:", error);
        setIsError(true);
      } finally {
        setIsLoading(false);
      }
    };

    if (slug) fetchPage();
    window.scrollTo(0, 0);
  }, [slug]);

  // --- TRACK READING PROGRESS ---
  useEffect(() => {
    const handleScroll = () => {
      const totalHeight =
        document.documentElement.scrollHeight - window.innerHeight;
      const progress = (window.scrollY / totalHeight) * 100;
      setScrollProgress(progress);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // --- LOADING UI ---
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-6">
          <div className="w-12 h-12 border-4 border-daw-green border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-400 font-bold tracking-[0.2em] uppercase text-xs animate-pulse">
            Loading Content...
          </p>
        </div>
      </div>
    );
  }

  // --- ERROR 404 UI ---
  if (isError || !pageData) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center bg-slate-50">
        <h1 className="text-[10rem] font-serif font-black text-slate-200 leading-none drop-shadow-sm mb-4">
          404
        </h1>
        <h2 className="text-3xl font-bold text-slate-800 mb-2">
          Page Not Found
        </h2>
        <p className="text-slate-500 mb-8 max-w-md">
          Sorry, the page you are looking for might have been removed, had its
          name changed, or is temporarily unavailable.
        </p>
        <button
          onClick={() => navigate("/")}
          className="group flex items-center gap-3 bg-daw-green text-white px-8 py-3.5 rounded-full font-bold shadow-md hover:bg-[#003b1c] transition-all duration-300"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Back to Home
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white selection:bg-daw-green selection:text-white">
      {/* 🚀 PROGRESS BAR */}
      <div
        className="fixed top-0 left-0 h-1.5 bg-gradient-to-r from-daw-green via-emerald-400 to-daw-green z-[100] transition-all duration-150 ease-out shadow-[0_0_10px_rgba(16,185,129,0.5)]"
        style={{ width: `${scrollProgress}%` }}
      />

      {/* --- 🚀 HERO BANNER (Matches About Us & Businesses Pro Version) --- */}
      <section className="relative h-[85vh] min-h-[600px] flex items-center justify-center overflow-hidden">
        {/* Parallax Background */}
        <div
          className="absolute inset-0 bg-cover bg-center transition-transform duration-700 hover:scale-105"
          style={{
            backgroundImage: `url(${pageData.heroImage || "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80"})`,
            backgroundAttachment: "fixed", // Efek Parallax
          }}
        />

        {/* Color Blending & Gradient Overlay (Sama dengan Businesses) */}
        <div className="absolute inset-0 bg-[#004B23]/70 mix-blend-multiply" />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900/60 via-slate-900/40 to-slate-900/80" />

        {/* Text Content */}
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

        {/* Scroll Indicator Decoration */}
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-white/50 animate-bounce">
          <span className="text-[10px] font-bold tracking-widest uppercase">
            Scroll to Explore
          </span>
          <ChevronRight className="rotate-90 w-4 h-4" />
        </div>
      </section>

      {/* --- SECTIONS CONTAINER --- */}
      <div className="flex flex-col relative py-24">
        {/* Ambient Blur Decoration (Konsisten dengan halaman lain) */}
        <div className="absolute top-40 right-0 w-[500px] h-[500px] bg-daw-green/[0.03] rounded-full blur-[120px] -z-10 pointer-events-none" />

        <div
          className={`container mx-auto px-6 max-w-7xl relative z-10 ${pageData.templateType === "split" ? "grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20" : ""}`}
        >
          {/* Main Article */}
          <div
            className={`${pageData.templateType === "split" ? "lg:col-span-8" : "max-w-4xl mx-auto"}`}
          >
            <article
              className="w-full min-w-0 text-pretty
                /* Editorial Typography Classes */
                prose prose-lg md:prose-xl max-w-none 
                prose-headings:font-serif prose-headings:font-bold prose-headings:text-slate-900 prose-headings:tracking-tight
                prose-h2:text-3xl md:prose-h2:text-4xl prose-h2:mb-6 prose-h2:mt-12
                
                prose-p:font-sans prose-p:text-slate-600 prose-p:leading-relaxed prose-p:mb-8 prose-p:text-justify
                
                /* Magazine Style Drop Cap */
                prose-p:first-of-type:first-letter:text-7xl md:prose-p:first-of-type:first-letter:text-8xl prose-p:first-of-type:first-letter:font-serif prose-p:first-of-type:first-letter:font-black prose-p:first-of-type:first-letter:text-daw-green prose-p:first-of-type:first-letter:mr-4 prose-p:first-of-type:first-letter:float-left prose-p:first-of-type:first-letter:leading-[0.8] prose-p:first-of-type:first-letter:mt-2
                
                /* Image Styling within Rich Text */
                [&_img]:rounded-2xl [&_img]:shadow-lg [&_img]:my-12 [&_img]:mx-auto
                
                prose-blockquote:border-l-4 prose-blockquote:border-daw-green prose-blockquote:bg-slate-50 prose-blockquote:py-6 prose-blockquote:px-8 prose-blockquote:text-slate-700 prose-blockquote:font-serif prose-blockquote:text-xl prose-blockquote:italic prose-blockquote:rounded-r-2xl
                
                prose-a:text-daw-green prose-a:font-bold prose-a:no-underline hover:prose-a:underline underline-offset-4"
              dangerouslySetInnerHTML={{ __html: pageData.content }}
            />
          </div>

          {/* Sidebar (Only visible if Admin chose 'split' template) */}
          {pageData.templateType === "split" && (
            <aside className="lg:col-span-4 space-y-12 animate-in fade-in slide-in-from-right-10 duration-1000">
              <div className="sticky top-32">
                <div className="p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100 shadow-sm">
                  <h4 className="text-xl font-serif font-bold text-slate-900 mb-6 flex items-center gap-3">
                    <Share2 className="w-5 h-5 text-daw-green" /> Inside this
                    Topic
                  </h4>
                  <p className="text-sm text-slate-500 leading-relaxed mb-8">
                    Discover more about DAW Group's commitment to
                    sustainability, energy, and resource development.
                  </p>
                  <div className="flex flex-col gap-3">
                    <Link
                      to="/about"
                      className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-200 hover:border-daw-green transition-all group"
                    >
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                        About Us
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-daw-green transition-colors" />
                    </Link>
                    <Link
                      to="/businesses"
                      className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-200 hover:border-daw-green transition-all group"
                    >
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                        Our Businesses
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-daw-green transition-colors" />
                    </Link>
                  </div>
                </div>
              </div>
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}
