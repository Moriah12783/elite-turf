/**
 * lib/ai-pronostics/source-crawlers/lonaci.ts
 *
 * Crawler LONACI (Côte d'Ivoire) — source PRIMARY/AFRICA_AVAILABILITY.
 *
 * 🎯 RÔLE
 *   Récupère la liste des courses du jour disponibles sur LONACI via
 *   l'API publique de la plateforme FlexBet Software. Une course présente
 *   ici → validation VALIDATION_LONACI_DIRECTE possible (cahier §9.2).
 *
 * 🔌 ENDPOINT
 *   GET https://api.lonacionline.flexbet-software.com:14443/sport-gateway/v1/hippique/get_active_games
 *   - Public, pas d'auth
 *   - CORS ouvert (Access-Control-Allow-Origin: *)
 *   - Format JSON ~180KB, ~1s
 *
 * 📦 STRUCTURE RÉPONSE (extraits utiles)
 *   {
 *     data: {
 *       HP: [                                    // tableau réunions hippiques
 *         {
 *           nReunion:  1,                        // numéro réunion (1, 2, 3…)
 *           libelle:   "PARIS-VINCENNES",        // nom hippodrome
 *           races: [
 *             {
 *               course_number: 1,                // numéro course
 *               libelle:       "PRIX DE RIQUEWIHR",
 *               racedt:        "2026-05-13 09:05:00",
 *               partantnb:     12,
 *               particularite: "Attelé",         // → discipline
 *               statut_course: "Fin de course" | "Programmée" | etc.
 *             }
 *           ]
 *         }
 *       ]
 *     }
 *   }
 *
 * 🛡️ Tolérance d'erreur : retourne `null` plutôt que de jeter, le caller
 *   (orchestrateur) traitera l'absence comme "sources indisponibles".
 */

const LONACI_API_BASE = "https://api.lonacionline.flexbet-software.com:14443/sport-gateway/v1";
const LONACI_USER_AGENT = "EliteTurfBot/1.0 (+https://elite-turf.fr)";
const LONACI_TIMEOUT_MS = 15_000;

// ─────────────────────────────────────────────────────────────────────────
// Types — modélisation minimale de la réponse API
// ─────────────────────────────────────────────────────────────────────────

export interface LonaciRace {
  course_number:  number;
  libelle:        string;          // ex: "PRIX DE RIQUEWIHR"
  racedt:         string;          // "YYYY-MM-DD HH:MM:SS"
  partantnb:      number;
  particularite?: string;          // "Attelé" | "Monté" | "Plat" | "Haies" | "Steeple"
  statut_course?: string;          // "Programmée" | "Fin de course" | etc.
  numero?:        number;          // ID interne LONACI
  status?:        number;
  reunion_num?:   string;
}

export interface LonaciReunion {
  nReunion: number;                // 1, 2, 3...
  libelle:  string;                // hippodrome en MAJUSCULES (ex: "PARIS-VINCENNES")
  rd?:      string;                // date réunion
  numero?:  number;
  races:    LonaciRace[];
}

// ─────────────────────────────────────────────────────────────────────────
// Fetcher
// ─────────────────────────────────────────────────────────────────────────

/**
 * Récupère toutes les réunions hippiques actives sur LONACI (jour courant).
 *
 * @returns Tableau de réunions ou null si l'API n'est pas joignable.
 *   Le caller doit gérer le null (ne pas throw — la chaîne doit rester
 *   resilient face à une API LONACI down).
 */
export async function fetchLonaciActiveGames(): Promise<LonaciReunion[] | null> {
  const url = `${LONACI_API_BASE}/hippique/get_active_games`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LONACI_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "Accept":     "application/json",
        "User-Agent": LONACI_USER_AGENT,
      },
      signal: controller.signal,
      // Cache désactivé : on veut toujours la donnée fraîche pour le cron
      cache: "no-store",
    });

    if (!res.ok) {
      console.error(`[lonaci] HTTP ${res.status} on ${url}`);
      return null;
    }

    const body = await res.json() as { data?: { HP?: unknown } };
    const hp = body?.data?.HP;

    if (!Array.isArray(hp)) {
      console.error("[lonaci] data.HP absent ou pas un array");
      return null;
    }

    // Normalisation défensive
    return hp.map((r: any): LonaciReunion => ({
      nReunion: Number(r.nReunion) || 0,
      libelle:  String(r.libelle ?? r.hippodrome ?? "").trim(),
      rd:       r.rd ?? undefined,
      numero:   r.numero != null ? Number(r.numero) : undefined,
      races:    Array.isArray(r.races) ? r.races.map((c: any): LonaciRace => ({
        course_number:  Number(c.course_number ?? c.numCourse ?? 0),
        libelle:        String(c.libelle ?? "").trim(),
        racedt:         String(c.racedt ?? ""),
        partantnb:      Number(c.partantnb ?? c.partantNb ?? 0),
        particularite:  c.particularite ?? undefined,
        statut_course:  c.statut_course  ?? undefined,
        numero:         c.numero != null ? Number(c.numero) : undefined,
        status:         c.status != null ? Number(c.status) : undefined,
        reunion_num:    c.reunion_num != null ? String(c.reunion_num) : undefined,
      })) : [],
    })).filter((r) => r.nReunion > 0 && r.races.length > 0);

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("aborted")) {
      console.error(`[lonaci] timeout après ${LONACI_TIMEOUT_MS}ms`);
    } else {
      console.error(`[lonaci] fetch failed: ${msg}`);
    }
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Helpers de matching
// ─────────────────────────────────────────────────────────────────────────

/**
 * Extrait la date YYYY-MM-DD depuis le champ `racedt` de LONACI.
 */
export function lonaciDateFromRacedt(racedt: string): string | null {
  const m = racedt.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

/**
 * Mappe la particularité LONACI vers la discipline cahier des charges.
 * - "Attelé"  → TROT_ATTELE
 * - "Monté"   → TROT_MONTE
 * - "Plat"    → PLAT
 * - "Haies"   → HAIES
 * - "Steeple" → STEEPLE
 */
export function mapLonaciDiscipline(particularite: string | undefined): string | null {
  if (!particularite) return null;
  const p = particularite.toLowerCase();
  if (p.includes("attel"))         return "TROT_ATTELE";
  if (p.includes("monté") || p.includes("monte")) return "TROT_MONTE";
  if (p.includes("plat"))          return "PLAT";
  if (p.includes("steeple"))       return "STEEPLE";
  if (p.includes("haie"))          return "HAIES";
  return null;
}

/**
 * Normalise un nom d'hippodrome pour le matching (uppercase, sans accents,
 * sans tirets/espaces multiples).
 *   "PARIS-VINCENNES" → "PARISVINCENNES"
 *   "Cagnes-sur-Mer"  → "CAGNESSURMER"
 */
export function normalizeHippodromeName(name: string | null | undefined): string {
  if (!name) return "";
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")    // supprime diacritiques
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}
