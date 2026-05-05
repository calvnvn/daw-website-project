import mapBase from "@/assets/map-indonesia-base.svg";

export default function MapMarkerPreview({ data }: { data: any }) {
  if (!data) return null;

  // Koordinat dari payload
  const dotX = parseFloat(data.dotX) || 0;
  const dotY = parseFloat(data.dotY) || 0;

  return (
    <div className="p-2 space-y-4">
      {/*  MINI MAP CANVAS */}
      <div className="relative w-full aspect-[16/9] bg-slate-100 rounded-2xl border border-slate-200 overflow-hidden shadow-inner">
        <img
          src={mapBase}
          alt="Map Base"
          className="absolute inset-0 w-full h-full object-contain opacity-50 grayscale"
        />

        {/* The Animated Pulse Marker */}
        <div
          className="absolute -translate-x-1/2 -translate-y-1/2 z-20"
          style={{ left: `${dotX}%`, top: `${dotY}%` }}>
          <span className="animate-ping absolute inline-flex h-6 w-6 rounded-full bg-daw-green opacity-40"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-daw-green border-2 border-white shadow-md"></span>
        </div>

        {/* Coordinate Overlay */}
        <div className="absolute bottom-3 left-3 bg-white/80 backdrop-blur-md px-2 py-1 rounded border border-slate-200 text-[9px] font-mono text-slate-500">
          X: {dotX}% | Y: {dotY}%
        </div>
      </div>

      {/* 📋 MARKER INFO CARD */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-2 h-2 rounded-full bg-daw-green"></div>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            Marker Details
          </span>
        </div>
        <h4 className="font-serif font-bold text-slate-900 text-lg mb-1">
          {data.title || "Untitled Location"}
        </h4>
        <p className="text-xs text-slate-500 leading-relaxed mb-3 italic">
          "{data.desc || "Tidak ada deskripsi lokasi."}"
        </p>

        {data.mapUrl && (
          <div className="text-[9px] text-daw-green font-bold truncate border-t border-slate-50 pt-2">
            Google Maps: <span className="underline">{data.mapUrl}</span>
          </div>
        )}
      </div>

      <p className="text-[9px] text-slate-400 text-center italic">
        * Verifikasi posisi titik pada peta sebelum menyetujui lokasi baru.
      </p>
    </div>
  );
}
