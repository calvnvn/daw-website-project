import { getCleanImageUrl } from "@/lib/utils";
import { ArrowRight, ImageOff, Layers } from "lucide-react";

export default function HeroPreview({ data }: { data: any }) {
  if (!data) return null;

  // Mendukung data tunggal (Edit 1 slide) atau data bulk (List slides)
  const slide = data.id ? data : data.slides ? data.slides[0] : data;
  const imgUrl = slide.imageUrl ? getCleanImageUrl(slide.imageUrl) : null;

  // Parse order untuk Dynamic Indicator
  const orderNum = Number(slide.order) || 0;

  return (
    <div className="relative w-full aspect-video rounded-2xl overflow-hidden border border-slate-200 shadow-[0_8px_30px_rgb(0,0,0,0.12)] bg-slate-900 group">
      {/* 📸 LAYER 1: BACKGROUND IMAGE WITH SMOOTH KEN-BURNS EFFECT */}
      <div className="absolute inset-0 w-full h-full overflow-hidden">
        {imgUrl ? (
          <img
            src={imgUrl}
            alt="Hero Preview"
            className="w-full h-full object-cover object-center scale-105 group-hover:scale-100 transition-transform duration-1000 ease-out"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900 text-slate-500">
            <ImageOff className="w-8 h-8 mb-2 opacity-50" />
            <span className="text-[10px] uppercase tracking-widest font-bold opacity-50">
              Tanpa Gambar Latar
            </span>
          </div>
        )}
      </div>

      {/* 🎭 LAYER 2: CINEMATIC GRADIENTS & BRAND OVERLAYS */}
      <div className="absolute inset-0 bg-[#004B23]/30 mix-blend-multiply pointer-events-none" />
      <div className="absolute bottom-0 left-0 right-0 h-3/4 bg-gradient-to-t from-black/95 via-black/40 to-transparent pointer-events-none" />
      <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-black/60 to-transparent pointer-events-none" />

      {/* 🛡️ LAYER 3: BUREAUCRATIC MIRROR (BADGES) */}
      <div className="absolute top-4 left-4 right-4 flex justify-between items-start z-20">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/10 backdrop-blur-md border border-white/20 text-white text-[9px] font-bold uppercase tracking-widest shadow-lg">
          <Layers className="w-3 h-3 text-daw-green" />
          Preview Layar
        </div>

        {/* POSITIONAL BADGE: Sangat krusial untuk mendeteksi Drag & Drop */}
        <div className="inline-flex flex-col items-end">
          <div className="px-3 py-1 rounded-md bg-amber-500/90 backdrop-blur-sm border border-amber-400/50 text-white text-[10px] font-black uppercase tracking-widest shadow-lg">
            Posisi Slide: {orderNum + 1}
          </div>
        </div>
      </div>

      {/* 📝 LAYER 4: CONTENT SIMULATION */}
      <div className="absolute inset-0 flex flex-col justify-center px-8 md:px-12 z-10 mt-4">
        <div className="max-w-xl space-y-4">
          {/* Title */}
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-serif font-bold text-white leading-tight drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)]">
            {slide.title || (
              <span className="italic text-white/50 font-sans text-xl">
                Judul belum diisi...
              </span>
            )}
          </h1>

          {/* Subtitle */}
          <p className="text-xs md:text-sm text-slate-200 font-light max-w-md line-clamp-2 drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)] leading-relaxed">
            {slide.subtitle || (
              <span className="italic text-white/40">
                Sub-judul belum diisi...
              </span>
            )}
          </p>

          {/* Button Simulation */}
          <div className="pt-4 flex gap-3">
            <div className="px-6 py-2.5 bg-daw-green text-white rounded-full text-[10px] font-bold flex items-center gap-2 shadow-lg shadow-daw-green/20 border border-daw-green/50 transition-all hover:bg-[#003b1c]">
              CTA Primary <ArrowRight className="w-3 h-3" />
            </div>
            <div className="px-6 py-2.5 bg-white/10 backdrop-blur-md text-white rounded-full text-[10px] font-bold border border-white/20 hover:bg-white/20 transition-all">
              CTA Secondary
            </div>
          </div>
        </div>
      </div>

      {/* 🧭 LAYER 5: DYNAMIC INDICATOR SIMULATION */}
      {/* Menggunakan array 5 elemen untuk mensimulasikan posisi slide secara visual */}
      <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-2 z-20">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className={`h-1.5 rounded-full transition-all duration-500 shadow-sm ${
              i === orderNum
                ? "w-8 bg-daw-green border border-daw-green/50"
                : "w-2 bg-white/40 border border-white/20"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
