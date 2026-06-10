/**
 * WhatsAppFloatingButton — Bouton flottant "wa.me" sur le site public.
 *
 * Apparaît en bas à droite sur toutes les pages publiques.
 * Cliquer → ouvre WhatsApp (mobile) ou WhatsApp Web (desktop) avec un
 * message pré-rempli vers le numéro Elite Turf.
 *
 * Pas de tracking complexe — juste un wa.me direct. C'est volontairement
 * minimaliste : pas de popup intrusive, pas de chat embarqué, juste un
 * point d'entrée discret pour convertir les visiteurs en leads WhatsApp.
 */

"use client";

import { MessageCircle } from "lucide-react";
import { whatsappUrl } from "@/lib/constants/whatsapp";

const PREFILL_MESSAGE = "Bonjour Elite Turf, je souhaite plus d'informations sur vos pronostics.";

export default function WhatsAppFloatingButton() {
  const href = whatsappUrl(PREFILL_MESSAGE);

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Nous contacter sur WhatsApp"
      className="
        fixed bottom-6 right-6 z-40
        flex items-center justify-center
        w-14 h-14 rounded-full
        bg-[#25D366] hover:bg-[#1ebe5c]
        shadow-lg hover:shadow-xl
        text-white
        transition-all duration-200
        hover:scale-110
      "
    >
      {/* Icône WhatsApp officielle (SVG inline pour zéro dep) */}
      <svg
        viewBox="0 0 32 32"
        fill="currentColor"
        className="w-7 h-7"
        aria-hidden="true"
      >
        <path d="M16.001 3C9.373 3 4 8.373 4 15.001c0 2.385.696 4.605 1.892 6.475L4 28l6.689-1.852A11.94 11.94 0 0 0 16.001 27C22.628 27 28 21.628 28 15.001 28 8.373 22.628 3 16.001 3zm0 21.797a9.794 9.794 0 0 1-4.997-1.367l-.358-.213-3.971 1.099 1.057-3.868-.234-.395a9.778 9.778 0 0 1-1.498-5.151c0-5.405 4.395-9.797 9.801-9.797 5.406 0 9.797 4.392 9.797 9.797s-4.391 9.895-9.797 9.895zm5.376-7.342c-.295-.148-1.743-.86-2.013-.959-.27-.099-.467-.148-.665.148-.197.296-.764.959-.936 1.156-.172.197-.345.222-.64.074-.295-.148-1.245-.459-2.371-1.462-.877-.782-1.469-1.747-1.641-2.043-.172-.296-.018-.456.13-.604.133-.132.295-.345.443-.518.148-.172.197-.296.296-.493.099-.197.05-.37-.025-.518-.074-.148-.665-1.603-.911-2.196-.24-.578-.484-.499-.665-.508l-.567-.01c-.197 0-.518.074-.789.37s-1.034 1.011-1.034 2.466 1.058 2.86 1.206 3.057c.148.197 2.082 3.179 5.043 4.456.705.305 1.255.487 1.685.624.708.225 1.353.193 1.863.117.568-.085 1.743-.713 1.989-1.401.246-.689.246-1.279.172-1.401-.074-.122-.27-.197-.566-.345z" />
      </svg>
    </a>
  );
}
