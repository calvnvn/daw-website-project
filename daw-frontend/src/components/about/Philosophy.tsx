import { useTranslation } from "react-i18next";
import ScrollReveal from "../ScrollReveal";
import {
  Heart,
  Briefcase,
  Users,
  Zap,
  Lightbulb,
  CheckCircle,
} from "lucide-react";
import { useAbout } from "@/contexts/AboutContext";

export default function Philosophy() {
  const { t } = useTranslation();
  const { aboutData, isLoading } = useAbout();

  // Map Icon
  const getIconForPillar = (id: string) => {
    switch (id.toLowerCase()) {
      case "human":
        return <Heart className="w-6 h-6" />;
      case "ethics":
        return <Briefcase className="w-6 h-6" />;
      case "unity":
        return <Users className="w-6 h-6" />;
      case "speed":
        return <Zap className="w-6 h-6" />;
      case "smart":
        return <Lightbulb className="w-6 h-6" />;
      default:
        return <CheckCircle className="w-6 h-6" />; // Fallback icon jika admin buat id baru
    }
  };

  if (isLoading)
    return <div className="animate-pulse h-64 bg-slate-100 rounded-xl"></div>;

  const pillarsToRender = aboutData?.philosophyPillars?.length
    ? aboutData.philosophyPillars
    : [];

  return (
    <div>
      <ScrollReveal direction="up" delay={0}>
        <h2 className="font-serif text-4xl text-slate-900 mb-10">
          {aboutData?.philosophyTitle || t("about.philosophy.title")}
        </h2>
      </ScrollReveal>

      <ScrollReveal direction="up" delay={50}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
          {pillarsToRender.map((pillar) => (
            <div className="p-8 border border-slate-100 bg-slate-50/50 rounded-2xl hover:shadow-[0_8px_30px_rgba(0,0,0,0.04)] hover:border-daw-green/20 hover:bg-white transition-all duration-500 h-full">
              <div className="w-12 h-12 flex items-center justify-center rounded-full bg-daw-green/10 text-daw-green mb-6">
                {getIconForPillar(pillar.id)}
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
