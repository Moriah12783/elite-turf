/**
 * lib/brouillons-quinte/assembler.ts — contrôles d'entrée et assemblage des
 * deux lignes `pronostics` à partir de l'édition T-90 d'Argon (spec du
 * 16/10/2026, §8 à §10). PUR : la route fait les I/O.
 */
import { memesPartants, memeNom, nomCheval } from "@/lib/pmu-cotes";
import { cotesPlausibles } from "@/lib/cotes/fiabilite";
import { buildSelectionDetail, type SelectionDetailRow } from "@/lib/pronostics/selection-detail";
import { ROLE_ASSOCIE } from "@/lib/pronostics/selection-roles";
import type { AllocationsPmu, ParticipantPmu } from "./pmu";
import { SOURCE_BROUILLON } from "./fenetre";
import { TAILLE_SELECTION, type Confiance } from "./selection";
import type { CourseArgon } from "./argon";
import { composerArgon, confianceArgon, type CompositionArgon } from "./composition-argon";
import { analyseCourte, analyseComplete, heureGmt, type AvisArgon, type ChevalCommente, type ContexteCourse } from "./commentaires";
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
  /** La course chez Argon, déjà contrôlée (trouverCourseArgon + controlerChevauxArgon). */
  argon: CourseArgon;
  /** Allocations des dernières courses par numéro ; absentes ou null = PMU muet, rien n'est bloqué. */
  allocations?: AllocationsPmu | null;
}

export type ResultatAssemblage =
  | { ok: true; pro: LigneBrouillon; elite: LigneBrouillon; resume: ResumeBrouillons }
  | { ok: false; raison: RaisonEchec };

/** PUR : rang au marché des partants cotés : cote croissante, à égalité le numéro. */
function rangsAuMarche(participants: ParticipantPmu[]): Record<number, number> {
  const rangs: Record<number, number> = {};
  participants
    .filter((p) => !p.nonPartant && p.cote !== null)
    .sort((a, b) => (a.cote as number) - (b.cote as number) || a.numero - b.numero)
    .forEach((p, i) => { rangs[p.numero] = i + 1; });
  return rangs;
}

/** PUR : libellé de la colonne « Retenu » du tableau des musiques. */
function libelleRetenu(n: number, c: CompositionArgon): string | null {
  if (n === c.pivot) return "Base ⭐";
  if (c.bases.indexOf(n) !== -1) return "Base";
  const pro = c.valuesPro.indexOf(n) !== -1;
  const elite = c.valuesElite.indexOf(n) !== -1;
  const associe = c.associes.indexOf(n) !== -1;
  if (pro && elite) return "Value Pro + Elite";
  if (pro && associe) return "Value Pro · Associé";
  if (pro) return "Value Pro";
  if (elite) return "Value Elite";
  if (associe) return "Associé";
  return null;
}

/**
 * PUR : tableau des musiques de tous les chevaux, pour l'analyse de Steph.
 * Ordre du marché (cote croissante, à égalité le numéro), puis les chevaux sans
 * cote, puis les non-partants.
 */
function tableauPartants(
  participants: ParticipantPmu[],
  rangs: Record<number, number>,
  composition: CompositionArgon,
  allocations: AllocationsPmu | null,
): LigneMusique[] {
  const cotes = participants
    .filter((p) => !p.nonPartant && p.cote !== null)
    .sort((a, b) => rangs[a.numero] - rangs[b.numero]);
  const sansCote = participants.filter((p) => !p.nonPartant && p.cote === null).sort((a, b) => a.numero - b.numero);
  const nonPartants = participants.filter((p) => p.nonPartant).sort((a, b) => a.numero - b.numero);

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
      retenu: p.nonPartant ? null : libelleRetenu(p.numero, composition),
      allocations: allocations && allocations[p.numero] ? allocations[p.numero] : null,
    };
  };

  return cotes.map((p) => ligne(p, rangs[p.numero]))
    .concat(sansCote.map((p) => ligne(p, null)))
    .concat(nonPartants.map((p) => ligne(p, null)));
}

