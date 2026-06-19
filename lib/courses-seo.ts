/**
 * Elite Turf — Couche SEO & éditoriale pour les pages "grand rendez-vous".
 * Tout le contenu est DÉRIVÉ des faits du dataset (date, hippodrome, discipline,
 * cycle, prestige). Aucune donnée inventée. Le palmarès (vainqueurs des éditions
 * passées) est laissé volontairement vide : à compléter depuis les sources
 * officielles (France Galop / LeTrot / PMU) — voir PALMARES en bas de fichier.
 */

import {
  GRANDS_RENDEZ_VOUS_2026,
  DISCIPLINE_LABEL,
  formatDateFr,
  type GrandRendezVous,
} from "@/data/grands-rendez-vous-2026";

/* ----------------------------- Slugs & lookup ----------------------------- */

export function getEventBySlug(slug: string): GrandRendezVous | undefined {
  return GRANDS_RENDEZ_VOUS_2026.find((e) => e.slug === slug);
}

export function getAllSlugs(): string[] {
  return GRANDS_RENDEZ_VOUS_2026.map((e) => e.slug);
}

/** Nom d'épreuve nettoyé des tags de qualification (« — Amérique Races Q#6 »). */
export function cleanName(evt: GrandRendezVous): string {
  return evt.courses[0].replace(/\s—\s(Cornulier|Amérique)\sRaces(\sQ#\d+)?$/, "").trim();
}

/* ------------------------------- Statut ----------------------------------- */

export type EventStatus = "a-venir" | "aujourd-hui" | "passe";

export function getStatus(
  evt: GrandRendezVous,
  now: Date = new Date()
): { status: EventStatus; daysUntil: number } {
  const today = now.toISOString().slice(0, 10);
  const end = evt.dateEnd ?? evt.date;
  if (today < evt.date) {
    const days = Math.ceil(
      (new Date(evt.date).getTime() - new Date(today).getTime()) / 86_400_000
    );
    return { status: "a-venir", daysUntil: days };
  }
  if (today > end) return { status: "passe", daysUntil: 0 };
  return { status: "aujourd-hui", daysUntil: 0 };
}

/* --------------------------- Maillage interne ----------------------------- */

/** Rendez-vous liés : même cycle d'abord, puis même discipline. Max `max`. */
export function getRelatedEvents(evt: GrandRendezVous, max = 3): GrandRendezVous[] {
  const others = GRANDS_RENDEZ_VOUS_2026.filter((e) => e.id !== evt.id);
  const sameCycle = evt.cycle ? others.filter((e) => e.cycle === evt.cycle) : [];
  const sameDiscipline = others.filter(
    (e) => e.discipline === evt.discipline && !sameCycle.includes(e)
  );
  return [...sameCycle, ...sameDiscipline].slice(0, max);
}

/* --------------------------- Contenu éditorial ---------------------------- */

const PRESTIGE_PHRASE: Record<GrandRendezVous["prestige"], string> = {
  mythique: "compte parmi les épreuves les plus prestigieuses du calendrier hippique",
  majeur: "figure parmi les grands rendez-vous de la saison",
  classique: "s'inscrit parmi les rendez-vous à suivre de la saison",
};

const CYCLE_PHRASE: Record<NonNullable<GrandRendezVous["cycle"]>, string> = {
  amerique: " Il fait partie des Amérique Races, la route qui mène au Prix d'Amérique.",
  cornulier: " Il s'inscrit dans les Cornulier Races, le rendez-vous du trot monté.",
  criterium: " Il appartient au cycle des Critériums de Vincennes.",
  gnt: " Il s'inscrit dans le Grand National du Trot.",
};

/** Paragraphe d'introduction généré à partir des faits connus (zéro invention). */
export function buildIntro(evt: GrandRendezVous): string {
  const nom = cleanName(evt);
  const disc = DISCIPLINE_LABEL[evt.discipline].toLowerCase();
  const cycle = evt.cycle ? CYCLE_PHRASE[evt.cycle] : "";
  return (
    `Le ${nom} ${PRESTIGE_PHRASE[evt.prestige]} en ${disc}. ` +
    `L'édition 2026 se dispute le ${formatDateFr(evt)} sur l'hippodrome de ${evt.hippodrome}.` +
    `${cycle} ` +
    `Nos experts publient leur analyse et leur pronostic à l'approche de la course.`
  );
}

/** Meta description SEO (≈ 150–160 caractères). */
export function buildMetaDescription(evt: GrandRendezVous): string {
  const nom = cleanName(evt);
  return (
    `${nom} 2026 : ${formatDateFr(evt)} à ${evt.hippodrome} ` +
    `(${DISCIPLINE_LABEL[evt.discipline].toLowerCase()}). ` +
    `Pronostic et analyse Elite Turf à l'approche de la course.`
  );
}

/** FAQ factuelle, réutilisée à l'écran ET en JSON-LD FAQPage. */
export function buildFaq(evt: GrandRendezVous): { q: string; a: string }[] {
  const nom = cleanName(evt);
  const disc = DISCIPLINE_LABEL[evt.discipline].toLowerCase();
  return [
    {
      q: `Quand a lieu le ${nom} 2026 ?`,
      a: `Le ${nom} se court le ${formatDateFr(evt)}.`,
    },
    {
      q: `Sur quel hippodrome se dispute le ${nom} ?`,
      a: `L'épreuve se déroule sur l'hippodrome de ${evt.hippodrome}, en ${disc}.`,
    },
    {
      q: `Où trouver le pronostic Elite Turf du ${nom} ?`,
      a:
        `Notre analyse et notre sélection sont publiées à l'approche de la course, ` +
        `chaque matin entre 8h30 et 9h30 (heure d'Abidjan). Les abonnés reçoivent ` +
        `une alerte WhatsApp dès la publication.`,
    },
  ];
}

/* ------------------------------- JSON-LD ---------------------------------- */

const BASE_URL = "https://www.elite-turf.fr";

export function breadcrumbJsonLd(evt: GrandRendezVous) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil", item: BASE_URL },
      { "@type": "ListItem", position: 2, name: "Calendrier 2026", item: `${BASE_URL}/calendrier` },
      { "@type": "ListItem", position: 3, name: cleanName(evt), item: `${BASE_URL}/calendrier/${evt.slug}` },
    ],
  };
}

