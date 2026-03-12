import { useEffect, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import * as Icons from "lucide-react"; // 👈 IMPORT SEMUA ICON
import ScrollReveal from "./ScrollReveal";
import { useHome } from "@/contexts/HomeContext"; // 👈 IMPORT CONTEXT

// --- CountUp Animation Function ---
function AnimatedNumber({ text, locale }: { text: string; locale: string }) {
  const [count, setCount] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  const match = text.match(/^(\D*)(\d+(?:[.,]\d+)*)(\D*)$/);
  const target = match ? parseFloat(match[2].replace(/[,.]/g, "")) : 0;

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 },
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible || target === 0) return;
    let startTimestamp: number | null = null;
    let animationFrameId: number;
    const duration = 2500;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const easeProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setCount(easeProgress * target);

      if (progress < 1) {
        animationFrameId = window.requestAnimationFrame(step);
      } else {
        setCount(target);
      }
    };
    animationFrameId = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(animationFrameId);
  }, [isVisible, target]);

  if (!match) return <span ref={ref}>{text}</span>;

  const prefix = match[1];
  const suffix = match[3];
  const formatLocale = locale.startsWith("id") ? "id-ID" : "en-US";
  const displayNum = Math.floor(count).toLocaleString(formatLocale);

  return (
    <span ref={ref}>
      {prefix}
      {displayNum}
      {suffix}
    </span>
  );
}

export default function ImpactStatistics() {
  const { i18n } = useTranslation();

  // 👈 TARIK DATA DARI PIPELINE
  const { stats } = useHome();

  // Jika admin belum mengisi data sama sekali, sembunyikan section ini agar tidak kosong melompong
  if (!stats || stats.length === 0) return null;

  return (
    <section className="pb-12 lg:pb-32 bg-white border-b border-slate-100">
      <div className="container mx-auto px-6 max-w-7xl">
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-y-12 gap-x-6 lg:gap-y-0 lg:gap-x-0 lg:divide-x divide-slate-200">
          {stats.map((stat, index) => {
            // 👇 SULAP DARI STRING DATABASE KE KOMPONEN ICON LUCIDE
            const Icon = (Icons as any)[stat.icon] || Icons.HelpCircle;

            return (
              <ScrollReveal
                key={stat.id}
                direction="up"
                delay={index * 150}
                className={`group flex flex-col items-center text-center px-2 lg:px-8 xl:px-12 ${
                  index !== 0 ? "lg:pt-0" : ""
                }`}
              >
                {/* Icon Hover Effect */}
                <Icon className="w-10 h-10 text-daw-green mb-6 stroke-[1.5px] opacity-80 transition-all duration-300 group-hover:-translate-y-1 group-hover:opacity-100 group-hover:drop-shadow-md" />

                <h3 className="text-3xl lg:text-4xl font-serif text-slate-900 mb-4 tracking-tight">
                  <AnimatedNumber text={stat.value} locale={i18n.language} />
                </h3>

                <p className="text-[13px] font-bold text-slate-800 uppercase tracking-wide mb-3">
                  {stat.label}
                </p>

                <p className="text-[14px] text-slate-500 font-light leading-relaxed max-w-[250px]">
                  {stat.desc}
                </p>
              </ScrollReveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
