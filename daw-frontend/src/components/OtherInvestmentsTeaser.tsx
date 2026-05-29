import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useInvestments } from "@/contexts/InvestmentContext";
import ScrollReveal from "./ScrollReveal";
import { getCleanImageUrl } from "@/lib/utils";

export default function OtherInvestmentsTeaser() {
  const { t } = useTranslation();

  const { publicSettings: settings, publicCompanies: companies } = useInvestments();
  const displayCompanies = (companies || []).slice(0, 6);

  return (
    <section className="py-24 lg:py-32 bg-[#081C15] relative overflow-hidden rounded-t-[50px] lg:rounded-t-[100px] shadow-[inset_0_25px_80px_rgba(0,0,0,0.4)]">
      {/* Background Elements */}
      <div className="absolute inset-0 bg-[radial-gradient(#ffffff15_1px,transparent_1px)] [background-size:24px_24px] opacity-30"></div>
      <div className="absolute -bottom-1/2 -right-1/4 w-[800px] h-[800px] bg-daw-green/20 rounded-full blur-[150px] pointer-events-none"></div>

      <div className="container mx-auto px-6 max-w-6xl relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 lg:gap-24 items-center">
          {/* KOLOM KIRI: Teks Dinamis */}
          <div className="lg:col-span-5 flex flex-col items-start pr-0 lg:pr-8">
            <ScrollReveal direction="up" delay={150}>
              <h2 className="text-4xl md:text-5xl font-serif text-white tracking-tight leading-[1.15] mb-8">
                {/* 3. Gunakan Teks dari DB, jika kosong pakai fallback i18n */}
                {settings?.teaserHeadline ||
                  t("business.investmentsTeaser.headline", "Other Investments.")}
              </h2>
            </ScrollReveal>

            <ScrollReveal direction="up" delay={300}>
              <p className="text-lg text-slate-400 font-light leading-relaxed mb-10 whitespace-pre-line">
                {settings?.teaserBody || t("business.investmentsTeaser.body")}
              </p>
            </ScrollReveal>

            <ScrollReveal direction="up" delay={450}>
              <Link
                to="/businesses#investments"
                aria-label={t(
                  "business.investmentsTeaser.ctaAria",
                  "View details about our other investments and partnerships",
                )}
                className="group inline-flex items-center gap-4 bg-white/5 hover:bg-daw-green border border-white/10 hover:border-daw-green text-white px-7 py-3.5 rounded-full text-[14px] font-bold tracking-widest uppercase transition-all duration-300 backdrop-blur-sm"
              >
                <span>{t("business.investmentsTeaser.cta", "Explore All Investments")}</span>
                <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform duration-300" />
              </Link>
            </ScrollReveal>
          </div>

          {/* KOLOM KANAN: Grid Logo Perusahaan Dinamis */}
          <div className="lg:col-span-7">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
              {displayCompanies.map((company, index) => {
                // 🔥 THE FIX: Tentukan tag (a atau div) dan propertinya secara dinamis
                const Wrapper = company.websiteUrl ? "a" : "div";
                const wrapperProps = company.websiteUrl
                  ? {
                      href: company.websiteUrl,
                      target: "_blank",
                      rel: "noopener noreferrer",
                    }
                  : {};

                return (
                  <ScrollReveal
                    key={company.id}
                    direction="up"
                    delay={index * 100}
                  >
                    {/* 🔥 THE FIX: Gunakan <Wrapper> menggantikan <div> */}
                    <Wrapper
                      {...wrapperProps}
                      className={`group aspect-[4/3] bg-white rounded-2xl flex items-center justify-center p-6 sm:p-8 border border-transparent hover:border-daw-yellow transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_15px_35px_rgba(0,0,0,0.3)] h-full ${
                        company.websiteUrl ? "cursor-pointer block" : ""
                      }`}
                    >
                      <img
                        src={getCleanImageUrl(company.logoUrl)}
                        alt={company.name}
                        width="200"
                        height="200"
                        className="max-h-full max-w-full object-contain opacity-90 group-hover:opacity-100 transition-all duration-500 transform group-hover:scale-110"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                          e.currentTarget.parentElement!.innerHTML = `<span class="text-xs font-bold text-slate-800 text-center tracking-widest uppercase opacity-70">${company.name}</span>`;
                        }}
                      />
                    </Wrapper>
                  </ScrollReveal>
                );
              })}

              {displayCompanies.length === 0 && (
                <div className="col-span-full text-center text-slate-400 italic">
                  {t("business.investmentsTeaser.noInvestments")}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
