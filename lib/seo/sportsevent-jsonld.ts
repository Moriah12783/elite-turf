/**
 * lib/seo/sportsevent-jsonld.ts
 *
 * Helper centralisé pour produire un Schema.org SportsEvent conforme aux
 * recommandations Google (Rich Results Event).
 *
 * Champs requis ET recommandés (Search Console signale en warning si manquants):
 *  - name, startDate (requis)
 *  - endDate, eventStatus, location, image, description, performer, organizer
 *
 * Référence : https://developers.google.com/search/docs/appearance/structured-data/event
 */

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://www.elite-turf.fr");

interface CourseRow {
  id:              string;
  libelle:         string;
  date_course:     string;            // YYYY-MM-DD
  heure_depart?:   string | null;     // HH:MM:SS
  distance_metres?: number | null;
  categorie?:      string | null;     // PLAT, TROT_ATTELE, TROT_MONTE, HAIE, STEEPLE, OBSTACLE, etc.
  nb_partants?:    number | null;
  statut?:         string | null;     // PROGRAMME, EN_COURS, TERMINE, ANNULE
  hippodrome?: {
    nom?:   string | null;
    ville?: string | null;
    pays?:  string | null;
  } | null;
}

interface BuildSportsEventOptions {
  /** URL canonique de la page (différent de la course en détail). */
  url?: string;
  /** Image principale (fallback : logo Elite Turf). */
  image?: string;
}

/**
 * Construit un SportsEvent JSON-LD complet pour une course.
 * Tous les champs recommandés Google sont remplis avec des valeurs sensibles.
 */
export function buildSportsEventJsonLd(
  c: CourseRow,
  opts: BuildSportsEventOptions = {},
): Record<string, unknown> {
  const startDate = c.heure_depart
    ? `${c.date_course}T${c.heure_depart.slice(0, 8)}`
    : `${c.date_course}T12:00:00`;

  // Durée typique d'une course PMU : 5-8 min de course + cérémonie + ralentissement
  // → on prend 15 min comme estimation honnête (Google a juste besoin d'un endDate
  // raisonnable, pas d'une précision à la seconde).
  const startMs = new Date(startDate).getTime();
  const endDate = new Date(startMs + 15 * 60 * 1000).toISOString();

  // eventStatus selon le statut DB
  const eventStatus = (() => {
    switch (c.statut) {
      case "TERMINE": return "https://schema.org/EventCompleted";
      case "ANNULE":  return "https://schema.org/EventCancelled";
      case "EN_COURS": return "https://schema.org/EventScheduled";
      case "PROGRAMME":
      default:         return "https://schema.org/EventScheduled";
    }
  })();

  // Organizer : France Galop pour plat/obstacle, Le Trot pour trot, LONACI pour CI
  const organizer = pickOrganizer(c);

  // Description riche
  const distanceText = c.distance_metres ? `, ${c.distance_metres} m` : "";
  const partantsText = c.nb_partants ? `, ${c.nb_partants} partants` : "";
  const hipText      = c.hippodrome?.nom ? ` à ${c.hippodrome.nom}` : "";
  const description  = `Course hippique ${c.libelle}${hipText}${distanceText}${partantsText}. `
    + `Programme PMU du ${formatDateFR(c.date_course)} sur Elite Turf — pronostic, partants, arrivée et rapports.`;

  // Performer : on déclare un SportsTeam générique pour signaler la présence
  // de partants. Sans liste détaillée par cheval (qui serait pertinent à
  // l'échelle de chaque course mais pas du programme global), on évite les
  // données invalides ("performer" est obligatoire mais peut rester abstrait).
  const performer = {
    "@type": "SportsTeam" as const,
    name:    c.nb_partants
      ? `${c.nb_partants} chevaux engagés`
      : "Chevaux engagés",
  };

  // Location : Place avec adresse
  const location = c.hippodrome?.nom
    ? {
        "@type": "Place" as const,
        name:    c.hippodrome.nom,
        address: c.hippodrome.ville
          ? {
              "@type":          "PostalAddress" as const,
              addressLocality:  c.hippodrome.ville,
              addressCountry:   c.hippodrome.pays || "FR",
            }
          : {
              "@type":          "PostalAddress" as const,
              addressCountry:   c.hippodrome.pays || "FR",
            },
      }
    : undefined;

  return {
    "@context":   "https://schema.org",
    "@type":      "SportsEvent",
    name:         c.libelle,
    description,
    startDate,
    endDate,
    eventStatus,
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    sport:        "Horse Racing",
    url:          opts.url ?? `${APP_URL}/courses/${c.id}`,
    image:        [opts.image ?? `${APP_URL}/images/heroes/hero-courses.jpg`],
    location,
    performer,
    organizer,
    isAccessibleForFree: true,
  };
}

/**
 * Choisit l'organisateur sportif pertinent en fonction de la catégorie/discipline.
 * France Galop pour les courses de galop (plat/obstacle), Le Trot pour le trot,
 * LONACI pour la Côte d'Ivoire.
 */
function pickOrganizer(c: CourseRow) {
  // Hippodromes ivoiriens (LONACI) : par exemple Abidjan
  const hipCountry = c.hippodrome?.pays?.toUpperCase() ?? "FR";
  if (hipCountry === "CI" || hipCountry.includes("IVOIRE")) {
    return {
      "@type": "Organization" as const,
      name:    "LONACI",
      url:     "https://www.lonacionline.ci",
    };
  }

  // Trot français : Le Trot
  const cat = c.categorie?.toUpperCase() ?? "";
  if (cat.includes("TROT")) {
    return {
      "@type": "Organization" as const,
      name:    "LeTROT",
      url:     "https://www.letrot.com",
    };
  }

  // Galop français : France Galop (par défaut, vu que la majorité de notre catalogue est FR)
  return {
    "@type": "Organization" as const,
    name:    "France Galop",
    url:     "https://www.france-galop.com",
  };
}

function formatDateFR(dateISO: string): string {
  return new Date(dateISO + "T12:00:00").toLocaleDateString("fr-FR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}
