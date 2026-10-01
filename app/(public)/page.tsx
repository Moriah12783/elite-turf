import type { Metadata } from "next";
import AccueilSections from "@/components/home/AccueilSections";

// ── Accueil public mis en cache (brief SEO du 01/10/2026, B3) ──────────────
// Avant : rendu à CHAQUE visite (0,9 à 4,8 s). Le `revalidate = 60` d'alors
// restait sans effet : le pied de page lit la session (cookies), ce qui rend
// la page dynamique, et OpenNext n'avait de toute façon aucun stockage de cache
// (cf. open-next.config.ts).
//
// `force-static` : cookies et en-têtes sont VIDES pendant le rendu → la page
// en cache est la version visiteur, sans aucune donnée personnelle (le pied de
// page affiche « Créer un compte gratuit »). Les requêtes Supabase et PMU
// (fetch `no-store`) ne sont jamais mises en cache par Next : chaque
// régénération relit la base.
//
// Les membres connectés ne reçoivent jamais cette version : le middleware les
// réécrit vers /accueil-membre (personnalisée), à la même adresse « / ».
//
// Fraîcheur : elite-turf-crons appelle « / » toutes les 5 min. Avec un délai
// de 4 min, chaque appel trouve la page périmée et la fait régénérer : la
// version servie a au plus ~5 min, même la nuit et au changement de jour (un
// délai de 5 min pile ne régénérerait qu'un appel sur deux).
export const dynamic = "force-static";
export const revalidate = 240;

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://www.elite-turf.fr");

export const metadata: Metadata = {
  title: { absolute: "Elite Turf — Pronostics PMU & Analyses Hippiques Premium" },
  description:
    "Pronostics PMU du jour analysés par des experts hippiques. Quinté+, Quarté+, Tiercé. Résultats publiés en toute transparence. Abonnements dès 65€ — Paiement par carte bancaire (Visa/Mastercard), toutes cartes tous pays. Mobile Money bientôt.",
  alternates: { canonical: APP_URL },
  openGraph: {
    title: "Elite Turf — Pronostics PMU & Analyses Hippiques Premium",
    description:
      "Pronostics PMU du jour analysés par des experts hippiques. Résultats transparents et vérifiables.",
    url: APP_URL,
    siteName: "Elite Turf",
    locale: "fr_FR",
    type: "website",
  },
};

export default function HomePage() {
  return <AccueilSections abonne={false} personnalise={false} />;
}
