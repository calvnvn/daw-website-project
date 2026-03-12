import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft,
  ChevronRight,
  X,
  ChevronLeft,
  ImageIcon,
  Calendar,
  User,
} from "lucide-react";
import ScrollReveal from "@/components/ScrollReveal";
import ProjectDetailSkeleton from "@/components/ProjectDetailSkeleton";

// 1. Interface untuk menghilangkan warning 'any'
interface ProjectData {
  id: string;
  title: string;
  category: string;
  content: string;
  cover_image: string | null;
  gallery: string | null;
  author: string;
  createdAt: string;
  updatedAt: string;
  views: number;
}

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // 2. Menggunakan interface yang sudah dikunci bentuknya
  const [project, setProject] = useState<ProjectData | null>(null);
  const [otherProjects, setOtherProjects] = useState<ProjectData[]>([]);
  const [galleryUrls, setGalleryUrls] = useState<string[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(
    null,
  );

  // 3. Menghindari "Calling State Synchronously"
  useEffect(() => {
    setIsLoading(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
    setSelectedImageIndex(null);

    // Fetch Data Utama
    fetch(`http://localhost:5000/api/projects/public/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Project not found");
        return res.json();
      })
      .then((data: ProjectData) => {
        setProject(data);
        if (data.gallery) {
          const parsed = JSON.parse(data.gallery);
          setGalleryUrls(
            parsed.map((img: string) => `http://localhost:5000/uploads/${img}`),
          );
        } else {
          setGalleryUrls([]);
        }
      })
      .catch((err) => console.error("Error fetching project:", err))
      .finally(() => setIsLoading(false));

    // Fetch Data Sidebar (Other Projects)
    fetch(`http://localhost:5000/api/projects/public`)
      .then((res) => res.json())
      .then((data: ProjectData[]) => {
        const filtered = data.filter((p) => p.id !== id).slice(0, 4);
        setOtherProjects(filtered);
      })
      .catch((err) => console.error("Error fetching other projects:", err));
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

  const heroImage = project.cover_image
    ? `http://localhost:5000/uploads/${project.cover_image}`
    : "";

  return (
    <>
      <div className="min-h-screen bg-white pb-20">
        {/* --- HERO BANNER SECTION (Konsisten dengan Desain Asli) --- */}
        <section className="relative w-full h-[50vh] min-h-[400px] flex items-center justify-center overflow-hidden bg-slate-900">
          {heroImage && (
            <div
              className="absolute inset-0 w-full h-full bg-cover bg-center transform scale-100 hover:scale-110 transition-transform duration-[15000ms] ease-out"
              style={{ backgroundImage: `url(${heroImage})` }}
            />
          )}
          <div className="absolute inset-0 bg-daw-green/70 mix-blend-multiply" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30" />

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
                  className="font-sans prose prose-lg max-w-full prose-slate text-slate-600 md:text-[17px] leading-[1.8] tracking-normal whitespace-pre-line prose-headings:font-serif prose-headings:text-slate-900 prose-p:my-4 prose-a:text-daw-green prose-a:font-semibold hover:prose-a:text-[#003b1c] prose-a:underline-offset-4 prose-img:rounded-xl prose-img:shadow-md prose-img:w-full prose-img:my-8 [&_table]:block [&_table]:overflow-x-auto [&_table]:w-full [&_table]:whitespace-nowrap [&_table]:border-collapse [&_td]:border [&_td]:border-slate-200 [&_td]:p-3 [&_th]:border [&_th]:border-slate-200 [&_th]:p-3 [&_th]:bg-slate-50 [&_pre]:whitespace-pre-wrap [&_pre]:break-words text-justify break-normal [word-break:normal] [overflow-wrap:break-word] overflow-hidden"
                  dangerouslySetInnerHTML={{ __html: project.content }}
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
                              src={`http://localhost:5000/uploads/${other.cover_image}`}
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
