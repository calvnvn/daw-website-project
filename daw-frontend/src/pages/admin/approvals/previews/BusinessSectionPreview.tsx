import DOMPurify from "dompurify";

export default function BusinessSectionPreview({ data }: { data: any }) {
  if (!data) return null;

  return (
    <div className="p-2 space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        {/* Header Simulation */}
        <div className="p-8 border-b border-slate-50 bg-gradient-to-br from-white to-slate-50">
          <div className="flex items-center gap-3 mb-4">
            <span className="w-8 h-[2px] bg-daw-green rounded-full"></span>
            <span className="text-[10px] font-black text-daw-green uppercase tracking-[0.2em]">
              {data.title || "Business Unit"}
            </span>
          </div>
          <h2 className="text-3xl font-serif font-bold text-slate-900 leading-tight">
            {data.category || "Division Name"}
            <span className="block text-xl text-slate-300 italic font-light mt-1">
              Division
            </span>
          </h2>
        </div>

        {/* Content Simulation */}
        <div className="p-8">
          <div className="flex items-center gap-2 mb-4 text-slate-400">
            <span className="text-[9px] font-black uppercase tracking-widest">
              Editorial Narrative
            </span>
          </div>
          <div
            className="prose prose-sm max-w-none text-slate-600 leading-relaxed line-clamp-[10] daw-editorial-content"
            dangerouslySetInnerHTML={{
              __html: DOMPurify.sanitize(
                (data.htmlContent || "").replace(/&nbsp;|\u00A0/g, " "),
              ),
            }}
          />
        </div>
      </div>

      {/* Map Toggle Indicator */}
      <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-xl">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-tight">
          Interactive Map Module:
        </span>
        <span
          className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${data.hasMap ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500"}`}>
          {data.hasMap ? "ENABLED" : "DISABLED"}
        </span>
      </div>
    </div>
  );
}
