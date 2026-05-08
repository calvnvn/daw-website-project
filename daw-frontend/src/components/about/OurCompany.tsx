import { useTranslation } from "react-i18next";
import ScrollReveal from "../ScrollReveal";
import { useAbout } from "@/contexts/AboutContext";

/** * COMPONENT: OurCompany | Orchestrates the display of corporate identity, vision, and mission through localized content and dynamic highlighting.
 */
export default function OurCompany() {
  // INITIALIZATION
  // Initialize localization hooks and consume about data context
  const { t } = useTranslation();
  const { aboutData, isLoading } = useAbout();

  // UTILITY
  // Parse and normalize markdown-style bold text into stylized span elements
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

  // RENDER LOGIC
  // Enforce skeleton state during asynchronous data resolution
  if (isLoading)
    return <div className="animate-pulse h-64 bg-slate-100 rounded-xl"></div>;

  // EXECUTION
  // Execute structured layout rendering for corporate spirit, vision, and mission segments
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
