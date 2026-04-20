import * as Icons from "lucide-react";

export default function ImpactStatPreview({ data }: { data: any }) {
  if (!data) return null;

  // Handle data bulk (array) atau data tunggal (object)
  const stats = Array.isArray(data) ? data : data.stats || [data];

  return (
    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 shadow-inner">
      <div className="mb-4 flex items-center justify-between">
        <span className="px-2 py-0.5 rounded bg-daw-green text-white text-[9px] font-black uppercase tracking-widest">
          Statistics Grid Preview
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-white p-6 rounded-xl border border-slate-100 shadow-sm">
        {stats.map((stat: any, index: number) => {
          // Resolve Icon secara dinamis dari string database
          const IconComponent = (Icons as any)[stat.icon] || Icons.HelpCircle;

          return (
            <div
              key={index}
              className="flex flex-col items-center text-center p-4 border border-slate-50 rounded-xl hover:bg-slate-50 transition-colors">
              <div className="w-10 h-10 rounded-full bg-daw-green/10 flex items-center justify-center mb-3">
                <IconComponent className="w-5 h-5 text-daw-green stroke-[2px]" />
              </div>

              <div className="space-y-1">
                <h4 className="text-2xl font-serif font-bold text-slate-900">
                  {stat.value || "0"}
                </h4>
                <p className="text-[10px] font-black text-slate-800 uppercase tracking-tight">
                  {stat.label || "Tanpa Label"}
                </p>
                <p className="text-[11px] text-slate-500 leading-tight line-clamp-2 italic">
                  {stat.desc || "Tidak ada deskripsi."}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-4 text-[9px] text-slate-400 text-center italic">
        * Animasi counter dinonaktifkan dalam mode pratinjau.
      </p>
    </div>
  );
}
