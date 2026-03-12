// src/components/AnimatedNumber.tsx
import { useEffect, useState, useRef } from "react";

interface AnimatedNumberProps {
  text: string;
  locale: string;
}

export default function AnimatedNumber({ text, locale }: AnimatedNumberProps) {
  const [count, setCount] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  // Pisahkan Prefix (Simbol/Teks Awal), Angka, dan Suffix (Simbol/Teks Akhir)
  const match = text.match(/^(\D*)(\d+(?:[.,]\d+)*)(\D*)$/);

  // Hapus titik DAN koma agar parseFloat bisa membaca format ID maupun EN dengan benar
  const target = match ? parseFloat(match[2].replace(/[,.]/g, "")) : 0;

  // Observer Scroll (Memicu animasi hanya saat elemen masuk ke layar)
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

  // Logika Animasi Angka (Berjalan lancar pada 60fps)
  useEffect(() => {
    if (!isVisible || target === 0) return;

    let startTimestamp: number | null = null;
    let animationFrameId: number;
    const duration = 2500; // Durasi animasi 2.5 detik

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);

      // Kurva Easing (Mulai cepat, melambat di akhir secara elegan)
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

  // Jika teks tidak mengandung angka (contoh: teks biasa), render normal saja
  if (!match) {
    return <span ref={ref}>{text}</span>;
  }

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
