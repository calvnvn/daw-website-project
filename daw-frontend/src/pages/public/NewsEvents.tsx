import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Calendar,
  Clock,
  Filter,
  ImageIcon,
  Search,
  ChevronLeft,
  ChevronRight,
  Loader2,
  X,
  TrendingUp,
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
  published_count?: number;
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
  const [pagination, setPagination] = useState<PaginationData>({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    itemsPerPage: 6,
  });
  const [isLoading, setIsLoading] = useState(true);

  const [activeCategory, setActiveCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [scrollProgress, setScrollProgress] = useState(0);

  const ITEMS_PER_PAGE = 6;

  // Fetch categories on mount
  useEffect(() => {
    api
      .get("/news/public/categories")
      .then((res) => {
        if (Array.isArray(res.data)) {
          const activeCats = res.data.filter((c: any) => c.published_count > 0);
          setCategories(activeCats);
        }
      })
      .catch(console.error);
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
        setPagination(
          res.data.pagination || {
            currentPage: 1,
            totalPages: 1,
            totalItems: 0,
            itemsPerPage: ITEMS_PER_PAGE,
          },
        );
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
      const totalHeight =
        document.documentElement.scrollHeight - window.innerHeight;
      setScrollProgress(
        totalHeight > 0 ? (window.scrollY / totalHeight) * 100 : 0,
      );
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Auto-scroll on page change
  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    const timer = setTimeout(() => {
      document
        .getElementById("article-grid")
        ?.scrollIntoView({ behavior: "smooth" });
    }, 100);
    return () => clearTimeout(timer);
  }, [currentPage]);

  // Featured article (only on All + page 1 + no search)
  const featuredArticle =
    activeCategory === "All" && searchQuery === "" && currentPage === 1
      ? articles[0]
      : null;
  const gridArticles = featuredArticle ? articles.slice(1) : articles;

  const getImageUrl = (img: string) => {
    if (!img) return "";
    if (img.startsWith("http")) return img;
    return `${BASE_UPLOAD_URL}/${img}`;
  };

  const getCategoryName = (article: Article) =>
    article.categoryData?.name || "Uncategorized";

  return (
    <>
      <SEO
        title="News & Events"
        description="Stay updated with the latest news, events, press releases, and CSR activities from PT Dharma Agung Wijaya."
      />

      <div className="bg-slate-50/50 min-h-screen overflow-x-hidden w-full relative">
        <div
          className="fixed top-0 left-0 h-1.5 bg-gradient-to-r from-daw-green via-emerald-400 to-daw-green z-[100] transition-all duration-150 ease-out shadow-[0_0_10px_rgba(16,185,129,0.5)]"
          style={{ width: `${scrollProgress}%` }}
        />

        <GlobalHeroBanner
          title="News & Events"
          targetIndex={2}
          localFallback={bannerImg}
        />

        <div
          id="news-feed"
          className="max-w-7xl mx-auto px-6 py-12 animate-in fade-in duration-500 scroll-mt-24">
          {/* Enhanced Control Bar */}
          <div className="flex flex-col lg:flex-row items-center justify-between gap-8 mb-8 bg-white p-4 rounded-[2rem] shadow-sm border border-slate-100">
            {/* Category Pills */}
            <div className="flex flex-nowrap lg:flex-wrap items-center justify-start lg:justify-start gap-2 w-full lg:w-auto overflow-x-auto no-scrollbar pb-1 py-2 px-1 lg:pb-0">
              <button
                onClick={() => setActiveCategory("All")}
                className={`px-5 py-2.5 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeCategory === "All" ? "bg-daw-green text-white shadow-md shadow-green-900/20 scale-105" : "bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-800"}`}>
                All Categories
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`px-5 py-2.5 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap flex items-center gap-2 ${activeCategory === cat.id ? "bg-daw-green text-white shadow-md shadow-green-900/20 scale-105" : "bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-800"}`}>
                  {cat.name}
                  {activeCategory === cat.id && (
                    <span className="bg-white/20 px-1.5 py-0.5 rounded-md text-[9px]">
                      {cat.published_count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Rich Search Bar */}
            <div className="w-full lg:w-96 relative group z-30 shrink-0">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search articles, topics..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-full py-3.5 pl-12 pr-10 text-sm text-slate-700 focus:outline-none focus:ring-4 focus:ring-daw-green/10 focus:border-daw-green hover:border-slate-300 transition-all shadow-inner"
                />
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-daw-green transition-colors" />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 hover:text-red-500 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Popular Searches Popover */}
              <div className="absolute top-full left-0 right-0 mt-3 bg-white rounded-2xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)] border border-slate-100 p-5 opacity-0 invisible group-focus-within:opacity-100 group-focus-within:visible transition-all duration-300 translate-y-2 group-focus-within:translate-y-0 before:content-[''] before:absolute before:-top-2 before:left-10 before:w-4 before:h-4 before:bg-white before:border-t before:border-l before:border-slate-100 before:rotate-45">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5" /> Popular Searches
                </span>
                <div className="flex flex-wrap gap-2 relative z-10">
                  {[
                    "Sustainability",
                    "Energi Terbarukan",
                    "Penghargaan",
                    "Inovasi",
                    "Pembangkit Listrik",
                    "CSR",
                  ].map((tag) => (
                    <button
                      key={tag}
                      onMouseDown={(e) => {
                        e.preventDefault(); // Prevent input blur on click
                        setSearchQuery(tag);
                      }}
                      className="px-3 py-1.5 bg-slate-50 hover:bg-daw-green hover:text-white text-slate-600 text-xs font-bold rounded-xl border border-slate-200 hover:border-daw-green transition-all">
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
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
                  <Link
                    to={`/news/${featuredArticle.slug}`}
                    id="featured-article"
                    className="group relative block mb-16 rounded-[2rem] overflow-hidden border border-slate-200 shadow-xl hover:shadow-2xl transition-all duration-700 min-h-[450px] lg:min-h-[550px]">
                    {/* Background Image */}
                    {featuredArticle.cover_image ? (
                      <img
                        src={getImageUrl(featuredArticle.cover_image)}
                        alt={featuredArticle.title}
                        className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000"
                      />
                    ) : (
                      <div className="absolute inset-0 bg-slate-200 flex items-center justify-center">
                        <ImageIcon className="w-20 h-20 text-slate-400 opacity-50" />
                      </div>
                    )}

                    {/* Gradient Overlays for Readability */}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/60 to-transparent opacity-90 group-hover:opacity-100 transition-opacity duration-500" />
                    <div className="absolute inset-0 bg-[#004B23]/20 mix-blend-multiply group-hover:bg-[#004B23]/20 transition-colors duration-700" />

                    {/* Category Badge */}
                    <div className="absolute top-6 left-6 lg:top-8 lg:left-8 z-20">
                      <span className="bg-daw-green text-white px-4 py-2 text-[10px] sm:text-xs font-black uppercase tracking-[0.15em] rounded-xl shadow-lg border border-white/20">
                        {getCategoryName(featuredArticle)}
                      </span>
                    </div>

                    {/* Content at Bottom */}
                    <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8 lg:p-12 z-20">
                      <div className="max-w-4xl transform lg:translate-y-4 group-hover:translate-y-0 transition-transform duration-500">
                        <div className="flex flex-wrap items-center gap-3 text-[10px] sm:text-xs font-bold text-slate-300 mb-4 uppercase tracking-widest">
                          <span className="flex items-center gap-1.5 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10">
                            <Calendar className="w-3.5 h-3.5 text-daw-yellow" />
                            {new Date(
                              featuredArticle.published_at ||
                                featuredArticle.createdAt,
                            ).toLocaleDateString("en-US", {
                              month: "long",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </span>
                          <span className="flex items-center gap-1.5 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10">
                            <Clock className="w-3.5 h-3.5 text-daw-yellow" />
                            {featuredArticle.read_time || "1 min read"}
                          </span>
                        </div>

                        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-serif font-bold text-white mb-5 leading-[1.1] group-hover:text-slate-200 transition-colors drop-shadow-xl">
                          {featuredArticle.title}
                        </h2>

                        <p className="text-slate-200 text-sm sm:text-base leading-relaxed mb-8 line-clamp-2 md:line-clamp-3 lg:w-4/5 drop-shadow-md">
                          {featuredArticle.excerpt}
                        </p>

                        <div className="inline-flex items-center justify-center px-6 py-3.5 bg-daw-green hover:bg-emerald-600 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-daw-green/20 group-hover:shadow-daw-green/40">
                          Read Full Article{" "}
                          <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1.5 transition-transform" />
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
                    <p className="font-bold">
                      No articles found in this category.
                    </p>
                    <button
                      onClick={() => setActiveCategory("All")}
                      className="text-daw-green text-sm underline mt-2">
                      Clear all filters
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {gridArticles.map((article, idx) => (
                      <ScrollReveal
                        key={article.id}
                        direction="up"
                        delay={idx * 60}>
                        <Link
                          to={`/news/${article.slug}`}
                          id={`article-${article.id}`}
                          className={`group flex bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-sm hover:shadow-2xl transition-all duration-500 hover:-translate-y-1 h-full ${idx % 3 === 0 ? "flex-col" : "flex-row md:flex-col"}`}>
                          {/* Image Thumbnail */}
                          <div
                            className={`relative bg-slate-100 overflow-hidden shrink-0 ${idx % 3 === 0 ? "w-full aspect-[4/3]" : "w-[38%] md:w-full aspect-[4/3]"}`}>
                            {article.cover_image ? (
                              <img
                                src={getImageUrl(article.cover_image)}
                                alt={article.title}
                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                                loading="lazy"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-slate-300">
                                <ImageIcon className="w-8 h-8 md:w-10 md:h-10" />
                              </div>
                            )}
                            <div
                              className={`absolute top-3 left-3 md:top-4 md:left-4 bg-white/95 backdrop-blur-sm text-[9px] font-black uppercase tracking-[0.15em] text-daw-green rounded-lg shadow-sm ${idx % 3 === 0 ? "px-3 py-1.5" : "px-2 py-1 md:px-3 md:py-1.5 hidden md:block"}`}>
                              {getCategoryName(article)}
                            </div>
                          </div>

                          {/* Content Area */}
                          <div
                            className={`flex flex-col flex-1 justify-center ${idx % 3 === 0 ? "p-6 md:p-8" : "p-4 md:p-8"}`}>
                            {/* Meta & Small Category Tag */}
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                              {idx % 3 !== 0 && (
                                <span className="inline-block md:hidden bg-daw-green/10 text-daw-green text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded">
                                  {getCategoryName(article)}
                                </span>
                              )}
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-3 flex-wrap">
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  {new Date(
                                    article.published_at || article.createdAt,
                                  ).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  })}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {article.read_time || "1 min read"}
                                </span>
                              </p>
                            </div>

                            {/* Title */}
                            <h3
                              className={`font-bold text-slate-900 group-hover:text-daw-green transition-colors leading-snug line-clamp-2 ${idx % 3 === 0 ? "text-xl mb-4" : "text-sm sm:text-base md:text-xl mb-1.5 md:mb-4"}`}>
                              {article.title}
                            </h3>

                            {/* Excerpt */}
                            <p
                              className={`text-slate-500 leading-relaxed flex-1 ${idx % 3 === 0 ? "text-sm line-clamp-3 mb-5" : "text-xs line-clamp-2 mb-3 md:mb-5"}`}>
                              {article.excerpt}
                            </p>

                            {/* Read Article Link */}
                            <div className="mt-auto flex items-center text-[10px] md:text-xs font-black uppercase tracking-widest text-daw-green pt-2 md:pt-6 border-t border-slate-50/50">
                              Read Article{" "}
                              <ArrowRight className="w-3 h-3 md:w-4 md:h-4 ml-1 md:ml-2 group-hover:translate-x-1.5 transition-transform" />
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
                  <button
                    onClick={() =>
                      setCurrentPage((prev) => Math.max(prev - 1, 1))
                    }
                    disabled={currentPage === 1}
                    className="w-10 h-10 rounded-full flex items-center justify-center border border-slate-200 text-slate-500 hover:bg-daw-green hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm">
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <div className="flex items-center gap-1.5">
                    {Array.from({ length: pagination.totalPages }).map(
                      (_, i) => (
                        <button
                          key={i}
                          onClick={() => setCurrentPage(i + 1)}
                          className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all ${currentPage === i + 1 ? "bg-daw-green text-white shadow-md shadow-green-900/20" : "border border-transparent text-slate-600 hover:bg-slate-100"}`}>
                          {i + 1}
                        </button>
                      ),
                    )}
                  </div>
                  <button
                    onClick={() =>
                      setCurrentPage((prev) =>
                        Math.min(prev + 1, pagination.totalPages),
                      )
                    }
                    disabled={currentPage === pagination.totalPages}
                    className="w-10 h-10 rounded-full flex items-center justify-center border border-slate-200 text-slate-500 hover:bg-daw-green hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm">
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
