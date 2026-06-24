import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Calendar,
  Share2,
  Facebook,
  Twitter,
  Linkedin,
  Link as LinkIcon,
  ChevronRight,
  Search,
  FolderOpen,
  Loader2,
  Clock,
  Maximize2,
  ChevronLeft,
  X,
} from "lucide-react";
import { toast } from "sonner";
import SEO from "@/components/SEO";
import GlobalHeroBanner from "@/components/ui/GlobalHeroBanner";
import bannerImg from "@/assets/about-banner.jpg";
import api, { BASE_UPLOAD_URL } from "@/lib/api";
import DOMPurify from "dompurify";

interface CategoryData {
  id: string;
  name: string;
  slug: string;
  color: string;
}

interface ArticleDetail {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  cover_image: string;
  category_id: string;
  published_at: string;
  author: string;
  read_time: string;
  views: number;
  seo_title: string;
  meta_description: string;
  createdAt: string;
  categoryData?: CategoryData | null;
  gallery_images?: any[];
}

interface SidebarPost {
  id: string;
  title: string;
  slug: string;
  cover_image: string;
  published_at: string;
  createdAt: string;
  categoryData?: CategoryData | null;
}

// ─── SCROLL PROGRESS BAR ────────────────────────────────────────────────
const ScrollProgressBar = () => {
  const [scrollProgress, setScrollProgress] = useState(0);
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
  return (
    <div
      className="fixed top-0 left-0 h-1.5 bg-gradient-to-r from-daw-green via-emerald-400 to-daw-green z-[100] transition-all duration-150 ease-out shadow-[0_0_10px_rgba(16,185,129,0.5)]"
      style={{ width: `${scrollProgress}%` }}
    />
  );
};

