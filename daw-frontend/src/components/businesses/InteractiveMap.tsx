import { useState, useEffect, useMemo, memo } from "react";
import mapBase from "@/assets/map-indonesia-base.svg";
import { MapIcon, X } from "lucide-react";

export interface MapMarker {
  id: string;
  title: string;
  desc: string;
  type: "direct" | "tudung";
  dotX: string;
  dotY: string;
  boxX: string;
  boxY: string;
  mapUrl?: string;
}

interface InteractiveMapProps {
  markers: MapMarker[];
}

const InteractiveMap = memo(function InteractiveMap({
  markers,
}: InteractiveMapProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // PHYSICS COLLISION ENGINE V4: TALL STEM ARCHITECTURE
  const smartMarkers = useMemo(() => {
    if (!markers || markers.length === 0) return [];

    const nodes = markers.map((m, index) => {
      const dX = parseFloat(m.dotX);
      const dY = parseFloat(m.dotY);

      // 1. KUNCI ANTI NUMPUK: Alternating Direction (Ganjil ke Atas, Genap ke Bawah)
      // Jika index genap = -1 (Ke Atas). Jika ganjil = 1 (Ke Bawah).
      const direction = index % 2 === 0 ? -1 : 1;

      // Beri sedikit dorongan ke kiri/kanan di awal agar tidak satu sumbu vertikal
      const shiftX = index % 2 === 0 ? -2 : 2;

      return {
        ...m,
        dX,
        dY,
        bX: dX + shiftX,
        // Spawn menjauh ke atas atau ke bawah sesuai 'direction'
        bY: dY + 20 * direction,
        // Simpan target melayang masing-masing kotak
        targetHoverY: dY + 18 * direction,
      };
    });

    // Iterasi Simulasi Fisika
    for (let i = 0; i < 30; i++) {
      // Naikkan iterasi ke 30 agar lebih presisi
      for (let j = 0; j < nodes.length; j++) {
        // 1. Box vs Box Dodge (Saling menghindar kalau tabrakan)
        for (let k = j + 1; k < nodes.length; k++) {
          const n1 = nodes[j];
          const n2 = nodes[k];
          const dx = n1.bX - n2.bX;
          const dy = n1.bY - n2.bY;
          const dist = Math.sqrt(dx * dx + dy * dy) || 0.1;

          // Jarak aman horizontal dan vertikal
          if (dist < 18) {
            // Perlebar sedikit jarak amannya (dari 16 ke 18)
            const force = (18 - dist) * 0.5;
            n1.bX += (dx / dist) * force;
            n1.bY += (dy / dist) * force;
            n2.bX -= (dx / dist) * force;
            n2.bY -= (dy / dist) * force;
          }
        }

        // 2. Box VS Dot Anti-Eclipse (Kotak menjauhi SEMUA titik)
        const n = nodes[j];
        nodes.forEach((dotNode) => {
          const dx = n.bX - dotNode.dX;
          const dy = n.bY - dotNode.dY;
          const dist = Math.sqrt(dx * dx + dy * dy) || 0.1;

          if (dist < 15) {
            // Naikkan dari 14 ke 15
            const force = (15 - dist) * 0.8;
            n.bX += (dx / dist) * force;
            n.bY += (dy / dist) * force;
          }
        });

        // 3. Gravity (THE HOVER ANCHOR)
        // Sekarang kotak akan ditarik ke targetHoverY masing-masing (ada yg ke atas, ada yg ke bawah)
        const anchorDx = n.dX - n.bX;
        const anchorDy = n.targetHoverY - n.bY;
        const anchorDist = Math.sqrt(anchorDx * anchorDx + anchorDy * anchorDy);

        if (anchorDist > 5) {
          n.bX += anchorDx * 0.05;
          n.bY += anchorDy * 0.05;
        }

        // 4. Batas Edge Layar (Mencegah kotak keluar dari map)
        n.bX = Math.max(8, Math.min(92, n.bX)); // Persempit edge agar box tidak terpotong
        n.bY = Math.max(10, Math.min(90, n.bY));
      }
    }

    return nodes;
  }, [markers]);

  const activeMarker = useMemo(
    () => smartMarkers.find((m) => m.id === activeId),
    [activeId, smartMarkers],
  );

  if (smartMarkers.length === 0) return null;

  return (
    <div className="relative w-full bg-white md:bg-slate-50/50 md:rounded-3xl md:border border-slate-200 shadow-sm p-0 md:p-8 overflow-hidden">
      {/* Legend & Instruksi (Sembunyikan di mobile agar lebih clean, atau biarkan di atas) */}
      <div className="flex justify-between items-center mb-4 px-4 md:px-0 mt-4 md:mt-0">
        <div className="bg-white/95 backdrop-blur-sm p-2.5 rounded-xl border border-slate-200/60 shadow-sm flex flex-row gap-4 md:gap-6 relative z-10 w-full md:w-auto justify-center md:justify-start">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#004B23]"></span>
            <span className="text-[9px] md:text-[10px] font-bold text-slate-700 uppercase tracking-wider">
              DAW DIRECT
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#D97706]"></span>
            <span className="text-[9px] md:text-[10px] font-bold text-slate-700 uppercase tracking-wider">
              TUDUNG GROUP
            </span>
          </div>
        </div>
      </div>

      {/* Area Peta Utama */}
      <div className="relative w-full aspect-[16/10] md:aspect-[16/9] flex items-center justify-center overflow-hidden">
        <img
          src={mapBase}
          alt="Map"
          className="absolute inset-0 w-full h-full object-contain opacity-70 md:opacity-80 pointer-events-none"
        />

        {/* LAYER GARIS PENGHUBUNG (Hanya muncul di Desktop) */}
        {!isMobile && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-10 overflow-visible">
            {smartMarkers.map((m) => {
              const isActive = activeId === m.id;
              return (
                <line
                  key={`line-${m.id}`}
                  x1={`${m.dX}%`}
                  y1={`${m.dY}%`}
                  x2={`${m.bX}%`}
                  y2={`${m.bY}%`}
                  stroke={m.type === "direct" ? "#004B23" : "#D97706"}
                  strokeWidth="1.5"
                  className={`transition-all duration-500 ease-out ${
                    isActive ? "opacity-100 stroke-[2px]" : "opacity-40"
                  }`}
                />
              );
            })}
          </svg>
        )}

        {/* LAYER TITIK & KOTAK */}
        {smartMarkers.map((m) => {
          const isActive = activeId === m.id;
          return (
            <div
              key={m.id}
              className={`absolute inset-0 w-full h-full pointer-events-none ${isActive ? "z-50" : "z-20"}`}
            >
              {/* THE DOT */}
              <div
                className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto cursor-pointer"
                style={{ left: `${m.dX}%`, top: `${m.dY}%` }}
                onClick={() => setActiveId(isActive ? null : m.id)}
                onMouseEnter={() => !isMobile && setActiveId(m.id)}
                onMouseLeave={() => !isMobile && setActiveId(null)}
              >
                <span
                  className={`animate-ping absolute inline-flex h-4 w-4 rounded-full opacity-40 ${
                    m.type === "direct" ? "bg-[#004B23]" : "bg-[#D97706]"
                  }`}
                ></span>
                <span
                  className={`relative inline-flex rounded-full h-3 w-3 border-[1.5px] border-white shadow-md transition-all duration-300 ${
                    isActive ? "scale-150" : "scale-100 hover:scale-125"
                  } ${m.type === "direct" ? "bg-[#004B23]" : "bg-[#D97706]"}`}
                ></span>
              </div>

              {/* THE INFO BOX (DESKTOP ONLY) */}
              {!isMobile && (
                <div
                  className={`absolute bg-white/95 backdrop-blur-md border shadow-xl p-3 md:p-4 rounded-xl -translate-x-1/2 -translate-y-1/2 transition-all duration-500 ease-out flex flex-col justify-center pointer-events-auto
                  ${m.type === "direct" ? "border-[#004B23]/30" : "border-[#D97706]/30"}
                  ${isActive ? "opacity-100 scale-110 shadow-2xl z-50" : "opacity-90 scale-100 visible"}
                  ${activeId !== null && !isActive ? "opacity-30 blur-[1px] grayscale-[30%]" : ""}
                  `}
                  style={{
                    left: `${m.bX}%`,
                    top: `${m.bY}%`,
                    minWidth: "150px",
                    maxWidth: "220px",
                  }}
                  onMouseEnter={() => !isMobile && setActiveId(m.id)}
                  onMouseLeave={() => !isMobile && setActiveId(null)}
                >
                  <h4
                    className={`font-serif font-bold text-[13px] md:text-[14px] leading-tight mb-1.5 break-words ${
                      m.type === "direct" ? "text-[#004B23]" : "text-[#D97706]"
                    }`}
                  >
                    {m.title}
                  </h4>
                  <p className="font-sans text-[11px] font-medium text-slate-600 leading-relaxed break-words">
                    {m.desc}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* --- MOBILE DETAIL PANEL (BOTTOM SHEET) --- */}
      <div
        className={`fixed md:hidden bottom-0 left-0 right-0 z-[100] bg-white border-t border-slate-200 rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.1)] transition-transform duration-500 ease-out p-6 pb-10
        ${activeMarker ? "translate-y-0" : "translate-y-full"}`}
      >
        {/* Handle Bar (Visual cue that it can be swiped/closed) */}
        <div
          className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6"
          onClick={() => setActiveId(null)}
        />

        {activeMarker && (
          <div className="space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <span
                  className={`text-[10px] font-bold uppercase tracking-[0.2em] px-2 py-1 rounded-md ${activeMarker.type === "direct" ? "bg-[#004B23]/10 text-[#004B23]" : "bg-[#D97706]/10 text-[#D97706]"}`}
                >
                  {activeMarker.type === "direct"
                    ? "DAW Direct Owns"
                    : "Tudung Group"}
                </span>
                <h3 className="text-xl font-serif font-bold text-slate-900 mt-2">
                  {activeMarker.title}
                </h3>
              </div>
              <button
                onClick={() => setActiveId(null)}
                className="p-2 bg-slate-100 rounded-full text-slate-400 active:bg-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-slate-600 leading-relaxed font-medium">
              {activeMarker.desc}
            </p>

            {activeMarker.mapUrl && (
              <a
                href={activeMarker.mapUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center justify-center gap-2 w-full py-3.5 rounded-xl text-sm font-bold transition-all active:scale-95 ${activeMarker.type === "direct" ? "bg-[#004B23] text-white" : "bg-[#D97706] text-white"}`}
              >
                <MapIcon className="w-4 h-4" />
                VIEW ON GOOGLE MAPS
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

export default InteractiveMap;
