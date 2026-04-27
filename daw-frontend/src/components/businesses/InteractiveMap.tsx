import { useState, useEffect, useMemo, memo } from "react";
import mapBase from "@/assets/map-indonesia-base.svg";
import { X, ExternalLink } from "lucide-react";
import { type MapCategory } from "@/contexts/BusinessContext";

/**
 * @constant DEFAULT_COLOR
 * Stable reference outside component to prevent unnecessary re-evaluations.
 */
const DEFAULT_COLOR = "#94a3b8";

export interface MapMarker {
  id: string;
  title: string;
  desc: string;
  categoryId: string;
  dotX: string;
  dotY: string;
  boxX: string;
  boxY: string;
  mapUrl?: string;
  categoryData?: MapCategory;
}

interface InteractiveMapProps {
  markers: MapMarker[];
  categories: MapCategory[];
}

const InteractiveMap = memo(function InteractiveMap({
  markers,
  categories,
}: InteractiveMapProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  /**
   * --- PHYSICS COLLISION ENGINE V4.1 ---
   * Manages label positioning to prevent overlapping while maintaining
   * geographical integrity. Optimized for high-density marker sets.
   */
  const smartMarkers = useMemo(() => {
    if (!markers || markers.length === 0) return [];

    // Initialize nodes with local copies of coordinates
    const nodes = markers.map((m, index) => {
      const dX = parseFloat(m.dotX) || 0;
      const dY = parseFloat(m.dotY) || 0;
      const direction = index % 2 === 0 ? -1 : 1;
      const shiftX = index % 2 === 0 ? -2 : 2;

      const catInfo = categories.find((c) => c.id === m.categoryId);

      return {
        ...m,
        dX,
        dY,
        bX: dX + shiftX,
        bY: dY + 20 * direction,
        targetHoverY: dY + 18 * direction,
        color: catInfo?.color || DEFAULT_COLOR,
        categoryName: catInfo?.name || "Division",
      };
    });

    // Run physics simulation
    for (let i = 0; i < 30; i++) {
      for (let j = 0; j < nodes.length; j++) {
        const n = nodes[j];

        // 1. Box vs Box Avoidance
        for (let k = j + 1; k < nodes.length; k++) {
          const n2 = nodes[k];
          const dx = n.bX - n2.bX;
          const dy = n.bY - n2.bY;
          const dist = Math.sqrt(dx * dx + dy * dy) || 0.1;

          if (dist < 18) {
            const force = (18 - dist) * 0.5;
            n.bX += (dx / dist) * force;
            n.bY += (dy / dist) * force;
            n2.bX -= (dx / dist) * force;
            n2.bY -= (dy / dist) * force;
          }
        }

        // 2. Box vs Dot Shield
        nodes.forEach((dotNode) => {
          const dx = n.bX - dotNode.dX;
          const dy = n.bY - dotNode.dY;
          const dist = Math.sqrt(dx * dx + dy * dy) || 0.1;
          if (dist < 15) {
            const force = (15 - dist) * 0.8;
            n.bX += (dx / dist) * force;
            n.bY += (dy / dist) * force;
          }
        });

        // 3. Anchoring Force (Gravity)
        n.bX += (n.dX - n.bX) * 0.05;
        n.bY += (n.targetHoverY - n.bY) * 0.05;

        // 4. Bound Constraint
        n.bX = Math.max(8, Math.min(92, n.bX));
        n.bY = Math.max(10, Math.min(90, n.bY));
      }
    }
    return nodes;
  }, [markers, categories]);

  const activeMarker = useMemo(
    () => smartMarkers.find((m) => m.id === activeId),
    [activeId, smartMarkers],
  );

  if (smartMarkers.length === 0) return null;

  return (
    <div className="relative w-full bg-white md:bg-slate-50/50 md:rounded-3xl md:border border-slate-200 shadow-sm p-0 md:p-8 overflow-hidden">
      {/* --- INTERACTIVE LEGEND --- */}
      <div className="flex justify-between items-center mb-4 px-4 md:px-0 mt-4 md:mt-0">
        <div className="bg-white/95  p-3 rounded-2xl border border-slate-200/60 shadow-sm flex flex-wrap gap-4 md:gap-8 relative z-10 w-full md:w-auto justify-center">
          {categories.map((cat) => (
            <div
              key={cat.id}
              className={`flex items-center gap-2 cursor-pointer transition-all duration-300 ${
                hoveredCategory && hoveredCategory !== cat.id
                  ? "opacity-30 grayscale"
                  : "opacity-100"
              }`}
              onMouseEnter={() => !isMobile && setHoveredCategory(cat.id)}
              onMouseLeave={() => !isMobile && setHoveredCategory(null)}>
              <span
                className="w-3 h-3 rounded-full shadow-sm"
                style={{ backgroundColor: cat.color }}
              />
              <span className="text-[10px] font-bold text-slate-800 uppercase tracking-[0.15em]">
                {cat.name}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* --- MAIN MAP CANVAS --- */}
      <div className="relative w-full aspect-[16/10] md:aspect-[16/9] flex items-center justify-center overflow-hidden">
        <img
          src={mapBase}
          alt="Map"
          className="absolute inset-0 w-full h-full object-contain opacity-70 md:opacity-80 pointer-events-none"
        />

        {/* Vector Connector Layer (Desktop Only) */}
        {!isMobile && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-10 overflow-visible">
            {smartMarkers.map((m) => {
              const isActive = activeId === m.id;
              const isFaded =
                (activeId !== null && !isActive) ||
                (hoveredCategory && m.categoryId !== hoveredCategory);
              return (
                <line
                  key={`line-${m.id}`}
                  x1={`${m.dX}%`}
                  y1={`${m.dY}%`}
                  x2={`${m.bX}%`}
                  y2={`${m.bY}%`}
                  style={{ stroke: m.color }}
                  strokeWidth={isActive ? "2" : "1.5"}
                  className={`transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
                    isActive
                      ? "opacity-100 drop-shadow-[0_0_5px_rgba(0,0,0,0.3)]"
                      : isFaded
                        ? "opacity-30"
                        : "opacity-60"
                  }`}
                />
              );
            })}
          </svg>
        )}

        {/* Interaction Layer: Dots & Boxes */}
        {smartMarkers.map((m) => {
          const isActive = activeId === m.id;
          const isFaded =
            (activeId !== null && !isActive) ||
            (hoveredCategory && m.categoryId !== hoveredCategory);
          const markerColor = m.color;

          return (
            <div key={m.id} className={isActive ? "z-50" : "z-20"}>
              {/* THE MARKER DOT */}
              <div
                className={`absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto cursor-pointer transition-all duration-500 ${isFaded ? "opacity-20 scale-75" : "opacity-100 scale-100"}`}
                style={{ left: `${m.dX}%`, top: `${m.dY}%` }}
                onClick={() => setActiveId(isActive ? null : m.id)}
                onMouseEnter={() => !isMobile && setActiveId(m.id)}
                onMouseLeave={() => !isMobile && setActiveId(null)}>
                {!isFaded && (
                  <span
                    className="animate-ping absolute inline-flex h-4 w-4 rounded-full opacity-40"
                    style={{ backgroundColor: markerColor }}></span>
                )}
                <span
                  className={`relative inline-flex rounded-full h-3 w-3 border-[1.5px] border-white shadow-md transition-all duration-300 ${isActive ? "scale-150" : "hover:scale-125"}`}
                  style={{ backgroundColor: markerColor }}></span>
              </div>

              {/* FLOATING DATA BOX (Desktop Only) - TIER S DESIGN */}
              {!isMobile && (
                <div
                  className={`absolute group flex flex-col justify-center pointer-events-auto transform -translate-x-1/2 -translate-y-1/2 transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] overflow-hidden rounded-2xl
                    ${
                      isActive
                        ? "z-[60] scale-110 bg-white shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] ring-2 ring-offset-4 ring-offset-slate-50/50"
                        : isFaded
                          ? "z-10 scale-95 bg-white/70 backdrop-blur-md opacity-80 border-slate-200 shadow-sm pointer-events-none"
                          : "z-30 scale-100 bg-white/90 backdrop-blur-md border-white/50 shadow-xl hover:shadow-2xl"
                    }
                  `}
                  style={{
                    left: `${m.bX}%`,
                    top: `${m.bY}%`,
                    minWidth: "190px",
                    maxWidth: "260px",
                    borderWidth: "1px",
                    // Apply ring color dynamically
                    ...(isActive
                      ? ({
                          "--tw-ring-color": markerColor,
                        } as React.CSSProperties)
                      : {}),
                    borderColor: isActive ? "transparent" : `${markerColor}30`,
                  }}
                  onMouseEnter={() => setActiveId(m.id)}
                  onMouseLeave={() => setActiveId(null)}>
                  {/* AESTHETIC: Dynamic Top Accent Line */}
                  <div
                    className={`absolute top-0 left-0 w-full transition-all duration-500 ease-out ${
                      isActive ? "h-1.5" : "h-0.5"
                    }`}
                    style={{ backgroundColor: markerColor }}
                  />

                  {/* AESTHETIC: Ambient Inner Glow */}
                  <div
                    className={`absolute inset-0 transition-opacity duration-700 pointer-events-none ${
                      isActive ? "opacity-15" : "opacity-0"
                    }`}
                    style={{
                      background: `radial-gradient(circle at top right, ${markerColor}, transparent 70%)`,
                    }}
                  />

                  {/* CONTENT WRAPPER */}
                  <div className="relative z-10 p-5 flex flex-col gap-2">
                    <div>
                      <h4
                        className="font-serif font-bold text-[14px] leading-tight mb-1 transition-colors duration-300"
                        style={{ color: isActive ? "#0f172a" : markerColor }}>
                        {m.title}
                      </h4>
                      <p className="font-sans text-[11px] font-medium text-slate-600 leading-relaxed">
                        {m.desc}
                      </p>
                    </div>

                    {/* MICRO-INTERACTION: Expanding Action Link (View on Maps) */}
                    {/* Menggunakan Grid template rows untuk transisi ekspansi yang lebih mulus tanpa magic number max-height */}
                    <div
                      className={`grid transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] ${
                        isActive && m.mapUrl
                          ? "grid-rows-[1fr] opacity-100 mt-2"
                          : "grid-rows-[0fr] opacity-0 mt-0"
                      }`}>
                      <div className="overflow-hidden">
                        {m.mapUrl && (
                          <a
                            href={m.mapUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.15em] hover:opacity-70 transition-opacity bg-slate-50 py-2 px-3 rounded-lg border border-slate-100 w-full"
                            style={{ color: markerColor }}
                            onClick={(e) => e.stopPropagation()}>
                            <ExternalLink className="w-3 h-3" />
                            <span>View on Maps</span>
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* --- MOBILE: BOTTOM SHEET & BACKDROP --- */}
      {isMobile && activeId && activeMarker && (
        <>
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] z-[90] animate-in fade-in duration-300"
            onClick={() => setActiveId(null)}
          />

          <div className="fixed md:hidden bottom-0 left-0 right-0 z-[100] bg-white border-t border-slate-100 rounded-t-[2.5rem] shadow-[0_-15px_40px_rgba(0,0,0,0.15)] transition-transform duration-500 ease-out p-8 pb-12 translate-y-0 animate-in slide-in-from-bottom-full">
            <div
              className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-8 cursor-pointer active:scale-95 transition-transform"
              onClick={() => setActiveId(null)}
            />

            {/* Isi Konten Data Lokasi */}
            <div className="space-y-6">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: activeMarker.color }}
                    />
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                      {activeMarker.categoryName}
                    </span>
                  </div>
                  <h3 className="text-2xl font-serif font-bold text-slate-900 leading-tight">
                    {activeMarker.title}
                  </h3>
                </div>
                <button
                  onClick={() => setActiveId(null)}
                  className="p-3 bg-slate-50 rounded-full text-slate-400 hover:text-slate-600 active:scale-90 transition-all">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <p className="text-slate-600 leading-relaxed font-medium">
                {activeMarker.desc}
              </p>

              {activeMarker.mapUrl && (
                <a
                  href={activeMarker.mapUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-3 w-full py-4 rounded-2xl text-sm font-bold text-white shadow-lg transition-transform active:scale-95 hover:opacity-90"
                  style={{ backgroundColor: activeMarker.color }}>
                  <ExternalLink className="w-4 h-4" /> VIEW ON GOOGLE MAPS
                </a>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
});

export default InteractiveMap;
