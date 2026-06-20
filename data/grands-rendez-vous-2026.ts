/**
 * Elite Turf — Grands Rendez-vous hippiques 2026
 * Source : Calendrier officiel des courses 2026 (France Galop / Société du Trotteur Français / PMU).
 * Données figées (événements majeurs). Le programme quotidien complet doit venir d'un flux live
 * (voir note d'intégration), pas de ce fichier statique.
 */

export type Discipline = "trot" | "galop" | "obstacle";

/** Niveau de prestige pour la hiérarchie visuelle (losanges ◆ Elite Turf). */
export type Prestige = "mythique" | "majeur" | "classique";

/** Cycle de qualification (utile pour des pages thématiques et le SEO). */
export type Cycle = "amerique" | "cornulier" | "criterium" | "gnt" | null;

export interface GrandRendezVous {
  /** Identifiant stable (slug-friendly). */
  id: string;
  /** Date de début au format ISO (YYYY-MM-DD). */
  date: string;
  /** Date de fin pour les meetings sur 2 jours (week-ends). Optionnel. */
  dateEnd?: string;
  hippodrome: string;
  /** Discipline principale de la réunion. */
  discipline: Discipline;
  /** Une ou plusieurs épreuves majeures du jour. */
  courses: string[];
  prestige: Prestige;
  cycle: Cycle;
  /** Slug SEO prêt à l'emploi pour une route /courses/[slug] ou /evenements/[slug]. */
  slug: string;
}

/* ------------------------------------------------------------------ */
/*  DATASET                                                            */
/* ------------------------------------------------------------------ */

