"use client";

/**
 * components/analytics/TrackPageView.tsx
 *
 * Client component à insérer dans n'importe quelle page server pour pousser
 * un event GTM au mount. Utilisé pour les events "view_*" qui se déclenchent
 * automatiquement quand l'utilisateur arrive sur une page clé du funnel.
 *
 * @example
 * // Dans /abonnements/page.tsx
 * <TrackPageView event="view_pricing" />
 *
 * // Avec params
 * <TrackPageView event="purchase" params={{ value: 65, currency: "EUR", ...}} />
 */

import { useEffect, useRef } from "react";
import { trackEvent, type FunnelEvent, type TrackEventParams } from "@/lib/analytics/track";

interface Props {
  event:   FunnelEvent;
  params?: TrackEventParams;
}

export default function TrackPageView({ event, params }: Props) {
  // Garde anti double-fire (React strict mode déclenche useEffect 2× en dev)
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    trackEvent(event, params);
  }, [event, params]);

  return null;
}
