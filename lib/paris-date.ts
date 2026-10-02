/**
 * lib/paris-date.ts
 *
 * Helpers timezone Europe/Paris pour le scraping Geny et les opérations
 * date-sensibles côté Cloudflare Workers (qui tournent en UTC).
 *
 * ── Pourquoi ce module existe ──────────────────────────────────────────────
 *
 * Cloudflare Workers tournent en UTC. Geny.com renvoie les courses selon
 * l'heure de Paris. Quand le serveur (UTC) calcule "today" via
 * `new Date().toISOString().split("T")[0]`, il peut être décalé d'1 jour
 * par rapport à Paris.
 *
 * Exemple concret de bug :
 *   - 01h heure de Paris (DST été = UTC+2) le 9 mai
 *   - Côté UTC : 23h le 8 mai
 *   - `new Date().toISOString().split("T")[0]` → "2026-05-08" (UTC)
 *   - Mais Geny `_daujourdhui` (heure Paris) → courses du **9 mai**
 *   - 💥 Les courses du 9 mai sont stockées en DB sous la date du 8 mai
 *
 * Fix : utiliser `Intl.DateTimeFormat` avec `timeZone: "Europe/Paris"` pour
 * formater les dates relatives à Paris, indépendamment du fuseau du serveur.
 *
 * Le format "fr-CA" est choisi car il produit nativement YYYY-MM-DD (ISO 8601).
 */

const PARIS_DATE_FMT = new Intl.DateTimeFormat("fr-CA", {
  timeZone: "Europe/Paris",
  year:     "numeric",
  month:    "2-digit",
  day:      "2-digit",
});

/**
 * Formate une Date au format YYYY-MM-DD selon le fuseau Europe/Paris.
 *
 * @param date Date à formater (par défaut : maintenant)
 * @returns "YYYY-MM-DD" en heure de Paris
 *
 * @example
 *   parisDateISO(new Date())             // "2026-05-08" si on est le 8 mai à Paris
 *   parisDateISO(new Date("2026-05-09T01:00:00+02:00"))  // "2026-05-09"
 */
export function parisDateISO(date: Date = new Date()): string {
  return PARIS_DATE_FMT.format(date);
}

/**
 * Retourne la date d'aujourd'hui (YYYY-MM-DD) selon Europe/Paris.
 * Remplace le pattern bugué `new Date().toISOString().split("T")[0]`.
 */
export function todayParisISO(): string {
  return parisDateISO(new Date());
}

/**
 * Retourne la date de demain (YYYY-MM-DD) selon Europe/Paris.
 *
 * Note : on ajoute 24h à `Date.now()` puis on formate avec timeZone Paris.
 * Le piège DST switch (un jour par an, ~3h du matin où l'heure recule/avance)
 * est négligeable car +24h reste dans la fenêtre du jour suivant à Paris.
 */
export function tomorrowParisISO(): string {
  return parisDateISO(new Date(Date.now() + 24 * 60 * 60 * 1000));
}

/**
 * Retourne la date de N jours après aujourd'hui (YYYY-MM-DD) selon Paris.
 *
 * @param days Nombre de jours à ajouter (peut être négatif pour les jours passés)
 *
 * @example
 *   parisDateISOPlusDays(-1)  // hier à Paris
 *   parisDateISOPlusDays(7)   // dans 1 semaine à Paris
 */
export function parisDateISOPlusDays(days: number): string {
  return parisDateISO(new Date(Date.now() + days * 24 * 60 * 60 * 1000));
}

const PARIS_TIME_FMT = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/**
 * Minutes écoulées depuis minuit en heure de Paris (0–1439).
 * Sert au calcul de l'état « live » d'une course (à venir / imminente /
 * résultat imminent) indépendamment du fuseau du serveur (UTC sur Workers).
 *
 * @example  parisMinutesOfDay()  // 870 s'il est 14h30 à Paris
 */
export function parisMinutesOfDay(date: Date = new Date()): number {
  const parts = PARIS_TIME_FMT.formatToParts(date);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? "0") % 24;
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return h * 60 + m;
}

const PARIS_COMPLET_FMT = new Intl.DateTimeFormat("en-US", {
  timeZone: "Europe/Paris",
  hourCycle: "h23",
  year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit",
});

/** Décalage (minutes) de l'heure de Paris sur UTC à l'instant donné : 120 en été, 60 en hiver. */
function decalageParisMinutes(instantUtcMs: number): number {
  const parts = PARIS_COMPLET_FMT.formatToParts(new Date(instantUtcMs));
  const lire = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? "0");
  const commeUtc = Date.UTC(lire("year"), lire("month") - 1, lire("day"), lire("hour") % 24, lire("minute"), lire("second"));
  return Math.round((commeUtc - instantUtcMs) / 60000);
}

/**
 * Instant exact d'une heure de Paris. La base stocke `courses.heure_depart`
 * en heure de PARIS : la lire comme de l'UTC (`new Date(date + "T" + heure + "Z")`)
 * décalait le compte à rebours des fiches course de 2 h en été (1 h en hiver).
 *
 * @example parisVersUtc("2026-10-02", "16:20:00")  // 2026-10-02T14:20:00Z
 */
export function parisVersUtc(dateISO: string, heure: string): Date | null {
  const d = String(dateISO || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const h = String(heure || "").match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!d || !h) return null;
  const naif = Date.UTC(Number(d[1]), Number(d[2]) - 1, Number(d[3]), Number(h[1]), Number(h[2]), Number(h[3] ?? 0));
  // Deux passes : le décalage se lit à l'instant visé (sûr autour des changements d'heure).
  const premier = naif - decalageParisMinutes(naif) * 60000;
  return new Date(naif - decalageParisMinutes(premier) * 60000);
}