export const GRANDS_RENDEZ_VOUS_2026: GrandRendezVous[] = [
  // ─── TROT ────────────────────────────────────────────────────────
  {
    id: "prix-du-calvados",
    date: "2026-01-04",
    hippodrome: "Paris-Vincennes",
    discipline: "trot",
    courses: ["Prix du Calvados — Cornulier Races Q#3"],
    prestige: "classique",
    cycle: "cornulier",
    slug: "prix-du-calvados-2026",
  },
  {
    id: "prix-de-belgique",
    date: "2026-01-11",
    hippodrome: "Paris-Vincennes",
    discipline: "trot",
    courses: ["Prix de Belgique — Amérique Races Q#6"],
    prestige: "majeur",
    cycle: "amerique",
    slug: "prix-de-belgique-2026",
  },
  {
    id: "prix-de-cornulier",
    date: "2026-01-18",
    hippodrome: "Paris-Vincennes",
    discipline: "trot",
    courses: ["Prix de Cornulier"],
    prestige: "mythique",
    cycle: "cornulier",
    slug: "prix-de-cornulier-2026",
  },
  {
    id: "prix-d-amerique",
    date: "2026-01-25",
    hippodrome: "Paris-Vincennes",
    discipline: "trot",
    courses: ["Prix d'Amérique — Legend Race"],
    prestige: "mythique",
    cycle: "amerique",
    slug: "prix-d-amerique-2026",
  },
  {
    id: "prix-ile-de-france",
    date: "2026-02-01",
    hippodrome: "Paris-Vincennes",
    discipline: "trot",
    courses: ["Prix de l'Île-de-France — Cornulier Races"],
    prestige: "classique",
    cycle: "cornulier",
    slug: "prix-ile-de-france-2026",
  },
  {
    id: "prix-de-france",
    date: "2026-02-08",
    hippodrome: "Paris-Vincennes",
    discipline: "trot",
    courses: ["Prix de France — Speed Race"],
    prestige: "majeur",
    cycle: "amerique",
    slug: "prix-de-france-2026",
  },
  {
    id: "prix-comte-pierre-de-montesson",
    date: "2026-02-15",
    hippodrome: "Paris-Vincennes",
    discipline: "trot",
    courses: ["Prix Comte Pierre de Montesson"],
    prestige: "classique",
    cycle: null,
    slug: "prix-comte-pierre-de-montesson-2026",
  },
  {
    id: "prix-de-paris",
    date: "2026-02-22",
    hippodrome: "Paris-Vincennes",
    discipline: "trot",
    courses: ["Prix de Paris — Marathon Race"],
    prestige: "majeur",
    cycle: null,
    slug: "prix-de-paris-2026",
  },
  {
    id: "prix-des-centaures",
    date: "2026-02-28",
    hippodrome: "Paris-Vincennes",
    discipline: "trot",
    courses: ["Prix des Centaures", "Prix Henri Desmontils"],
    prestige: "classique",
    cycle: null,
    slug: "prix-des-centaures-2026",
  },
  {
    id: "grand-criterium-vitesse-cote-azur",
    date: "2026-03-08",
    hippodrome: "Cagnes-sur-Mer",
    discipline: "trot",
    courses: ["Grand Critérium de Vitesse de la Côte d'Azur"],
    prestige: "majeur",
    cycle: null,
    slug: "grand-criterium-vitesse-cote-azur-2026",
  },
  {
    id: "prix-de-l-atlantique",
    date: "2026-04-18",
    hippodrome: "Enghien-Soisy",
    discipline: "trot",
    courses: ["Prix de l'Atlantique"],
    prestige: "classique",
    cycle: null,
    slug: "prix-de-l-atlantique-2026",
  },
  {
    id: "prix-des-ducs-de-normandie",
    date: "2026-05-09",
    hippodrome: "Caen",
    discipline: "trot",
    courses: ["Prix des Ducs de Normandie"],
    prestige: "classique",
    cycle: null,
    slug: "prix-des-ducs-de-normandie-2026",
  },
  {
    id: "finales-etrier-2026",
    date: "2026-06-21",
    hippodrome: "Paris-Vincennes",
    discipline: "trot",
    courses: [
      "Prix d'Essai — Étrier 3 ans (Finale)",
      "Prix du Président de la République — Étrier 4 ans (Finale)",
      "Prix de Normandie — Étrier 5 ans (Finale)",
      "Prix Albert Viel",
      "Prix Réné Ballière",
    ],
    prestige: "majeur",
    cycle: null,
    slug: "finales-etrier-vincennes-2026",
  },
  {
    id: "criteriums-3-4-5-ans",
    date: "2026-09-12",
    hippodrome: "Paris-Vincennes",
    discipline: "trot",
    courses: ["Critérium des 3 ans", "Critérium des 4 ans", "Critérium des 5 ans"],
    prestige: "majeur",
    cycle: "criterium",
    slug: "criteriums-trot-vincennes-2026",
  },
  {
    id: "prix-des-elites",
    date: "2026-09-27",
    hippodrome: "Paris-Vincennes",
    discipline: "trot",
    courses: ["Prix des Élites"],
    prestige: "majeur",
    cycle: null,
    slug: "prix-des-elites-2026",
  },
  {
    id: "saint-leger-des-trotteurs",
    date: "2026-10-10",
    hippodrome: "Caen",
    discipline: "trot",
    courses: ["Saint Léger des Trotteurs"],
    prestige: "classique",
    cycle: null,
    slug: "saint-leger-des-trotteurs-2026",
  },
  {
    id: "prix-de-bretagne",
    date: "2026-11-22",
    hippodrome: "Paris-Vincennes",
    discipline: "trot",
    courses: ["Prix de Bretagne — Amérique Races Q#1"],
    prestige: "majeur",
    cycle: "amerique",
    slug: "prix-de-bretagne-2026",
  },
  {
    id: "finale-grand-national-du-trot",
    date: "2026-12-06",
    hippodrome: "Paris-Vincennes",
    discipline: "trot",
    courses: ["Finale du Grand National du Trot"],
    prestige: "majeur",
    cycle: "gnt",
    slug: "finale-grand-national-du-trot-2026",
  },
  {
    id: "prix-du-bourbonnais",
    date: "2026-12-13",
    hippodrome: "Paris-Vincennes",
    discipline: "trot",
    courses: ["Prix du Bourbonnais — Amérique Races Q#2"],
    prestige: "classique",
    cycle: "amerique",
    slug: "prix-du-bourbonnais-2026",
  },
  {
    id: "prix-jag-de-bellouet",
    date: "2026-12-20",
    hippodrome: "Paris-Vincennes",
    discipline: "trot",
    courses: [
      "Prix Jag de Bellouet — Cornulier Races Q#1",
      "Prix Bilibili — Cornulier Races Q#2",
      "Prix de Vincennes",
    ],
    prestige: "classique",
    cycle: "cornulier",
    slug: "prix-jag-de-bellouet-2026",
  },
  {
    id: "criterium-continental",
    date: "2026-12-27",
    hippodrome: "Paris-Vincennes",
    discipline: "trot",
    courses: [
      "Critérium Continental — Amérique Races Q#3",
      "Prix Ténor de Baune — Amérique Races Q#4",
    ],
    prestige: "classique",
    cycle: "amerique",
    slug: "criterium-continental-2026",
  },

  // ─── GALOP ───────────────────────────────────────────────────────
  {
    id: "prix-ganay",
    date: "2026-04-26",
    hippodrome: "ParisLongchamp",
    discipline: "galop",
    courses: ["Prix Ganay"],
    prestige: "majeur",
    cycle: null,
    slug: "prix-ganay-2026",
  },
  {
    id: "poule-d-essai",
    date: "2026-05-10",
    hippodrome: "ParisLongchamp",
    discipline: "galop",
    courses: ["Emirates Poule d'Essai des Poulains et Pouliches"],
    prestige: "majeur",
    cycle: null,
    slug: "poule-d-essai-2026",
  },
  {
    id: "grand-steeple-chase-de-paris",
    date: "2026-05-16",
    dateEnd: "2026-05-17",
    hippodrome: "Auteuil",
    discipline: "obstacle",
    courses: ["Week-end du Grand Steeple-Chase de Paris"],
    prestige: "mythique",
    cycle: null,
    slug: "grand-steeple-chase-de-paris-2026",
  },
  {
    id: "prix-d-ispahan",
    date: "2026-05-21",
    hippodrome: "ParisLongchamp",
    discipline: "galop",
    courses: ["Prix d'Ispahan", "Prix Vicomtesse Vigier"],
    prestige: "classique",
    cycle: null,
    slug: "prix-d-ispahan-2026",
  },
  {
    id: "prix-du-jockey-club",
    date: "2026-05-31",
    hippodrome: "Chantilly",
    discipline: "galop",
    courses: ["Qatar Prix du Jockey Club"],
    prestige: "mythique",
    cycle: null,
    slug: "prix-du-jockey-club-2026",
  },
  {
    id: "prix-de-diane",
    date: "2026-06-14",
    hippodrome: "Chantilly",
    discipline: "galop",
    courses: ["Prix de Diane Longines"],
    prestige: "mythique",
    cycle: null,
    slug: "prix-de-diane-2026",
  },
  {
    id: "grand-prix-de-saint-cloud",
    date: "2026-06-28",
    hippodrome: "Saint-Cloud",
    discipline: "galop",
    courses: ["Grand Prix de Saint-Cloud"],
    prestige: "majeur",
    cycle: null,
    slug: "grand-prix-de-saint-cloud-2026",
  },
  {
    id: "prix-jean-prat",
    date: "2026-07-05",
    hippodrome: "Deauville",
    discipline: "galop",
    courses: ["Prix Jean Prat"],
    prestige: "classique",
    cycle: null,
    slug: "prix-jean-prat-2026",
  },
  {
    id: "grand-prix-de-paris",
    date: "2026-07-14",
    hippodrome: "ParisLongchamp",
    discipline: "galop",
    courses: ["CYGAMES Grand Prix de Paris"],
    prestige: "majeur",
    cycle: null,
    slug: "grand-prix-de-paris-2026",
  },
  {
    id: "prix-rothschild",
    date: "2026-08-02",
    hippodrome: "Deauville",
    discipline: "galop",
    courses: ["Prix Rothschild"],
    prestige: "classique",
    cycle: null,
    slug: "prix-rothschild-2026",
  },
  {
    id: "prix-maurice-de-gheest",
    date: "2026-08-09",
    hippodrome: "Deauville",
    discipline: "galop",
    courses: ["ARC Prix Maurice de Gheest"],
    prestige: "classique",
    cycle: null,
    slug: "prix-maurice-de-gheest-2026",
  },
  {
    id: "prix-jacques-le-marois",
    date: "2026-08-16",
    hippodrome: "Deauville",
    discipline: "galop",
    courses: ["THE AGA KHAN STUDS Prix Jacques Le Marois"],
    prestige: "majeur",
    cycle: null,
    slug: "prix-jacques-le-marois-2026",
  },
  {
    id: "prix-morny",
    date: "2026-08-23",
    hippodrome: "Deauville",
    discipline: "galop",
    courses: ["Sumbe Prix Morny", "Sumbe Prix Jean Romanet"],
    prestige: "majeur",
    cycle: null,
    slug: "prix-morny-2026",
  },
  {
    id: "qatar-arc-trials",
    date: "2026-09-06",
    hippodrome: "ParisLongchamp",
    discipline: "galop",
    courses: ["Qatar Arc Trials"],
    prestige: "classique",
    cycle: null,
    slug: "qatar-arc-trials-2026",
  },
  {
    id: "prix-de-l-arc-de-triomphe",
    date: "2026-10-03",
    dateEnd: "2026-10-04",
    hippodrome: "ParisLongchamp",
    discipline: "galop",
    courses: ["Week-end du Qatar Prix de l'Arc de Triomphe"],
    prestige: "mythique",
    cycle: null,
    slug: "prix-de-l-arc-de-triomphe-2026",
  },
  {
    id: "criterium-international-saint-cloud",
    date: "2026-10-25",
    hippodrome: "Saint-Cloud",
    discipline: "galop",
    courses: ["Critérium International", "Critérium de Saint-Cloud", "Prix Royal-Oak"],
    prestige: "majeur",
    cycle: null,
    slug: "criterium-international-saint-cloud-2026",
  },
  {
    id: "48h-de-l-obstacle",
    date: "2026-11-14",
    dateEnd: "2026-11-15",
    hippodrome: "Auteuil",
    discipline: "obstacle",
    courses: ["Week-end des 48H de l'Obstacle"],
    prestige: "majeur",
    cycle: null,
    slug: "48h-de-l-obstacle-2026",
  },
];

