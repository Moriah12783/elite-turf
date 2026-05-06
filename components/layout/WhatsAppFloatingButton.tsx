"use client";

/**
 * WhatsApp Floating Button — sticky bouton mobile pour contacter le support.
 *
 * En CI/SN/Maroc, WhatsApp est le canal de support attendu (vs email en France).
 * Ce bouton flottant en bas-droite augmente les conversations support et
 * l'engagement. Click trackée via GTM dataLayer (event: whatsapp_click).
 *
 * Désactivé sur les pages avec déjà un sticky CTA (paywall, panier, etc.).
 */

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { MessageCircle } from "lucide-react";

const WHATSAPP_NUMBER = (process.env.NEXT_PUBLIC_WHATSAPP || "+33644686720").replace(/\s/g, "");
const DEFAULT_MESSAGE = "Bonjour Elite Turf, je souhaite plus d'informations sur vos pronostics.";

// Pages où le bouton est masqué pour éviter chevauchement avec d'autres CTAs sticky
const HIDDEN_PATHS = [
  "/auth",
  "/paiement",
  "/admin",
];

// Déclaration TypeScript pour window.dataLayer (Google Tag Manager)
declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
  }
}

export default function WhatsAppFloatingButton() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Mount uniquement après hydratation pour éviter les flash CSP / SSR mismatch
    setMounted(true);
  }, []);

  if (!mounted) return null;
  if (HIDDEN_PATHS.some((p) => pathname?.startsWith(p))) return null;
  if (!WHATSAPP_NUMBER) return null;

  const url = `https://wa.me/${WHATSAPP_NUMBER.replace(/^\+/, "")}?text=${encodeURIComponent(DEFAULT_MESSAGE)}`;

  const handleClick = () => {
    // Push event GTM pour tracking conversion
    if (typeof window !== "undefined" && Array.isArray(window.dataLayer)) {
      window.dataLayer.push({
        event: "whatsapp_click",
        page_path: pathname,
      });
    }
  };

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      aria-label="Contacter Elite Turf sur WhatsApp"
      className="
        fixed bottom-5 right-5 z-50
        flex items-center justify-center
        w-14 h-14 sm:w-16 sm:h-16
        rounded-full
        bg-[#25D366] hover:bg-[#1EBE5C]
        shadow-2xl shadow-[#25D366]/40
        transition-all duration-200 hover:scale-110 active:scale-95
        focus:outline-none focus:ring-2 focus:ring-[#25D366]/60 focus:ring-offset-2 focus:ring-offset-bg-primary
      "
    >
      <MessageCircle className="w-6 h-6 sm:w-7 sm:h-7 text-white" fill="white" />
      {/* Pulse animation pour attirer l'œil */}
      <span className="absolute inset-0 rounded-full bg-[#25D366] animate-ping opacity-20" aria-hidden="true" />
    </a>
  );
}
