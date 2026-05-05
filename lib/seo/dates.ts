/**
 * Helpers SEO pour pages temporelles (/programme/[date], /quinte-plus/[date], /arrivees/[date]).
 *
 * Objectifs :
 *  - Validation stricte du paramètre [date] (sinon notFound) → pas de pollution sitemap.
 *  - Format texte humain réutilisable dans titre, description, schema.org.
 *  - Liste de dates pré-rendues (generateStaticParams) : fenêtre [-14j, +7j].
 *
 * Le fuseau de référence est Europe/Paris (PMU France) pour le calcul de "today".
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDateParam(s: string | undefined | null): s is string {
  if (!s || !DATE_RE.test(s)) return false;
  const d = new Date(s + "T00:00:00Z");
  if (isNaN(d.getTime())) return false;
  // Réécrire et comparer pour rejeter "2026-02-30"
  const round = d.toISOString().split("T")[0];
  return round === s;
}

/** Today à Paris (YYYY-MM-DD). */
export function todayParis(): string {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    year:  "numeric",
    month: "2-digit",
    day:   "2-digit",
  }).format(new Date()).split("/").reverse().join("-");
}

/** "samedi 4 mai 2026" */
export function formatDateLong(date: string): string {
  const d = new Date(date + "T12:00:00");
  return d.toLocaleDateString("fr-FR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

/** "4 mai 2026" — version compacte pour titres SEO */
export function formatDateCompact(date: string): string {
  const d = new Date(date + "T12:00:00");
  return d.toLocaleDateString("fr-FR", {
    day: "numeric", month: "long", year: "numeric",
  });
}

/** "4 mai" — sans année, pour breadcrumbs ou titres déjà contextualisés */
export function formatDateShort(date: string): string {
  const d = new Date(date + "T12:00:00");
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
}

export function isToday(date: string): boolean { return date === todayParis(); }
export function isFuture(date: string): boolean { return date > todayParis(); }
export function isPast(date: string): boolean { return date < todayParis(); }

/**
 * Liste des dates à pré-rendre par ISR : 14 jours passés + aujourd'hui + 7 futurs.
 * 22 entrées au total — peu coûteux pour Cloudflare ISR.
 */
export function generateDateRangeParams(): { date: string }[] {
  const today = todayParis();
  const todayDate = new Date(today + "T12:00:00Z");
  const out: { date: string }[] = [];
  for (let i = -14; i <= 7; i++) {
    const d = new Date(todayDate.getTime() + i * 24 * 60 * 60 * 1000);
    out.push({ date: d.toISOString().split("T")[0] });
  }
  return out;
}

/**
 * Determine la durée de cache ISR optimale selon la position de la date :
 *  - Aujourd'hui : 60s (cotes/horaires bougent)
 *  - Futur (J+1 à J+7) : 600s (programme stable jusqu'à H-2)
 *  - Passé : 86400s (24h) — résultats figés
 */
export function getRevalidateForDate(date: string): number {
  if (isToday(date)) return 60;
  if (isFuture(date)) return 600;
  return 86400;
}
