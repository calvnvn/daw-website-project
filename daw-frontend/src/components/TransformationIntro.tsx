import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import logoDaw from "@/assets/logo-daw.png";
import ScrollReveal from "./ScrollReveal";
import { useHome } from "@/contexts/HomeContext"; // 👈 IMPORT CONTEXT

export default function TransformationIntro() {
  const { t } = useTranslation();

  // 👈 TARIK DATA DARI PIPELINE
  const { settings } = useHome();

  return (
    <section className="py-24 lg:py-32 bg-white">
      <div className="container mx-auto px-6 max-w-6xl">
        <div className="flex flex-col lg:flex-row gap-12 lg:gap-24 items-center">
          <div className="lg:w-1/3 pt-5 items-center mx-auto">
            <ScrollReveal direction="up" delay={0}>
              <img
                src={logoDaw}
                alt="DAW Group Logo"
                className="h-40 md:h-50 w-auto object-contain mb-2 opacity-90"
              />
            </ScrollReveal>
            <ScrollReveal direction="up" delay={150}>
              <div className="w-50 h-1 bg-daw-green mb-4 rounded-full mx-auto"></div>
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-[0.2em] text-center">
                {t("intro.tagline", "Our Logo")}
              </h3>
            </ScrollReveal>
          </div>

          <div className="lg:w-2/3">
            <ScrollReveal direction="up" delay={100}>
              <h2 className="text-4xl md:text-5xl lg:text-[52px] font-serif text-slate-900 tracking-tight leading-[1.15] mb-8">
                {/* Gunakan data DB, jika kosong pakai bahasa lokalisasi */}
                {settings?.introHeadline || t("intro.headline")}
              </h2>
            </ScrollReveal>
            <ScrollReveal direction="up" delay={250}>
              <p className="text-xl text-slate-500 font-light leading-relaxed mb-12 max-w-3xl whitespace-pre-line">
                {settings?.introBody || t("intro.body")}
              </p>
            </ScrollReveal>
            <ScrollReveal direction="up" delay={400}>
              <Link
                to="/about?tab=history"
                className="group inline-flex items-center gap-3 text-daw-green text-[15px] font-bold uppercase tracking-wide transition-colors hover:text-daw-green-hover"
              >
                <span>{t("intro.cta")}</span>
                <ArrowRight className="w-5 h-5 transform group-hover:translate-x-2 transition-transform duration-300" />
              </Link>
            </ScrollReveal>
          </div>
        </div>
      </div>
    </section>
  );
}
