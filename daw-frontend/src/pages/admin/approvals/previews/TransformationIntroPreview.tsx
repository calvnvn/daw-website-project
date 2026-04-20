import { ArrowRight } from "lucide-react";
import logoDaw from "@/assets/logo-daw.png";

export default function TransformationIntroPreview({ data }: { data: any }) {
  if (!data) return null;

  return (
    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 shadow-inner">
      <div className="mb-6">
        <span className="px-2 py-0.5 rounded bg-daw-green text-white text-[9px] font-black uppercase tracking-widest">
          Homepage Intro Preview
        </span>
      </div>

      <div className="bg-white p-8 md:p-12 rounded-xl border border-slate-100 shadow-sm flex flex-col lg:flex-row gap-10 items-center">
        {/* SISI KIRI: LOGO (STATIC) */}
        <div className="lg:w-1/3 flex flex-col items-center border-b lg:border-b-0 lg:border-r border-slate-100 pb-6 lg:pb-0 lg:pr-10">
          <img
            src={logoDaw}
            alt="DAW Group Logo"
            className="h-24 w-auto object-contain mb-4 opacity-80 grayscale"
          />
          <div className="w-20 h-0.5 bg-daw-green mb-2 rounded-full"></div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Corporate Identity
          </p>
        </div>

        {/* SISI KANAN: CONTENT (DYNAMIC) */}
        <div className="lg:w-2/3 space-y-6 text-center lg:text-left">
          <h2 className="text-2xl md:text-3xl font-serif text-slate-900 leading-tight tracking-tight">
            {data.introHeadline || "Headline Belum Diisi"}
          </h2>

          <p className="text-sm text-slate-500 font-light leading-relaxed whitespace-pre-line line-clamp-6">
            {data.introBody || "Belum ada deskripsi konten perkenalan..."}
          </p>

          <div className="pt-2 flex items-center justify-center lg:justify-start gap-2 text-daw-green text-[12px] font-bold uppercase tracking-wider opacity-70">
            <span>Discover Our Journey</span>
            <ArrowRight className="w-4 h-4" />
          </div>
        </div>
      </div>

      <p className="mt-4 text-[9px] text-slate-400 text-center italic">
        * Pratinjau ini menggunakan layout desktop standar untuk verifikasi
        teks.
      </p>
    </div>
  );
}
