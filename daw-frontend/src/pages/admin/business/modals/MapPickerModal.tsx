import React, { useState, useRef, useCallback } from "react";
import { X, MousePointerClick } from "lucide-react";
import mapBase from "@/assets/map-indonesia-base.svg";
import { type MapMarker, type MapCategory } from "@/contexts/BusinessContext";

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
  // --- LOCAL INTERACTION STATES ---
  const [isHoveringMap, setIsHoveringMap] = useState(false);
  const [isTouching, setIsTouching] = useState(false);

  // --- DOM REFERENCES (High Performance Tracking) ---
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const crosshairRef = useRef<HTMLDivElement>(null);
  const loupeRef = useRef<HTMLDivElement>(null);
  const radarRef = useRef<HTMLDivElement>(null);
  const lastCoords = useRef({ x: "0%", y: "0%" });

  /**
   * Method: updatePointerPos
   * Menghitung koordinat persentase berdasarkan posisi kursor/sentuhan terhadap boks peta.
   */
  const updatePointerPos = useCallback(
    (clientX: number, clientY: number) => {
      if (!mapContainerRef.current) return;

      const rect = mapContainerRef.current.getBoundingClientRect();
      const xP = Math.max(
        0,
        Math.min(100, ((clientX - rect.left) / rect.width) * 100),
      );
      const yP = Math.max(
        0,
        Math.min(100, ((clientY - rect.top) / rect.height) * 100),
      );

      lastCoords.current = { x: `${xP.toFixed(2)}%`, y: `${yP.toFixed(2)}%` };

      // Injeksi style langsung ke DOM (bypass React render) untuk performa 60fps
      if (!isMobile) {
        if (crosshairRef.current) {
          crosshairRef.current.style.left = `${xP}%`;
          crosshairRef.current.style.top = `${yP}%`;
        }
        if (loupeRef.current) {
          loupeRef.current.style.left = `${xP}%`;
          loupeRef.current.style.top = `${yP}%`;
          loupeRef.current.style.backgroundPosition = `${xP}% ${yP}%`;
        }
      } else if (radarRef.current) {
        radarRef.current.style.backgroundPosition = `${xP}% ${yP}%`;
        const textNode = radarRef.current.querySelector(".radar-coord");
        if (textNode)
          textNode.innerHTML = `X:${xP.toFixed(0)} Y:${yP.toFixed(0)}`;
      }
    },
    [isMobile],
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/90 flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header Modal */}
        <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-3 text-slate-900">
            <div className="w-10 h-10 rounded-full bg-daw-green/10 flex items-center justify-center">
              <MousePointerClick className="w-5 h-5 text-daw-green" />
            </div>
            <div>
              <h3 className="font-bold">Precision Map Picker</h3>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest">
                Click to drop a location pin
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-red-50 hover:text-red-500 rounded-xl transition-all"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Map Interactive Area */}
        <div className="flex-1 bg-slate-200 flex items-center justify-center p-4 relative overflow-hidden">
          <div
            ref={mapContainerRef}
            className={`relative w-full max-w-4xl aspect-video bg-white shadow-2xl rounded-xl overflow-hidden ${
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
            onTouchEnd={() => setIsTouching(false)}
          >
            <img
              src={mapBase}
              className="absolute inset-0 w-full h-full object-contain opacity-70 pointer-events-none"
              alt="map"
            />

            {/* Existing Pins */}
            {mapMarkers.map((m) => (
              <div
                key={m.id}
                className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none z-20"
                style={{ left: m.dotX, top: m.dotY }}
              >
                <div
                  className="w-3 h-3 rounded-full border-2 border-white shadow-lg"
                  style={{
                    backgroundColor: categoryMap[m.categoryId] || "#94a3b8",
                  }}
                />
              </div>
            ))}

            {/* Magnifier / Loupe (Desktop Only) */}
            {!isMobile && isHoveringMap && (
              <>
                <div
                  ref={crosshairRef}
                  className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none z-40 flex items-center justify-center"
                >
                  <div className="absolute w-8 h-[1.5px] bg-slate-900/60" />
                  <div className="absolute h-8 w-[1.5px] bg-slate-900/60" />
                  <div className="w-2 h-2 bg-red-600 rounded-full shadow-lg" />
                </div>
                <div
                  ref={loupeRef}
                  className="absolute pointer-events-none z-50 w-40 h-40 rounded-full border-4 border-white shadow-2xl bg-white overflow-hidden -translate-y-[130%] -translate-x-1/2"
                  style={{
                    backgroundImage: `url(${mapBase})`,
                    backgroundSize: "400%",
                    backgroundRepeat: "no-repeat",
                  }}
                >
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-red-600 rounded-full" />
                </div>
              </>
            )}

            {/* Radar (Mobile Only) */}
            {isMobile && isTouching && (
              <div
                ref={radarRef}
                className="absolute top-4 left-4 pointer-events-none z-[100] w-32 h-32 rounded-2xl border-4 border-daw-green shadow-2xl bg-white overflow-hidden"
                style={{
                  backgroundImage: `url(${mapBase})`,
                  backgroundSize: "600%",
                  backgroundRepeat: "no-repeat",
                }}
              >
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-red-600 rounded-full shadow-[0_0_10px_red]" />
                <div className="radar-coord absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/80 text-white text-[9px] px-2 py-0.5 rounded-full font-mono">
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