export function assemblerBrouillons(e: EntreeAssemblage): ResultatAssemblage {
  const participants = e.ctx.participants;
  const partants = participants.filter((p) => !p.nonPartant).map((p) => p.numero);
  const avantage: Record<number, number | null> = {};
  for (const c of e.argon.coureurs) avantage[c.numero] = c.avantage;

  const compose = composerArgon(e.argon.t90.argon8, partants, avantage);
  if (!compose.ok) return { ok: false, raison: compose.raison };
  const comp = compose.composition;

  // Un cheval retenu sans cote PMU n'a pas de rang au marché : on n'en invente pas.
  const rangs = rangsAuMarche(participants);
  const retenus = comp.bases.concat(comp.valuesPro, comp.valuesElite, comp.associes)
    .filter((n, i, t) => t.indexOf(n) === i);
  if (retenus.some((n) => rangs[n] === undefined)) return { ok: false, raison: "cotes_indisponibles" };

  const parNumero: Record<number, ParticipantPmu> = {};
  for (const p of participants) parNumero[p.numero] = p;
  const nomDe = (n: number): string => {
    if (parNumero[n]) return parNumero[n].nom;
    const coureur = e.argon.coureurs.find((c) => c.numero === n);
    return coureur ? coureur.nom : `n°${n}`;
  };
  const noms: Record<number, string> = {};
  for (const n of retenus) noms[n] = nomDe(n);
  const commente = (n: number): ChevalCommente => ({ numero: n, nom: nomDe(n), rang: rangs[n] });
  const resume = (n: number): ChevalResume => ({ numero: n, nom: nomDe(n) });

  let releveCotes: number | null = null;
  for (const n of retenus) {
    const maj = parNumero[n].coteMaj;
    if (maj !== null && (releveCotes === null || maj > releveCotes)) releveCotes = maj;
  }
  const ctx: ContexteCourse = { ...e.ctx, releveCotes, allocations: e.allocations ?? null };
  const confiance = confianceArgon(e.argon.etoiles);
  const nbElite = comp.bases.length + comp.valuesElite.length + comp.associes.length;
  const courte = analyseCourte(ctx, commente(comp.pivot), nbElite);
  // Plan de jeu Elite : couplé maître et sniper de l'édition T-90 scellée ; à défaut, le sniper du moment.
  const prono = e.argon.t90.prono;
  const avis: AvisArgon = {
    couple: prono && prono.coupleMaitre ? prono.bases.slice(0, 2) : null,
    sniper: prono && prono.sniper !== null
      ? { numero: prono.sniper, cote: prono.sniperCote }
      : e.argon.sniper,
  };

  const ligne = (niveau: "PRO" | "ELITE", values: number[], associes: number[], texte: string): LigneBrouillon => {
    const selection = comp.bases.concat(values, associes);
    const roles: Record<number, string> = {};
    for (const n of comp.bases) roles[n] = "BASE";
    for (const n of values) roles[n] = "OUTSIDER";
    for (const n of associes) roles[n] = ROLE_ASSOCIE;
    return {
      course_id: e.courseId,
      niveau_acces: niveau,
      type_pari: "QUINTE_PLUS",
      selection,
      // Pas de couplé : c'est Steph qui le choisit (décision du 16/10/2026).
      selection_detail: buildSelectionDetail({ selection, roles, pivot: comp.pivot, noms }),
      confiance,
      analyse_courte: courte,
      analyse_texte: texte,
      publie: false,
      date_publication: null,
      source: SOURCE_BROUILLON,
      auteur_id: null,
    };
  };

  const textePro = analyseComplete(ctx, "PRO", comp.bases.map(commente), comp.valuesPro.map(commente), []);
  const texteElite = analyseComplete(ctx, "ELITE", comp.bases.map(commente), comp.valuesElite.map(commente), comp.associes.map(commente), avis);

  return {
    ok: true,
    pro: ligne("PRO", comp.valuesPro, [], textePro),
    elite: ligne("ELITE", comp.valuesElite, comp.associes, texteElite),
    resume: {
      jour: e.ctx.dateISO,
      prix: e.ctx.prix,
      hippodrome: e.ctx.hippodrome,
      reunion: e.ctx.reunion,
      course: e.ctx.course,
      heureGmt: heureGmt(e.ctx.departUtc.getTime()),
      releve: releveCotes === null ? null : heureGmt(releveCotes),
      confiance,
      allocationJour: e.ctx.coursePmu ? e.ctx.coursePmu.allocation : null,
      pro: { base: comp.bases.map(resume), values: comp.valuesPro.map(resume) },
      elite: { base: comp.bases.map(resume), values: comp.valuesElite.map(resume), associes: comp.associes.map(resume) },
      argon: {
        lockGmt: e.argon.t90.lockGmt,
        argon8: e.argon.t90.argon8.map(resume),
        etoiles: e.argon.etoiles,
        deconseillee: e.argon.deconseillee,
        decision: e.argon.decision,
        nonPartants: comp.nonPartants.map(resume),
      },
      partants: tableauPartants(participants, rangs, comp, e.allocations ?? null),
      textes: { courte, pro: textePro, elite: texteElite },
    },
  };
}
