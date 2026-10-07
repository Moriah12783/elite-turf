/**
 * lib/brouillons-quinte/assembler.ts — contrôles d'entrée et assemblage des
 * deux lignes `pronostics` (spec §5, §8). PUR : la route fait les I/O.
 */
import { memesPartants, memeNom, nomCheval } from "@/lib/pmu-cotes";
import { cotesPlausibles } from "@/lib/cotes/fiabilite";
import { buildSelectionDetail, type SelectionDetailRow } from "@/lib/pronostics/selection-detail";
import type { NotreSelectionItem } from "@/lib/courses/notre-selection";
import type { ParticipantPmu } from "./pmu";
import { SOURCE_BROUILLON } from "./fenetre";
import {
  versChevauxClasses, decouperPro, choisirValuesElite, confianceDuMarche,
  TAILLE_SELECTION, type ChevalClasse, type Confiance,
} from "./selection";
import { analyseCourte, analyseComplete, heureGmt, type ChevalCommente, type ContexteCourse } from "./commentaires";
import type { RaisonEchec, ResumeBrouillons, ChevalResume, LigneMusique } from "./email";
import { dernieresPlaces, estFaute } from "./musique";

/** Partant de la base, tel que la route le lit. */
export interface PartantBase {
  numero: number;
  nom_cheval: string;
}

/**
 * PUR : les données PMU sont-elles exploitables ? null = oui. Ordre :
 * 1. PMU injoignable ;
 * 2. autre course (contrôle d'identité par les noms, piège déjà vécu 4 fois) ;
 * 3. partants incohérents : chaque partant coté du PMU doit exister en base
 *    sous le même numéro et le même nom. Les cotes PMU sont appliquées aux
 *    lignes de la base par numéro : sans ce contrôle, une base incomplète ou
 *    mal numérotée ferait écrire « Favori du marché » pour un cheval qui ne
 *    l'est pas (revue finale du 07/10/2026) ;
 * 4. cotes factices ;
 * 5. moins de 8 cotes.
 */
export function controlerDonneesPmu(base: PartantBase[], participants: ParticipantPmu[] | null): RaisonEchec | null {
  if (participants === null) return "pmu_injoignable";
  if (!memesPartants(base.map((b) => b.nom_cheval), participants.map((p) => p.nom))) return "course_pmu_non_reconnue";
  const partants = participants.filter((p) => !p.nonPartant);
  if (!partantsCoherents(base, partants)) return "partants_incoherents";
  if (!cotesPlausibles(partants.map((p) => p.cote))) return "cotes_factices";
  if (partants.filter((p) => p.cote !== null).length < TAILLE_SELECTION) return "cotes_indisponibles";
  return null;
}

/** PUR : chaque partant coté du PMU a, en base, une ligne au même numéro et au même nom. */
function partantsCoherents(base: PartantBase[], partantsPmu: ParticipantPmu[]): boolean {
  const nomParNumero: Record<number, string> = {};
  for (const b of base) nomParNumero[b.numero] = nomCheval(b.nom_cheval);
  for (const p of partantsPmu) {
    if (p.cote === null) continue;
    const nomBase = nomParNumero[p.numero];
    if (nomBase === undefined || !memeNom(nomBase, nomCheval(p.nom))) return false;
  }
  return true;
}

export interface LigneBrouillon {
  course_id: string;
  niveau_acces: "PRO" | "ELITE";
  type_pari: "QUINTE_PLUS";
  selection: number[];
  selection_detail: SelectionDetailRow[] | null;
  confiance: Confiance;
  analyse_courte: string;
  analyse_texte: string;
  publie: false;
  date_publication: null;
  source: typeof SOURCE_BROUILLON;
  auteur_id: null;
}

export interface EntreeAssemblage {
  courseId: string;
  /** Contexte de la course ; l'heure du relevé des cotes est calculée ici. */
  ctx: Omit<ContexteCourse, "releveCotes">;
  /** Les 8 favoris dans l'ordre du marché (buildNotreSelection). */
  top8: NotreSelectionItem[];
}

export type ResultatAssemblage =
  | { ok: true; pro: LigneBrouillon; elite: LigneBrouillon; resume: ResumeBrouillons }
  | { ok: false; raison: RaisonEchec };

/** PUR : le plus récent horodatage de cote parmi les chevaux classés. */
function releveDesCotes(classes: ChevalClasse[], participants: ParticipantPmu[]): number | null {
  let max: number | null = null;
  for (const c of classes) {
    for (const p of participants) {
      if (p.numero === c.numero && p.coteMaj !== null && (max === null || p.coteMaj > max)) max = p.coteMaj;
    }
  }
  return max;
}

/**
 * PUR : tableau des musiques de tous les chevaux, pour l'analyse de Steph.
 * Ordre du marché : cote croissante ; à cote égale, l'ordre des 8 favoris
 * (buildNotreSelection), puis le numéro. Chevaux sans cote ensuite, puis les
 * non-partants.
 */
