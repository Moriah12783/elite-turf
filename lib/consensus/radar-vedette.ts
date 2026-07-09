/**
 * « Le Radar de la presse » — données publiques du CONSENSUS DE LA PRESSE de la
 * course vedette du jour, pour la home (visiteurs + inscrits gratuits).
 *
 * SOURCE = `consensus_drafts` (brouillon déposé chaque jour par le pipeline
 * Cowork, ouvert/relu par l'admin → statut `reviewed`). On recalcule le
 * consensus avec le MÊME moteur pur que l'atelier (`buildConsensus`) → les
 * chiffres du Radar sont exactement ceux que l'admin voit. On enrichit les
 * cotes manquantes + les non-partants depuis la table `partants` (course liée),
 * comme le fait l'atelier.
 *
 * On n'expose QUE l'agrégat presse (base/value/coup + favori le plus cité) —
 * JAMAIS l'analyse/commentaire premium (`commentaires`), qui reste aux abonnés.
 *
 * Anti-fabrication : aucun brouillon aujourd'hui, ou sélection vide → `null`
 * (l'appelant retombe sur un repli, jamais de chiffres inventés).
 *
 * `shapeRadarFromConsensus` est PUR (testable) ; `getRadarVedette` fait les I/O.
 */
import { createServiceClient } from "@/lib/supabase/server";
import { buildConsensus, type PartantConsensus, type ConsensusResult } from "./engine";

export interface RadarVedette {
  hippodrome:    string | null;
  course:        string | null;   // "R1C5"
  nbPartants:    number | null;
  nbSources:     number;
  typePariLabel: string;
  base:          number[];
  value:         number[];
  coup:          number[];
  /** Cheval le plus cité par la presse (le « favori presse »). */
  favori:        { numero: number; citations: number; tauxPct: number } | null;
  /** Favori du MARCHÉ = plus basse cote RÉELLE PMU (jamais le placeholder 1,2 LONACI). */
  favoriMarche:  { numero: number; cote: number } | null;
}

export interface RadarMeta {
  hippodrome?: string | null;
  course?:     string | null;
  nbPartants?: number | null;
  typePari?:   string | null;
}

const PARI_LABEL: Record<string, string> = {
  QUINTE_PLUS: "Quinté+",
  QUARTE_PLUS: "Quarté+",
  QUARTE:      "Quarté+",
  TIERCE:      "Tiercé",
};

/**
 * Transforme la sortie de `buildConsensus` (+ méta course) en données du Radar.
 * PUR. On prend la sélection **PRO** (base 4 / value 3 / coup 1) — la lecture
 * validée avec le PO (teaser généreux, distinct du pronostic premium). Renvoie
 * `null` si rien d'exploitable (repli côté appelant).
 */
export function shapeRadarFromConsensus(
  result: ConsensusResult | null | undefined,
  meta: RadarMeta,
  favoriMarche: RadarVedette["favoriMarche"] = null,
): RadarVedette | null {
  if (!result || !result.pro) return null;
  const base  = Array.isArray(result.pro.base)  ? result.pro.base  : [];
  const value = Array.isArray(result.pro.value) ? result.pro.value : [];
  const coup  = Array.isArray(result.pro.coup)  ? result.pro.coup  : [];
  if (base.length === 0 && value.length === 0 && coup.length === 0) return null;

  // Favori presse = le plus cité PARMI LES PARTANTS (un non-partant est ignoré).
  let fav: { numero: number; citations: number; taux: number } | null = null;
  for (const p of result.partants || []) {
    if (p.nonPartant) continue;
    if (!fav || p.citations > fav.citations) {
      fav = { numero: p.numero, citations: p.citations, taux: p.tauxCitation };
    }
  }

  return {
    hippodrome:    meta.hippodrome ?? null,
    course:        meta.course ?? null,
    nbPartants:    meta.nbPartants ?? null,
    nbSources:     result.nbSources,
    typePariLabel: (meta.typePari && PARI_LABEL[meta.typePari]) || "La course vedette",
    base,
    value,
    coup,
    favori: fav
      ? { numero: fav.numero, citations: fav.citations, tauxPct: Math.round(fav.taux * 100) }
      : null,
    favoriMarche,
  };
}

/**
 * Favori DU MARCHÉ = la plus basse cote RÉELLE parmi les partants — **cotes PMU
 * uniquement** (`cote_source === "pmu"`), jamais le placeholder LONACI « 1,2 ».
 * PUR. `null` si aucune cote PMU fiable → on n'affiche rien plutôt qu'une fausse
 * info (anti-fabrication). Distinct du « favori presse » (le plus cité).
 */