/* ------------------------------------------------------------------ */
/*  HELPERS                                                            */
/* ------------------------------------------------------------------ */

const MOIS_FR = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

export const DISCIPLINE_LABEL: Record<Discipline, string> = {
  trot: "Trot",
  galop: "Galop",
  obstacle: "Obstacle",
};

export const PRESTIGE_DIAMONDS: Record<Prestige, number> = {
  mythique: 3,
  majeur: 2,
  classique: 1,
};

/** "2026-01-25" -> "25 janvier 2026" (avec plage pour les week-ends). */
export function formatDateFr(evt: Pick<GrandRendezVous, "date" | "dateEnd">): string {
  const [, m, d] = evt.date.split("-").map(Number);
  const start = `${d} ${MOIS_FR[m - 1]}`;
  if (evt.dateEnd) {
    const [, , d2] = evt.dateEnd.split("-").map(Number);
    return `${d}–${d2} ${MOIS_FR[m - 1]} 2026`;
  }
  return `${start} 2026`;
}

/** Numéro de mois (1–12) d'un événement. */
export function monthOf(evt: GrandRendezVous): number {
  return Number(evt.date.split("-")[1]);
}

/** Regroupe les événements par mois, dans l'ordre du calendrier. */
export function groupByMonth(
  events: GrandRendezVous[] = GRANDS_RENDEZ_VOUS_2026
): { month: number; label: string; events: GrandRendezVous[] }[] {
  const map = new Map<number, GrandRendezVous[]>();
  for (const e of events) {
    const m = monthOf(e);
    if (!map.has(m)) map.set(m, []);
    map.get(m)!.push(e);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a - b)
    .map(([month, evts]) => ({
      month,
      label: MOIS_FR[month - 1],
      events: evts.sort((a, b) => a.date.localeCompare(b.date)),
    }));
}