function tableauPartants(
  participants: ParticipantPmu[],
  classes: ChevalClasse[],
  retenus: { pivot: number; base: number[]; valuesPro: number[]; valuesElite: number[] },
): LigneMusique[] {
  const rangClasse: Record<number, number> = {};
  for (const c of classes) rangClasse[c.numero] = c.rang;
  const ordre = (n: number) => (rangClasse[n] === undefined ? Infinity : rangClasse[n]);
  const cotes = participants
    .filter((p) => !p.nonPartant && p.cote !== null)
    .sort((a, b) => (a.cote as number) - (b.cote as number) || ordre(a.numero) - ordre(b.numero) || a.numero - b.numero);
  const sansCote = participants.filter((p) => !p.nonPartant && p.cote === null).sort((a, b) => a.numero - b.numero);
  const nonPartants = participants.filter((p) => p.nonPartant).sort((a, b) => a.numero - b.numero);

  const retenu = (n: number): string | null => {
    if (n === retenus.pivot) return "Base ⭐";
    if (retenus.base.indexOf(n) !== -1) return "Base";
    const pro = retenus.valuesPro.indexOf(n) !== -1;
    const elite = retenus.valuesElite.indexOf(n) !== -1;
    if (pro && elite) return "Value Pro + Elite";
    if (pro) return "Value Pro";
    if (elite) return "Value Elite";
    return null;
  };

  const ligne = (p: ParticipantPmu, rang: number | null): LigneMusique => {
    const places = dernieresPlaces(p.musique);
    return {
      numero: p.numero,
      nom: p.nom,
      nonPartant: p.nonPartant,
      cote: p.cote,
      rang,
      exAequo: rang !== null && cotes.filter((x) => x.cote === p.cote).length > 1,
      places,
      fautes: places === null ? null : places.filter(estFaute).length,
      retenu: p.nonPartant ? null : retenu(p.numero),
    };
  };

  return cotes.map((p, i) => ligne(p, i + 1))
    .concat(sansCote.map((p) => ligne(p, null)))
    .concat(nonPartants.map((p) => ligne(p, null)));
}

export function assemblerBrouillons(e: EntreeAssemblage): ResultatAssemblage {
  const classes = versChevauxClasses(e.top8, e.ctx.participants);
  const pro = decouperPro(classes);
  const elite = choisirValuesElite(classes);
  if (classes.length < TAILLE_SELECTION || !pro || !elite) return { ok: false, raison: "cotes_indisponibles" };

  const parNumero: Record<number, ChevalClasse> = {};
  const noms: Record<number, string> = {};
  for (const c of classes) {
    parNumero[c.numero] = c;
    noms[c.numero] = c.nom;
  }
  const commente = (n: number): ChevalCommente => ({ numero: n, nom: parNumero[n].nom, rang: parNumero[n].rang });
  const resume = (n: number): ChevalResume => ({ numero: n, nom: parNumero[n].nom });

  const releveCotes = releveDesCotes(classes, e.ctx.participants);
  const ctx: ContexteCourse = { ...e.ctx, releveCotes };
  const confiance = confianceDuMarche(parNumero[pro.pivot].cote);
  const courte = analyseCourte(ctx, commente(pro.pivot));

  const ligne = (niveau: "PRO" | "ELITE", base: number[], values: number[], texte: string): LigneBrouillon => {
    const selection = base.concat(values);
    const roles: Record<number, string> = {};
    for (const n of base) roles[n] = "BASE";
    for (const n of values) roles[n] = "OUTSIDER";
    return {
      course_id: e.courseId,
      niveau_acces: niveau,
      type_pari: "QUINTE_PLUS",
      selection,
      selection_detail: buildSelectionDetail({ selection, roles, pivot: pro.pivot, noms }),
      confiance,
      analyse_courte: courte,
      analyse_texte: texte,
      publie: false,
      date_publication: null,
      source: SOURCE_BROUILLON,
      auteur_id: null,
    };
  };

  return {
    ok: true,
    pro: ligne("PRO", pro.base, pro.values, analyseComplete(ctx, "PRO", pro.base.map(commente), pro.values.map(commente), [])),
    elite: ligne("ELITE", elite.base, elite.values, analyseComplete(ctx, "ELITE", elite.base.map(commente), elite.values.map(commente), elite.ecartes.map(commente))),
    resume: {
      jour: e.ctx.dateISO,
      prix: e.ctx.prix,
      hippodrome: e.ctx.hippodrome,
      reunion: e.ctx.reunion,
      course: e.ctx.course,
      heureGmt: heureGmt(e.ctx.departUtc.getTime()),
      releve: releveCotes === null ? null : heureGmt(releveCotes),
      confiance,
      pro: { base: pro.base.map(resume), values: pro.values.map(resume) },
      elite: {
        base: elite.base.map(resume),
        values: elite.values.map(resume),
        ecartes: elite.ecartes.map(resume),
        completeAvecFautifs: elite.completeAvecFautifs,
      },
      partants: tableauPartants(e.ctx.participants, classes, {
        pivot: pro.pivot,
        base: pro.base,
        valuesPro: pro.values,
        valuesElite: elite.values,
      }),
    },
  };
}
