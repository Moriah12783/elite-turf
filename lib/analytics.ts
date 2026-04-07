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
  // Hero
  heroCtaClick:          (target: string)  => trackEvent("hero_cta_click", { target }),

  // Guide gratuit — aimant anti-rebond
  guideCtaClick:         (source: string)  => trackEvent("guide_cta_click", { source }),
  guideDownload:         ()                => trackEvent("guide_download"),

  // Pronostics
  pronosticsCtaClick:    (type: string)    => trackEvent("pronostics_cta_click", { type }),
  pronosticCardClick:    (id: string)      => trackEvent("pronostic_card_click", { id }),

  // Performances
  performancesCtaClick:  (source: string)  => trackEvent("performances_cta_click", { source }),

  // Pricing / abonnements
  pricingCtaClick:       (plan: string)    => trackEvent("pricing_cta_click", { plan }),

  // Comment ça marche
  howItWorksStepClick:   (step: number)    => trackEvent("how_it_works_step_click", { step }),

  // Navigation
  navGuideClick:         ()                => trackEvent("nav_guide_click"),
  navPronosticsClick:    ()                => trackEvent("nav_pronostics_click"),

  // CTAs mobiles / sticky
  stickyCtaClick:        (target: string)  => trackEvent("sticky_cta_click", { target }),

  // Scroll & sections
  scrollDepth:           (pct: number)     => trackEvent("scroll_depth", { percent: pct }),
  sectionVisible:        (section: string) => trackEvent("section_visible", { section }),

  // Final CTA
  finalCtaClick:         (target: string)  => trackEvent("final_cta_click", { target }),
};
