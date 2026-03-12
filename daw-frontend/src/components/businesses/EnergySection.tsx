import { useTranslation } from "react-i18next";
import {
  Zap,
  Settings,
  Lightbulb,
  MapPin,
  Factory,
  Droplet,
  FlaskConical,
  Cpu,
} from "lucide-react";
import ScrollReveal from "@/components/ScrollReveal";
import AnimatedNumber from "@/components/AnimatedNumber";
import BusinessGrid from "@/components/BusinessGrid";

export default function EnergySection() {
  const { t, i18n } = useTranslation();

  return (
    <div className="space-y-24">
      {/* 1. HEADER SECTION */}
      <div className="text-center max-w-3xl mx-auto space-y-6">
        <ScrollReveal direction="up" delay={0}>
          <h3 className="text-sm font-sans font-bold text-daw-green uppercase tracking-[0.2em]">
            Renewable & Efficiency
          </h3>
        </ScrollReveal>
        <ScrollReveal direction="up" delay={150}>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-serif text-slate-900 tracking-tight leading-tight">
            Powering the Future <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-daw-green to-emerald-600">
              Sustainably.
            </span>
          </h2>
        </ScrollReveal>
      </div>

      {/* 2. THE BENTO GRID (KUNCI UTAMA) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 auto-rows-[minmax(300px,auto)]">
        {/* BENTO BOX 1: HYDROPOWER (Besar, Dark Mode, Kiri Atas) */}
        <ScrollReveal direction="up" delay={200} className="lg:col-span-2">
          <div className="relative w-full h-full bg-slate-900 rounded-[2rem] p-8 md:p-12 overflow-hidden group border border-slate-800 shadow-2xl flex flex-col justify-between">
            {/* Background Effects */}
            <div className="absolute -top-32 -right-32 w-96 h-96 bg-daw-green/30 rounded-full blur-[100px] group-hover:bg-daw-green/40 transition-colors duration-700"></div>
            <div className="absolute bottom-0 right-0 p-8 opacity-10 transform translate-x-1/4 translate-y-1/4 group-hover:scale-110 transition-transform duration-[2000ms]">
              <Droplet className="w-64 h-64 text-white" strokeWidth={0.5} />
            </div>

            {/* Content */}
            <div className="relative z-10 flex flex-col md:flex-row gap-8 justify-between items-start">
              <div className="max-w-lg space-y-6">
                <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-md border border-white/10">
                  <Zap className="w-7 h-7 text-emerald-400" />
                </div>
                <h3 className="font-serif text-3xl md:text-4xl text-white font-medium">
                  {t("businessesPage.energy.hydropower.title")}
                </h3>
                <p className="font-sans text-slate-400 text-[15px] leading-relaxed">
                  {t("businessesPage.energy.hydropower.desc")}
                </p>
              </div>

              {/* Data Callout */}
              <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 shrink-0 text-center w-full md:w-auto">
                <p className="font-serif text-5xl text-white mb-2">
                  <AnimatedNumber text="15" locale={i18n.language} />
                  <span className="text-2xl text-emerald-500 ml-1">MW</span>
                </p>
                <div className="flex items-center justify-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-widest mt-3">
                  <MapPin className="w-3.5 h-3.5" /> Toba Samosir
                </div>
              </div>
            </div>
          </div>
        </ScrollReveal>

        {/* BENTO BOX 2: O&M SERVICES (Tinggi, DAW Green, Kanan) */}
        <ScrollReveal
          direction="left"
          delay={300}
          className="lg:col-span-1 lg:row-span-2"
        >
          <div className="relative w-full h-full bg-[#004B23] rounded-[2rem] p-8 md:p-10 overflow-hidden group shadow-xl flex flex-col">
            {/* Background Pattern */}
            <div className="absolute inset-0 bg-[radial-gradient(#ffffff20_1px,transparent_1px)] [background-size:16px_16px] opacity-20"></div>

            <div className="relative z-10 space-y-8 flex-1 flex flex-col">
              <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center backdrop-blur-sm border border-white/20">
                <Settings className="w-6 h-6 text-white" />
              </div>

              <div>
                <h3 className="font-serif text-2xl md:text-3xl text-white font-medium mb-4">
                  {t("businessesPage.energy.omServices.title")}
                </h3>
                <p className="font-sans text-white/80 text-[14px] leading-relaxed">
                  {t("businessesPage.energy.omServices.desc")}
                </p>
              </div>

              {/* Timeline/Locations UI */}
              <div className="mt-auto pt-8">
                <div className="flex items-end gap-4 mb-6">
                  <p className="font-serif text-6xl text-white leading-none">
                    <AnimatedNumber text="5" locale={i18n.language} />
                  </p>
                  <p className="text-white/70 text-xs font-bold uppercase tracking-widest pb-1">
                    Power Plants
                    <br />
                    Currently Served
                  </p>
                </div>

                <div className="space-y-4 border-l-2 border-white/20 pl-4 ml-2">
                  {["Sumatera", "Kalimantan", "Sulawesi"].map((island) => (
                    <div key={island} className="relative flex items-center">
                      {/* Timeline Dot */}
                      <div className="absolute -left-[21px] w-2.5 h-2.5 bg-white rounded-full shadow-[0_0_10px_rgba(255,255,255,0.8)]"></div>
                      <p className="font-sans text-white font-medium tracking-wide">
                        {island}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </ScrollReveal>

        {/* BENTO BOX 3: ESCO (Lebar, Putih Bersih, Kiri Bawah) */}
        <ScrollReveal direction="up" delay={400} className="lg:col-span-2">
          <div className="relative w-full h-full bg-white rounded-[2rem] p-8 md:p-10 overflow-hidden border border-slate-200 shadow-sm group hover:shadow-lg transition-all duration-500 flex flex-col justify-between">
            <div className="flex flex-col md:flex-row gap-8 items-start mb-8">
              <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center border border-emerald-100 shrink-0">
                <Lightbulb className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <h3 className="font-serif text-2xl md:text-3xl text-slate-900 font-medium mb-4">
                  {t("businessesPage.energy.esco.title")}
                </h3>
                <p className="font-sans text-slate-600 text-[15px] leading-relaxed max-w-2xl">
                  {t("businessesPage.energy.esco.desc")}
                </p>
              </div>
            </div>

            {/* Industry Pills */}
            <div className="pt-6 border-t border-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">
                Industries We Optimize
              </p>
              <div className="flex flex-wrap gap-3">
                <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-200 rounded-full text-[13px] font-semibold text-slate-700">
                  <Factory className="w-4 h-4 text-daw-green" /> Food & Beverage
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-200 rounded-full text-[13px] font-semibold text-slate-700">
                  <Droplet className="w-4 h-4 text-daw-green" /> Textile
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-200 rounded-full text-[13px] font-semibold text-slate-700">
                  <FlaskConical className="w-4 h-4 text-daw-green" /> Chemical
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-200 rounded-full text-[13px] font-semibold text-slate-700">
                  <Cpu className="w-4 h-4 text-daw-green" /> Steel
                </div>
              </div>
            </div>
          </div>
        </ScrollReveal>
      </div>

      {/* 3. PROJECT GRID PORTFOLIO */}
      <div className="pt-20">
        <ScrollReveal direction="up" delay={0}>
          <div className="text-center mb-16">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mb-4">
              Portfolio
            </h3>
            <h2 className="text-4xl md:text-5xl font-serif text-slate-900 tracking-tight">
              {t("businessesPage.energy.projectsTitle")}
            </h2>
          </div>
        </ScrollReveal>

        <ScrollReveal direction="up" delay={200}>
          {/* Reuse BusinessGrid tapi khusus kategori Energy */}
          <BusinessGrid filter="Energy" hideFilters />
        </ScrollReveal>
      </div>
    </div>
  );
}
