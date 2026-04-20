import { getCleanImageUrl } from "@/lib/utils";
import { ImageIcon, Search, FileText, Layout } from "lucide-react";
import DOMPurify from "dompurify";

export default function ProjectPreview({ data }: { data: any }) {
  if (!data) return null;

  // Parsing Gallery (karena di DB berbentuk JSON string atau array)
  let gallery: string[] = [];
  if (data.gallery) {
    try {
      gallery =
        typeof data.gallery === "string"
          ? JSON.parse(data.gallery)
          : data.gallery;
    } catch (e) {
      gallery = [];
    }
  }

  return (
    <div className="space-y-8 p-2 max-w-full overflow-hidden">
      {/* 🖼️ SECTION 1: HERO & IDENTITY */}
      <div className="relative aspect-video w-full rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-slate-100">
        {data.cover_image ? (
          <img
            src={getCleanImageUrl(data.cover_image)}
            alt="Project Cover"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 gap-2">
            <ImageIcon className="w-8 h-8 opacity-20" />
            <span className="text-[10px] font-bold uppercase tracking-widest">
              No Cover Image
            </span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-6">
          <span className="text-[9px] font-black text-daw-green bg-white/90 px-2 py-0.5 rounded-sm w-max mb-2 uppercase tracking-tighter">
            {data.category || "General Project"}
          </span>
          <h2 className="text-xl md:text-2xl font-serif font-bold text-white leading-tight">
            {data.title || "Untitled Project"}
          </h2>
        </div>
      </div>

      {/* 📑 SECTION 2: EDITORIAL CONTENT */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2 mb-4 text-slate-400">
          <FileText className="w-4 h-4" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em]">
            Project Narrative
          </span>
        </div>
        <div
          className="prose prose-sm max-w-none text-slate-600 leading-relaxed text-xs line-clamp-[15]"
          dangerouslySetInnerHTML={{
            __html: DOMPurify.sanitize(
              data.content || "<i>Tidak ada konten narasi.</i>",
            ),
          }}
        />
      </div>

      {/* 📷 SECTION 3: PROJECT GALLERY */}
      {gallery.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-slate-400">
            <Layout className="w-4 h-4" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">
              Gallery Assets ({gallery.length})
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {gallery.map((img, idx) => (
              <div
                key={idx}
                className="aspect-square rounded-lg bg-slate-100 border border-slate-200 overflow-hidden">
                <img
                  src={getCleanImageUrl(img)}
                  alt="Gallery"
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 🔍 SECTION 4: SEO & STRATEGIC METADATA */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
          <div className="flex items-center gap-2 text-slate-400 mb-1">
            <Search className="w-3.5 h-3.5" />
            <span className="text-[9px] font-black uppercase tracking-widest">
              SEO Configuration
            </span>
          </div>
          <p className="text-[11px] font-bold text-slate-800 leading-tight">
            <span className="text-slate-400 font-normal">Title:</span>{" "}
            {data.seo_title || data.title}
          </p>
          <p className="text-[10px] text-slate-500 leading-relaxed line-clamp-2">
            <span className="text-slate-400 font-normal">Meta Desc:</span>{" "}
            {data.meta_description || "N/A"}
          </p>
        </div>

        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
          <div className="flex items-center gap-2 text-slate-400 mb-1">
            <span className="text-[9px] font-black uppercase tracking-widest italic font-mono">
              system_data
            </span>
          </div>
          <p className="text-[11px] font-bold text-slate-800">
            <span className="text-slate-400 font-normal">Slug:</span> /projects/
            {data.slug || "no-slug"}
          </p>
          <p className="text-[11px] font-bold text-slate-800">
            <span className="text-slate-400 font-normal">Author:</span>{" "}
            {data.author || "System"}
          </p>
        </div>
      </div>

      <p className="text-[9px] text-slate-400 text-center italic mt-6">
        * Peninjauan visual disesuaikan untuk layar admin.
      </p>
    </div>
  );
}
