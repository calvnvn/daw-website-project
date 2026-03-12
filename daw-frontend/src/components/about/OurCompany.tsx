import { useTranslation } from "react-i18next";
import ScrollReveal from "../ScrollReveal";
import { useAbout } from "@/contexts/AboutContext";

export default function OurCompany() {
  const { t } = useTranslation();
  const { aboutData, isLoading } = useAbout();

  const renderHighlightedText = (text: string) => {
    if (!text) return null;
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, index) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <span key={index} className="text-daw-green font-bold">
            {part.replace(/\*\*/g, "")}
          </span>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  if (isLoading)
    return <div className="animate-pulse h-64 bg-slate-100 rounded-xl"></div>;

  return (
    <div className="space-y-16">
      <ScrollReveal direction="up" delay={0}>
        <div>
          <h3 className="text-sm font-sans font-bold text-daw-green uppercase tracking-[0.2em] mb-6">
            {t("about.company.spiritTitle")}
          </h3>
          <p className="font-serif italic text-3xl md:text-4xl text-slate-800 leading-[1.4]">
            {aboutData?.spiritText || t("about.company.spiritText")}
          </p>
        </div>
      </ScrollReveal>

      <ScrollReveal direction="up" delay={150}>
        <div className="w-full h-[1px] bg-slate-200"></div>
      </ScrollReveal>

      {/* Vision & Mission */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12 lg:gap-16">
        <ScrollReveal direction="up" delay={200}>
          <div>
            <h3 className="text-sm font-sans font-bold text-slate-400 uppercase tracking-widest mb-4">
              {t("about.company.missionTitle")}
            </h3>
            <p className="font-serif text-2xl text-slate-900 leading-relaxed">
              {/* Jika pakai data DB, kita proses manual. Kalau i18n, panggil biasa. */}
              {aboutData?.missionText
                ? renderHighlightedText(aboutData.missionText)
                : t("about.company.missionText")}
            </p>
          </div>
        </ScrollReveal>

        <ScrollReveal direction="up" delay={300}>
          <div>
            <h3 className="text-sm font-sans font-bold text-slate-400 uppercase tracking-widest mb-4">
              {t("about.company.visionTitle")}
            </h3>
            <p className="font-serif text-2xl text-slate-900 leading-relaxed">
              {aboutData?.visionText
                ? renderHighlightedText(aboutData.visionText)
                : t("about.company.visionText")}
            </p>
          </div>
        </ScrollReveal>
      </div>
    </div>
  );
}
