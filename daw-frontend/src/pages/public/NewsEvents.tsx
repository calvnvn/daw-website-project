import { useState, useEffect, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight, Calendar, Clock, User, Filter, ImageIcon,
  Search, ChevronLeft, ChevronRight, Loader2,
} from "lucide-react";
import ScrollReveal from "@/components/ScrollReveal";
import SEO from "@/components/SEO";
import GlobalHeroBanner from "@/components/ui/GlobalHeroBanner";
import bannerImg from "@/assets/about-banner.jpg";
import api, { BASE_UPLOAD_URL } from "@/lib/api";

interface CategoryData {
  id: string;
  name: string;
  slug: string;
  color: string;
}

interface Article {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  cover_image: string;
  category_id: string;
  published_at: string;
  author: string;
  read_time: string;
  views: number;
  createdAt: string;
  categoryData?: CategoryData | null;
}

interface PaginationData {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
}

export default function NewsEvents() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [categories, setCategories] = useState<CategoryData[]>([]);
  const [pagination, setPagination] = useState<PaginationData>({ currentPage: 1, totalPages: 1, totalItems: 0, itemsPerPage: 6 });
  const [isLoading, setIsLoading] = useState(true);

  const [activeCategory, setActiveCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [scrollProgress, setScrollProgress] = useState(0);

  const ITEMS_PER_PAGE = 6;

  // Fetch categories on mount
  useEffect(() => {
    api.get("/news/public/categories").then((res) => {
      if (Array.isArray(res.data)) setCategories(res.data);
    }).catch(console.error);
  }, []);

  // Fetch articles when page/filter/search changes
  useEffect(() => {
    const fetchArticles = async () => {
      setIsLoading(true);
      try {
        const params: Record<string, string | number> = {
          page: currentPage,
          limit: ITEMS_PER_PAGE,
        };
        if (searchQuery.trim()) params.search = searchQuery.trim();
        if (activeCategory !== "All") params.category = activeCategory;

        const res = await api.get("/news/public", { params });
        setArticles(res.data.data || []);
        setPagination(res.data.pagination || { currentPage: 1, totalPages: 1, totalItems: 0, itemsPerPage: ITEMS_PER_PAGE });
      } catch (error) {
        console.error("Error fetching news:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchArticles();
  }, [currentPage, activeCategory, searchQuery]);

  // Reset page when filter/search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeCategory, searchQuery]);

  // Scroll progress
  useEffect(() => {
    const handleScroll = () => {
      const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
      setScrollProgress(totalHeight > 0 ? (window.scrollY / totalHeight) * 100 : 0);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Auto-scroll on page change
  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) { isInitialMount.current = false; return; }
    const timer = setTimeout(() => {
      document.getElementById("article-grid")?.scrollIntoView({ behavior: "smooth" });
    }, 100);
    return () => clearTimeout(timer);
  }, [currentPage]);

  // Featured article (only on All + page 1 + no search)
  const featuredArticle = activeCategory === "All" && searchQuery === "" && currentPage === 1 ? articles[0] : null;
  const gridArticles = featuredArticle ? articles.slice(1) : articles;

  const getImageUrl = (img: string) => {
    if (!img) return "";
    if (img.startsWith("http")) return img;
    return `${BASE_UPLOAD_URL}/${img}`;
  };

  const getCategoryName = (article: Article) => article.categoryData?.name || "Uncategorized";

  return (
    <>
      <SEO title="News & Events" description="Stay updated with the latest news, events, press releases, and CSR activities from PT Dharma Agung Wijaya." />

      <div className="bg-white min-h-screen overflow-x-hidden w-full relative">
        <div className="fixed top-0 left-0 h-1.5 bg-gradient-to-r from-daw-green via-emerald-400 to-daw-green z-[100] transition-all duration-150 ease-out shadow-[0_0_10px_rgba(16,185,129,0.5)]" style={{ width: `${scrollProgress}%` }} />

        <GlobalHeroBanner title="News & Events" targetIndex={2} localFallback={bannerImg} />

        <div id="news-feed" className="max-w-7xl mx-auto px-6 py-16 animate-in fade-in duration-500 scroll-mt-24">
          {/* Control Bar */}
          <div className="flex flex-col lg:flex-row items-center justify-between gap-6 mb-12 border-b border-slate-100 pb-8">
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2">
              <button onClick={() => setActiveCategory("All")} className={`px-5 py-2.5 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all ${activeCategory === "All" ? "bg-daw-green text-white shadow-md shadow-green-900/20" : "bg-slate-50 text-slate-500 hover:bg-slate-100"}`}>
                All Categories
              </button>
              {categories.map((cat) => (
                <button key={cat.id} onClick={() => setActiveCategory(cat.id)} className={`px-5 py-2.5 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all ${activeCategory === cat.id ? "bg-daw-green text-white shadow-md shadow-green-900/20" : "bg-slate-50 text-slate-500 hover:bg-slate-100"}`}>
                  {cat.name}
                </button>
              ))}
            </div>
            <div className="w-full lg:w-80 relative group">
              <input type="text" placeholder="Search articles..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-slate-50/50 border border-slate-200 rounded-full py-3 pl-11 pr-4 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-daw-green/20 focus:border-daw-green hover:border-slate-300 transition-all shadow-sm" />
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-daw-green transition-colors" />
            </div>
          </div>

          {/* Loading State */}
          {isLoading ? (
            <div className="flex items-center justify-center py-32">
              <div className="flex flex-col items-center gap-4 text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin" />
                <p className="text-sm font-medium">Memuat artikel...</p>
              </div>
            </div>
          ) : (
            <>
              {/* Featured Article */}
              {featuredArticle && (
                <ScrollReveal direction="up" delay={0}>
                  <Link to={`/news/${featuredArticle.slug}`} id="featured-article" className="group block mb-16 rounded-2xl overflow-hidden border border-slate-100 shadow-sm hover:shadow-2xl transition-all duration-500">
                    <div className="grid grid-cols-1 lg:grid-cols-2">
                      <div className="aspect-[16/10] lg:aspect-auto bg-slate-100 overflow-hidden relative">
                        {featuredArticle.cover_image ? (
                          <img src={getImageUrl(featuredArticle.cover_image)} alt={featuredArticle.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-300"><ImageIcon className="w-16 h-16" /></div>
                        )}
                        <div className="absolute top-4 left-4 bg-daw-green text-white px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.15em] rounded-lg">{getCategoryName(featuredArticle)}</div>
                      </div>
                      <div className="p-8 md:p-10 lg:p-12 flex flex-col justify-center">
                        <p className="text-[10px] font-bold text-slate-400 mb-4 uppercase tracking-widest">
                          {new Date(featuredArticle.published_at || featuredArticle.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} · {featuredArticle.read_time || "5 min read"}
                        </p>
                        <h2 className="text-2xl md:text-3xl font-serif font-bold text-slate-900 mb-4 group-hover:text-daw-green transition-colors leading-snug">{featuredArticle.title}</h2>
                        <p className="text-slate-500 text-sm leading-relaxed mb-6 line-clamp-3">{featuredArticle.excerpt}</p>
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-slate-400 text-[10px] font-bold uppercase tracking-widest"><User className="w-3 h-3" />{featuredArticle.author}</span>
                          <span className="flex items-center text-xs font-black uppercase tracking-widest text-daw-green">Read Article <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-2 transition-transform" /></span>
                        </div>
                      </div>
                    </div>
                  </Link>
                </ScrollReveal>
              )}

              {/* Article Grid */}
              <div id="article-grid" className="scroll-mt-56">
                {gridArticles.length === 0 ? (
                  <div className="text-center text-slate-400 py-32 border-2 border-dashed border-slate-100 rounded-3xl">
                    <Filter className="w-12 h-12 mx-auto mb-4 opacity-20" />
                    <p className="font-bold">No articles found in this category.</p>
                    <button onClick={() => setActiveCategory("All")} className="text-daw-green text-sm underline mt-2">Clear all filters</button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {gridArticles.map((article, idx) => (
                      <ScrollReveal key={article.id} direction="up" delay={idx * 60}>
                        <Link to={`/news/${article.slug}`} id={`article-${article.id}`} className={`group flex bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-sm hover:shadow-2xl transition-all duration-500 hover:-translate-y-1 h-full ${idx % 3 === 0 ? "flex-col" : "flex-row md:flex-col"}`}>
                          <div className={`relative bg-slate-100 overflow-hidden shrink-0 ${idx % 3 === 0 ? "w-full aspect-[4/3]" : "w-[35%] md:w-full aspect-square md:aspect-[4/3]"}`}>
                            {article.cover_image ? (
                              <img src={getImageUrl(article.cover_image)} alt={article.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" loading="lazy" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-slate-300"><ImageIcon className="w-8 h-8 md:w-10 md:h-10" /></div>
                            )}
                            <div className={`absolute top-3 left-3 md:top-4 md:left-4 bg-white/95 backdrop-blur-sm text-[9px] font-black uppercase tracking-[0.15em] text-daw-green rounded-lg shadow-sm ${idx % 3 === 0 ? "px-3 py-1.5" : "px-2 py-1 md:px-3 md:py-1.5 hidden md:block"}`}>
                              {getCategoryName(article)}
                            </div>
                          </div>
                          <div className={`flex flex-col flex-1 ${idx % 3 === 0 ? "p-6 md:p-8" : "p-4 md:p-8"}`}>
                            <p className={`text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-3 flex-wrap ${idx % 3 === 0 ? "mb-3" : "mb-2 md:mb-3"}`}>
                              <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(article.published_at || article.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                              <span className={`flex items-center gap-1 ${idx % 3 === 0 ? "" : "hidden sm:flex md:flex"}`}><Clock className="w-3 h-3" />{article.read_time || "5 min"}</span>
                            </p>
                            <h3 className={`font-bold text-slate-900 group-hover:text-daw-green transition-colors leading-snug line-clamp-2 ${idx % 3 === 0 ? "text-xl mb-4" : "text-sm sm:text-base md:text-xl mb-2 md:mb-4"}`}>{article.title}</h3>
                            <p className={`text-slate-500 leading-relaxed flex-1 ${idx % 3 === 0 ? "text-sm line-clamp-3 mb-5" : "text-xs line-clamp-2 mb-2 md:mb-5 hidden md:block"}`}>{article.excerpt}</p>
                            <div className={`mt-auto items-center text-[10px] md:text-xs font-black uppercase tracking-widest text-daw-green ${idx % 3 === 0 ? "pt-5 border-t border-slate-50 flex" : "pt-2 md:pt-6 md:border-t border-slate-50 hidden md:flex"}`}>
                              Read Article <ArrowRight className="w-3 h-3 md:w-4 md:h-4 ml-1 md:ml-2 group-hover:translate-x-1 md:group-hover:translate-x-2 transition-transform" />
                            </div>
                          </div>
                        </Link>
                      </ScrollReveal>
                    ))}
                  </div>
                )}
              </div>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="mt-16 flex items-center justify-center gap-3">
                  <button onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))} disabled={currentPage === 1} className="w-10 h-10 rounded-full flex items-center justify-center border border-slate-200 text-slate-500 hover:bg-daw-green hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm">
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <div className="flex items-center gap-1.5">
                    {Array.from({ length: pagination.totalPages }).map((_, i) => (
                      <button key={i} onClick={() => setCurrentPage(i + 1)} className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all ${currentPage === i + 1 ? "bg-daw-green text-white shadow-md shadow-green-900/20" : "border border-transparent text-slate-600 hover:bg-slate-100"}`}>
                        {i + 1}
                      </button>
                    ))}
                  </div>
                  <button onClick={() => setCurrentPage((prev) => Math.min(prev + 1, pagination.totalPages))} disabled={currentPage === pagination.totalPages} className="w-10 h-10 rounded-full flex items-center justify-center border border-slate-200 text-slate-500 hover:bg-daw-green hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm">
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