export function pickFavoriMarche(
  rows: Array<{ numero?: unknown; cote?: unknown; cote_source?: unknown; non_partant?: unknown }> | null | undefined,
): { numero: number; cote: number } | null {
  let best: { numero: number; cote: number } | null = null;
  for (const r of rows ?? []) {
    if (r?.non_partant) continue;
    if (r?.cote_source !== "pmu") continue; // seulement les vraies cotes PMU
    const numero = Number(r?.numero);
    const cote = Number(r?.cote);
    if (!Number.isFinite(numero) || !Number.isFinite(cote) || cote <= 0) continue;
    if (!best || cote < best.cote) best = { numero, cote };
  }
  return best;
}

/** Date du jour en heure de Paris (le programme/les courses sont FR). */
function todayParis(): string {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit",
  })
    .format(new Date())
    .split("/")
    .reverse()
    .join("-");
}

/**
 * Récupère + calcule le consensus presse de la course vedette d'aujourd'hui.
 * Lecture serveur (service client). Ne throw jamais (null si indisponible → la
 * home ne casse pas, elle retombe sur le bloc de repli).
 */
export async function getRadarVedette(): Promise<RadarVedette | null> {
  try {
    const supabase = createServiceClient();
    const today = todayParis();

    // 1. Brouillon du jour (le plus récent non rejeté ; on préfère le Quinté+).
    const { data: drafts } = await supabase
      .from("consensus_drafts")
      .select("reunion_course, hippodrome, type_pari, nb_partants, nb_sources, course_id, citations, created_at")
      .eq("date_course", today)
      .neq("status", "rejected")
      .order("created_at", { ascending: false })
      .limit(8);
    if (!drafts || drafts.length === 0) return null;

    const draft: any = drafts.find((d: any) => d.type_pari === "QUINTE_PLUS") ?? drafts[0];
    const rawCitations = Array.isArray(draft.citations) ? draft.citations : [];
    if (rawCitations.length === 0) return null;

    // 2. Table de citations → entrée du moteur (+ non-partants signalés par le pipeline).
    const partants: PartantConsensus[] = [];
    const nonPartants: number[] = [];
    for (const c of rawCitations as any[]) {
      const numero = Number(c?.numero);
      if (!Number.isFinite(numero)) continue;
      if (c?.np) nonPartants.push(numero);
      partants.push({
        numero,
        citations: Number(c?.citations) || 0,
        bases: c?.bases != null ? Number(c.bases) : undefined,
        cote: c?.cote != null && Number.isFinite(Number(c.cote)) ? Number(c.cote) : null,
      });
    }

    // 3. Enrichir cotes manquantes + non-partants depuis `partants` (course liée),
    //    exactement comme l'atelier → même classement base/value/coup. On en
    //    profite pour calculer le FAVORI DU MARCHÉ (plus basse cote PMU réelle).
    let favoriMarche: RadarVedette["favoriMarche"] = null;
    if (draft.course_id) {
      const { data: parts } = await supabase
        .from("partants")
        .select("numero, cote, cote_source, non_partant")
        .eq("course_id", draft.course_id);
      if (parts && parts.length) {
        const coteByNum = new Map<number, number>();
        for (const p of parts as any[]) {
          const n = Number(p.numero);
          if (!Number.isFinite(n)) continue;
          if (p.non_partant) nonPartants.push(n);
          if (p.cote != null && Number.isFinite(Number(p.cote))) coteByNum.set(n, Number(p.cote));
        }
        for (const pc of partants) {
          if (pc.cote == null && coteByNum.has(pc.numero)) pc.cote = coteByNum.get(pc.numero)!;
        }
        favoriMarche = pickFavoriMarche(parts as any[]);
      }
    }

    // 4. Consensus (moteur pur, même que l'atelier).
    const result = buildConsensus(
      { nbSources: Number(draft.nb_sources) || partants.length, partants },
      { nonPartants },
    );

    return shapeRadarFromConsensus(result, {
      hippodrome: draft.hippodrome,
      course:     draft.reunion_course,
      nbPartants: draft.nb_partants,
      typePari:   draft.type_pari,
    }, favoriMarche);
  } catch {
    return null; // Supabase KO / réseau → repli, jamais d'erreur sur la home
  }
}
