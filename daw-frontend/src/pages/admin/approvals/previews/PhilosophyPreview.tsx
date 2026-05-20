export default function PhilosophyPreview({ data }: { data: any }) {
  if (!data) return null;

  return (
    <div className="space-y-4 p-2">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm text-center">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
          Headline Utama (Our Philosophy)
        </p>
        <h3 className="font-serif text-2xl text-slate-900">
          {data.philosophyTitle || "Tanpa Judul"}
        </h3>
      </div>
      <p className="text-[9px] text-slate-400 text-center italic mt-4">
        * Preview perubahan pada judul Philosophy
      </p>
    </div>
  );
}
