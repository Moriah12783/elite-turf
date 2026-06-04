/**
 * lib/performances/periode-filter.ts
 *
 * Navigation temporelle de l'historique /performances.
 *
 * 🎯 Contexte (04/06/2026)
 * La page /performances tronquait à 30 entrées (slice 0..30) → coupait au
 * 24 mai alors que 175 pronostics publiés existent (dont ~85 gagnants cachés).
 * C'est la preuve sociale n°1 du site : on ne peut pas en cacher 83%.
 *
 * Solution : navigation par période via query param `?periode=`.
 *   - "recents" (défaut) : les N derniers (preuve fraîche, frappe à l'arrivée)
 *   - "YYYY-MM"          : un mois précis (URL SEO indexable)
 *   - "tout"            : tout l'historique (vérification exhaustive)
 *
 * La date de référence d'un pronostic est sa date_course (fallback
 * date_publication) — cohérent avec le tri de la page.
 */

/** Nombre de pronostics affichés par défaut (vue "Récents"). */
export const RECENTS_COUNT = 40;

const MOIS_FR = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

const MOIS_PATTERN = /^\d{4}-\d{2}$/;

export type PeriodeKey = "recents" | "tout" | string; // string = "YYYY-MM"

export interface PeriodeTab {
  key:   PeriodeKey;
  label: string;
  count: number;        // nb de pronostics dans cette période
}

/** Extrait la clé mois "YYYY-MM" d'un pronostic (date_course > date_publication). */
function moisKeyOf(p: any): string {
  const d: string =
    p?.course?.date_course ||
    (typeof p?.date_publication === "string" ? p.date_publication.split("T")[0] : "");
  return d ? d.slice(0, 7) : ""; // "2026-05"
}

/** "2026-05" → "Mai 2026". Chaîne d'origine si invalide. */
export function moisLabel(moisKey: string): string {
  const parts = moisKey.split("-");
  if (parts.length !== 2) return moisKey;
  const annee = parts[0];
  const idx = parseInt(parts[1], 10) - 1;
  if (Number.isNaN(idx) || idx < 0 || idx > 11) return moisKey;
  return `${MOIS_FR[idx]} ${annee}`;
}

/**
 * Construit la liste des onglets période depuis l'historique complet.
 * Ordre : [Récents] [mois le + récent] … [mois le + ancien] [Tout].
 *
 * `pronostics` doit déjà être trié desc (plus récent en premier) et filtré
 * par formule si applicable, pour que les counts reflètent la vue courante.
 */
export function buildPeriodeTabs(pronostics: any[]): PeriodeTab[] {
  const total = pronostics.length;

  // Compter par mois (insertion order = ordre du tri desc déjà appliqué)
  const counts = new Map<string, number>();
  for (const p of pronostics) {
    const k = moisKeyOf(p);
    if (k) counts.set(k, (counts.get(k) ?? 0) + 1);
  }

  const moisTabs: PeriodeTab[] = Array.from(counts.entries()).map(([key, count]) => ({
    key,
    label: moisLabel(key),
    count,
  }));

  return [
    { key: "recents", label: "Récents", count: Math.min(RECENTS_COUNT, total) },
    ...moisTabs,
    { key: "tout", label: "Tout", count: total },
  ];
}

/**
 * Filtre les pronostics selon la période demandée.
 *   - "recents" → les RECENTS_COUNT premiers (déjà triés desc)
 *   - "tout"   → tous
 *   - "YYYY-MM" → ceux de ce mois
 *
 * Toute valeur inconnue retombe sur "recents" (défaut sûr).
 */
export function filterByPeriode(pronostics: any[], periode: string | undefined): any[] {
  if (periode === "tout") return pronostics;
  if (periode && MOIS_PATTERN.test(periode)) {
    return pronostics.filter((p) => moisKeyOf(p) === periode);
  }
  // "recents" ou indéfini
  return pronostics.slice(0, RECENTS_COUNT);
}

/** Résout une période brute (query param) en clé valide. */
export function resolvePeriode(raw: string | undefined): PeriodeKey {
  if (raw === "tout") return "tout";
  if (raw && MOIS_PATTERN.test(raw)) return raw;
  return "recents";
}
