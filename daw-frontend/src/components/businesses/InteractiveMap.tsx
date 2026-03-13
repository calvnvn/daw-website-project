import { useState, useEffect, useMemo } from "react";
import mapBase from "@/assets/map-indonesia-base.svg";

export interface MapMarker {
  id: string;
  title: string;
  desc: string;
  type: "direct" | "tudung";
  dotX: string;
  dotY: string;
  boxX: string;
  boxY: string;
}

interface InteractiveMapProps {
  markers: MapMarker[];
}

export default function InteractiveMap({ markers }: InteractiveMapProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // ==========================================
  // PHYSICS COLLISION ENGINE V3: THE SHIELD
  // ==========================================
  const smartMarkers = useMemo(() => {
    if (!markers || markers.length === 0) return [];

    const nodes = markers.map((m) => {
      const dX = parseFloat(m.dotX);
      const dY = parseFloat(m.dotY);
      return {
        ...m,
        dX,
        dY,
        // Posisi awal kotak didorong ke atas (12%) agar tidak menutupi titik
        bX: dX,
        bY: dY - 12,
      };
    });

    // Simulasi Fisika (Dijalankan 60 kali agar posisinya stabil dan sempurna)
    for (let i = 0; i < 60; i++) {
      for (let j = 0; j < nodes.length; j++) {
        // 1. KOTAK VS KOTAK (Saling Menghindar)
        for (let k = j + 1; k < nodes.length; k++) {
          const n1 = nodes[j];
          const n2 = nodes[k];
          const dx = n1.bX - n2.bX;
          const dy = n1.bY - n2.bY;
          const dist = Math.sqrt(dx * dx + dy * dy) || 0.1;

          if (dist < 14) {
            // Jarak minimal antar kotak adalah 14% layar
            const force = (14 - dist) * 0.5;
            n1.bX += (dx / dist) * force;
            n1.bY += (dy / dist) * force;
            n2.bX -= (dx / dist) * force;
            n2.bY -= (dy / dist) * force;
          }
        }

        // 2. KOTAK VS TITIK DOT (Anti-Gerhana / Tidak Boleh Menutupi Titik)
        const n = nodes[j];
        nodes.forEach((dotNode) => {
          const dx = n.bX - dotNode.dX;
          const dy = n.bY - dotNode.dY;
          const dist = Math.sqrt(dx * dx + dy * dy) || 0.1;

          if (dist < 9) {
            // Kotak harus berada minimal 9% dari TITIK MANAPUN
            const force = (9 - dist) * 0.8; // Gaya pentalannya sangat kuat
            n.bX += (dx / dist) * force;
            n.bY += (dy / dist) * force;
          }
        });

        // 3. GRAVITASI (Tarik kotak kembali ke arah titik asalnya agar tidak hilang)
        const anchorDx = n.dX - n.bX;
        const anchorDy = n.dY - n.bY;
        const anchorDist = Math.sqrt(anchorDx * anchorDx + anchorDy * anchorDy);

        if (anchorDist > 18) {
          // Jika kotak terpental terlalu jauh (>18%), tarik pelan-pelan
          n.bX += anchorDx * 0.05;
          n.bY += anchorDy * 0.05;
        }

        // 4. BATAS LAYAR PETA
        n.bX = Math.max(5, Math.min(95, n.bX));
        n.bY = Math.max(5, Math.min(90, n.bY));
      }
    }

    return nodes;
  }, [markers]);

  if (smartMarkers.length === 0) return null;

  return (
    <div className="w-full bg-slate-50/50 rounded-3xl border border-slate-200 shadow-sm p-4 md:p-8">
      {/* Legend & Instruksi */}
      <div className="flex justify-between items-center mb-6">
        <p className="text-[11px] font-bold text-daw-green uppercase tracking-widest bg-daw-green/10 px-3 py-1.5 rounded-lg md:hidden animate-pulse">
          Tap dots for details
        </p>
        <div className="bg-white/95 backdrop-blur-sm p-3 rounded-xl border border-slate-200/60 shadow-sm flex flex-col gap-2 relative z-50 ml-auto md:ml-0 md:flex-row md:gap-6">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-[#004B23]"></span>
            <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">
              DAW direct owns
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-[#D97706]"></span>
            <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">
              Tudung Group
            </span>
          </div>
        </div>
      </div>

      {/* Area Peta Utama */}
      <div className="relative w-full h-auto flex items-center justify-center">
        <img
          src={mapBase}
          alt="Map of Indonesia"
          className="w-full h-auto opacity-80 pointer-events-none"
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
                onMouseEnter={() => !isMobile && setActiveId(m.id)}
                onMouseLeave={() => !isMobile && setActiveId(null)}
                onClick={() => isMobile && setActiveId(isActive ? null : m.id)}
              >
                <span
                  className={`animate-ping absolute inline-flex h-4 w-4 md:h-5 md:w-5 rounded-full opacity-40 ${
                    m.type === "direct" ? "bg-[#004B23]" : "bg-[#D97706]"
                  }`}
                ></span>
                <span
                  className={`relative inline-flex rounded-full h-3 w-3 md:h-3.5 md:w-3.5 border-[2px] border-white shadow-md transition-transform duration-300 ${
                    isActive ? "scale-150" : "scale-100 hover:scale-125"
                  } ${m.type === "direct" ? "bg-[#004B23]" : "bg-[#D97706]"}`}
                ></span>
              </div>

              {/* THE INFO BOX */}
              <div
                className={`absolute bg-white/95 backdrop-blur-md border shadow-xl p-3 md:p-4 rounded-xl -translate-x-1/2 transition-all duration-500 ease-out flex flex-col justify-center
                ${m.type === "direct" ? "border-[#004B23]/30" : "border-[#D97706]/30"}
                
                /* DESKTOP: Gunakan koordinat Fisika (bY) & pusatkan di tengahnya (-translate-y-1/2) */
                ${!isMobile ? "-translate-y-1/2 pointer-events-auto visible opacity-90" : ""}
                ${!isMobile && isActive ? "opacity-100 scale-110 shadow-2xl z-50" : "scale-100"}
                ${!isMobile && activeId !== null && !isActive ? "opacity-30 blur-[1px] grayscale-[30%]" : ""}
                
                /* MOBILE: Gunakan titik asal (dY), TAPI dipaksa naik murni ke atas titik (-translate-y-[calc(100%+16px)]) */
                ${isMobile ? "-translate-y-[calc(100%+16px)]" : ""}
                ${isMobile && isActive ? "opacity-100 visible scale-100 z-50 pointer-events-auto" : ""}
                ${isMobile && !isActive ? "opacity-0 invisible scale-90 -z-10 pointer-events-none mt-4" : ""}
                `}
                style={{
                  // Kunci Posisi: Jika Mobile, nempel ke dot (dX, dY). Jika Desktop, ikut hasil Fisika (bX, bY).
                  left: isMobile ? `${m.dX}%` : `${m.bX}%`,
                  top: isMobile ? `${m.dY}%` : `${m.bY}%`,
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

                {/* Aksen Segitiga Penunjuk di Mobile agar lebih manis seperti Tooltip Maps */}
                {isMobile && (
                  <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white rotate-45 border-r border-b border-slate-200/50 -z-10"></div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
