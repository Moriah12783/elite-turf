/**
 * Helpers temporels pour articles blog auto-générés.
 *
 * Format semaine ISO 8601 (YYYY-WNN) : standard FR/EU, 1ère semaine = celle
 * contenant le 4 janvier (donc commence souvent le lundi 29 déc ou 1 jan).
 * Ex : 2026-W19 = semaine du lundi 4 mai au dimanche 10 mai 2026.
 *
 * Format mois (YYYY-MM) : trivial, 2026-05 = mai 2026.
 *
 * Tous les calculs se font en UTC pour éviter les off-by-one timezone.
 */

const WEEK_RE  = /^(\d{4})-W(\d{2})$/;
const MONTH_RE = /^(\d{4})-(\d{2})$/;

export const MOIS_LABELS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

// ── Semaines ISO ─────────────────────────────────────────────────────────────

export function isValidWeekParam(s: string | undefined | null): s is string {
  if (!s || !WEEK_RE.test(s)) return false;
  const m = s.match(WEEK_RE);
  if (!m) return false;
  const week = parseInt(m[2], 10);
  return week >= 1 && week <= 53;
}

/** Semaine ISO courante (UTC) au format YYYY-WNN. */
export function currentWeekISO(): string {
  return getWeekISOFromDate(new Date());
}

/** Convertit Date → "YYYY-WNN" ISO 8601. */
export function getWeekISOFromDate(d: Date): string {
  // Algorithme ISO 8601 standard
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7; // 1=lundi, 7=dimanche (ISO)
  date.setUTCDate(date.getUTCDate() + 4 - dayNum); // jeudi de la même semaine
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${weekNum.toString().padStart(2, "0")}`;
}

/** Renvoie la fenêtre [debut, fin] (YYYY-MM-DD) pour une semaine ISO donnée. */
export function getWeekDateRange(weekStr: string): { debut: string; fin: string } {
  const m = weekStr.match(WEEK_RE);
  if (!m) throw new Error(`Invalid week format: ${weekStr}`);
  const year = parseInt(m[1], 10);
  const week = parseInt(m[2], 10);
  // Lundi de la semaine N : 4 jan + (N-1)*7, puis recule au lundi le plus proche
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - (jan4Day - 1) + (week - 1) * 7);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  return {
    debut: monday.toISOString().split("T")[0],
    fin:   sunday.toISOString().split("T")[0],
  };
}

/** "Semaine 19 — du 4 au 10 mai 2026" pour titres SEO/UI. */
export function formatWeekHumanLong(weekStr: string): string {
  const m = weekStr.match(WEEK_RE);
  if (!m) return weekStr;
  const week = parseInt(m[2], 10);
  const { debut, fin } = getWeekDateRange(weekStr);
  const debutD = new Date(debut + "T12:00:00");
  const finD   = new Date(fin   + "T12:00:00");
  const sameMonth = debutD.getUTCMonth() === finD.getUTCMonth();
  const debutFmt = sameMonth
    ? debutD.getUTCDate().toString()
    : debutD.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
  const finFmt = finD.toLocaleDateString("fr-FR", {
    day: "numeric", month: "long", year: "numeric",
  });
  return `Semaine ${week} — du ${debutFmt} au ${finFmt}`;
}

// ── Mois ─────────────────────────────────────────────────────────────────────

export function isValidMonthParam(s: string | undefined | null): s is string {
  if (!s || !MONTH_RE.test(s)) return false;
  const m = s.match(MONTH_RE);
  if (!m) return false;
  const month = parseInt(m[2], 10);
  return month >= 1 && month <= 12;
}

/** Mois courant (UTC) format "YYYY-MM". */
export function currentMonth(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${(d.getUTCMonth() + 1).toString().padStart(2, "0")}`;
}

/** Renvoie la fenêtre [debut, fin] (YYYY-MM-DD) pour un mois "YYYY-MM". */
export function getMonthDateRange(monthStr: string): { debut: string; fin: string } {
  const m = monthStr.match(MONTH_RE);
  if (!m) throw new Error(`Invalid month format: ${monthStr}`);
  const year  = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  const debut = new Date(Date.UTC(year, month - 1, 1));
  const fin   = new Date(Date.UTC(year, month, 0)); // dernier jour du mois (jour 0 du suivant)
  return {
    debut: debut.toISOString().split("T")[0],
    fin:   fin.toISOString().split("T")[0],
  };
}

/** "Mai 2026" */
export function formatMonthHuman(monthStr: string): string {
  const m = monthStr.match(MONTH_RE);
  if (!m) return monthStr;
  const month = parseInt(m[2], 10);
  return `${MOIS_LABELS[month - 1]} ${m[1]}`;
}

// ── Génération des paramètres statiques ─────────────────────────────────────

/** Pré-rendre les 12 dernières semaines + courante. */
export function generateRecentWeekParams(): { semaine: string }[] {
  const out: { semaine: string }[] = [];
  const today = new Date();
  for (let i = 0; i < 13; i++) {
    const d = new Date(today.getTime() - i * 7 * 24 * 3600 * 1000);
    out.push({ semaine: getWeekISOFromDate(d) });
  }
  return out;
}

/** Pré-rendre les 12 derniers mois + courant. */
export function generateRecentMonthParams(): { mois: string }[] {
  const out: { mois: string }[] = [];
  const today = new Date();
  for (let i = 0; i < 13; i++) {
    const d = new Date(today.getUTCFullYear(), today.getUTCMonth() - i, 1);
    const yyyy = d.getUTCFullYear();
    const mm   = (d.getUTCMonth() + 1).toString().padStart(2, "0");
    out.push({ mois: `${yyyy}-${mm}` });
  }
  return out;
}
