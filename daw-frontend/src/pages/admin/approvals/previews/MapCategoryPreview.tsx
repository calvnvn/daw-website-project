export default function MapCategoryPreview({ data }: { data: any }) {
  if (!data) return null;
  return (
    <div className="p-2 space-y-4">
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
            Category Name
          </p>
          <p className="font-bold text-base text-slate-900">{data.name}</p>
        </div>
        <div className="flex flex-col items-end">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
            Color Pin
          </p>
          <div className="flex items-center gap-2">
            <div
              className="w-6 h-6 rounded-full border border-slate-300 shadow-inner"
              style={{ backgroundColor: data.color || "#cccccc" }}></div>
            <span className="font-mono text-xs text-slate-500">
              {data.color || "None"}
            </span>
          </div>
        </div>
      </div>
      <p className="text-[9px] text-slate-400 text-center italic mt-4">
        * Preview kategori peta interaktif
      </p>
    </div>
  );
}
