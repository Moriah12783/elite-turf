"use client";

import { useEffect } from "react";
import { Analytics } from "@/lib/analytics";

const SCROLL_CHECKPOINTS = [25, 50, 75, 100];
const SECTIONS_TO_OBSERVE = ["pronostics", "pricing", "testimonials", "faq", "final-cta"];

export default function ScrollDepthTracker() {
  useEffect(() => {
    const fired = new Set<number>();

    // ── Scroll depth ──
    const onScroll = () => {
      const scrolled = window.scrollY + window.innerHeight;
      const total = document.documentElement.scrollHeight;
      const pct = Math.round((scrolled / total) * 100);
      for (const checkpoint of SCROLL_CHECKPOINTS) {
        if (pct >= checkpoint && !fired.has(checkpoint)) {
          fired.add(checkpoint);
          Analytics.scrollDepth(checkpoint);
        }
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    // ── Section visibility ──
    const observers: IntersectionObserver[] = [];
    for (const id of SECTIONS_TO_OBSERVE) {
      const el = document.getElementById(id);
      if (!el) continue;
      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            Analytics.sectionVisible(id);
            obs.disconnect();
          }
        },
        { threshold: 0.3 },
      );
      obs.observe(el);
      observers.push(obs);
    }

    return () => {
      window.removeEventListener("scroll", onScroll);
      observers.forEach((o) => o.disconnect());
    };
  }, []);

  return null;
}
