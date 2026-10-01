/**
 * Heure locale de départ d'une course pour un pays (brief « pages pays » du
 * 01/10/2026, §3 bloc 1).
 *
 * Les heures de course en base sont à l'heure de PARIS. Le décalage avec un
 * pays africain change deux fois par an — quand la France passe à l'heure
 * d'été ou d'hiver (le 25/10/2026, tous les départs reculent d'une heure en
 * Afrique) — et les règles locales changent aussi : le Maroc est repassé à
 * l'heure UTC permanente le 20/09/2026 (base horaire IANA 2026c ; avant, UTC+1
 * sauf pendant le Ramadan). On ne l'écrit donc jamais en dur : on passe par
 * l'instant réel (UTC) puis par le fuseau IANA du pays (`Intl`).
 *
 * ⚠️ Le résultat n'est juste que si la base horaire de l'environnement est à
 * jour (≥ 2026c pour le Maroc ; Node 24.14 embarque la 2025c). Vérifier celle
 * du Worker Cloudflare avant d'afficher une heure marocaine.
 *
 * null si la date ou l'heure est illisible : jamais une heure devinée.
 */

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Parties d'un instant vu dans un fuseau donné. */
function partiesDans(instant: number, fuseau: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: fuseau,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(new Date(instant));
  const val = (type: string) => {
    for (let i = 0; i < parts.length; i++) if (parts[i].type === type) return parts[i].value;
    return "";
  };
  return {
    date: val("year") + "-" + val("month") + "-" + val("day"),
    heure: (val("hour") === "24" ? "00" : val("hour")) + ":" + val("minute"),
  };
}

/** Instant (ms UTC) d'une heure affichée à Paris ce jour-là ; null si illisible. */
export function instantDepuisParis(date: string, heureParis: string | null | undefined): number | null {
  if (!date || !DATE_RE.test(date) || !heureParis) return null;
  const m = /^(\d{2}):(\d{2})/.exec(heureParis);
  if (!m) return null;
  // Instant « comme si » l'heure de Paris était déjà en UTC, puis correction
  // du décalage réel de Paris à cet instant (1 h l'hiver, 2 h l'été).
  const naif = Date.parse(date + "T" + m[1] + ":" + m[2] + ":00Z");
  if (isNaN(naif)) return null;
  const vu = partiesDans(naif, "Europe/Paris");
  const vueDeParis = Date.parse(vu.date + "T" + vu.heure + ":00Z");
  return naif - (vueDeParis - naif);
}

export interface HeureLocale {
  /** « HH:MM » à l'heure du pays. */
  heure: string;
  /** Date locale « AAAA-MM-JJ » (peut être le lendemain : course tardive vue de l'océan Indien). */
  date: string;
  /** true si la date locale diffère de la date de la course à Paris. */
  autreJour: boolean;
}

/**
 * Heure de départ dans le fuseau IANA `fuseau` (ex. "Africa/Ouagadougou")
 * d'une course prévue à `heureParis` le `date` (heure de Paris).
 */
export function heureLocaleDepuisParis(
  date: string,
  heureParis: string | null | undefined,
  fuseau: string,
): HeureLocale | null {
  const instant = instantDepuisParis(date, heureParis);
  if (instant === null) return null;
  try {
    const local = partiesDans(instant, fuseau);
    return { heure: local.heure, date: local.date, autreJour: local.date !== date };
  } catch {
    return null; // fuseau inconnu
  }
}
