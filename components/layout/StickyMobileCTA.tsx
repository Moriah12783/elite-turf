"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Analytics } from "@/lib/analytics";

export default function StickyMobileCTA() {
  const [visible, setVisible] = useState(false);
  const finalCtaRef = useRef<Element | null>(null);

  useEffect(() => {
    // Apparaît après 1 scroll-height
    const onScroll = () => setVisible(window.scrollY > window.innerHeight * 0.8);
    window.addEventListener("scroll", onScroll, { passive: true });

    // Disparaît quand le final CTA est visible
    const finalCta = document.getElementById("final-cta");
    if (finalCta) {
      finalCtaRef.current = finalCta;
      const obs = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) setVisible(false); },
        { threshold: 0.3 },
      );
      obs.observe(finalCta);
      return () => {
        obs.disconnect();
        window.removeEventListener("scroll", onScroll);
      };
    }
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="bg-bg-primary/95 backdrop-blur-md border-t border-gold-primary/30 px-4 py-3 flex gap-3 shadow-2xl">
        <Link
          href="/pronostics"
          onClick={() => Analytics.stickyCtaClick()}
          className="flex-1 text-center py-3 bg-gold-primary hover:bg-gold-dark text-bg-primary font-bold text-sm rounded-xl transition-all shadow-gold"
        >
          🏆 Voir les pronostics du jour
        </Link>
        <Link
          href="/abonnements"
          className="flex-shrink-0 py-3 px-4 border border-border hover:border-gold-primary/40 text-text-secondary font-semibold text-sm rounded-xl transition-all"
        >
          S'abonner
        </Link>
      </div>
    </div>
  );
}