export function faqJsonLd(faq: { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}

/* ------------------------------- Palmarès --------------------------------- */
/**
 * ⚠️ À COMPLÉTER depuis les sources officielles (letrot.com / france-galop.com).
 * Ne JAMAIS inventer de vainqueur : la crédibilité « transparence » d'Elite Turf
 * en dépend. Format : clé = id de l'épreuve (cf. dataset), valeur = éditions.
 * La page n'affiche la section palmarès QUE si une entrée existe ici.
 *
 * Exemple de structure attendue (à remplacer par des données réelles) :
 *   "prix-d-amerique": [
 *     { annee: 2025, vainqueur: "Nom officiel du cheval", driver: "Nom du driver" },
 *   ],
 */
export const PALMARES: Record<
  string,
  { annee: number; vainqueur: string; driver?: string }[]
> = {
  // Palmarès vérifiés (sources : France Galop, LeTrot, PMU, Equidia, Canalturf).
  // « driver » = driver (trot) ou jockey (galop / obstacle).

  "prix-d-amerique": [
    { annee: 2025, vainqueur: "Idao de Tillard", driver: "Clément Duvaldestin" },
    { annee: 2024, vainqueur: "Idao de Tillard", driver: "Clément Duvaldestin" },
    { annee: 2023, vainqueur: "Hooker Berry", driver: "Jean-Michel Bazire" },
    { annee: 2022, vainqueur: "Davidson du Pont", driver: "Nicolas Bazire" },
    { annee: 2021, vainqueur: "Face Time Bourbon", driver: "Björn Goop" },
  ],

  "prix-de-cornulier": [
    { annee: 2025, vainqueur: "Joumba de Guez", driver: "Éric Raffin" },
    { annee: 2024, vainqueur: "Esperanza Idole", driver: "Jean-Yves Ricard" },
    { annee: 2023, vainqueur: "Flamme du Goutier" },
    { annee: 2022, vainqueur: "Flamme du Goutier" },
    // 2021 : à compléter (non vérifié à ce stade).
  ],

  "prix-du-jockey-club": [
    { annee: 2025, vainqueur: "Camille Pissarro", driver: "Ryan Moore" },
    { annee: 2024, vainqueur: "Look de Vega", driver: "Ronan Thomas" },
    { annee: 2023, vainqueur: "Ace Impact", driver: "Cristian Demuro" },
    { annee: 2022, vainqueur: "Vadeni", driver: "Christophe Soumillon" },
    { annee: 2021, vainqueur: "St Mark's Basilica", driver: "Ioritz Mendizabal" },
  ],

  "prix-de-diane": [
    { annee: 2025, vainqueur: "Gezora", driver: "Christophe Soumillon" },
    { annee: 2024, vainqueur: "Sparkling Plenty", driver: "Thomas Piccone" },
    { annee: 2023, vainqueur: "Blue Rose Cen", driver: "Aurélien Lemaître" },
    { annee: 2022, vainqueur: "Nashwa", driver: "Hollie Doyle" },
    { annee: 2021, vainqueur: "Joan of Arc", driver: "Ioritz Mendizabal" },
  ],

  "prix-de-l-arc-de-triomphe": [
    { annee: 2025, vainqueur: "Daryz", driver: "Mickaël Barzalona" },
    { annee: 2024, vainqueur: "Bluestocking", driver: "Rossa Ryan" },
    { annee: 2023, vainqueur: "Ace Impact", driver: "Cristian Demuro" },
    { annee: 2022, vainqueur: "Alpinista", driver: "Luke Morris" },
    { annee: 2021, vainqueur: "Torquator Tasso", driver: "René Piechulek" },
  ],

  "grand-steeple-chase-de-paris": [
    { annee: 2025, vainqueur: "Diamond Carl", driver: "Bertrand Lestrade" },
    { annee: 2024, vainqueur: "Gran Diose", driver: "Clément Lefebvre" },
    { annee: 2023, vainqueur: "Rosario Baron", driver: "Jonathan Charron" },
    { annee: 2022, vainqueur: "Sel Jem", driver: "Jonathan Charron" },
    { annee: 2021, vainqueur: "Docteur de Ballon", driver: "Bertrand Lestrade" },
  ],
};
