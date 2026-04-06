/**
 * Wrapper type-safe pour le tracking comportemental.
 * Utilise Vercel Analytics (window.va) — remplaçable par Plausible/PostHog.
 */
export function trackEvent(
  name: string,
  props?: Record<string, string | number>,
) {
  if (typeof window === "undefined") return;
  try {
    // Vercel Analytics custom events
    if ((window as any).va) {
      (window as any).va("event", { name, ...props });
    }
    // Debug en dev
    if (process.env.NODE_ENV === "development") {
      console.log("[analytics]", name, props);
    }
  } catch {
    // silently ignore
  }
}

// ── Events nommés ──────────────────────────────────────────────────────────

export const Analytics = {
  heroCtaClick:        (target: string) => trackEvent("hero_cta_click", { target }),
  pronosticsCtaClick:  (type: string)   => trackEvent("pronostics_cta_click", { type }),
  pricingCtaClick:     (plan: string)   => trackEvent("pricing_cta_click", { plan }),
  stickyCtaClick:      ()               => trackEvent("sticky_cta_click"),
  scrollDepth:         (pct: number)    => trackEvent("scroll_depth", { percent: pct }),
  sectionVisible:      (section: string) => trackEvent("section_visible", { section }),
};
