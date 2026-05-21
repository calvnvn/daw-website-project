import DOMPurify from "dompurify";
import { LinkIcon, Search, FileText, Calendar, Clock } from "lucide-react";
import { getCleanImageUrl } from "@/lib/utils";

export default function NewsArticlePreview({ data }: { data: any }) {
  if (!data) return null;

  const sanitizeConfig = {
    ADD_TAGS: ["iframe"],
    ADD_ATTR: ["allow", "allowfullscreen", "frameborder", "scrolling", "id"],
  };

  const getDynamicSeoDescription = () => {
    if (data.meta_description && data.meta_description.trim() !== "")
      return data.meta_description;
    if (data.excerpt && data.excerpt.trim() !== "")
      return data.excerpt;

    if (!data.content || data.content.trim() === "") {
      return "No description preview available.";
    }

    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(data.content, "text/html");
      let plainText = doc.body.textContent || "";
      plainText = plainText.replace(/\s+/g, " ").trim();
      if (plainText.length === 0) {
        return "No description preview available.";
      }
      return plainText.slice(0, 150) + (plainText.length > 150 ? "..." : "");
    } catch (e) {
      const plainText = (data.content || "")
        .replace(/<[^>]*>?/gm, "")
        .replace(/&nbsp;|\u00A0/g, " ")
        .trim();
      return plainText.slice(0, 150) + (plainText.length > 150 ? "..." : "");
    }
  };

  const generatedSlug = (data.title || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

  return (
    <div className="p-2 space-y-6">
      {/* SECTION 1: COVER IMAGE & META BANNER */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm flex flex-col">
        {/* Cover Image Simulator */}
        <div className="h-48 bg-slate-100 relative">
          {data.cover_image ? (
            <img
              src={getCleanImageUrl(data.cover_image)}
              className="w-full h-full object-cover"
              alt="Cover Preview"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-slate-300">
              <FileText className="w-12 h-12 opacity-50" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 to-transparent" />

          <div className="absolute bottom-4 left-6 right-6">
            <h2 className="text-2xl font-serif font-bold text-white leading-tight">
              {data.title || "Untitled Article"}
            </h2>
          </div>
        </div>

        {/* Dynamic Meta Info */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center gap-6 text-xs text-slate-500 font-bold uppercase tracking-wider">
          <div className="flex items-center gap-1.5">
            <LinkIcon className="w-3.5 h-3.5 text-daw-green" />
            <span className="font-mono text-slate-400">/news/{generatedSlug || "---"}</span>
          </div>
          {data.published_at && (
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>
                Terbit:{" "}
                {new Date(data.published_at).toLocaleDateString("id-ID", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>{data.read_time || "Auto Waktu Baca"}</span>
          </div>
        </div>
      </div>

      {/* SECTION 2: SEO GOOGLE CARD PREVIEW */}
      <div className="bg-slate-900 p-6 rounded-2xl shadow-md border border-slate-800">
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-3">
          Google Search Snippet Preview
        </span>
        <div className="bg-white p-4 rounded-xl shadow-inner flex flex-col justify-center">
          <p className="text-[#1a0dab] text-lg font-medium truncate hover:underline cursor-pointer">
            {data.seo_title || data.title || "Untitled Article"}
          </p>
          <p className="text-[#006621] text-xs truncate mb-1 flex items-center gap-1 font-mono">
            daw.co.id <span className="text-slate-400 text-[10px]">› news ›</span> {generatedSlug || "..."}
          </p>
          <p className="text-[#545454] text-xs line-clamp-2 leading-relaxed break-words">
            {getDynamicSeoDescription()}
          </p>
        </div>
      </div>

      {/* SECTION 3: EXCERPT & WYSIWYG CONTENT */}
      <div className="space-y-6">
        {data.excerpt && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">
              Ringkasan (Excerpt)
            </span>
            <p className="text-sm text-slate-600 leading-relaxed italic">
              "{data.excerpt}"
            </p>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-4">
            Konten Artikel (HTML Render)
          </span>
          <article
            className="prose prose-sm max-w-none text-slate-600 leading-relaxed line-clamp-[20]
              prose-p:leading-[1.8] prose-p:text-slate-600 prose-p:mb-4
              prose-headings:font-serif prose-headings:text-slate-900
              prose-h2:text-2xl prose-h2:mt-6 prose-h2:mb-4
              prose-blockquote:border-l-4 prose-blockquote:border-daw-green
              prose-blockquote:bg-slate-50 prose-blockquote:py-2 prose-blockquote:px-4
              prose-blockquote:italic"
            dangerouslySetInnerHTML={{
              __html: DOMPurify.sanitize(
                (data.content || "").replace(/&nbsp;|\u00A0/g, " "),
                sanitizeConfig
              ),
            }}
          />
        </div>
      </div>
    </div>
  );
}