export default function NewsEventDetail() {
  const { t, i18n } = useTranslation();
  const { slug } = useParams();
  const navigate = useNavigate();
  const [article, setArticle] = useState<ArticleDetail | null>(null);
  const [otherPosts, setOtherPosts] = useState<SidebarPost[]>([]);
  const [categories, setCategories] = useState<CategoryData[]>([]);
  const [trendingKeywords, setTrendingKeywords] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  // Gallery States
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);

  // Gallery Data
  const galleryImages = article?.gallery_images || [];

  // Fetch article by slug
  useEffect(() => {
    if (!slug) return;
    const fetchArticle = async () => {
      setIsLoading(true);
      try {
        const res = await api.get(`/news/public/s/${slug}`, {
          params: { lang: i18n.language === "id" ? "id" : "en" },
        });
        setArticle(res.data);
      } catch (error: unknown) {
        if ((typeof error === "object" && error !== null && "response" in error ? (error as any).response?.status : undefined) === 404) {
          toast.error("Article not found");
          navigate("/news");
        } else {
          console.error("Error fetching article:", error);
        }
      } finally {
        setIsLoading(false);
      }
    };
    fetchArticle();
  }, [slug, navigate, i18n.language]);

  // Increment views once per session to avoid double counting (especially in StrictMode)
  useEffect(() => {
    if (!slug) return;

    const sessionKey = `viewed_news_${slug}`;
    const hasViewed = sessionStorage.getItem(sessionKey);

    if (!hasViewed) {
      api
        .post(`/news/public/s/${slug}/view`)
        .then(() => {
          sessionStorage.setItem(sessionKey, "true");
        })
        .catch((err) => {
          console.error("Error incrementing view count:", err);
        });
    }
  }, [slug]);

  // Fetch sidebar data
  useEffect(() => {
    api
      .get("/news/public", {
        params: { limit: 4, lang: i18n.language === "id" ? "id" : "en" },
      })
      .then((res) => {
        const posts = (res.data.data || []).filter(
          (p: SidebarPost) => p.slug !== slug,
        );
        setOtherPosts(posts.slice(0, 3));
      })
      .catch(console.error);

    api
      .get("/news/public/categories")
      .then((res) => {
        if (res.data.categories) {
          const activeCats = res.data.categories.filter(
            (c: any) => c.published_count > 0,
          );
          setCategories(activeCats);
        }
        if (res.data.trendingKeywords) {
          setTrendingKeywords(res.data.trendingKeywords);
        }
      })
      .catch(console.error);
  }, [slug, i18n.language]);

  // Auto-scroll to content
  useEffect(() => {
    const timer = setTimeout(() => {
      const el = document.getElementById("article-content");
      if (el) el.scrollIntoView({ behavior: "smooth" });
      else window.scrollTo(0, 0);
    }, 300);
    return () => clearTimeout(timer);
  }, [slug]);

  const getImageUrl = (img: string) => {
    if (!img) return "";
    if (img.includes("/uploads/")) {
      img = img.split("/uploads/").pop() || img;
    }
    if (img.startsWith("http")) return img;
    return `${BASE_UPLOAD_URL}/${img}`;
  };

  const handleShare = (platform: string) => {
    const url = window.location.href;
    const title = article?.title || "";
    if (platform === "copy") {
      navigator.clipboard.writeText(url);
      toast.success("Link copied to clipboard");
      return;
    }
    let shareUrl = "";
    switch (platform) {
      case "facebook":
        shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
        break;
      case "twitter":
        shareUrl = `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`;
        break;
      case "linkedin":
        shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
        break;
    }
    if (shareUrl) window.open(shareUrl, "_blank", "width=600,height=400");
  };

  if (isLoading) {
    return (
      <>
        <GlobalHeroBanner
          title="News & Events"
          targetIndex={2}
          localFallback={bannerImg}
        />
        <div className="flex items-center justify-center py-32 bg-white">
          <div className="flex flex-col items-center gap-4 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin" />
            <p className="text-sm font-medium">Loading article...</p>
          </div>
        </div>
      </>
    );
  }

  if (!article) return null;

  const categoryName = article.categoryData?.name || "Uncategorized";
  const dynamicBannerImage = article.cover_image
    ? getImageUrl(article.cover_image)
    : undefined;

  return (
    <>
      <SEO
        title={`${article.seo_title || article.title} | News & Events`}
        description={
          article.meta_description || article.excerpt || article.title
        }
        image={dynamicBannerImage}
        type="article"
      />
      <ScrollProgressBar />

      {/* DYNAMIC HERO BANNER — Database-Driven */}
      <GlobalHeroBanner
        title={article.title}
        targetIndex={2}
        localFallback={bannerImg}
        dynamicImageUrl={dynamicBannerImage}
      />

      <div
        id="article-content"
        className="bg-white min-h-screen pt-8 md:pt-12 pb-16 md:pb-20 scroll-mt-[80px] md:scroll-mt-[100px] overflow-x-hidden w-full">
        <div className="container mx-auto px-5 md:px-6 max-w-7xl">
          {/* ─── CONTENT GRID ─── */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16 items-start">
            {/* Left Column: Main Article Flow */}
            <div className="lg:col-span-8 w-full min-w-0 overflow-hidden">
              {/* Breadcrumb */}
              <nav className="flex text-[10px] font-bold uppercase tracking-widest text-slate-600 mb-6 md:mb-8">
                <Link to="/" className="hover:text-daw-green transition-colors">
                  Home
                </Link>
                <span className="mx-2">/</span>
                <Link
                  to="/news"
                  className="hover:text-daw-green transition-colors">
                  News
                </Link>
                <span className="mx-2">/</span>
                <span className="text-slate-900">{categoryName}</span>
              </nav>

              {/* Article Header */}
              <div className="mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="flex flex-wrap items-center gap-3 mb-6">
                  <span className="px-3 py-1.5 bg-daw-green text-white text-[10px] font-black uppercase tracking-widest rounded-md">
                    {categoryName}
                  </span>
                  <span className="flex items-center gap-1.5 text-slate-500 text-[11px] font-bold uppercase tracking-widest">
                    <Calendar className="w-3.5 h-3.5" />
                    {new Date(
                      article.published_at || article.createdAt,
                    ).toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                  {article.read_time && (
                    <span className="flex items-center gap-1.5 text-slate-500 text-[11px] font-bold uppercase tracking-widest">
                      <Clock className="w-3.5 h-3.5" />
                      {article.read_time}
                    </span>
                  )}
                </div>

                <h1 className="text-3xl sm:text-4xl md:text-5xl font-serif font-bold text-slate-900 leading-[1.25] md:leading-[1.2] mb-6 md:mb-8">
                  {article.title}
                </h1>

                {/* Author & Share Bar */}
                <div className="flex flex-wrap items-center justify-between gap-4 py-5 border-y border-slate-100">
                  {/* <span className="flex items-center gap-2 text-slate-500 text-xs font-bold uppercase tracking-widest">
                    <User className="w-4 h-4" />
                    {article.author}
                  </span> */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-600 uppercase tracking-widest flex items-center gap-2 mr-1">
                      <Share2 className="w-4 h-4" /> Share
                    </span>
                    <button
                      aria-label="Share on Facebook"
                      onClick={() => handleShare("facebook")}
                      className="w-9 h-9 rounded-full bg-slate-50 flex items-center justify-center text-slate-500 hover:bg-[#1877F2] hover:text-white transition-colors">
                      <Facebook className="w-4 h-4" />
                    </button>
                    <button
                      aria-label="Share on Twitter"
                      onClick={() => handleShare("twitter")}
                      className="w-9 h-9 rounded-full bg-slate-50 flex items-center justify-center text-slate-500 hover:bg-[#1DA1F2] hover:text-white transition-colors">
                      <Twitter className="w-4 h-4" />
                    </button>
                    <button
                      aria-label="Share on LinkedIn"
                      onClick={() => handleShare("linkedin")}
                      className="w-9 h-9 rounded-full bg-slate-50 flex items-center justify-center text-slate-500 hover:bg-[#0A66C2] hover:text-white transition-colors">
                      <Linkedin className="w-4 h-4" />
                    </button>
                    <button
                      aria-label="Copy article link"
                      onClick={() => handleShare("copy")}
                      className="w-9 h-9 rounded-full bg-slate-50 flex items-center justify-center text-slate-500 hover:bg-daw-green hover:text-white transition-colors">
                      <LinkIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Article Body — Prose */}
              <article
                className={`w-full text-left [&>*:first-child]:mt-0
                  prose prose-slate prose-lg md:prose-xl max-w-none
                  prose-p:leading-[1.8] prose-p:text-slate-600 prose-p:mb-1 
                  prose-p:text-[1.125rem] md:prose-p:text-[1.2rem]
                  prose-headings:font-serif prose-headings:text-slate-900 
                  prose-h2:text-3xl md:prose-h2:text-4xl prose-h2:mt-4 prose-h2:mb-4
                  prose-headings:tracking-tight prose-headings:font-bold
                  prose-h3:text-2xl md:prose-h3:text-3xl prose-h3:mt-4 prose-h3:mb-4
                  [&_img]:rounded-[2rem] [&_img]:my-8
                  [&_iframe]:rounded-[1.5rem] [&_iframe]:shadow-2xl [&_iframe]:my-8
                  
                  prose-blockquote:border-l-4 prose-blockquote:border-daw-green
                  prose-blockquote:bg-slate-50 prose-blockquote:py-2 prose-blockquote:px-6
                  prose-blockquote:rounded-r-2xl prose-blockquote:text-daw-green
                  prose-blockquote:font-serif prose-blockquote:italic prose-blockquote:my-2
                  prose-li:marker:text-daw-green prose-li:my-2`}
                dangerouslySetInnerHTML={{
                  __html: (() => {
                    let rawHtml = (article.content || "").replace(
                      /&nbsp;|\u00A0/g,
                      " ",
                    );

                    // Path normalization: Replace any environment's /uploads/ URLs with the current BASE_UPLOAD_URL
                    rawHtml = rawHtml.replace(
                      /src="[^"]*\/uploads\/([^"'\s>]+)"/g,
                      `src="${BASE_UPLOAD_URL}/$1"`
                    );

                    // DOMPurify Sanitization
                    const cleanHtml = DOMPurify.sanitize(rawHtml, {
                      ADD_TAGS: ['iframe'],
                      ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder', 'scrolling', 'target']
                    });

                    // Helper generator untuk HTML kartu putar premium
                    const getPremiumPlayCard = (videoId: string) => {
                      return `
                        <div 
                          class="relative group aspect-video rounded-[1.5rem] overflow-hidden shadow-2xl my-8 cursor-pointer bg-slate-900 border border-slate-200/60"
                          onclick="this.innerHTML = '<iframe class=\\'w-full h-full absolute inset-0 rounded-[1.5rem]\\' src=\\'https://www.youtube.com/embed/${videoId}?autoplay=1\\' frameborder=\\'0\\' allow=\\'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture\\' allowfullscreen></iframe>'"
                        >
                          <!-- Image Thumbnail -->
                          <img 
                            src="https://img.youtube.com/vi/${videoId}/maxresdefault.jpg" 
                            onerror="this.src='https://img.youtube.com/vi/${videoId}/hqdefault.jpg'"
                            class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                            alt="YouTube video thumbnail"
                          />
                          <!-- Dark overlay on hover -->
                          <div class="absolute inset-0 bg-black/30 transition-colors duration-300 group-hover:bg-black/45"></div>
                          
                          <!-- Premium Glowing Play Button -->
                          <div class="absolute inset-0 flex items-center justify-center">
                            <div class="w-16 h-16 md:w-20 md:h-20 flex items-center justify-center rounded-full bg-white text-emerald-700 shadow-lg transform transition-all duration-300 group-hover:scale-110 group-hover:shadow-[0_0_35px_rgba(16,185,129,0.5)]">
                              <svg class="w-8 h-8 md:w-10 md:h-10 fill-current translate-x-0.5" viewBox="0 0 24 24">
                                <path d="M8 5v14l11-7z"/>
                              </svg>
                            </div>
                          </div>
                        </div>
                      `;
                    };

                    let processedHtml = cleanHtml;

                    // 1. Ubah tag iframe youtube bawaan editor menjadi kartu premium
                    const iframeRegex =
                      /<iframe[^>]*src="[^"]*youtube\.com\/embed\/([^"?\s>]+)[^"]*"[^>]*><\/iframe>/g;
                    processedHtml = processedHtml.replace(
                      iframeRegex,
                      (videoId) => {
                        return getPremiumPlayCard(videoId);
                      },
                    );

                    // 2. Ubah link youtube mentah yang ditulis di dalam paragraf <p>https://www.youtube.com/... </p>
                    const pYoutubeRegex =
                      /<p>\s*https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([^"<\s?&]+)[^<]*<\/p>/g;
                    processedHtml = processedHtml.replace(
                      pYoutubeRegex,
                      (videoId) => {
                        return getPremiumPlayCard(videoId);
                      },
                    );

                    return processedHtml;
                  })(),
                }}
              />

              {/* --- PREMIUM GALLERY SECTION --- */}
              {galleryImages && galleryImages.length > 0 && (
                <div className="mt-8 pt-8 border-t border-slate-100 animate-in fade-in duration-700">
                  <h3 className="text-2xl font-serif font-bold text-slate-900 mb-8 flex items-center gap-3">
                    <span className="w-8 h-1 bg-daw-green rounded-full" />
                    {t("ui.gallery", "GALLERY")}
                  </h3>

                  {/* 1 PHOTO LAYOUT */}
                  {galleryImages.length === 1 && (
                    <div className="rounded-[2rem] overflow-hidden shadow-xl border border-slate-100 bg-slate-200/60 h-[400px] relative group cursor-pointer">
                      <div
                        className="w-full h-full"
                        onClick={() => {
                          setCurrentImageIndex(0);
                          setLightboxOpen(true);
                        }}>
                        <img
                          src={getImageUrl(galleryImages[0].imageUrl)}
                          alt="Gallery Showcase"
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-8">
                          <p className="text-white font-sans text-xs font-semibold uppercase tracking-widest mb-1.5 opacity-80">
                            View Photo
                          </p>
                          <p className="text-white font-sans text-[15px] font-medium translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                            {galleryImages[0].caption ||
                              "Click to expand image"}
                          </p>
                        </div>
                        <div className="absolute top-6 right-6 w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 border border-white/30">
                          <Maximize2 className="w-6 h-6 text-white" />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 2 PHOTOS LAYOUT */}
                  {galleryImages.length === 2 && (
                    <div className="rounded-[2rem] overflow-hidden shadow-xl border border-slate-100 bg-slate-200/60 grid grid-cols-1 md:grid-cols-2 gap-[3px]">
                      {galleryImages.map((img, idx) => (
                        <div
                          key={idx}
                          className="h-[350px] relative group cursor-pointer overflow-hidden"
                          onClick={() => {
                            setCurrentImageIndex(idx);
                            setLightboxOpen(true);
                          }}>
                          <img
                            src={getImageUrl(img.imageUrl)}
                            alt={`Gallery ${idx}`}
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-6">
                            <p className="text-white font-sans text-xs font-semibold uppercase tracking-widest mb-1.5 opacity-80">
                              View Photo
                            </p>
                            <p className="text-white font-sans text-sm font-medium translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                              {img.caption || "Click to expand image"}
                            </p>
                          </div>
                          <div className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 border border-white/30">
                            <Maximize2 className="w-5 h-5 text-white" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 3 PHOTOS LAYOUT */}
                  {galleryImages.length === 3 && (
                    <div className="rounded-[2rem] overflow-hidden shadow-xl border border-slate-100 bg-slate-200/60 flex flex-col md:grid md:grid-cols-12 gap-[3px]">
                      {/* Main Image */}
                      <div
                        className="md:col-span-8 h-[300px] md:h-[450px] overflow-hidden relative group cursor-pointer"
                        onClick={() => {
                          setCurrentImageIndex(0);
                          setLightboxOpen(true);
                        }}>
                        <img
                          src={galleryImages[0].imageUrl}
                          alt="Gallery Cover"
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-6">
                          <p className="text-white font-sans text-xs font-semibold uppercase tracking-widest mb-1.5 opacity-80">
                            View Photo
                          </p>
                          <p className="text-white font-sans text-sm font-medium translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                            {galleryImages[0].caption ||
                              "Click to expand image"}
                          </p>
                        </div>
                        <div className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 border border-white/30">
                          <Maximize2 className="w-5 h-5 text-white" />
                        </div>
                      </div>

                      {/* Stacked Images Column */}
                      <div className="md:col-span-4 flex flex-col gap-[3px]">
                        {galleryImages.slice(1, 3).map((img, idx) => {
                          const globalIndex = idx + 1;
                          return (
                            <div
                              key={globalIndex}
                              className="h-[223.5px] overflow-hidden relative group cursor-pointer"
                              onClick={() => {
                                setCurrentImageIndex(globalIndex);
                                setLightboxOpen(true);
                              }}>
                              <img
                                src={getImageUrl(img.imageUrl)}
                                alt={`Gallery ${globalIndex}`}
                                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
                                <p className="text-white text-[10px] font-sans font-semibold uppercase tracking-widest mb-1 opacity-80">
                                  View Photo
                                </p>
                                <p className="text-white text-xs font-medium translate-y-2 group-hover:translate-y-0 transition-transform duration-300 line-clamp-2">
                                  {img.caption || "Click to expand image"}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* 4+ PHOTOS LAYOUT (Bento Showcase) */}
                  {galleryImages.length >= 4 && (
                    <div className="rounded-[2rem] overflow-hidden shadow-xl border border-slate-100 bg-slate-200/60 flex flex-col md:grid md:grid-cols-12 gap-[3px]">
                      {/* Main Image */}
                      <div
                        className="md:col-span-8 h-[300px] md:h-[450px] overflow-hidden relative group cursor-pointer"
                        onClick={() => {
                          setCurrentImageIndex(0);
                          setLightboxOpen(true);
                        }}>
                        <img
                          src={getImageUrl(galleryImages[0].imageUrl)}
                          alt="Gallery Cover"
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-6">
                          <p className="text-white font-sans text-xs font-semibold uppercase tracking-widest mb-1.5 opacity-80">
                            View Photo
                          </p>
                          <p className="text-white font-sans text-sm font-medium translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                            {galleryImages[0].caption ||
                              "Click to expand image"}
                          </p>
                        </div>
                        <div className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 border border-white/30">
                          <Maximize2 className="w-5 h-5 text-white" />
                        </div>
                      </div>

                      {/* Stacked Images Column */}
                      <div className="md:col-span-4 flex flex-col gap-[3px]">
                        {galleryImages.slice(1, 4).map((img, idx) => {
                          const isLast = idx === 2 && galleryImages.length > 4;
                          const globalIndex = idx + 1;

                          return (
                            <div
                              key={globalIndex}
                              className="h-[148px] overflow-hidden relative group cursor-pointer"
                              onClick={() => {
                                setCurrentImageIndex(globalIndex);
                                setLightboxOpen(true);
                              }}>
                              <img
                                src={getImageUrl(img.imageUrl)}
                                alt={`Gallery ${globalIndex}`}
                                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                              />
                              {!isLast && (
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
                                  <p className="text-white text-[10px] font-sans font-semibold uppercase tracking-widest mb-1 opacity-80">
                                    View Photo
                                  </p>
                                  <p className="text-white text-xs font-medium translate-y-2 group-hover:translate-y-0 transition-transform duration-300 line-clamp-2">
                                    {img.caption || "Click to expand image"}
                                  </p>
                                </div>
                              )}

                              {/* Overlay +X More Photos */}
                              {isLast && (
                                <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center group-hover:bg-black/80 transition-colors">
                                  <span className="text-white font-serif text-3xl font-bold">
                                    +{galleryImages.length - 4}
                                  </span>
                                  <span className="text-white/80 text-[10px] font-black tracking-[0.2em] uppercase mt-2">
                                    MORE PHOTOS
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
              {/* --- END GALLERY SECTION --- */}
            </div>

            {/* Right Column: Sticky Sidebar */}
            <aside className="lg:col-span-4 w-full min-w-0 sticky top-32 flex flex-col gap-8">
              {/* Widget: Search */}
              <div className="p-6 md:p-8 bg-slate-50 rounded-2xl md:rounded-3xl border border-slate-100">
                <form
                  className="relative group"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (searchQuery.trim()) {
                      navigate(
                        `/news?search=${encodeURIComponent(searchQuery.trim())}`,
                      );
                    }
                  }}>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t(
                      "newsPage.searchPlaceholder",
                      "Search articles...",
                    )}
                    className="w-full bg-white border border-slate-200 rounded-full py-3.5 pl-5 pr-12 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-daw-green/20 focus:border-daw-green transition-all"
                  />
                  <button
                    type="submit"
                    aria-label="Submit search"
                    className="absolute right-2 top-2 p-2 bg-daw-green text-white rounded-full hover:bg-emerald-800 transition-colors">
                    <Search className="w-4 h-4" />
                  </button>

                  {/* Popular Searches Dropdown */}
                  <div className="absolute top-full left-0 right-0 mt-3 bg-white rounded-2xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)] border border-slate-100 p-5 opacity-0 invisible group-focus-within:opacity-100 group-focus-within:visible transition-all duration-300 translate-y-2 group-focus-within:translate-y-0 z-50 before:content-[''] before:absolute before:-top-2 before:left-10 before:w-4 before:h-4 before:bg-white before:border-t before:border-l before:border-slate-100 before:rotate-45">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-1.5">
                      Related Searches
                    </span>
                    <div className="flex flex-wrap gap-2 relative z-10">
                      {(trendingKeywords.length > 0
                        ? trendingKeywords
                        : ["News", "Latest", "Update"]
                      ).map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setSearchQuery(tag);
                            navigate(`/news?search=${encodeURIComponent(tag)}`);
                          }}
                          className="px-3 py-1.5 bg-slate-50 hover:bg-daw-green hover:text-white text-slate-600 text-xs font-bold rounded-xl border border-slate-200 hover:border-daw-green transition-all">
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>
                </form>
              </div>

              {/* Widget: Categories */}
              <div className="p-6 md:p-8 bg-slate-50 rounded-2xl md:rounded-3xl border border-slate-100">
                <h4 className="text-xl font-serif font-bold text-slate-900 mb-6 flex items-center gap-3">
                  <span className="w-6 h-1 bg-daw-green rounded-full" />
                  Categories
                </h4>
                <ul className="flex flex-col gap-3">
                  {categories.map((cat) => (
                    <li key={cat.id}>
                      <Link
                        to="/news"
                        className="group flex items-center justify-between p-3 bg-white rounded-xl border border-slate-100 hover:border-daw-green/30 hover:shadow-sm transition-all">
                        <span className="flex items-center gap-3 text-sm font-bold text-slate-600 group-hover:text-daw-green transition-colors">
                          <FolderOpen className="w-4 h-4 text-slate-300 group-hover:text-daw-green transition-colors" />
                          {cat.name}
                        </span>
                        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-daw-green group-hover:translate-x-1 transition-transform" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Widget: Other Posts */}
              <div className="p-6 md:p-8 bg-slate-50 rounded-2xl md:rounded-3xl border border-slate-100">
                <h4 className="text-xl font-serif font-bold text-slate-900 mb-6 flex items-center gap-3">
                  <span className="w-6 h-1 bg-daw-green rounded-full" />
                  {t("ui.otherPosts", "Other Posts")}
                </h4>
                <div className="flex flex-col gap-6">
                  {otherPosts.map((post) => (
                    <Link
                      key={post.id}
                      to={`/news/${post.slug}`}
                      className="group flex gap-4 items-start">
                      <div className="w-24 h-24 shrink-0 rounded-xl overflow-hidden bg-slate-200">
                        {post.cover_image ? (
                          <img
                            src={getImageUrl(post.cover_image)}
                            alt={post.title}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-300">
                            <FolderOpen className="w-6 h-6" />
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                          {new Date(
                            post.published_at || post.createdAt,
                          ).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                        <h5 className="text-sm font-bold text-slate-900 group-hover:text-daw-green transition-colors line-clamp-3 leading-snug">
                          {post.title}
                        </h5>
                      </div>
                    </Link>
                  ))}
                </div>
                <div className="mt-8 pt-6 border-t border-slate-200">
                  <Link
                    to="/news"
                    className="flex items-center justify-between p-4 bg-white rounded-xl border border-slate-200 hover:border-daw-green hover:shadow-md transition-all group">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700 group-hover:text-daw-green transition-colors">
                      {t("ui.viewAllNews", "View All News")}
                    </span>
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-daw-green group-hover:translate-x-1 transition-transform" />
                  </Link>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>

      {/* --- LIGHTBOX MODAL --- */}
      {lightboxOpen && galleryImages.length > 0 && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/95 backdrop-blur-xl">
          {/* Close Button */}
          <button
            className="absolute top-6 right-6 w-12 h-12 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors z-50 border border-white/10"
            onClick={() => {
              setLightboxOpen(false);
              setIsZoomed(false);
            }}>
            <X className="w-6 h-6" />
          </button>

          {/* Navigation Prev */}
          <button
            className="absolute left-6 top-1/2 -translate-y-1/2 w-14 h-14 flex items-center justify-center rounded-full bg-black/50 hover:bg-daw-green text-white transition-all z-50 border border-white/10 hover:scale-110 disabled:opacity-30 disabled:hover:bg-black/50 disabled:hover:scale-100"
            onClick={(e) => {
              e.stopPropagation();
              setIsZoomed(false);
              setCurrentImageIndex((prev) =>
                prev > 0 ? prev - 1 : galleryImages.length - 1,
              );
            }}>
            <ChevronLeft className="w-8 h-8" />
          </button>

          {/* Main Image View */}
          <div
            className="relative w-full h-full flex flex-col items-center justify-center p-8 md:p-16 overflow-hidden cursor-zoom-in"
            onClick={() => setIsZoomed(!isZoomed)}>
            <img
              src={getImageUrl(galleryImages[currentImageIndex].imageUrl)}
              alt="Lightbox View"
              className={`max-w-full max-h-[80vh] object-contain transition-all duration-500 ${isZoomed ? "scale-150 cursor-zoom-out" : "scale-100"}`}
            />

            {/* Integrated Caption Bar */}
            <div
              className="absolute bottom-8 left-1/2 -translate-x-1/2 w-[90%] max-w-3xl bg-black/40 backdrop-blur-md px-8 py-5 rounded-2xl border border-white/10 shadow-2xl transition-opacity duration-300"
              onClick={(e) => e.stopPropagation()} // Mencegah klik deskripsi men-trigger zoom
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-daw-green font-bold text-xs uppercase tracking-widest">
                  DOCUMENTATION
                </span>
                <span className="text-white/60 font-mono text-xs">
                  {currentImageIndex + 1} / {galleryImages.length}
                </span>
              </div>
              <p className="text-white/90 font-sans text-[15px] leading-relaxed">
                {galleryImages[currentImageIndex].caption ||
                  "No description available."}
              </p>
            </div>
          </div>

          {/* Navigation Next */}
          <button
            className="absolute right-6 top-1/2 -translate-y-1/2 w-14 h-14 flex items-center justify-center rounded-full bg-black/50 hover:bg-daw-green text-white transition-all z-50 border border-white/10 hover:scale-110 disabled:opacity-30 disabled:hover:bg-black/50 disabled:hover:scale-100"
            onClick={(e) => {
              e.stopPropagation();
              setIsZoomed(false);
              setCurrentImageIndex((prev) =>
                prev < galleryImages.length - 1 ? prev + 1 : 0,
              );
            }}>
            <ChevronRight className="w-8 h-8" />
          </button>
        </div>
      )}
    </>
  );
}
