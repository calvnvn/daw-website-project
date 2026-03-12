import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ImageIcon } from "lucide-react";

export default function PublicProjects() {
  const [projects, setProjects] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Panggil API Publik yang tidak butuh token
    fetch("http://localhost:5000/api/projects/public")
      .then((res) => res.json())
      .then((data) => setProjects(data))
      .catch((err) => console.error(err))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-6 py-16 animate-in fade-in duration-500">
      <div className="text-center mb-16">
        <h1 className="text-4xl font-serif font-bold text-slate-900 mb-4">
          DAW Projects & Portfolios
        </h1>
        <p className="text-slate-500 max-w-2xl mx-auto">
          Explore our latest operational assets, energy solutions, and resource
          management projects.
        </p>
      </div>

      {isLoading ? (
        <div className="text-center text-slate-400 py-20">
          Loading projects...
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center text-slate-400 py-20">
          No published projects yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {projects.map((project) => (
            <Link
              key={project.id}
              to={`/projects/${project.id}`}
              className="group flex flex-col bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
            >
              {/* Cover Image */}
              <div className="aspect-[4/3] w-full bg-slate-100 overflow-hidden relative">
                {project.cover_image ? (
                  <img
                    src={`http://localhost:5000/uploads/${project.cover_image}`}
                    alt={project.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-300">
                    <ImageIcon className="w-10 h-10" />
                  </div>
                )}
                <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-daw-green rounded-full">
                  {project.category}
                </div>
              </div>

              {/* Text Content */}
              <div className="p-6 flex flex-col flex-1">
                <p className="text-xs text-slate-400 mb-2">
                  {new Date(project.createdAt).toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
                <h3 className="text-xl font-bold text-slate-900 mb-4 group-hover:text-daw-green transition-colors line-clamp-2">
                  {project.title}
                </h3>

                <div className="mt-auto flex items-center text-sm font-bold text-daw-green">
                  Read More{" "}
                  <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-2 transition-transform" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
