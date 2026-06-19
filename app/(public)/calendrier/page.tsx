import type { Metadata } from "next";
import CalendrierGrandsRendezVous from "@/components/CalendrierGrandsRendezVous";

export const metadata: Metadata = {
  title: "Calendrier des courses 2026 — Grands rendez-vous PMU | Elite Turf",
  description:
    "Calendrier 2026 des grandes épreuves du Trot et du Galop : Prix d'Amérique, Prix de Diane, Prix du Jockey Club, Arc de Triomphe. Dates, hippodromes et analyses Elite Turf.",
  alternates: { canonical: "https://www.elite-turf.fr/calendrier" },
};

export default function CalendrierPage() {
  return <CalendrierGrandsRendezVous />;
}
