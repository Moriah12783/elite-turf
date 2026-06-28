/**
 * GET /llms.txt
 *
 * Fichier "llms.txt" (convention AEO/GEO) : une carte concise et lisible du site
 * pour les moteurs IA / agents (ChatGPT, Perplexity, Claude, Gemini…), afin
 * qu'ils comprennent et citent le contenu d'Elite Turf.
 *
 * GÉNÉRÉ depuis les données réelles du site (blog, pays, calendrier) → URLs
 * exactes + descriptions = la copie publiée (zéro fabrication, toujours à jour).
 * Voir aussi /sitemap.xml pour l'index complet des pages.
 */

import { BLOG_ARTICLES } from "@/lib/blog-data";
import { COUNTRIES } from "@/lib/geo/countries";
import { GRANDS_RENDEZ_VOUS_2026 } from "@/data/grands-rendez-vous-2026";

export const dynamic = "force-static";

const BASE = "https://www.elite-turf.fr";

const MOIS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

/** Aplati les espaces/retours pour garder un lien sur une seule ligne. */
function clean(s: string): string {
  return (s || "").replace(/\s+/g, " ").trim();
}

/** "2026-01-11" → "11 janvier 2026" (sans dépendance à l'ICU/locale). */
function dateFr(iso: string): string {
  const p = (iso || "").split("-");
  if (p.length !== 3) return iso;
  return `${Number(p[2])} ${MOIS[Number(p[1]) - 1] ?? ""} ${p[0]}`.trim();
}

/** Ligne llms.txt : - [Titre](URL absolue): description. */
function link(title: string, path: string, desc: string): string {
  return `- [${clean(title)}](${BASE}${path}): ${clean(desc)}`;
}

export async function GET() {
  const out: string[] = [];

  // ── En-tête ──────────────────────────────────────────────────────────
  out.push("# Elite Turf");
  out.push("");
  out.push(
    "> Maison de pronostics hippiques PMU pour l'Afrique francophone et la France. " +
    "Analyses fondées sur les données PMU officielles, l'intelligence artificielle et la validation humaine. " +
    "Résultats publics et horodatés — l'arrivée officielle est affichée après chaque course, gagnée comme perdue. " +
    "Aucune promesse de gain, jeu responsable. Contenu en français.",
  );
  out.push("");
  out.push(
    "Elite Turf publie chaque jour des pronostics (Quinté+, Tiercé, Quarté+), des analyses de courses, " +
    "des guides pour parier avec méthode, des pages dédiées par pays d'Afrique francophone, et des ressources " +
    "pour reconnaître les arnaques aux pronostics. Marque éditée par Tsalach Ventures LLC. " +
    `Index complet des pages : ${BASE}/sitemap.xml`,
  );
  out.push("");

  // ── Pronostics & courses ─────────────────────────────────────────────
  out.push("## Pronostics & courses");
  out.push("");
  out.push(link("Pronostics du jour", "/pronostics", "Pronostics du jour (Quinté+, Tiercé, Quarté+) selon le niveau d'accès."));
  out.push(link("Pronostic gratuit du jour", "/pronostics/gratuit", "Un pronostic gratuit publié chaque jour pour tester nos analyses."));
  out.push(link("Programme des courses", "/programme", "Programme des courses PMU du jour et des prochains jours."));
  out.push(link("Quinté+ du jour", "/quinte-plus", "Le Quinté+ du jour : partants, analyse et sélection."));
  out.push(link("Courses du jour", "/courses", "Toutes les courses du jour, avec une Sélection stats gratuite par course."));
  out.push(link("Arrivées & rapports", "/arrivees", "Arrivées officielles et rapports des courses."));
  out.push(link("Le Direct", "/live", "Suivi des courses du jour et replays."));
  out.push(link("Performances publiques", "/performances", "Bilan public et horodaté de nos pronostics — gagnés comme perdus."));
  out.push("");

  // ── Transparence & jeu responsable ──────────────────────────────────
  out.push("## Transparence & jeu responsable");
  out.push("");
  out.push(link("Reconnaître les arnaques aux pronostics", "/arnaques-pronostics", "Les signaux d'alerte des faux pronostiqueurs PMU et comment s'en protéger."));
  out.push(link("Guide gratuit de l'initié", "/guide-gratuit", "Guide gratuit : méthodes pour analyser une course et détecter les outsiders."));
  out.push("");

  // ── Guides & analyses (blog) ─────────────────────────────────────────
  out.push("## Guides & analyses");
  out.push("");
  out.push(link("Blog Elite Turf", "/blog", "Tous les guides et analyses PMU de nos experts."));
  for (const a of BLOG_ARTICLES) {
    out.push(link(a.titre, `/blog/${a.slug}`, a.description));
  }
  out.push("");

  // ── Pronostics PMU par pays ──────────────────────────────────────────
  out.push("## Pronostics PMU par pays");
  out.push("");
  for (const c of COUNTRIES) {
    out.push(link(`Pronostics PMU ${c.nom}`, `/pronostics-pmu-${c.slug}`, c.accroche));
  }
  out.push("");

  // ── Grands rendez-vous hippiques (épreuves majeures) ────────────────
  out.push("## Grands rendez-vous hippiques 2026");
  out.push("");
  out.push(link("Calendrier des grands rendez-vous", "/calendrier", "Les épreuves majeures du trot, du galop et de l'obstacle en 2026."));
  for (const ev of GRANDS_RENDEZ_VOUS_2026) {
    if (ev.prestige === "classique") continue; // on garde les épreuves mythiques/majeures
    const titre = ev.courses[0] || ev.hippodrome;
    out.push(link(titre, `/calendrier/${ev.slug}`, `${ev.hippodrome} · ${ev.discipline} · ${dateFr(ev.date)}.`));
  }
  out.push("");

  // ── À propos & infos ─────────────────────────────────────────────────
  out.push("## À propos & infos");
  out.push("");
  out.push(link("À propos d'Elite Turf", "/a-propos", "Mission, méthode et positionnement transparence d'Elite Turf."));
  out.push(link("Abonnements", "/abonnements", "Les formules d'abonnement (Starter, Pro, Elite)."));
  out.push(link("Contact", "/contact", "Contacter l'équipe Elite Turf."));
  out.push(link("Politique de confidentialité", "/confidentialite", "Confidentialité et protection des données."));
  out.push("");

  return new Response(out.join("\n"), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
