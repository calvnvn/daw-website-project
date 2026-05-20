import { Calendar, Target, Award } from "lucide-react";
import { getCleanImageUrl } from "@/lib/utils";
import { AVAILABLE_ICONS } from "../../about/AboutConstants";

export default function AchievementPreview({ data }: { data: any }) {
  const Icon = AVAILABLE_ICONS.find((i) => i.id === data.iconId)?.icon || Target;

  return (
    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 flex flex-col md:flex-row gap-5 items-center">
        {data.imageUrl ? (
          <div className="w-24 h-24 md:w-32 md:h-32 shrink-0 rounded-lg overflow-hidden border border-slate-100">
            <img
              src={getCleanImageUrl(data.imageUrl)}
              alt={data.title}
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div className="w-24 h-24 md:w-32 md:h-32 shrink-0 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400">
            <Award className="w-10 h-10 opacity-30" />
          </div>
        )}

        <div className="flex-1 flex flex-col w-full text-left">
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-daw-green/10 text-daw-green font-bold text-[10px] uppercase">
              <Icon className="w-3 h-3" />
              <span>{data.category || "Kategori"}</span>
            </div>
            <div className="flex items-center gap-1 text-slate-400 text-[10px] font-bold uppercase">
              <Calendar className="w-3 h-3" />
              <span>{data.date || "TANGGAL"}</span>
            </div>
          </div>
          <h3 className="font-serif text-lg text-slate-900 mb-1 leading-tight">
            {data.title || "Judul Penghargaan"}
          </h3>
          <p className="text-xs text-slate-500 font-bold mb-2">
            Tahun: {data.year}
          </p>
          <p className="text-xs text-slate-600 line-clamp-3">
            {data.description || "Deskripsi penghargaan..."}
          </p>
        </div>
      </div>
    </div>
  );
}
