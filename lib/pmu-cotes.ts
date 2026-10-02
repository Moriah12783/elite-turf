/**
 * lib/pmu-cotes.ts
 *
 * Cotes PMU en direct d'une course (onglet « Côtes en direct » des fiches).
 *
 * POURQUOI CE MODULE EXISTE
 * -------------------------
 * L'onglet appelait `/partants/{YYYYMMDD}/R{R}/C{C}` : l'API PMU répond 420
 * (bloqué) depuis l'été, et l'onglet affichait « Côtes non encore disponibles »
 * sur TOUTES les courses (constat du 02/10/2026). L'endpoint qui répond est
 * `/programme/{DDMMYYYY}/R{R}/C{C}/participants`.
 *
 * CE QUE DONNE LE PMU (relevé toutes les 20 s le 02/10/2026)
 * ----------------------------------------------------------
 *   - `dernierRapportDirect` : cote probable du simple gagnant, horodatée
 *     (`dateRapport`). Environ une mise à jour par quart d'heure loin du
 *     départ, toutes les 20 à 45 s dans la dernière demi-heure, figée à la
 *     clôture (départ réel, parfois une minute après l'heure prévue) ;
 *   - `dernierRapportReference` : la photo prise ~30 min avant le départ.
 * La cote définitive, celle qui paie, n'existe qu'à la clôture.
 */
import { isoVersDdmmyyyy } from "@/lib/sync/pmu-arrivees";

export interface CotePmu {
  numero: number;
  nom: string;
  nonPartant: boolean;
  /** Cote directe (rapport probable simple gagnant) ; null tant que le PMU n'en publie pas. */
  cote: number | null;
  /** Horodatage PMU de cette cote (ms). */
  coteMaj: number | null;
  /** « + » : cote en hausse (cheval délaissé) ; « - » : en baisse (cheval joué). */
  tendance: "+" | "-" | null;
  /** Cote de référence (photo prise ~30 min avant le départ). */
  coteReference: number | null;
  jockey: string | null;
}

function positif(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** PUR : réponse `/participants` du PMU → cotes (testé). */
export function lireCotesPmu(json: unknown): CotePmu[] {
  const liste = json && typeof json === "object" ? (json as { participants?: unknown }).participants : null;
  if (!Array.isArray(liste)) return [];
  const out: CotePmu[] = [];
  for (const brut of liste as any[]) {
    const numero = Number(brut?.numPmu);
    if (!Number.isFinite(numero) || numero <= 0) continue;
    const direct = brut?.dernierRapportDirect ?? null;
    const reference = brut?.dernierRapportReference ?? null;
    const t = direct?.indicateurTendance;
    out.push({
      numero,
      nom: String(brut?.nom ?? ""),
      nonPartant: String(brut?.statut ?? "").toUpperCase() === "NON_PARTANT",
      cote: positif(direct?.rapport),
      coteMaj: positif(direct?.dateRapport),
      tendance: t === "+" || t === "-" ? t : null,
      coteReference: positif(reference?.rapport),
      // Le PMU range le jockey (plat) comme le driver (trot) dans `driver`.
      jockey: typeof brut?.driver === "string" && brut.driver.trim() ? brut.driver.trim() : null,
    });
  }
  return out;
}

/** « FREEDOM (NOR) » → « FREEDOM » : majuscules sans accents, sans suffixe de pays. */
export function nomCheval(nom: string | null | undefined): string {
  return String(nom == null ? "" : nom)
    .replace(/\([^)]*\)/g, " ")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toUpperCase().replace(/[^A-Z0-9]+/g, "");
}

/**
 * Les partants PMU sont bien ceux de notre course : au moins 60 % de nos
 * chevaux s'y retrouvent. (date, R, C) ne suffit pas à identifier une course
 * (copies d'une source secondaire mal numérotées) : sans ce contrôle, la fiche
 * afficherait les cotes d'une autre course. Avec moins de 3 noms connus, on
 * ne peut rien affirmer → false.
 */
export function memesPartants(nomsBase: string[], nomsPmu: string[]): boolean {
  const base = nomsBase.map(nomCheval).filter(Boolean);
  if (base.length < 3) return false;
  const pmu = nomsPmu.map(nomCheval);
  let communs = 0;
  for (let i = 0; i < base.length; i++) if (pmu.indexOf(base[i]) !== -1) communs++;
  return communs / base.length >= 0.6;
}

export interface FavoriPmu {
  numero: number;
  nom: string;
  cote: number;
  /** Horodatage PMU de cette cote (ms). */
  coteMaj: number | null;
}

/**
 * PUR : le favori PMU = la cote directe la plus basse parmi les partants.
 * null si le PMU n'a rien répondu, n'a publié aucune cote, ou parle d'une autre
 * course (même contrôle d'identité que l'onglet « Côtes en direct »).
 */
export function favoriPmu(cotes: CotePmu[] | null, nomsBase: string[]): FavoriPmu | null {
  if (!cotes || !memesPartants(nomsBase, cotes.map((c) => c.nom))) return null;
  let favori: FavoriPmu | null = null;
  for (const c of cotes) {
    if (c.nonPartant || c.cote === null) continue;
    if (!favori || c.cote < favori.cote) favori = { numero: c.numero, nom: c.nom, cote: c.cote, coteMaj: c.coteMaj };
  }
  return favori;
}

const PMU_DIRECT = "https://online.turfinfo.api.pmu.fr";
const PMU_PROXY = (process.env.PMU_PROXY_URL || "https://pmu-proxy.manuel-conti2008.workers.dev").replace(/\/$/, "");
const PMU_HEADERS = {
  "Accept": "application/json, text/plain, */*",
  "Accept-Language": "fr-FR,fr;q=0.9",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Referer": "https://www.pmu.fr/",
  "Origin": "https://www.pmu.fr",
};

/**
 * Cotes en direct d'une course. `null` = PMU injoignable : l'appelant NE DOIT
 * PAS en conclure « pas de cote ».
 */
export async function fetchCotesPmu(dateISO: string, R: number, C: number, timeoutMs = 4000): Promise<CotePmu[] | null> {
  const chemin = `/rest/client/1/programme/${isoVersDdmmyyyy(dateISO)}/R${R}/C${C}/participants`;
  for (const base of [PMU_PROXY, PMU_DIRECT]) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(base + chemin, { headers: PMU_HEADERS, cache: "no-store", signal: ctrl.signal });
      clearTimeout(timer);
      if (!res.ok) continue;
      return lireCotesPmu(await res.json());
    } catch {
      clearTimeout(timer);
      /* base suivante */
    }
  }
  return null;
}
