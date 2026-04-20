import { getCleanImageUrl } from "@/lib/utils";
import { Globe2 } from "lucide-react";

export default function AffiliatePreview({ data }: { data: any }) {
  if (!data) return null;

  return (
    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
      <div className="mb-4 flex items-center justify-between">
        <span className="px-2 py-0.5 rounded bg-daw-green text-white text-[9px] font-black uppercase tracking-widest">
          Affiliate Card Preview
        </span>
        <span className="text-[10px] text-slate-400 font-mono">
          Category:{" "}
          <span className="font-bold text-daw-green">
            {data.category || "General"}
          </span>
        </span>
      </div>

      <div className="bg-[#001a0a] p-6 rounded-2xl border border-emerald-900/30 flex flex-col items-center text-center space-y-4">
        {/* Logo Simulation */}
        <div className="w-20 h-20 rounded-full bg-white flex items-center justify-center shadow-xl p-4 border border-white/10">
          {data.logoUrl ? (
            <img
              src={getCleanImageUrl(data.logoUrl)}
              alt={data.name}
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="text-[10px] text-slate-300 font-bold uppercase tracking-tighter">
              No Logo
            </div>
          )}
        </div>

        {/* Info */}
        <div className="space-y-1">
          <h4 className="text-lg font-serif font-bold text-white">
            {data.name || "Nama Perusahaan"}
          </h4>
          <p className="text-[10px] text-slate-400 leading-relaxed line-clamp-2 italic">
            {data.desc || "Tidak ada deskripsi singkat."}
          </p>
        </div>

        {/* Website Link Placeholder */}
        {data.websiteUrl && (
          <div className="flex items-center gap-1.5 text-emerald-400 text-[10px] font-bold">
            <Globe2 className="w-3 h-3" />
            <span className="underline underline-offset-4">
              {data.websiteUrl}
            </span>
          </div>
        )}
      </div>

      <p className="mt-4 text-[9px] text-slate-400 text-center italic leading-tight">
        * Preview disimulasikan dalam mode kartu investasi (Dark Theme).
      </p>
    </div>
  );
}
