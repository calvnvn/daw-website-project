import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
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
  User,
} from "lucide-react";
import { toast } from "sonner";
import SEO from "@/components/SEO";
import ScrollReveal from "@/components/ScrollReveal";
import GlobalHeroBanner from "@/components/ui/GlobalHeroBanner";
import bannerImg from "@/assets/about-banner.jpg";
import api, { BASE_UPLOAD_URL } from "@/lib/api";

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
  const { slug } = useParams();
  const navigate = useNavigate();
  const [article, setArticle] = useState<ArticleDetail | null>(null);
  const [otherPosts, setOtherPosts] = useState<SidebarPost[]>([]);
  const [categories, setCategories] = useState<CategoryData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch article by slug
  useEffect(() => {
    if (!slug) return;
    const fetchArticle = async () => {
      setIsLoading(true);
      try {
        const res = await api.get(`/news/public/s/${slug}`);
        setArticle(res.data);
      } catch (error: any) {
        if (error.response?.status === 404) {
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
  }, [slug, navigate]);

  // Fetch sidebar data
  useEffect(() => {
    api
      .get("/news/public", { params: { limit: 4 } })
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
        if (Array.isArray(res.data)) setCategories(res.data);
      })
      .catch(console.error);
  }, [slug]);

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
              <nav className="flex text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-6 md:mb-8">
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
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 mr-1">
                      <Share2 className="w-4 h-4" /> Share
                    </span>
                    <button
                      onClick={() => handleShare("facebook")}
                      className="w-9 h-9 rounded-full bg-slate-50 flex items-center justify-center text-slate-500 hover:bg-[#1877F2] hover:text-white transition-colors">
                      <Facebook className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleShare("twitter")}
                      className="w-9 h-9 rounded-full bg-slate-50 flex items-center justify-center text-slate-500 hover:bg-[#1DA1F2] hover:text-white transition-colors">
                      <Twitter className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleShare("linkedin")}
                      className="w-9 h-9 rounded-full bg-slate-50 flex items-center justify-center text-slate-500 hover:bg-[#0A66C2] hover:text-white transition-colors">
                      <Linkedin className="w-4 h-4" />
                    </button>
                    <button
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
                  prose-p:leading-[1.8] prose-p:text-slate-600 prose-p:mb-6 
                  prose-p:text-[1.125rem] md:prose-p:text-[1.2rem]
                  prose-headings:font-serif prose-headings:text-slate-900 
                  prose-h2:text-3xl md:prose-h2:text-4xl prose-h2:mt-12 prose-h2:mb-6
                  prose-headings:tracking-tight prose-headings:font-bold
                  prose-h3:text-2xl md:prose-h3:text-3xl prose-h3:mt-10
                  [&_img]:rounded-[2rem] [&_img]:my-8
                  [&_iframe]:rounded-[1.5rem] [&_iframe]:shadow-2xl [&_iframe]:my-8
                  prose-p:first-of-type:first-letter:text-[4rem] md:prose-p:first-of-type:first-letter:text-[5.5rem] 
                  prose-p:first-of-type:first-letter:font-serif prose-p:first-of-type:first-letter:font-black 
                  prose-p:first-of-type:first-letter:text-daw-green prose-p:first-of-type:first-letter:mr-4 
                  md:prose-p:first-of-type:first-letter:mr-5 prose-p:first-of-type:first-letter:float-left 
                  prose-p:first-of-type:first-letter:leading-[0.8] md:prose-p:first-of-type:first-letter:leading-[0.7] 
                  prose-p:first-of-type:first-letter:mt-1 md:prose-p:first-of-type:first-letter:mt-2
                  prose-p:first-of-type:first-letter:drop-shadow-sm
                  prose-blockquote:border-l-4 prose-blockquote:border-daw-green
                  prose-blockquote:bg-slate-50 prose-blockquote:py-4 prose-blockquote:px-6
                  prose-blockquote:rounded-r-2xl prose-blockquote:text-daw-green
                  prose-blockquote:font-serif prose-blockquote:italic prose-blockquote:my-10
                  prose-li:marker:text-daw-green prose-li:my-2`}
                dangerouslySetInnerHTML={{
                  __html: (article.content || "").replace(
                    /&nbsp;|\u00A0/g,
                    " ",
                  ),
                }}
              />
            </div>

            {/* Right Column: Sticky Sidebar */}
            <aside className="lg:col-span-4 w-full min-w-0 sticky top-32 flex flex-col gap-8">
              {/* Widget: Search */}
              <div className="p-6 md:p-8 bg-slate-50 rounded-2xl md:rounded-3xl border border-slate-100">
                <form className="relative" onSubmit={(e) => e.preventDefault()}>
                  <input
                    type="text"
                    placeholder="Search articles..."
                    className="w-full bg-white border border-slate-200 rounded-full py-3.5 pl-5 pr-12 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-daw-green/20 focus:border-daw-green transition-all"
                  />
                  <button
                    type="submit"
                    className="absolute right-2 top-2 p-2 bg-daw-green text-white rounded-full hover:bg-emerald-800 transition-colors">
                    <Search className="w-4 h-4" />
                  </button>
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
                  Other Posts
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
                      View All News
                    </span>
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-daw-green group-hover:translate-x-1 transition-transform" />
                  </Link>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </>
  );
}
