import { templateNewsletterLancement } from "@/lib/email/templates/newsletter-lancement";

export const dynamic = "force-dynamic";

export async function GET() {
  const { html } = templateNewsletterLancement({
    prenom: "Stéphane",
    numeroEdition: 1,
    reductionPct: 30,
    dateExpiration: "4 mai 2026",
    codePromo: "ELITE30",
    titreHero: "La méthode que les parieurs gagnants gardent pour eux.",
    sousTitreHero: "Et que vous allez découvrir aujourd'hui.",
  });

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
