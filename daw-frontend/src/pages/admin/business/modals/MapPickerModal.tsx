import { useState, useRef, useCallback, useEffect } from "react";
import { X, MousePointerClick, Crosshair } from "lucide-react";
import mapBase from "@/assets/map-indonesia-base.svg";
import { type MapMarker } from "@/contexts/BusinessContext";

// --- CONSTANTS (Centralized for maintainability) ---
const CONFIG = {
  DESKTOP: { zoom: 2.5, radius: 80, offset: 140 }, // offset untuk loupe agar tidak clipping
  MOBILE: { zoom: 2.0, radius: 64 },
};

interface MapPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectLocation: (coords: { x: string; y: string }) => void;
  mapMarkers: MapMarker[];
  categoryMap: Record<string, string>;
  isMobile: boolean;
}

export default function MapPickerModal({
  isOpen,
  onClose,
  onSelectLocation,
  mapMarkers,
  categoryMap,
  isMobile,
}: MapPickerModalProps) {
  const [isHoveringMap, setIsHoveringMap] = useState(false);
  const [isTouching, setIsTouching] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const crosshairRef = useRef<HTMLDivElement>(null);
  const loupeRef = useRef<HTMLDivElement>(null);
  const radarRef = useRef<HTMLDivElement>(null);
  const lastCoords = useRef({ x: "0%", y: "0%" });

  /**
   * Method: updatePointerPos
   * Optimasi: Penanganan rasio aspek dan pencegahan clipping.
   */
  const updatePointerPos = useCallback(
    (clientX: number, clientY: number) => {
      if (!mapContainerRef.current) return;

      const rect = mapContainerRef.current.getBoundingClientRect();
      const xPx = clientX - rect.left;
      const yPx = clientY - rect.top;

      // Hitung persentase murni terhadap container
      const xP = Math.max(0, Math.min(100, (xPx / rect.width) * 100));
      const yP = Math.max(0, Math.min(100, (yPx / rect.height) * 100));

      lastCoords.current = { x: `${xP.toFixed(2)}%`, y: `${yP.toFixed(2)}%` };

      if (!isMobile) {
        if (crosshairRef.current) {
          crosshairRef.current.style.left = `${xP}%`;
          crosshairRef.current.style.top = `${yP}%`;
        }
        if (loupeRef.current) {
          const { zoom, radius, offset } = CONFIG.DESKTOP;

          // Dynamic positioning: jika kursor di atas, pindahkan loupe ke bawah kursor
          const shouldFlip = yPx < offset;
          loupeRef.current.style.transform = `translate(-50%, ${shouldFlip ? "20%" : "-130%"})`;

          loupeRef.current.style.left = `${xP}%`;
          loupeRef.current.style.top = `${yP}%`;
          loupeRef.current.style.backgroundSize = `${rect.width * zoom}px ${rect.height * zoom}px`;
          loupeRef.current.style.backgroundPosition = `${radius - xPx * zoom}px ${radius - yPx * zoom}px`;
        }
      } else if (radarRef.current) {
        const { zoom, radius } = CONFIG.MOBILE;
        radarRef.current.style.backgroundSize = `${rect.width * zoom}px ${rect.height * zoom}px`;
        radarRef.current.style.backgroundPosition = `${radius - xPx * zoom}px ${radius - yPx * zoom}px`;

        const textNode = radarRef.current.querySelector(".radar-coord");
        if (textNode)
          textNode.textContent = `X:${xP.toFixed(0)} Y:${yP.toFixed(0)}`;
      }
    },
    [isMobile],
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] bg-slate-900/95 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl h-full max-h-[85vh] flex flex-col overflow-hidden border border-white/20">
        {/* Header Modals - Lebih Clean */}
        <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-daw-green text-white flex items-center justify-center shadow-lg shadow-daw-green/20">
              <Crosshair className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 leading-tight">
                Geographic Precision Tool
              </h3>
              <p className="text-[10px] text-slate-400 uppercase tracking-[0.2em] font-black">
                Select location coordinate
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-3 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-2xl transition-all active:scale-90">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Workspace */}
        <div className="flex-1 bg-slate-100 flex items-center justify-center p-4 md:p-8 relative overflow-hidden">
          <div
            ref={mapContainerRef}
            className={`relative w-full max-w-4xl aspect-video bg-white shadow-xl rounded-2xl overflow-hidden border-4 border-white transition-all ${
              isMobile ? "touch-none" : "cursor-none"
            }`}
            onClick={() => onSelectLocation(lastCoords.current)}
            onMouseMove={(e) =>
              !isMobile && updatePointerPos(e.clientX, e.clientY)
            }
            onMouseEnter={() => !isMobile && setIsHoveringMap(true)}
            onMouseLeave={() => !isMobile && setIsHoveringMap(false)}
            onTouchStart={(e) => {
              if (isMobile) {
                setIsTouching(true);
                updatePointerPos(e.touches[0].clientX, e.touches[0].clientY);
              }
            }}
            onTouchMove={(e) =>
              isMobile &&
              updatePointerPos(e.touches[0].clientX, e.touches[0].clientY)
            }
            onTouchEnd={() => setIsTouching(false)}>
            {/* Base Map */}
            <img
              src={mapBase}
              className="absolute inset-0 w-full h-full object-fill opacity-80 select-none pointer-events-none"
              alt="map"
            />

            {/* Existing Pins - Dibuat lebih kecil agar tidak menumpuk saat zoom */}
            {mapMarkers.map((m) => (
              <div
                key={m.id}
                className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none z-20"
                style={{ left: m.dotX, top: m.dotY }}>
                <div
                  className="w-2.5 h-2.5 rounded-full border-2 border-white shadow-md"
                  style={{
                    backgroundColor: categoryMap[m.categoryId] || "#94a3b8",
                  }}
                />
              </div>
            ))}

            {/* Desktop Loupe Interface */}
            {!isMobile && isHoveringMap && (
              <>
                <div
                  ref={crosshairRef}
                  className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none z-40 flex items-center justify-center">
                  <div className="absolute w-10 h-[1px] bg-red-600/40" />
                  <div className="absolute h-10 w-[1px] bg-red-600/40" />
                  <div className="w-1.5 h-1.5 bg-red-600 rounded-full ring-4 ring-red-600/20" />
                </div>
                <div
                  ref={loupeRef}
                  className="absolute pointer-events-none z-50 w-40 h-40 rounded-full border-4 border-white shadow-[0_20px_50px_rgba(0,0,0,0.3)] bg-white overflow-hidden transition-transform duration-100 ease-out"
                  style={{
                    backgroundImage: `url(${mapBase})`,
                    backgroundRepeat: "no-repeat",
                  }}>
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 border-2 border-white bg-red-600 rounded-full shadow-lg" />
                </div>
              </>
            )}

            {/* Mobile Radar Interface - Lebih Modern */}
            {isMobile && isTouching && (
              <div
                ref={radarRef}
                className="absolute top-4 right-4 pointer-events-none z-[100] w-32 h-32 rounded-3xl border-4 border-daw-green shadow-2xl bg-white overflow-hidden"
                style={{
                  backgroundImage: `url(${mapBase})`,
                  backgroundRepeat: "no-repeat",
                }}>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 border-2 border-white bg-red-600 rounded-full shadow-lg" />
                <div className="radar-coord absolute bottom-2 left-1/2 -translate-x-1/2 bg-slate-900/90 text-white text-[8px] px-3 py-1 rounded-full font-mono font-bold border border-white/20">
                  X:0 Y:0
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
