import { useState, useEffect, useRef, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft,
  ChevronRight,
  X,
  ChevronLeft,
  ImageIcon,
  Calendar,
} from "lucide-react";
import ScrollReveal from "@/components/ScrollReveal";
import ProjectDetailSkeleton from "@/components/ProjectDetailSkeleton";
import api from "@/lib/api";
import { getCleanImageUrl } from "@/lib/utils";
import DOMPurify from "dompurify";
import SEO from "@/components/SEO";

// 1. Interface untuk menghilangkan warning 'any'
// Cari interface ini di bagian atas
interface ProjectData {
  excerpt: string;
  id: string;
  title: string;
  category: string;
  content: string;
  cover_image: string | null;
  gallery: string | string[] | null;
  author: string;
  createdAt: string;
  updatedAt: string;
  views: number;
}

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Menggunakan interface yang sudah dikunci bentuknya
  const [project, setProject] = useState<ProjectData | null>(null);
  const [otherProjects, setOtherProjects] = useState<ProjectData[]>([]);
  const [galleryUrls, setGalleryUrls] = useState<string[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(
    null,
  );
  const hasFetched = useRef<string | null>(null);

  // Progress Bar & Parallax
  const [scrollProgress, setScrollProgress] = useState(0);
  const [offsetY, setOffsetY] = useState(0);

  const cleanContent = useMemo(() => {
    if (!project?.content) return "";

    // Regex ini akan mencari src="http://localhost:5000/uploads/..."
    // atau IP 172.30... dan mengubahnya menjadi src="/uploads/..."
    return project.content.replace(
      /src="https?:\/\/(localhost:5000|localhost:5550|172\.30\.1\.20:5550)\/uploads\//g,
      'src="/uploads/',
    );
  }, [project?.content]);

  useEffect(() => {
    const handleScroll = () => {
      // Progress Bar
      const totalHeight =
        document.documentElement.scrollHeight - window.innerHeight;
      const progress = (window.scrollY / totalHeight) * 100;
      setScrollProgress(progress);

      // Parallax Offset
      setOffsetY(window.scrollY);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Menghindari "Calling State Synchronously"
  useEffect(() => {
    if (hasFetched.current === id) return;

    const preparePage = setTimeout(() => {
      setIsLoading(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
      setSelectedImageIndex(null);
    }, 0);

    hasFetched.current = id || null;

    // Fetch Data Utama
    const fetchData = async () => {
      try {
        const [projectRes, otherProjectsRes] = await Promise.all([
          api.get(`/projects/public/${id}`),
          api.get("/projects/public"),
        ]);

        // Setup Project Utama
        const data: ProjectData = projectRes.data;
        setProject(data);

        // Setup Gallery dengan Path Normalization
        // Setup Gallery dengan Path Normalization (BULLETPROOF)
        if (data.gallery) {
          let parsedGallery: string[] = [];

          if (Array.isArray(data.gallery)) {
            // Kondisi 1: Kalau dari backend sudah otomatis jadi Array
            parsedGallery = data.gallery;
          } else if (typeof data.gallery === "string") {
            // Kondisi 2: Kalau bentuknya masih String
            try {
              parsedGallery = JSON.parse(data.gallery); // Coba parse jadi array
            } catch {
              parsedGallery = [data.gallery]; // Kalau gagal (karena teks biasa), jadikan array isi 1
            }
          }

          // Bersihkan URL gambar dan masukkan ke State
          setGalleryUrls(
            parsedGallery.map((img: string) => getCleanImageUrl(img)),
          );
        } else {
          setGalleryUrls([]);
        }

        // Setup Other Projects
        const otherData: ProjectData[] = otherProjectsRes.data;
        const filtered = otherData.filter((p) => p.id !== id).slice(0, 4);
        setOtherProjects(filtered);
      } catch (err) {
        console.error("Error fetching data:", err);
        hasFetched.current = null;
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();

    return () => clearTimeout(preparePage);
  }, [id]);

  const closeLightbox = () => setSelectedImageIndex(null);

  const nextImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (galleryUrls.length > 0 && selectedImageIndex !== null) {
      setSelectedImageIndex((selectedImageIndex + 1) % galleryUrls.length);
    }
  };

  const prevImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (galleryUrls.length > 0 && selectedImageIndex !== null) {
      setSelectedImageIndex(
        (selectedImageIndex - 1 + galleryUrls.length) % galleryUrls.length,
      );
    }
  };

  if (isLoading) return <ProjectDetailSkeleton />;

  if (!project) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-4">
        <h2 className="text-2xl font-serif text-slate-800">
          Project Not Found
        </h2>
        <button
          onClick={() => navigate("/businesses")}
          className="text-daw-green hover:underline"
        >
          Return to Our Businesses
        </button>
      </div>
    );
  }
  const heroImage = getCleanImageUrl(project.cover_image);

  return (
    <>
      <SEO
        title={project.title}
        description={project.excerpt || "Project Detail of DAW Group"} // Pakai excerpt kalau ada
        image={
          project.cover_image
            ? getCleanImageUrl(project.cover_image)
            : undefined
        }
        type="article"
      />
      <div
        className="fixed top-0 left-0 h-1.5 bg-gradient-to-r from-daw-green via-emerald-400 to-daw-green z-[100] transition-all duration-150 ease-out shadow-[0_0_10px_rgba(16,185,129,0.5)]"
        style={{ width: `${scrollProgress}%` }}
      />
      <div className="min-h-screen bg-white pb-20 selection:bg-daw-green selection:text-white">
        {/* --- HERO BANNER SECTION (Konsisten dengan Desain Asli) --- */}
        <section className="relative h-[85vh] min-h-[600px] flex items-center justify-center overflow-hidden bg-slate-900">
          {/* Layer 1: Parallax Wrapper */}
          <div
            className="absolute inset-0 w-full h-full"
            style={{
              transform: `translateY(${offsetY * 0.4}px)`,
              willChange: "transform",
            }}
          >
            {/* Layer 2: Slow Zoom Image */}
            {heroImage && (
              <div
                className="absolute inset-0 w-full h-[110%] -top-[5%] bg-cover bg-center transition-transform duration-[15000ms] ease-out scale-110"
                style={{ backgroundImage: `url(${heroImage})` }}
              />
            )}
          </div>
          {/* Layer 3: Multiply & Cinematic Overlay */}
          <div className="absolute inset-0 bg-[#004B23]/70 mix-blend-multiply" />
          <div className="absolute inset-0 bg-gradient-to-b from-slate-900/60 via-slate-900/40 to-slate-900/80" />

          <div className="relative z-10 text-center px-6 mt-16 max-w-4xl mx-auto">
            <ScrollReveal direction="up" delay={0}>
              <p className="text-sm md:text-base text-white/80 font-bold tracking-[0.2em] uppercase mb-4">
                {project.category} Portfolio
              </p>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-serif text-white tracking-tight drop-shadow-lg mb-6 leading-tight">
                {project.title}
              </h1>
            </ScrollReveal>

            <ScrollReveal direction="up" delay={200}>
              <div className="w-20 h-1.5 bg-white/80 mx-auto rounded-full shadow-sm"></div>
            </ScrollReveal>
          </div>
          <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-white/50 animate-bounce">
            <span className="text-[10px] font-bold tracking-widest uppercase">
              Scroll to Explore
            </span>
            <ChevronRight className="rotate-90 w-4 h-4" />
          </div>
        </section>
        {/* --- BREADCRUMBS (Konsisten dengan Desain Asli) --- */}
        <div className="bg-slate-50 border-b border-slate-100 py-4 mb-10">
          <div className="container mx-auto px-6 max-w-7xl">
            <div className="flex items-center gap-2 text-[12px] font-bold tracking-widest uppercase text-slate-400">
              <Link to="/" className="hover:text-daw-green transition-colors">
                Home
              </Link>
              <ChevronRight className="w-3 h-3" />
              <Link
                to="/businesses"
                className="hover:text-daw-green transition-colors"
              >
                Our Businesses
              </Link>
              <ChevronRight className="w-3 h-3" />
              <span className="text-daw-green line-clamp-1">
                {project.title}
              </span>
            </div>
          </div>
        </div>
        {/* --- MAIN CONTENT & SIDEBAR --- */}
        <div className="container mx-auto px-6 max-w-7xl">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
            {/* KOLOM KIRI: ARTIKEL UTAMA (8 Kolom) */}
            <div className="lg:col-span-8 space-y-10">
              {/* --- HEADER ARTIKEL & METADATA --- */}
              <ScrollReveal direction="up" delay={0}>
                {/* 1. Tombol Back to Directory (Dibuat lebih subtle dengan hover effect) */}
                <button
                  onClick={() => navigate("/businesses")}
                  className="group flex items-center gap-2 text-slate-400 hover:text-daw-green font-bold text-[11px] uppercase tracking-[0.2em] mb-8 transition-all"
                >
                  <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1.5 transition-transform" />
                  Back to Directory
                </button>

                {/* 2. Judul Utama */}
                <h1 className="text-3xl md:text-5xl lg:text-[52px] font-serif text-slate-900 leading-[1.15] mb-8">
                  {project.title}
                </h1>

                {/* 3. METADATA BAR (Desain Editorial Premium) */}
                <div className="flex flex-wrap items-center gap-y-4 gap-x-6 text-sm text-slate-500 py-5 border-y border-slate-100 bg-white">
                  {/* Publish Date */}
                  <div
                    className="flex items-center gap-2 font-medium"
                    title="Published Date"
                  >
                    <Calendar className="w-4 h-4 text-slate-400" />
                    <span>
                      {new Date(project.createdAt).toLocaleDateString("en-US", {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  </div>

                  {/* 👇 LOGIKA UPDATED AT (Berubah jadi Badge Eksklusif) 👇 */}
                  {new Date(project.createdAt).toDateString() !==
                    new Date(project.updatedAt).toDateString() && (
                    <>
                      <div className="hidden sm:block w-1.5 h-1.5 rounded-full bg-slate-200"></div>
                      <div
                        className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-100"
                        title="Last Updated"
                      >
                        {/* Titik hijau berkedip (Pulse Effect) */}
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-daw-green opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-daw-green"></span>
                        </span>
                        <span className="text-[10px] uppercase font-bold tracking-[0.1em] text-slate-600">
                          Updated{" "}
                          {new Date(project.updatedAt).toLocaleDateString(
                            "en-US",
                            { month: "short", day: "numeric", year: "numeric" },
                          )}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </ScrollReveal>
              {/* TEXT CONTENT */}
              <ScrollReveal direction="up" delay={150}>
                <div
                  className="
      daw-editorial-content
      max-w-none 
      text-slate-600 
      leading-relaxed 
      text-lg md:text-[1.125rem] 
      tracking-[-0.01em]
    "
                  dangerouslySetInnerHTML={{
                    //  WAJIB PAKAI DOMPURIFY DI PRODUCTION!
                    __html: DOMPurify.sanitize(
                      cleanContent.replace(/&nbsp;|\u00A0/g, " "),
                    ),
                  }}
                />
              </ScrollReveal>
              {/* IMAGE GALLERY DENGAN ONCLICK LIGHTBOX */}
              {galleryUrls.length > 0 && (
                <ScrollReveal direction="up" delay={300}>
                  <div className="pt-12 mt-12 border-t border-slate-100">
                    <h4 className="font-serif text-2xl text-slate-900 mb-6">
                      Project Gallery
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
                      {galleryUrls.map((imgUrl, idx) => (
                        <div
                          key={idx}
                          onClick={() => setSelectedImageIndex(idx)}
                          className="aspect-[4/3] rounded-xl overflow-hidden bg-slate-100 border border-slate-100 cursor-pointer group relative shadow-sm hover:shadow-lg transition-all duration-300"
                        >
                          <img
                            src={imgUrl}
                            alt={`Gallery ${idx + 1}`}
                            className="w-full h-full object-cover transform transition-transform duration-700 group-hover:scale-110"
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300 flex items-center justify-center">
                            <span className="text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-daw-green/90 px-4 py-1.5 rounded-full text-xs font-bold tracking-[0.15em] uppercase shadow-sm">
                              Enlarge
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </ScrollReveal>
              )}
            </div>

            {/* KOLOM KANAN: SIDEBAR */}
            <div className="lg:col-span-4 lg:sticky lg:top-32 space-y-8">
              <ScrollReveal direction="left" delay={200}>
                <div className="bg-slate-50 border border-slate-100 rounded-[2rem] p-8 shadow-sm hover:shadow-md transition-shadow duration-300">
                  <h3 className="font-serif text-2xl text-slate-900 mb-6 border-b border-slate-200 pb-4">
                    Our Projects
                  </h3>
                  <div className="space-y-6">
                    {otherProjects.map((other) => (
                      <Link
                        key={other.id}
                        to={`/projects/${other.id}`}
                        className="group flex gap-4 items-center"
                      >
                        <div className="w-16 h-16 md:w-20 md:h-20 rounded-xl overflow-hidden shrink-0 bg-white border border-slate-100 shadow-sm flex items-center justify-center relative">
                          {other.cover_image ? (
                            <img
                              src={getCleanImageUrl(other.cover_image)}
                              alt={other.title}
                              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                            />
                          ) : (
                            <ImageIcon className="w-6 h-6 text-slate-300" />
                          )}
                        </div>
                        <div className="flex-1">
                          <h4 className="font-serif text-[15px] md:text-[16px] text-slate-800 group-hover:text-daw-green transition-colors leading-snug line-clamp-2">
                            {other.title}
                          </h4>
                          <span className="text-[10px] uppercase tracking-[0.15em] font-bold text-slate-400 mt-1.5 block">
                            {other.category}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              </ScrollReveal>
            </div>
          </div>
        </div>
      </div>

      {/* --- LIGHTBOX MODAL --- */}
      {selectedImageIndex !== null && galleryUrls.length > 0 && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-4 backdrop-blur-sm transition-opacity"
          onClick={closeLightbox}
        >
          <button
            className="absolute top-6 right-6 text-white/50 hover:text-white bg-white/10 hover:bg-white/20 rounded-full p-2.5 transition-all"
            onClick={closeLightbox}
          >
            <X className="w-6 h-6" />
          </button>

          {galleryUrls.length > 1 && (
            <button
              className="absolute left-4 md:left-8 text-white/50 hover:text-white bg-white/10 hover:bg-white/20 rounded-full p-3 transition-all"
              onClick={prevImage}
            >
              <ChevronLeft className="w-8 h-8 md:w-10 md:h-10" />
            </button>
          )}

          <img
            src={galleryUrls[selectedImageIndex]}
            alt={`Fullscreen Gallery`}
            className="max-h-[85vh] max-w-[90vw] object-contain shadow-2xl rounded-sm animate-in fade-in zoom-in-95 duration-300"
            onClick={(e) => e.stopPropagation()}
          />

          {galleryUrls.length > 1 && (
            <button
              className="absolute right-4 md:right-8 text-white/50 hover:text-white bg-white/10 hover:bg-white/20 rounded-full p-3 transition-all"
              onClick={nextImage}
            >
              <ChevronRight className="w-8 h-8 md:w-10 md:h-10" />
            </button>
          )}

          <div className="absolute bottom-8 text-white/80 text-sm tracking-[0.2em] font-bold bg-black/50 backdrop-blur-md px-6 py-2 rounded-full border border-white/10">
            {selectedImageIndex + 1} / {galleryUrls.length}
          </div>
        </div>
      )}
    </>
  );
}
