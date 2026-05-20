import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Calendar,
  Clock,
  User,
  Filter,
  ImageIcon,
} from "lucide-react";
import ScrollReveal from "@/components/ScrollReveal";
import SEO from "@/components/SEO";
import GlobalHeroBanner from "@/components/ui/GlobalHeroBanner";
import bannerImg from "@/assets/about-banner.jpg";

/**
 * @interface Article
 * Data shape for news/event articles.
 * Will be replaced with API response type when backend is ready.
 */
interface Article {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  coverImage: string;
  category: string;
  publishedAt: string;
  author: string;
  readTime: string;
}

// ─── DUMMY DATA ─────────────────────────────────────────────────────────
const DUMMY_ARTICLES: Article[] = [
  {
    id: "1",
    title: "DAW Group Secures 15 MW Hydropower Plant in North Sumatera",
    slug: "daw-group-secures-15mw-hydropower",
    excerpt:
      "A major milestone in our renewable energy portfolio — the acquisition of a hydropower facility in the Toba Samosir region marks DAW Group's continued commitment to Indonesia's energy transition and sustainable development goals.",
    coverImage:
      "https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?w=800&q=80",
    category: "Company News",
    publishedAt: "2026-05-15T10:00:00Z",
    author: "DAW Communications",
    readTime: "5 min read",
  },
  {
    id: "2",
    title:
      "Annual Sustainability Summit 2026: Shaping the Future of Green Energy",
    slug: "annual-sustainability-summit-2026",
    excerpt:
      "Join industry leaders, policy makers, and sustainability advocates at our flagship annual event. Explore breakthroughs in renewable energy, carbon neutrality strategies, and circular economy frameworks.",
    coverImage:
      "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&q=80",
    category: "Events",
    publishedAt: "2026-05-10T08:00:00Z",
    author: "Events Team",
    readTime: "4 min read",
  },
  {
    id: "3",
    title: "DAW Group Reports Record Revenue Growth in Q1 2026",
    slug: "daw-record-revenue-q1-2026",
    excerpt:
      "Our consolidated financial performance demonstrates robust growth across both Energy and Resources divisions, driven by operational excellence and strategic market positioning in the Southeast Asian corridor.",
    coverImage:
      "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&q=80",
    category: "Press Release",
    publishedAt: "2026-05-08T14:00:00Z",
    author: "Corporate Finance",
    readTime: "6 min read",
  },
  {
    id: "4",
    title: "Community Empowerment Program: Building Schools in East Kalimantan",
    slug: "community-empowerment-east-kalimantan",
    excerpt:
      "As part of our CSR commitment, DAW Group has completed the construction of three new schools in remote communities surrounding our plantation operations, providing education access to over 500 children.",
    coverImage:
      "https://images.unsplash.com/photo-1497375638960-ca368c7231e4?w=800&q=80",
    category: "CSR",
    publishedAt: "2026-05-05T09:00:00Z",
    author: "CSR Division",
    readTime: "4 min read",
  },
  {
    id: "5",
    title: "Strategic Partnership with PLN for Power Plant O&M Services",
    slug: "strategic-partnership-pln-om-services",
    excerpt:
      "DAW Group expands its Operation & Maintenance service portfolio through a renewed five-year agreement with Indonesia's state electricity company, covering power plants across Sumatera, Kalimantan, and Sulawesi.",
    coverImage:
      "https://images.unsplash.com/photo-1581092160562-40aa08e78837?w=800&q=80",
    category: "Company News",
    publishedAt: "2026-04-28T11:00:00Z",
    author: "Business Development",
    readTime: "5 min read",
  },
  {
    id: "6",
    title: "Bioenergy Innovation Forum: Transforming Waste into Value",
    slug: "bioenergy-innovation-forum",
    excerpt:
      "Discover how DAW Group is pioneering biomass energy solutions, converting palm kernel shells and agricultural waste into clean, renewable fuel sources that power industrial operations across the archipelago.",
    coverImage:
      "https://images.unsplash.com/photo-1532601224476-15c79f2f7a51?w=800&q=80",
    category: "Events",
    publishedAt: "2026-04-22T08:30:00Z",
    author: "Bioenergy Division",
    readTime: "3 min read",
  },
  {
    id: "7",
    title: "DAW Group Achieves ISPO Certification for Sustainable Palm Oil",
    slug: "daw-ispo-certification-sustainable-palm-oil",
    excerpt:
      "Our palm oil plantation in East Kalimantan has received the Indonesian Sustainable Palm Oil (ISPO) certification, demonstrating our adherence to environmental standards and responsible agricultural practices.",
    coverImage:
      "https://images.unsplash.com/photo-1464226184884-fa280b87c399?w=800&q=80",
    category: "Press Release",
    publishedAt: "2026-04-18T10:00:00Z",
    author: "Sustainability Office",
    readTime: "4 min read",
  },
  {
    id: "8",
    title: "Clean Water Initiative: 1,000 Wells for Rural Communities",
    slug: "clean-water-initiative-1000-wells",
    excerpt:
      "In collaboration with local governments and NGOs, DAW Group has launched an ambitious clean water program to drill 1,000 wells across underserved rural areas in Kalimantan and Sumatera provinces.",
    coverImage:
      "https://images.unsplash.com/photo-1504297050568-910d24c426d3?w=800&q=80",
    category: "CSR",
    publishedAt: "2026-04-12T09:00:00Z",
    author: "CSR Division",
    readTime: "5 min read",
  },
  {
    id: "9",
    title: "CPO Mill Expansion: New 60 Ton/Hour Facility in Jambi Province",
    slug: "cpo-mill-expansion-jambi",
    excerpt:
      "DAW Group announces the commissioning of a new high-capacity CPO mill in Jambi Province, increasing our total processing capacity and strengthening our position in the downstream palm oil sector.",
    coverImage:
      "https://images.unsplash.com/photo-1565793298595-6a879b1d9492?w=800&q=80",
    category: "Company News",
    publishedAt: "2026-04-05T13:00:00Z",
    author: "Operations Division",
    readTime: "6 min read",
  },
  {
    id: "10",
    title: "Youth Leadership Camp: Nurturing Tomorrow's Energy Innovators",
    slug: "youth-leadership-camp-2026",
    excerpt:
      "50 selected university students from across Indonesia participated in our annual leadership camp, gaining hands-on experience in renewable energy project management and sustainable business practices.",
    coverImage:
      "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800&q=80",
    category: "Events",
    publishedAt: "2026-03-28T07:00:00Z",
    author: "HR & Development",
    readTime: "3 min read",
  },
  {
    id: "11",
    title: "DAW Group Joins UN Global Compact for Sustainable Development",
    slug: "daw-un-global-compact",
    excerpt:
      "Reinforcing our global sustainability commitment, DAW Group has officially become a signatory to the United Nations Global Compact, aligning our business operations with universal principles on human rights and environment.",
    coverImage:
      "https://images.unsplash.com/photo-1556761175-4b46a572b786?w=800&q=80",
    category: "Press Release",
    publishedAt: "2026-03-20T10:00:00Z",
    author: "Corporate Affairs",
    readTime: "4 min read",
  },
  {
    id: "12",
    title: "Reforestation Project: Planting 100,000 Trees in Degraded Lands",
    slug: "reforestation-100000-trees",
    excerpt:
      "Our environmental restoration initiative targets degraded lands surrounding our operational areas, with a goal to plant 100,000 native tree species over the next three years to restore biodiversity and carbon sinks.",
    coverImage:
      "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=800&q=80",
    category: "CSR",
    publishedAt: "2026-03-15T09:00:00Z",
    author: "Environmental Affairs",
    readTime: "5 min read",
  },
];

