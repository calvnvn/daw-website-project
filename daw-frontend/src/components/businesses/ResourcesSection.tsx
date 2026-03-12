import { useTranslation, Trans } from "react-i18next";
import ScrollReveal from "@/components/ScrollReveal";
import AnimatedNumber from "@/components/AnimatedNumber";
import BusinessGrid from "@/components/BusinessGrid"; // <-- PERUBAHAN: Import komponen ini
import mapBase from "@/assets/map-indonesia-base.svg";

const InteractiveMap = () => {
  // Koordinat sudah ditambahkan % semua dan dikalibrasi ulang
  const markers = [
    {
      id: "jambi1",
      type: "direct",
      dotX: "18%",
      dotY: "49%", // Titik Jambi 1
      boxX: "10%",
      boxY: "78%", // Kotak di kiri bawah
      title: "JAMBI 1\nPalm Oil Mill",
      desc: "45 ton/hour",
    },
    {
      id: "jambi2",
      type: "tudung",
      dotX: "19%",
      dotY: "51%", // Titik Jambi 2 (Tudung)
      boxX: "28%",
      boxY: "88%", // Kotak di tengah bawah
      title: "JAMBI 2\nPalm Oil Mill",
      desc: "45-60 ton/hour",
    },
    {
      id: "lampung",
      type: "tudung",
      dotX: "23%",
      dotY: "59%", // Titik Lampung
      boxX: "48%",
      boxY: "80%", // Kotak agak ke kanan
      title: "LAMPUNG\nPalm Oil Mill",
      desc: "45 ton/hour",
    },
    {
      id: "sangkulirang",
      type: "direct",
      dotX: "48%",
      dotY: "36%", // Titik Kaltim Utara
      boxX: "45%",
      boxY: "15%", // Kotak di atas Kalimantan
      title: "Sangkulirang\nPalm Oil Mill",
      desc: "30 tons/hour",
    },
    {
      id: "plantation",
      type: "direct",
      dotX: "49%",
      dotY: "35%", // Titik Kaltim Tengah
      boxX: "68%",
      boxY: "25%", // Kotak di Kanan Kalimantan
      title: "Palm Oil Plantation",
      desc: "10,000 ha landbank\n5073 ha planted",
    },
  ];

  return (
    <div className="w-full bg-slate-50 rounded-3xl border border-slate-200 shadow-[0_10px_40px_rgba(0,0,0,0.03)] p-4 md:p-8">
      {/* 1. LEGEND (Kanan Atas) */}
      <div className="flex justify-end mb-4">
        <div className="bg-white/90 backdrop-blur-sm p-3 md:p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <span className="w-3.5 h-3.5 rounded-full bg-[#004B23]"></span>
            <span className="text-[10px] md:text-[11px] font-bold text-slate-700 uppercase tracking-widest">
              DAW direct owns
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="w-3.5 h-3.5 rounded-full bg-[#D97706]"></span>
            <span className="text-[10px] md:text-[11px] font-bold text-slate-700 uppercase tracking-widest">
              DAW owns through Tudung Group
            </span>
          </div>
        </div>
      </div>

      {/* 2. WRAPPER PETA & KOORDINAT (KUNCI PERBAIKAN) */}
      {/* Wrapper ini relative, tingginya mengikuti gambar (h-auto), tidak ada object-contain */}
      <div className="relative w-full h-auto flex items-center justify-center">
        {/* Gambar Dasar */}
        <img
          src={mapBase}
          alt="Map of Indonesia"
          className="w-full h-auto opacity-90 drop-shadow-sm pointer-events-none"
        />

        {/* Layer Garis Penghubung */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-10 overflow-visible">
          {markers.map((m) => (
            <line
              key={`line-${m.id}`}
              x1={m.dotX}
              y1={m.dotY}
              x2={m.boxX}
              y2={m.boxY}
              stroke={m.type === "direct" ? "#004B23" : "#D97706"}
              strokeWidth="1.5"
              className="opacity-50"
            />
          ))}
        </svg>

        {/* Layer Titik & Kotak Informasi */}
        {markers.map((m) => (
          <div key={m.id}>
            {/* Titik Lokasi */}
            <div
              className="absolute z-20 -translate-x-1/2 -translate-y-1/2 group"
              style={{ left: m.dotX, top: m.dotY }}
            >
              <span
                className={`animate-ping absolute inline-flex h-4 w-4 md:h-6 md:w-6 rounded-full opacity-40 ${m.type === "direct" ? "bg-[#004B23]" : "bg-[#D97706]"}`}
              ></span>
              <span
                className={`relative inline-flex rounded-full h-2.5 w-2.5 md:h-3.5 md:w-3.5 border-[1.5px] border-white shadow-md ${m.type === "direct" ? "bg-[#004B23]" : "bg-[#D97706]"}`}
              ></span>
            </div>

            {/* Kotak Teks */}
            <div
              className={`absolute z-30 bg-white/95 backdrop-blur-md border shadow-[0_8px_30px_rgba(0,0,0,0.06)] p-3 md:p-4 min-w-[130px] md:min-w-[170px] -translate-x-1/2 -translate-y-1/2 transition-transform hover:scale-105 cursor-default ${
                m.type === "direct"
                  ? "border-[#004B23]/20"
                  : "border-[#D97706]/20"
              }`}
              style={{ left: m.boxX, top: m.boxY }}
            >
              <h4
                className={`font-serif font-bold text-[12px] md:text-[14px] whitespace-pre-line leading-tight mb-1.5 md:mb-2 ${m.type === "direct" ? "text-[#004B23]" : "text-[#D97706]"}`}
              >
                {m.title}
              </h4>
              <p className="font-sans text-[10px] md:text-[11px] font-medium text-slate-600 whitespace-pre-line leading-relaxed">
                {m.desc}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
// --- MAIN RESOURCES SECTION COMPONENT ---
export default function ResourcesSection() {
  const { t, i18n } = useTranslation();

  return (
    <div className="space-y-24">
      {/* 1. Teks Narasi & Peta Interaktif */}
      <div className="flex flex-col space-y-16">
        {/* Atas: Narasi & Angka */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-7 space-y-8">
            <ScrollReveal direction="up" delay={0}>
              <h3 className="text-sm font-sans font-bold text-daw-green uppercase tracking-[0.2em] mb-4">
                {t("businessesPage.resources.title")} Focus
              </h3>
              <p className="font-serif text-3xl lg:text-4xl text-slate-900 leading-snug">
                <Trans
                  i18nKey="businessesPage.resources.intro"
                  components={{
                    1: <span className="text-daw-green font-bold" />,
                  }}
                />
              </p>
            </ScrollReveal>

            <ScrollReveal direction="up" delay={150}>
              <p className="font-sans text-slate-600 text-[16px] leading-relaxed font-light max-w-2xl">
                <Trans
                  i18nKey="businessesPage.resources.downstream"
                  components={{
                    1: <span className="font-semibold text-slate-900" />,
                  }}
                />
              </p>
            </ScrollReveal>
          </div>

          <div className="lg:col-span-5">
            <ScrollReveal direction="left" delay={200}>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 text-center hover:border-daw-green/30 transition-colors duration-300">
                  <p className="font-serif text-4xl lg:text-5xl text-[#004B23] mb-2 tracking-tight">
                    <AnimatedNumber text="10,000+" locale={i18n.language} />
                  </p>
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Hectares Plantation
                  </p>
                </div>
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 text-center hover:border-[#D97706]/30 transition-colors duration-300">
                  <p className="font-serif text-4xl lg:text-5xl text-[#D97706] mb-2 tracking-tight">
                    <AnimatedNumber text="4" locale={i18n.language} />
                  </p>
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Operational CPO Mills
                  </p>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </div>

        {/* Bawah: Peta Infografis Penuh (Full Width) */}
        <ScrollReveal direction="up" delay={300}>
          <InteractiveMap />
        </ScrollReveal>
      </div>

      {/* 2. Resources Projects */}
      <div className="border-t border-slate-100 pt-20">
        <ScrollReveal direction="up" delay={0}>
          <div className="text-center mb-16">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mb-4">
              Portfolio
            </h3>
            <h2 className="text-4xl md:text-5xl font-serif text-slate-900 tracking-tight">
              {t("businessesPage.resources.projectsTitle")}
            </h2>
          </div>
        </ScrollReveal>

        {/* PERUBAHAN: Memanggil BusinessGrid dengan parameter agar berjalan */}
        <ScrollReveal direction="up" delay={200}>
          <BusinessGrid filter="Resources" hideFilters />
        </ScrollReveal>
      </div>
    </div>
  );
}
