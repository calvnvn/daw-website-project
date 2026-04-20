import { getCleanImageUrl } from "@/lib/utils";
import { ArrowRight } from "lucide-react";

export default function HeroPreview({ data }: { data: any }) {
  if (!data) return null;

  // Mendukung data tunggal (Edit 1 slide) atau data bulk (List slides)
  const slide = data.id ? data : data.slides ? data.slides[0] : data;

  const imgUrl = slide.imageUrl ? getCleanImageUrl(slide.imageUrl) : null;

  return (
    <div className="relative w-full aspect-video rounded-2xl overflow-hidden border border-slate-200 shadow-xl bg-slate-900 group">
      {/* 📸 LAYER 1: BACKGROUND IMAGE */}
      <div className="absolute inset-0 w-full h-full">
        {imgUrl ? (
          <img
            src={imgUrl}
            alt="Hero Preview"
            className="w-full h-full object-cover object-center scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-slate-800 text-slate-500 text-xs italic">
            Tanpa Gambar Latar
          </div>
        )}
      </div>

      {/* 🎭 LAYER 2: BRAND OVERLAYS (Sesuai Frontend Asli) */}
      {/* Multiply Green Overlay */}
      <div className="absolute inset-0 bg-[#004B23]/25 mix-blend-multiply" />
      {/* Bottom Dark Gradient */}
      <div className="absolute bottom-0 left-0 right-0 h-2/3 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
      {/* Top Header Shade */}
      <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-black/50 to-transparent" />

      {/* 📝 LAYER 3: CONTENT SIMULATION */}
      <div className="absolute inset-0 flex flex-col justify-center px-8 md:px-12">
        <div className="max-w-xl space-y-4">
          {/* Badge Preview */}
          <div className="inline-flex items-center px-2 py-0.5 rounded bg-daw-green text-white text-[8px] font-black uppercase tracking-widest mb-2 shadow-lg">
            Slide Preview
          </div>

          {/* Title */}
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-serif font-bold text-white leading-tight drop-shadow-lg">
            {slide.title || "Judul Belum Diisi"}
          </h1>

          {/* Subtitle */}
          <p className="text-xs md:text-sm text-slate-200 font-light max-w-md line-clamp-2 drop-shadow-md">
            {slide.subtitle || "Sub-judul belum diisi..."}
          </p>

          {/* Button Simulation */}
          <div className="pt-4 flex gap-3">
            <div className="px-5 py-2 bg-daw-green text-white rounded-full text-[10px] font-bold flex items-center gap-2 shadow-lg border border-daw-green/20">
              CTA Primary <ArrowRight className="w-3 h-3" />
            </div>
            <div className="px-5 py-2 bg-white/10 backdrop-blur-md text-white rounded-full text-[10px] font-bold border border-white/20">
              CTA Secondary
            </div>
          </div>
        </div>
      </div>

      {/* 🧭 LAYER 4: INDICATOR SIMULATION */}
      <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-1.5">
        <div className="w-8 h-1 rounded-full bg-daw-green"></div>
        <div className="w-2 h-1 rounded-full bg-white/30"></div>
        <div className="w-2 h-1 rounded-full bg-white/30"></div>
      </div>

      {/* Watermark Label */}
      <div className="absolute top-4 right-4 text-[9px] text-white/40 font-mono tracking-tighter uppercase pointer-events-none">
        Cinematic_Simulator_v1.0
      </div>
    </div>
  );
}