const CATEGORIES = ["All", "Company News", "Events", "Press Release", "CSR"];

// ─── MAIN COMPONENT ─────────────────────────────────────────────────────
export default function NewsEvents() {
  const [activeCategory, setActiveCategory] = useState("All");
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

  // Sort by publishedAt descending
  const sortedArticles = useMemo(
    () =>
      [...DUMMY_ARTICLES].sort(
        (a, b) =>
          new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
      ),
    [],
  );

  // Featured = latest article (only shown on "All")
  const featuredArticle = activeCategory === "All" ? sortedArticles[0] : null;

  // Filtered articles (excluding featured when on "All")
  const gridArticles = useMemo(() => {
    const pool =
      activeCategory === "All" ? sortedArticles.slice(1) : sortedArticles;
    if (activeCategory === "All") return pool;
    return pool.filter((a) => a.category === activeCategory);
  }, [sortedArticles, activeCategory]);

  return (
    <>
      <SEO
        title="News & Events"
        description="Stay updated with the latest news, events, press releases, and CSR activities from PT Dharma Agung Wijaya — a leading operating holding company in renewable energy and natural resources."
      />

      <div className="bg-white min-h-screen overflow-x-hidden w-full relative">
        {/* Progress Bar */}
        <div
          className="fixed top-0 left-0 h-1.5 bg-gradient-to-r from-daw-green via-emerald-400 to-daw-green z-[100] transition-all duration-150 ease-out shadow-[0_0_10px_rgba(16,185,129,0.5)]"
          style={{ width: `${scrollProgress}%` }}
        />

        {/* Hero Banner — konsisten dengan AboutUs, OurBusinesses */}
        <GlobalHeroBanner
          title="News & Events"
          targetIndex={2}
          localFallback={bannerImg}
        />

        {/* Content */}
        <div className="max-w-7xl mx-auto px-6 py-16 animate-in fade-in duration-500">
          {/* Filter Bar — konsisten dengan PublicProjects */}
          <div className="flex flex-wrap justify-center gap-3 mb-16">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                id={`filter-${cat.toLowerCase().replace(/\s+/g, "-")}`}
                onClick={() => setActiveCategory(cat)}
                className={`px-6 py-2.5 rounded-full text-xs font-black uppercase tracking-widest transition-all ${
                  activeCategory === cat
                    ? "bg-daw-green text-white shadow-lg shadow-green-900/20 scale-105"
                    : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                }`}>
                {cat === "All" ? "All Categories" : cat}
              </button>
            ))}
          </div>

          {/* Featured Article — only on "All" */}
          {featuredArticle && (
            <ScrollReveal direction="up" delay={0}>
              <Link
                to={`/news/${featuredArticle.slug}`}
                id="featured-article"
                className="group block mb-16 rounded-2xl overflow-hidden border border-slate-100 shadow-sm hover:shadow-2xl transition-all duration-500">
                <div className="grid grid-cols-1 lg:grid-cols-2">
                  {/* Image */}
                  <div className="aspect-[16/10] lg:aspect-auto bg-slate-100 overflow-hidden relative">
                    <img
                      src={featuredArticle.coverImage}
                      alt={featuredArticle.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                    />
                    <div className="absolute top-4 left-4 bg-daw-green text-white px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.15em] rounded-lg">
                      {featuredArticle.category}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-8 md:p-10 lg:p-12 flex flex-col justify-center">
                    <p className="text-[10px] font-bold text-slate-400 mb-4 uppercase tracking-widest">
                      {new Date(featuredArticle.publishedAt).toLocaleDateString(
                        "en-US",
                        {
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                        },
                      )}{" "}
                      · {featuredArticle.readTime}
                    </p>

                    <h2 className="text-2xl md:text-3xl font-serif font-bold text-slate-900 mb-4 group-hover:text-daw-green transition-colors leading-snug">
                      {featuredArticle.title}
                    </h2>

                    <p className="text-slate-500 text-sm leading-relaxed mb-6 line-clamp-3">
                      {featuredArticle.excerpt}
                    </p>

                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                        <User className="w-3 h-3" />
                        {featuredArticle.author}
                      </span>

                      <span className="flex items-center text-xs font-black uppercase tracking-widest text-daw-green">
                        Read Article
                        <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-2 transition-transform" />
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            </ScrollReveal>
          )}

          {/* Article Grid */}
          {gridArticles.length === 0 ? (
            <div className="text-center text-slate-400 py-32 border-2 border-dashed border-slate-100 rounded-3xl">
              <Filter className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p className="font-bold">No articles found in this category.</p>
              <button
                onClick={() => setActiveCategory("All")}
                className="text-daw-green text-sm underline mt-2">
                Clear all filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {gridArticles.map((article, idx) => (
                <ScrollReveal key={article.id} direction="up" delay={idx * 60}>
                  <Link
                    to={`/news/${article.slug}`}
                    id={`article-${article.id}`}
                    className={`group flex bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-sm hover:shadow-2xl transition-all duration-500 hover:-translate-y-1 h-full 
                      ${idx % 3 === 0 ? "flex-col" : "flex-row md:flex-col"}
                    `}>
                    {/* Image */}
                    <div className={`relative bg-slate-100 overflow-hidden shrink-0 
                      ${idx % 3 === 0 ? "w-full aspect-[4/3]" : "w-[35%] md:w-full aspect-square md:aspect-[4/3]"}
                    `}>
                      {article.coverImage ? (
                        <img
                          src={article.coverImage}
                          alt={article.title}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-300">
                          <ImageIcon className="w-8 h-8 md:w-10 md:h-10" />
                        </div>
                      )}
                      
                      {/* Category Badge - hide on small list view to keep it clean */}
                      <div className={`absolute top-3 left-3 md:top-4 md:left-4 bg-white/95 backdrop-blur-sm text-[9px] font-black uppercase tracking-[0.15em] text-daw-green rounded-lg shadow-sm
                        ${idx % 3 === 0 ? "px-3 py-1.5" : "px-2 py-1 md:px-3 md:py-1.5 hidden md:block"}
                      `}>
                        {article.category}
                      </div>
                    </div>

                    {/* Content */}
                    <div className={`flex flex-col flex-1 ${idx % 3 === 0 ? "p-6 md:p-8" : "p-4 md:p-8"}`}>
                      <p className={`text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-3 flex-wrap ${idx % 3 === 0 ? "mb-3" : "mb-2 md:mb-3"}`}>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(article.publishedAt).toLocaleDateString(
                            "en-US",
                            { month: "short", day: "numeric", year: "numeric" }
                          )}
                        </span>
                        <span className={`flex items-center gap-1 ${idx % 3 === 0 ? "" : "hidden sm:flex md:flex"}`}>
                          <Clock className="w-3 h-3" />
                          {article.readTime}
                        </span>
                      </p>

                      <h3 className={`font-bold text-slate-900 group-hover:text-daw-green transition-colors leading-snug line-clamp-2 md:line-clamp-2 ${
                        idx % 3 === 0 ? "text-xl md:text-xl mb-4" : "text-sm sm:text-base md:text-xl mb-2 md:mb-4"
                      }`}>
                        {article.title}
                      </h3>

                      <p className={`text-slate-500 leading-relaxed flex-1 ${
                        idx % 3 === 0 ? "text-sm line-clamp-3 mb-5" : "text-xs line-clamp-2 mb-2 md:mb-5 hidden md:block"
                      }`}>
                        {article.excerpt}
                      </p>

                      <div className={`mt-auto items-center text-[10px] md:text-xs font-black uppercase tracking-widest text-daw-green border-slate-50 ${
                        idx % 3 === 0 ? "pt-5 border-t flex" : "pt-2 md:pt-6 md:border-t hidden md:flex"
                      }`}>
                        Read Article
                        <ArrowRight className="w-3 h-3 md:w-4 md:h-4 ml-1 md:ml-2 group-hover:translate-x-1 md:group-hover:translate-x-2 transition-transform" />
                      </div>
                    </div>
                  </Link>
                </ScrollReveal>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
