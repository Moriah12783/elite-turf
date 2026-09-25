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

/**
 * Heure GMT (« HH:MM ») d'une heure de départ exprimée à l'heure de Paris.
 *
 * Les heures de course en base sont à l'heure de Paris (Geny, PMU) ; les
 * abonnés d'Afrique de l'Ouest — et le flux LONACI — raisonnent en GMT.
 * Ex. 25/09/2026 : Prix Austria = 20:15 Paris = 18:15 GMT.
 *
 * null si la date ou l'heure est illisible : jamais une heure devinée.
 */
export function heureGmtDepuisParis(date: string, heureParis: string | null | undefined): string | null {
  if (!isValidDateParam(date) || !heureParis) return null;
  const m = /^(\d{2}):(\d{2})/.exec(heureParis);
  if (!m) return null;
  // Instant « comme si » l'heure de Paris était déjà en UTC, puis correction du
  // décalage réel de Paris à cet instant (1 h l'hiver, 2 h l'été).
  const naif = Date.parse(date + "T" + m[1] + ":" + m[2] + ":00Z");
  if (isNaN(naif)) return null;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Paris",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(new Date(naif));
  const val = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const heure = val("hour") === "24" ? "00" : val("hour");
  const vueDeParis = Date.parse(val("year") + "-" + val("month") + "-" + val("day") + "T" + heure + ":" + val("minute") + ":00Z");
  const gmt = new Date(naif - (vueDeParis - naif));
  const deux = (n: number) => (n < 10 ? "0" : "") + n;
  return deux(gmt.getUTCHours()) + ":" + deux(gmt.getUTCMinutes());
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
