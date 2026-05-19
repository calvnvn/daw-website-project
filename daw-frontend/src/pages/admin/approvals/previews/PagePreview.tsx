import DOMPurify from "dompurify";
import { LinkIcon, Search, LayoutTemplate } from "lucide-react";
import { getCleanImageUrl } from "@/lib/utils";

export default function PagePreview({ data }: { data: any }) {
  if (!data) return null;

  const sanitizeConfig = {
    ADD_TAGS: ["iframe"],
    ADD_ATTR: ["allow", "allowfullscreen", "frameborder", "scrolling", "id"],
  };

  const safeSidebarLinks = (() => {
    try {
      return typeof data.sidebarLinks === "string"
        ? JSON.parse(data.sidebarLinks)
        : data.sidebarLinks || [];
    } catch {
      return [];
    }
  })();

  return (
    <div className="p-2 space-y-6">
      {/* SECTION 1: HERO & METADATA */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm flex flex-col">
        {/* Cover Image Simulator */}
        <div className="h-40 bg-slate-100 relative">
          {data.heroImage ? (
            <img
              src={getCleanImageUrl(data.heroImage)}
              className="w-full h-full object-cover"
              alt="Hero Preview"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-slate-300">
              <LayoutTemplate className="w-10 h-10 opacity-50" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 to-transparent" />

          <div className="absolute bottom-4 left-6 right-6">
            {data.subtitle && (
              <p className="text-emerald-400 font-bold tracking-[0.2em] uppercase text-[10px] mb-1">
                {data.subtitle}
              </p>
            )}
            <h2 className="text-2xl font-serif font-bold text-white leading-tight">
              {data.title || "Untitled Page"}
            </h2>
          </div>
        </div>

        {/* URL & SEO Info */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-col gap-3">
          <div className="flex items-center gap-2 text-xs font-mono text-slate-500">
            <LinkIcon className="w-3 h-3 text-daw-green" />
            <span>/page/{data.slug || "---"}</span>
          </div>

          <div className="flex items-start gap-2 bg-white p-3 rounded-lg border border-slate-200">
            <Search className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">
                Meta Description
              </span>
              <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                {data.metaDescription || (
                  <span className="italic opacity-50">
                    Belum ada deskripsi SEO
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: CONTENT & WIDGET CONFIG */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Editorial Content */}
        <div className="md:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Editorial Content
            </span>
            {data.showDropCap && (
              <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded text-[9px] font-bold tracking-wider">
                Drop Cap Active
              </span>
            )}
          </div>
          <div
            className={`prose prose-sm max-w-none text-slate-600 leading-relaxed line-clamp-[12]
              ${data.showDropCap ? "prose-p:first-of-type:first-letter:text-4xl prose-p:first-of-type:first-letter:font-serif prose-p:first-of-type:first-letter:font-black prose-p:first-of-type:first-letter:text-daw-green prose-p:first-of-type:first-letter:float-left prose-p:first-of-type:first-letter:mr-2" : ""}`}
            dangerouslySetInnerHTML={{
              __html: DOMPurify.sanitize(
                (data.content || "").replace(/&nbsp;|\u00A0/g, " "),
                sanitizeConfig,
              ),
            }}
          />
        </div>

        {/* Sidebar Links Preview */}
        <div className="md:col-span-1 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-4">
            Sidebar Widget
          </span>
          {safeSidebarLinks.length > 0 ? (
            <div className="flex flex-col gap-2">
              {safeSidebarLinks.map((link: any, idx: number) => (
                <div
                  key={idx}
                  className="p-3 bg-slate-50 border border-slate-100 rounded-lg text-xs font-bold text-slate-700">
                  {link.label || "Link"}
                  <div className="font-mono text-[9px] text-slate-400 font-normal truncate mt-1">
                    {link.url}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-24 border-2 border-dashed border-slate-100 rounded-xl flex items-center justify-center text-xs text-slate-400 font-medium">
              Tidak ada tautan
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
