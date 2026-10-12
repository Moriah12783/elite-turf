/**
 * lib/courses/performances-pmu.ts
 *
 * Dernières courses des partants d'après le PMU (`/performances-detaillees/pretty`,
 * 5 courses au plus par cheval) : allocation de chaque course et place obtenue.
 * Sert à l'onglet « Allocations » de la fiche course et au tableau de l'e-mail
 * des brouillons du Quinté+ : une musique régulière ne dit pas face à quel lot
 * elle a été obtenue.
 *
 * Lecteurs PURS, testés sur une vraie réponse du 12/10/2026. Aucune valeur
 * n'est déduite : champ absent = null. Aucun import : ce fichier est aussi
 * chargé par l'onglet côté navigateur.
 */
export interface PerformancePmu {
  /** Jour de la course (ms) : minuit à l'heure de Paris — à afficher dans ce fuseau, sinon la veille. */
  date: number | null;
  hippodrome: string | null;
  /** Allocation totale de la course (euros). */
  allocation: number | null;
  /** Place chiffrée du cheval ; null s'il n'a pas été classé. */
  place: number | null;
  /** PLACE, NON_PLACE, DISQUALIFIE_POUR_ALLURE_IRREGULIERE, ARRETE, TOMBE… */
  statut: string | null;
}

export interface ChevalPerformances {
  numero: number;
  nom: string | null;
  /** De la plus récente à la plus ancienne. */
  courses: PerformancePmu[];
}

function positif(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function texte(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/** PUR : réponse PMU → un cheval par partant (même sans course connue), courses de la plus récente à la plus ancienne. */
export function lirePerformancesPmu(json: unknown): ChevalPerformances[] {
  const liste = json && typeof json === "object" ? (json as { participants?: unknown }).participants : null;
  if (!Array.isArray(liste)) return [];
  const out: ChevalPerformances[] = [];
  for (const brut of liste as any[]) {
    const numero = Number(brut?.numPmu);
    if (!Number.isFinite(numero) || numero <= 0) continue;
    const courues: any[] = Array.isArray(brut?.coursesCourues) ? brut.coursesCourues : [];
    const courses = courues
      .map((c, i) => {
        const lui = Array.isArray(c?.participants) ? (c.participants as any[]).find((x) => x?.itsHim) : null;
        const perf: PerformancePmu = {
          date: positif(c?.date),
          hippodrome: texte(c?.hippodrome),
          allocation: positif(c?.allocation),
          place: positif(lui?.place?.place),
          statut: texte(lui?.place?.statusArrivee),
        };
        return { perf, rang: i };
      })
      .sort((a, b) => (a.perf.date !== null && b.perf.date !== null && b.perf.date !== a.perf.date ? b.perf.date - a.perf.date : a.rang - b.rang))
      .map((x) => x.perf);
    out.push({ numero, nom: texte(brut?.nomCheval), courses });
  }
  return out;
}

/** PUR : réponse « course » du PMU → allocation de la course du jour (euros). */
export function lireAllocationCoursePmu(json: unknown): number | null {
  return json && typeof json === "object" ? positif((json as { montantPrix?: unknown }).montantPrix) : null;
}

/** « 1er », « 6e » ; sans place : « Disq. », « Arrêté », « Tombé », « Non placé » ; inconnu : « — ». */
export function libellePlace(p: Pick<PerformancePmu, "place" | "statut">): string {
  if (p.place !== null) return p.place === 1 ? "1er" : `${p.place}e`;
  const s = p.statut || "";
  if (s.indexOf("DISQUALIFIE") === 0) return "Disq.";
  if (s === "ARRETE") return "Arrêté";
  if (s === "TOMBE") return "Tombé";
  if (s === "NON_PLACE") return "Non placé";
  return "—";
}

/** 19200 → « 19 k€ ». */
export function allocationEnMilliers(a: number): string {
  const k = Math.round(a / 1000);
  return k < 1 ? "<1 k€" : `${k} k€`;
}

/** La course passée valait au moins celle du jour. Montant inconnu : jamais mis en avant. */
export function auNiveauDuJour(allocation: number | null, allocationJour: number | null): boolean {
  return allocation !== null && allocationJour !== null && allocation >= allocationJour;
}
