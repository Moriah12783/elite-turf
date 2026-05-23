"use client";

/**
 * components/analytics/TrackPurchase.tsx
 *
 * Client component spécialisé pour tracker l'event GA4 `purchase` sur la page
 * `/paiement/succes`. Variante de TrackPageView avec les champs ecommerce
 * standards (transaction_id, value, currency, items).
 *
 * 🔒 Anti-double-fire : utilise sessionStorage avec le transaction_id comme
 *    clé pour éviter de re-tracker si le user rafraîchit la page de succès.
 *    Critique pour ne pas gonfler artificiellement les revenus en GA4.
 */

import { useEffect, useRef } from "react";
import { trackPurchase } from "@/lib/analytics/track";

interface Props {
  transactionId:  string;
  planId:         string;
  planName:       string;
  amountEur?:     number;
  amountFcfa?:    number;
  paymentMethod:  "paystack" | "stripe" | "sandbox";
  userId?:        string;
}

export default function TrackPurchase(props: Props) {
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;

    // Garde sessionStorage : si on a déjà tracké cette transaction, skip
    const key = `purchase_tracked_${props.transactionId}`;
    if (typeof window !== "undefined" && sessionStorage.getItem(key)) return;

    trackPurchase(props);

    if (typeof window !== "undefined") {
      sessionStorage.setItem(key, String(Date.now()));
    }
  }, [props]);

  return null;
}