/** Prochains rendez-vous à partir d'une date (par défaut : aujourd'hui). */
export function getUpcoming(
  from: Date = new Date(),
  count = 3
): GrandRendezVous[] {
  const iso = from.toISOString().slice(0, 10);
  return GRANDS_RENDEZ_VOUS_2026
    .filter((e) => (e.dateEnd ?? e.date) >= iso)
    .slice(0, count);
}

/** Le tout prochain grand rendez-vous (ou null si la saison est terminée). */
export function getNextEvent(from: Date = new Date()): GrandRendezVous | null {
  return getUpcoming(from, 1)[0] ?? null;
}

/**
 * Schema.org Event (JSON-LD) — à injecter dans le <head> ou via next/script
 * pour le SEO « rich results » Google. Voir note d'intégration.
 */
export function generateEventJsonLd(evt: GrandRendezVous) {
  // URL canonique du site (pas d'env dans ce data file ; cf. lib/courses-seo.ts).
  const SITE = "https://www.elite-turf.fr";
  // Organisateur dérivé de la discipline (FACTUEL) — aligné sur
  // lib/seo/sportsevent-jsonld.ts : Le Trot pour le trot, France Galop sinon.
  const organizer =
    evt.discipline === "trot"
      ? { "@type": "Organization", name: "LeTROT", url: "https://www.letrot.com" }
      : { "@type": "Organization", name: "France Galop", url: "https://www.france-galop.com" };
  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name: evt.courses[0],
    startDate: evt.date,
    // endDate TOUJOURS présent (= dateEnd si multi-jours, sinon le jour même) :
    // résout le warning GSC "Champ endDate manquant".
    endDate: evt.dateEnd ?? evt.date,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: {
      "@type": "Place",
      name: `Hippodrome de ${evt.hippodrome}`,
      address: { "@type": "PostalAddress", addressCountry: "FR" },
    },
    image: [`${SITE}/images/heroes/hero-courses.jpg`],
    sport: DISCIPLINE_LABEL[evt.discipline],
    description: `${evt.courses.join(", ")} — ${evt.hippodrome}. Analyse et pronostics Elite Turf.`,
    // Champs recommandés Google (alignés sur le helper SportsEvent /arrivees) :
    performer: { "@type": "SportsTeam", name: "Chevaux engagés" },
    organizer,
    url: `${SITE}/calendrier/${evt.slug}`,
    // Course gratuite à suivre → signal correct à la place d'un faux "offers".
    isAccessibleForFree: true,
  };
}
