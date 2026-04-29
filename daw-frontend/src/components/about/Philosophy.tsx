import { useTranslation } from "react-i18next";
import ScrollReveal from "../ScrollReveal";
import {
  Heart,
  Briefcase,
  Zap,
  Lightbulb,
  CheckCircle,
  Globe, // Tambahan ikon dari admin
  Shield, // Tambahan ikon dari admin
  Star, // Tambahan ikon dari admin
  Leaf, // Tambahan ikon dari admin
} from "lucide-react";
import { useAbout } from "@/contexts/AboutContext";

export default function Philosophy() {
  const { t } = useTranslation();

  // 🚀 REFACTOR: Ambil dari State Terpisah (Blueprint 3.1 & Phase 3)
  const { philosophyData, philosophyPillars, isLoading } = useAbout();

  // 🚀 REFACTOR: Mapping Icon sekarang berdasarkan iconId, BUKAN id
  const getIconForPillar = (iconId: string) => {
    if (!iconId) return <CheckCircle className="w-6 h-6" />;

    switch (iconId.toLowerCase()) {
      case "human":
        return <Heart className="w-6 h-6" />;
      case "ethics":
        return <Briefcase className="w-6 h-6" />;
      case "unity":
        return <Globe className="w-6 h-6" />; // Di admin kita pakai Globe, sesuaikan agar konsisten
      case "speed":
        return <Zap className="w-6 h-6" />;
      case "smart":
        return <Lightbulb className="w-6 h-6" />;
      case "shield":
        return <Shield className="w-6 h-6" />;
      case "star":
        return <Star className="w-6 h-6" />;
      case "leaf":
        return <Leaf className="w-6 h-6" />;
      default:
        return <CheckCircle className="w-6 h-6" />; // Fallback icon jika admin buat iconId baru yang blm kedaftar
    }
  };

  if (isLoading)
    return <div className="animate-pulse h-64 bg-slate-100 rounded-xl"></div>;

  // 🚀 REFACTOR: Gunakan state Collection baru
  const pillarsToRender = philosophyPillars?.length ? philosophyPillars : [];

  return (
    <div>
      <ScrollReveal direction="up" delay={0}>
        <h2 className="font-serif text-4xl text-slate-900 mb-10">
          {/* 🚀 REFACTOR: Gunakan data singleton baru */}
          {philosophyData?.philosophyTitle || t("about.philosophy.title")}
        </h2>
      </ScrollReveal>

      <ScrollReveal direction="up" delay={50}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
          {pillarsToRender.map((pillar) => (
            <div
              key={pillar.id}
              className="p-8 border border-slate-100 bg-slate-50/50 rounded-2xl hover:shadow-[0_8px_30px_rgba(0,0,0,0.04)] hover:border-daw-green/20 hover:bg-white transition-all duration-500 h-full flex flex-col">
              <div className="w-12 h-12 flex items-center justify-center rounded-full bg-daw-green/10 text-daw-green mb-6 shrink-0">
                {/* 🚀 REFACTOR: Kirim iconId ke function renderer */}
                {getIconForPillar(pillar.iconId)}
              </div>
              <h3 className="font-serif text-xl font-bold text-slate-900 mb-4">
                {pillar.title}
              </h3>
              <ul className="space-y-3 mt-auto">
                {pillar.text.split("\n").map((point: string, idx: number) => {
                  if (point.trim() === "") return null;

                  return (
                    <li key={idx} className="flex items-start gap-3 group">
                      {/* Custom Bullet Point */}
                      <span className="mt-2 w-1.5 h-1.5 rounded-full bg-daw-green/40 group-hover:bg-daw-green shrink-0 transition-colors"></span>
                      <span className="font-sans text-slate-600 leading-relaxed text-[14px]">
                        {point.trim()}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          {pillarsToRender.length === 0 && (
            <div className="col-span-full text-center py-10 text-slate-500">
              No philosophy pillars defined yet.
            </div>
          )}
        </div>
      </ScrollReveal>
    </div>
  );
}
