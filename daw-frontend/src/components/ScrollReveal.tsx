import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

interface ScrollRevealProps {
  children: ReactNode;
  // Arah datangnya elemen saat muncul
  direction?: "up" | "down" | "left" | "right" | "none";
  // Jeda waktu sebelum animasi dimulai (dalam milidetik)
  delay?: number;
  className?: string;
}

export default function ScrollReveal({
  children,
  direction = "up",
  delay = 0,
  className = "",
}: ScrollRevealProps) {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        // Jika elemen masuk ke dalam layar pengguna
        if (entry.isIntersecting) {
          setIsVisible(true);
          // Hentikan pantauan setelah muncul sekali agar tidak berkedip saat di-scroll naik turun
          observer.disconnect();
        }
      },
      {
        threshold: 0.1, // Animasi terpicu saat 10% bagian elemen sudah terlihat
        rootMargin: "0px 0px -50px 0px", // Memberikan sedikit ruang bernapas sebelum muncul
      },
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, []);

  // Durasi 800ms dengan kurva pergerakan (easing) yang sangat natural dan elegan
  const baseClass =
    "transition-all duration-[800ms] ease-[cubic-bezier(0.25,0.1,0.25,1)]";

  // Posisi awal sebelum elemen terlihat
  const hiddenClasses = {
    up: "opacity-0 translate-y-12",
    down: "opacity-0 -translate-y-12",
    left: "opacity-0 -translate-x-12",
    right: "opacity-0 translate-x-12",
    none: "opacity-0",
  };

  // Posisi akhir saat elemen terlihat (Kembali ke titik normal)
  const visibleClasses = "opacity-100 translate-y-0 translate-x-0";

  return (
    <div
      ref={ref}
      className={`${baseClass} ${
        isVisible ? visibleClasses : hiddenClasses[direction]
      } ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}
