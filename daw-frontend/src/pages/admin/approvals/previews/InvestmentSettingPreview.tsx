import { ArrowRight } from "lucide-react";

export default function InvestmentSettingPreview({ data }: { data: any }) {
  if (!data) return null;

  return (
    <div className="p-4 bg-[#081C15] rounded-2xl border border-emerald-900/50 shadow-inner overflow-hidden relative">
      {/* Background Simlation */}
      <div className="absolute inset-0 bg-[radial-gradient(#ffffff05_1px,transparent_1px)] [background-size:16px_16px] opacity-30"></div>

      <div className="relative z-10 space-y-6">
        <span className="px-2 py-0.5 rounded bg-emerald-500 text-white text-[8px] font-black uppercase tracking-widest">
          Investment Settings Preview
        </span>

        <div className="space-y-4">
          <div>
            <p className="text-[9px] font-bold text-emerald-400/60 uppercase tracking-widest mb-1">
              Teaser Headline
            </p>
            <h2 className="text-2xl font-serif text-white leading-tight">
              {data.teaserHeadline || "Other Investments."}
            </h2>
          </div>

          <div>
            <p className="text-[9px] font-bold text-emerald-400/60 uppercase tracking-widest mb-1">
              Teaser Body
            </p>
            <p className="text-xs text-slate-400 font-light leading-relaxed whitespace-pre-line line-clamp-4">
              {data.teaserBody || "Belum ada deskripsi teaser..."}
            </p>
          </div>

          <div className="pt-2 flex items-center gap-3 text-white/40 text-[10px] font-bold uppercase tracking-tighter">
            <div className="px-4 py-2 rounded-full border border-white/10 bg-white/5 flex items-center gap-2">
              Read More <ArrowRight className="w-3 h-3" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
