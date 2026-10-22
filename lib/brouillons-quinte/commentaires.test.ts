import { describe, it, expect } from "vitest";
import {
  analyseCourte, analyseComplete, heureGmt, personne, ANALYSE_COURTE_MAX, MOTS_INTERDITS,
  type AvisArgon, type ChevalCommente, type ContexteCourse,
} from "./commentaires";
import { CTX, PARTICIPANTS } from "./__fixtures__/gobelins";
import { CTX_THEMIS } from "./__fixtures__/themis";
import { CTX_TOULOUSE as T } from "./__fixtures__/toulouse";
import { CTX_CLAIREFONTAINE as C } from "./__fixtures__/clairefontaine";
import { CTX_AUTEUIL as A } from "./__fixtures__/auteuil";

/** Rang au marché d'après les cotes PMU du contexte (non-partants exclus, égalités départagées par le numéro). */
function cheval(ctx: ContexteCourse, numero: number): ChevalCommente {
  const cotees = ctx.participants
    .filter((p) => !p.nonPartant && p.cote !== null)
    .sort((a, b) => (a.cote as number) - (b.cote as number) || a.numero - b.numero);
  return { numero, nom: ctx.participants.find((p) => p.numero === numero)!.nom, rang: cotees.findIndex((p) => p.numero === numero) + 1 };
}
const L = (ctx: ContexteCourse, nums: number[]) => nums.map((n) => cheval(ctx, n));
const titres = (t: string) => t.split("\n\n").map((x) => x.split("\n")[0]);
const section = (t: string, debut: string) => t.split("\n\n").find((x) => x.indexOf(debut) === 0) ?? "";
/** Lignes de tête des fiches chevaux (★ pivot, • base, ◇ value, 🤝 associé). */
const fiches = (t: string) => t.split("\n").filter((l) => /^(★ Notre Pivot — |• |◇ |🤝 )n°\d+ /.test(l));

// ── Modèle éditorial de Steph (22/10/2026), vraies données PMU ──────────────

const COURTE_TOULOUSE = [
  "Grand Prix de la Ville Rose — Toulouse (R1C1) | Trot attelé · 2 950 m · 13 partants. Épreuve européenne sur deux échelons de départ (recul de 25 m pour les n°8 à 13). Notre analyse place en tête GERICAULT (n°12, Th. Briand), favori du marché. Découvrez la sélection complète en 6 chevaux (Pro) et le plan de jeu élargi en 8 chevaux (Elite).",
].join("\n");

const PRO_TOULOUSE = [
  "LA COURSE & LES CONDITIONS",
  "• Épreuve : Quinté+ du mercredi 21 octobre 2026 — Grand Prix de la Ville Rose, Toulouse (R1C1)",
  "• Départ : 11h55 GMT (13h55 heure de Paris)",
  "• Profil : Trot attelé — 2 950 m — Corde à droite — 13 partants âgés de 6 à 10 ans",
  "• Configuration du parcours : Départ volté sur deux échelons. Les n°1 à 7 s'élancent en tête (2 950 m) tandis que les n°8 à 13 rendent 25 mètres (2 975 m).",
  "",
  "LA BASE SOLIDE (4 CHEVAUX)",
  "★ Notre Pivot — n°12 GERICAULT (Driver : Th. Briand | Entraîneur : V. Martens | Ferrure : D4 | +25 m)",
  "Favori du marché (1er). Modèle de régularité : 3 fois dans les 3 premiers lors de ses 5 dernières courses, sans faute.",
  "• n°10 FREEDOM (NOR) (Driver : O. Raffin | Entraîneur : O. Raffin | Ferrure : D4 | +25 m)",
  "2e favori du marché. En pleine possession de ses moyens avec 2 victoires sur ses 5 dernières sorties, sans la moindre faute d'allure.",
  "• n°13 ICARE DU BERYL (Driver : M. Criado | Entraîneur : Y. Lacombe | Ferrure : D4 | +25 m)",
  "3e du marché. Modèle de régularité : 4 fois dans les 3 premiers lors de ses 5 dernières courses, sans faute.",
  "• n°1 ENEA FONT (Driver : J. Chavatte | Entraîneur : S. Guarato | Ferrure : D4)",
  "4e du marché. Victorieux récemment (1 succès sur ses 5 dernières courses) et irréprochable dans ses allures.",
  "",
  "LES VALUES SPÉCULATIVES (2 CHEVAUX)",
  "◇ n°4 HARLEM DE L'ITON (Driver : M. Cinier | Entraîneur : D. Cinier | Ferrure : D4)",
  "5e du marché. Performant avec 3 succès sur ses 5 dernières courses malgré 1 faux pas à effacer.",
  "◇ n°5 GHOST DE BEAULIEU (Driver : P. Geray | Entraîneur : J. Asselie | Ferrure : DA, PP)",
  "7e du marché. Modèle de régularité : 4 fois dans les 3 premiers lors de ses 5 dernières courses, sans faute.",
  "",
  "SYNTHÈSE PRO (6 CHEVAUX)",
  "12 · 10 · 13 · 1 · 4 · 5 (Pivot : n°12 GERICAULT)",
  "",
  "À SAVOIR",
  "Cotes PMU relevées à 10h15 GMT à titre indicatif (susceptibles d'évoluer jusqu'au départ). Les jeux d'argent comportent des risques : misez avec modération.",
].join("\n");

const ELITE_TOULOUSE = [
  "LA COURSE & LES CONDITIONS",
  "• Épreuve : Quinté+ du mercredi 21 octobre 2026 — Grand Prix de la Ville Rose, Toulouse (R1C1)",
  "• Départ : 11h55 GMT (13h55 heure de Paris)",
  "• Profil : Trot attelé — 2 950 m — Corde à droite — 13 partants âgés de 6 à 10 ans",
  "• Configuration du parcours : Départ volté sur deux échelons. Les n°1 à 7 s'élancent en tête (2 950 m) tandis que les n°8 à 13 rendent 25 mètres (2 975 m).",
  "",
  "LA BASE SOLIDE (4 CHEVAUX)",
  "★ Notre Pivot — n°12 GERICAULT (Driver : Th. Briand | Entraîneur : V. Martens | Ferrure : D4 | +25 m)",
  "Favori du marché (1er). Modèle de régularité : 3 fois dans les 3 premiers lors de ses 5 dernières courses, sans faute.",
  "• n°10 FREEDOM (NOR) (Driver : O. Raffin | Entraîneur : O. Raffin | Ferrure : D4 | +25 m)",
  "2e favori du marché. En pleine possession de ses moyens avec 2 victoires sur ses 5 dernières sorties, sans la moindre faute d'allure.",
  "• n°13 ICARE DU BERYL (Driver : M. Criado | Entraîneur : Y. Lacombe | Ferrure : D4 | +25 m)",
  "3e du marché. Modèle de régularité : 4 fois dans les 3 premiers lors de ses 5 dernières courses, sans faute.",
  "• n°1 ENEA FONT (Driver : J. Chavatte | Entraîneur : S. Guarato | Ferrure : D4)",
  "4e du marché. Victorieux récemment (1 succès sur ses 5 dernières courses) et irréprochable dans ses allures.",
  "",
  "LES VALUES SPÉCULATIVES (2 CHEVAUX)",
  "◇ n°4 HARLEM DE L'ITON (Driver : M. Cinier | Entraîneur : D. Cinier | Ferrure : D4)",
  "5e du marché. Performant avec 3 succès sur ses 5 dernières courses malgré 1 faux pas à effacer.",
  "◇ n°5 GHOST DE BEAULIEU (Driver : P. Geray | Entraîneur : J. Asselie | Ferrure : DA, PP)",
  "7e du marché. Modèle de régularité : 4 fois dans les 3 premiers lors de ses 5 dernières courses, sans faute.",
  "",
  "LES ASSOCIÉS DE COMPLÉMENT (2 CHEVAUX)",
  "🤝 n°7 INCREDIBLE GO (Driver : Th. Ducos | Entraîneur : F. Terry | Ferrure : D4)",
  "6e du marché. Performant avec 1 succès sur ses 5 dernières courses malgré 1 faux pas à effacer.",
  "🤝 n°6 IRRATI DUEM (Driver : Pierrick Le Moel | Entraîneur : C. Herserant)",
  "9e du marché. Délicat récemment (3 disqualifications sur ses 5 dernières sorties), mais capable de créer la surprise s'il reste sage du départ à l'arrivée.",
  "",
  "PLAN DE JEU ELITE (SYNTHÈSE 8 CHEVAUX)",
  "• Sélection complète (8 chevaux) : 12 · 10 · 13 · 1 · 4 · 5 · 7 · 6",
  "• Base Trio / Champ réduit : 12 — 10 — 13 (ou avec le n°1)",
  "• Couplé Maître recommandé : 12 — 10 (Sniper : n°13 à 6,9/1)",
  "• Outsiders / Associés à intégrer en champ réduit : 4 · 5 · 7 · 6",
  "",
  "À SAVOIR",
  "Cotes PMU relevées à 10h15 GMT à titre indicatif (susceptibles d'évoluer jusqu'au départ). Les jeux d'argent comportent des risques : misez uniquement ce que vous pouvez vous permettre de perdre.",
].join("\n");

const COURTE_CLAIREFONTAINE = [
  "Prix des Equidays — Clairefontaine (R1C1) | Plat · 2 400 m · Gazon (très souple) · 15 partants. Handicap divisé pour 3 ans sur 2 400 m (corde à droite). Notre analyse place en tête NITY GALESTE (n°2, C. Lecoeuvre), favori du marché. Découvrez la sélection complète en 6 chevaux (Pro) et le plan de jeu élargi en 8 chevaux (Elite).",
].join("\n");

const ELITE_CLAIREFONTAINE = [
  "LA COURSE & LES CONDITIONS",
  "• Épreuve : Quinté+ du mardi 20 octobre 2026 — Prix des Equidays, Clairefontaine (R1C1)",
  "• Départ : 11h55 GMT (13h55 heure de Paris)",
  "• Profil : Plat (Handicap divisé) — 2 400 m — Corde à droite — 15 partants de 3 ans (après le forfait du n°7 MOONEY VISION)",
  "• Terrain & paramètres clés : Piste en gazon (terrain très souple). Sur ce tracé de 2 400 m, la tenue, l'aptitude au terrain et la place dans l'échelle des poids seront déterminantes.",
  "",
  "LA BASE SOLIDE (4 CHEVAUX)",
  "★ Notre Pivot — n°2 NITY GALESTE (Jockey : C. Lecoeuvre | Entraîneur : H. Ghabri | Poids : 60 kg · Corde 3 · Val. 41)",
  "Favori du marché (1er). Fait preuve d'une remarquable constance avec 3 podiums sur ses 5 dernières tentatives. Bénéficie d'un bon numéro dans les stalles (corde 3).",
  "• n°9 TAKERYA (Jockey : A. Pouchin | Entraîneur : E. Libaud | Poids : 54,5 kg · Corde 10 · Val. 35,5)",
  "5e du marché. Fait preuve d'une remarquable constance avec 3 podiums sur ses 5 dernières tentatives.",
  "• n°4 ZARLAND (Jockey : T. Bachelot | Entraîneur : S. Wattel | Poids : 56 kg · Corde 13 · Val. 37)",
  "3e du marché. Régulier à ce niveau de compétition (2 fois dans les 5 premiers lors de ses 5 dernières courses).",
  "• n°3 MAKAN (Jockey : Pc. Boudot | Entraîneur : M. Delcher Sanchez | Poids : 56 kg · Corde 4 · Val. 37)",
  "2e favori du marché. Reste sur une victoire convaincante et aborde cet engagement en pleine forme. Bénéficie d'un bon numéro dans les stalles (corde 4).",
  "",
  "LES VALUES SPÉCULATIVES (2 CHEVAUX)",
  "◇ n°15 ZARABABY (Jockey : P. Remoue | Entraîneur : D. Artu | Poids : 52,5 kg · Corde 2 · Val. 33,5)",
  "7e du marché. Fait preuve d'une remarquable constance avec 4 podiums sur ses 5 dernières tentatives. Bénéficie d'un bon numéro dans les stalles (corde 2). Avantagée par son petit poids en bas de tableau (52,5 kg).",
  "◇ n°14 EXELMANS (Jockey : T. Trullier | Entraîneur : C. Ferland | Poids : 53 kg · Corde 6 · Val. 34)",
  "4e du marché. Régulière à ce niveau de compétition (3 fois dans les 5 premières lors de ses 5 dernières courses). Avantagée par son petit poids en bas de tableau (53 kg).",
  "",
  "LES ASSOCIÉS DE COMPLÉMENT (2 CHEVAUX)",
  "🤝 n°11 ENTLEBUCH (Jockey : A. Lemaitre | Entraîneur : Mme H. Sauer | Poids : 54 kg · Corde 7 · Val. 35)",
  "8e du marché. Régulier à ce niveau de compétition (4 fois dans les 5 premiers lors de ses 5 dernières courses).",
  "🤝 n°5 MY HABITUDE (Jockey : C. Collet-Vidal | Entraîneur : Rob. Collet | Poids : 55,5 kg · Corde 1 · Val. 36,5)",
  "13e du marché. Très compétitif actuellement avec 3 succès lors de ses 5 dernières sorties. Bénéficie d'un bon numéro dans les stalles (corde 1).",
  "",
  "PLAN DE JEU ELITE (SYNTHÈSE 8 CHEVAUX)",
  "• Sélection complète (8 chevaux) : 2 · 9 · 4 · 3 · 15 · 14 · 11 · 5 (Non-partant : n°7 MOONEY VISION)",
  "• Base Trio / Champ réduit : 2 — 9 — 4 (ou avec le n°3)",
  "• Outsiders / Associés à intégrer en champ réduit : 15 · 14 · 11 · 5",
  "",
  "À SAVOIR",
  "Cotes PMU relevées à 10h15 GMT à titre indicatif (susceptibles d'évoluer jusqu'au départ). Les jeux d'argent comportent des risques : misez uniquement ce que vous pouvez vous permettre de perdre.",
].join("\n");

const AVIS_TOULOUSE: AvisArgon = { couple: [12, 10], sniper: { numero: 13, cote: 6.9 } };

describe("modèle éditorial — Toulouse, Grand Prix de la Ville Rose du 21/10/2026 (trot attelé)", () => {
  const pro = analyseComplete(T, "PRO", L(T, [12, 10, 13, 1]), L(T, [4, 5]), []);
  const elite = analyseComplete(T, "ELITE", L(T, [12, 10, 13, 1]), L(T, [4, 5]), L(T, [7, 6]), AVIS_TOULOUSE);

  it("analyse courte", () => {
    expect(analyseCourte(T, cheval(T, 12), 8)).toBe(COURTE_TOULOUSE);
  });

  it("analyse complète Pro (6 chevaux)", () => {
    expect(pro).toBe(PRO_TOULOUSE);
  });

  it("analyse complète Elite (8 chevaux et plan de jeu)", () => {
    expect(elite).toBe(ELITE_TOULOUSE);
  });

  it("ordre des sections : la base, puis les values, puis les associés — jamais les associés avant les values", () => {
    expect(titres(pro)).toEqual([
      "LA COURSE & LES CONDITIONS", "LA BASE SOLIDE (4 CHEVAUX)", "LES VALUES SPÉCULATIVES (2 CHEVAUX)",
      "SYNTHÈSE PRO (6 CHEVAUX)", "À SAVOIR",
    ]);
    expect(titres(elite)).toEqual([
      "LA COURSE & LES CONDITIONS", "LA BASE SOLIDE (4 CHEVAUX)", "LES VALUES SPÉCULATIVES (2 CHEVAUX)",
      "LES ASSOCIÉS DE COMPLÉMENT (2 CHEVAUX)", "PLAN DE JEU ELITE (SYNTHÈSE 8 CHEVAUX)", "À SAVOIR",
    ]);
    expect(pro).not.toContain("ASSOCIÉS");
    expect(pro).not.toContain("Couplé");
  });

  it("trot : faute d'allure comptée, ni poids ni corde de stalle", () => {
    expect(elite).toContain("sans faute");
    for (const l of fiches(elite)) expect(l).not.toMatch(/Poids|Corde \d/);
  });
});

describe("modèle éditorial — Clairefontaine, Prix des Equidays du 20/10/2026 (plat, n°7 non partant)", () => {
  const pro = analyseComplete(C, "PRO", L(C, [2, 9, 4, 3]), L(C, [15, 14]), []);
  const elite = analyseComplete(C, "ELITE", L(C, [2, 9, 4, 3]), L(C, [15, 14]), L(C, [11, 5]));

  it("analyse courte : surface et terrain dans l'en-tête", () => {
    expect(analyseCourte(C, cheval(C, 2), 8)).toBe(COURTE_CLAIREFONTAINE);
  });

  it("analyse complète Elite", () => {
    expect(elite).toBe(ELITE_CLAIREFONTAINE);
  });

  it("plat : jamais de « faute », poids et corde dans chaque fiche", () => {
    for (const t of [pro, elite]) {
      expect(t).not.toMatch(/faute|faux pas/i);
      const f = fiches(t);
      expect(f.length).toBeGreaterThanOrEqual(6);
      for (const l of f) expect(l).toMatch(/Poids : [\d,]+ kg · Corde \d+/);
    }
  });

  it("non-partant : signalé dans le Profil et la sélection Elite, jamais retenu", () => {
    expect(section(elite, "LA COURSE")).toContain("(après le forfait du n°7 MOONEY VISION)");
    expect(elite).toContain("(Non-partant : n°7 MOONEY VISION)");
    for (const t of [pro, elite]) for (const l of fiches(t)) expect(l).not.toContain("n°7 ");
    expect(pro).not.toContain("Non-partant :");
  });
});

describe("obstacle réel — Auteuil, Prix André Adèle du 22/10/2026 (steeple-chase, cotes du matin)", () => {
  // Les 8 premiers du marché du matin, pour éprouver le texte (ce n'est pas la sélection d'Argon).
  const elite = analyseComplete(A, "ELITE", L(A, [9, 7, 5, 15]), L(A, [11, 16]), L(A, [2, 6]));

  it("discipline, catégorie et terrain", () => {
    expect(analyseCourte(A, cheval(A, 9), 8)).toBe(
      "Prix André Adèle — Auteuil (R1C1) | Steeple-chase · 3 600 m · 16 partants. Handicap de catégorie, steeple-chase sur terrain très souple. Notre analyse place en tête HERALISTE (n°9, G. Masure), favori du marché. Découvrez la sélection complète en 6 chevaux (Pro) et le plan de jeu élargi en 8 chevaux (Elite).",
    );
    expect(elite).toContain("• Profil : Steeple-chase (Handicap de catégorie) — 3 600 m — 16 partants âgés de 5 à 9 ans");
    expect(elite).toContain("• Parcours : Steeple-chase, terrain très souple. Le poids porté, l'aptitude au terrain et la qualité de saut compteront.");
  });

  it("fiches : jockey, poids et valeur ; chutes et arrêts comptés, jamais de faute d'allure", () => {
    expect(elite).toContain("★ Notre Pivot — n°9 HERALISTE (Jockey : G. Masure | Entraîneur : Chaille-Chaille & Pamart | Poids : 69,5 kg · Val. 54,5)");
    expect(elite).toContain("Favori du marché (1er). Doté de solides moyens (3 podiums sur ses 5 dernières sorties) malgré 1 incident de parcours à oublier.");
    expect(elite).toContain("2e favorite du marché. Sauteuse fiable et performante (1 victoire sur ses 5 dernières sorties, sans chute ni arrêt).");
    expect(elite).not.toMatch(/faute d'allure|Driver|Corde \d/);
  });
});

// ── Plan de jeu Elite ───────────────────────────────────────────────────────

describe("plan de jeu Elite : couplé maître et sniper de la T-90 scellée", () => {
  const plan = (ctx: ContexteCourse, bases: number[], avis: AvisArgon | null) =>
    section(analyseComplete(ctx, "ELITE", L(ctx, bases), L(ctx, [4, 5]), L(ctx, [7, 6]), avis), "PLAN DE JEU");

  it("sans avis d'Argon : ni couplé ni sniper", () => {
    const p = plan(T, [12, 10, 13, 1], null);
    expect(p).not.toMatch(/Couplé|Sniper/);
    expect(p).toContain("• Base Trio / Champ réduit : 12 — 10 — 13 (ou avec le n°1)");
  });

  it("cote du sniper inconnue : le numéro seul", () => {
    expect(plan(T, [12, 10, 13, 1], { couple: [12, 10], sniper: { numero: 13, cote: null } }))
      .toContain("• Couplé Maître recommandé : 12 — 10 (Sniper : n°13)");
  });

  it("pas de couplé maître : la ligne Sniper seule", () => {
    expect(plan(T, [12, 10, 13, 1], { couple: null, sniper: { numero: 13, cote: 6.9 } })).toContain("• Sniper : n°13 à 6,9/1");
  });

  it("un non-partant n'est jamais cité dans le couplé ni comme sniper", () => {
    const avecNp = plan(C, [2, 9, 4, 3], { couple: [2, 7], sniper: { numero: 3, cote: 10 } });
    expect(avecNp).not.toContain("Couplé");
    expect(avecNp).toContain("• Sniper : n°3 à 10/1");
    const sniperNp = plan(C, [2, 9, 4, 3], { couple: [2, 9], sniper: { numero: 7, cote: 12 } });
    expect(sniperNp).toContain("• Couplé Maître recommandé : 2 — 9\n");
    expect(sniperNp).not.toContain("Sniper");
  });

  it("base de 3 : pas de « ou avec »", () => {
    expect(plan(T, [12, 10, 13], null)).toContain("• Base Trio / Champ réduit : 12 — 10 — 13\n");
  });
});

// ── La course : configuration du parcours (trot) ────────────────────────────

describe("configuration du parcours au trot (Gobelins du 07/10/2026, n°12 non partant)", () => {
  const BASES = [17, 16, 5, 13];
  const conditions = (ctx: ContexteCourse) => section(analyseComplete(ctx, "PRO", L(ctx, BASES), L(ctx, [10, 15]), []), "LA COURSE");
  const avec = (distance: (n: number) => number): ContexteCourse => ({ ...CTX, participants: PARTICIPANTS.map((p) => ({ ...p, distance: distance(p.numero) })) });

  it("deux échelons, le non-partant retiré de la suite des reculés", () => {
    expect(conditions(CTX)).toContain(
      "• Configuration du parcours : Départ volté sur deux échelons. Les n°1 à 9 s'élancent en tête (2 875 m) tandis que les n°10, 11 et 13 à 18 rendent 25 mètres (2 900 m).",
    );
    expect(analyseCourte(CTX, cheval(CTX, 17))).toContain("Course sur deux échelons de départ (recul de 25 m pour les n°10, 11 et 13 à 18).");
  });

  it("le n°12 remis partant : « les n°10 à 18 »", () => {
    const ctx = { ...CTX, participants: PARTICIPANTS.map((p) => (p.numero === 12 ? { ...p, nonPartant: false } : p)) };
    expect(conditions(ctx)).toContain("tandis que les n°10 à 18 rendent 25 mètres (2 900 m).");
  });

  it("une seule distance : pas de recul", () => {
    const ctx = avec(() => 2875);
    expect(conditions(ctx)).toContain("• Configuration du parcours : Départ volté, tous les partants sur 2 875 m.");
    expect(analyseCourte(ctx, cheval(ctx, 17))).not.toContain("recul");
  });

  it("trois échelons : une proposition par groupe", () => {
    const ctx = avec((n) => (n <= 9 ? 2875 : n <= 14 ? 2900 : 2925));
    expect(conditions(ctx)).toContain(
      "Départ volté sur 3 échelons. Les n°1 à 9 s'élancent en tête (2 875 m) tandis que les n°10, 11, 13 et 14 rendent 25 mètres (2 900 m) et les n°15 à 18 rendent 50 mètres (2 925 m).",
    );
    expect(analyseCourte(ctx, cheval(ctx, 17))).toContain("Course sur 3 échelons de départ.");
  });

  it("autostart : première et seconde ligne", () => {
    const ctx: ContexteCourse = { ...avec(() => 2875), coursePmu: { ...CTX.coursePmu!, categorie: "AUTOSTART" } };
    expect(conditions(ctx)).toContain(
      "• Configuration du parcours : Départ à l'autostart. Les n°1 à 8 s'élancent en première ligne derrière les ailes, les suivants en seconde ligne.",
    );
    expect(analyseCourte(ctx, cheval(ctx, 17))).toContain("Course au départ de l'autostart.");
  });

  it("champ féminin : « 17 partantes âgées de 7 à 8 ans »", () => {
    expect(conditions(CTX)).toContain("17 partantes âgées de 7 à 8 ans (après le forfait du n°12 JUNON DE LOU)");
  });
});

// ── Phrase de forme par discipline ──────────────────────────────────────────

describe("phrase de forme (matrice du modèle)", () => {
  it("trot, femelles : accords au féminin", () => {
    const t = analyseComplete(CTX, "PRO", L(CTX, [17, 16, 5, 13]), L(CTX, [10, 15]), []);
    expect(t).toContain("Favorite du marché (1re). Modèle de régularité : 4 fois dans les 3 premières lors de ses 5 dernières courses, sans faute.");
    expect(t).toContain("2e favorite du marché. Constante et appliquée (3 fois dans les 5 premières sur ses 5 dernières sorties, sans faute).");
    expect(t).toContain("Délicate récemment (2 disqualifications sur ses 5 dernières sorties), mais capable de créer la surprise si elle reste sage du départ à l'arrivée.");
    expect(t).toContain("6e du marché. Performante avec 1 succès sur ses 5 dernières courses malgré 1 faux pas à effacer.");
  });

  it("trot, champ mixte : formes masculines", () => {
    const mixte: ContexteCourse = {
      ...CTX,
      coursePmu: { ...CTX.coursePmu!, conditionSexe: null },
      participants: PARTICIPANTS.map((p) => ({ ...p, sexe: "MALES" })),
    };
    const t = analyseComplete(mixte, "PRO", L(CTX, [17, 16, 5, 13]), L(CTX, [10, 15]), []);
    expect(t).toContain("Favori du marché (1er). Modèle de régularité : 4 fois dans les 3 premiers");
    expect(t).toContain("17 partants âgés de 7 à 8 ans");
    expect(t).not.toMatch(/Favorite|premières|Constante|Délicate|partantes|âgées/);
    expect(analyseCourte(mixte, cheval(CTX, 17))).toContain("(n°17, F. Nivard), favori du marché.");
  });

  it("trot, aucune condition remplie : phrase de secours avec l'allocation maximale", () => {
    const ctx: ContexteCourse = { ...T, participants: T.participants.map((p) => (p.numero === 6 ? { ...p, musique: "0a7a9a0a8a" } : p)) };
    const t = analyseComplete(ctx, "ELITE", L(T, [12, 10, 13, 1]), L(T, [4, 5]), L(T, [7, 6]));
    expect(t).toContain("9e du marché. Confirmé dans des lots de niveau équivalent (30 k€), il possède les ressources pour se réhabiliter.");
  });

  it("plat, aucune condition remplie : phrase de secours du handicap, puis le bonus de corde", () => {
    const ctx: ContexteCourse = { ...C, participants: C.participants.map((p) => (p.numero === 5 ? { ...p, musique: "0p0p8p9p7p" } : p)) };
    const t = analyseComplete(ctx, "ELITE", L(C, [2, 9, 4, 3]), L(C, [15, 14]), L(C, [11, 5]));
    expect(t).toContain(
      "13e du marché. Aguerri aux gros handicaps (lots jusqu'à 53 k€), il trouve une occasion de refaire parler de lui. Bénéficie d'un bon numéro dans les stalles (corde 1).",
    );
  });

  it("obstacle : incidents A et T, poids et valeur sans corde, jamais « faute d'allure »", () => {
    const musiques: Record<number, string | null> = { 2: "1h2h3h4h5h", 9: "Th1h2h3h4h", 3: "AhTh8h9h0h", 15: "0h0h7h8h9h", 14: null };
    const ctx: ContexteCourse = {
      ...C,
      coursePmu: { ...C.coursePmu!, specialite: "HAIES", categorie: "HANDICAP" },
      participants: C.participants.map((p) => (p.numero in musiques ? { ...p, musique: musiques[p.numero] } : p)),
    };
    const t = analyseComplete(ctx, "PRO", L(C, [2, 9, 4, 3]), L(C, [15, 14]), []);
    expect(t).toContain("★ Notre Pivot — n°2 NITY GALESTE (Jockey : C. Lecoeuvre | Entraîneur : H. Ghabri | Poids : 60 kg · Val. 41)");
    expect(t).toContain("Favori du marché (1er). Sauteur fiable et performant (1 victoire sur ses 5 dernières sorties, sans chute ni arrêt).");
    expect(t).toContain("5e du marché. Dotée de solides moyens (3 podiums sur ses 5 dernières sorties) malgré 1 incident de parcours à oublier.");
    expect(t).toContain("Capable du meilleur comme du pire sur les obstacles (2 arrêts ou chutes récemment), il peut surprendre à belle cote s'il boucle son parcours.");
    expect(t).toContain("Habituée aux lots relevés (53 k€) et adaptée aux conditions de poids du jour (52,5 kg), elle mérite crédit.");
    expect(t).toContain("4e du marché. Peu de références récentes au PMU.");
    expect(t).toContain("• Parcours : Haies, terrain très souple.");
    expect(t).not.toMatch(/faute d'allure|Corde \d/);
  });

  it("réponse « course » du PMU absente : discipline lue dans la musique, aucun libellé inventé", () => {
    const sans: ContexteCourse = { ...CTX, coursePmu: null };
    const t = analyseComplete(sans, "PRO", L(CTX, [17, 16, 5, 13]), L(CTX, [10, 15]), []);
    expect(t).toContain("• Profil : 2 875 m — 17 partants âgés de 7 à 8 ans (après le forfait du n°12 JUNON DE LOU)");
    expect(t).toContain("★ Notre Pivot — n°17 IMAGE D'ATALANTE (F. Nivard | Entraîneur : D. Cherbonnel)");
    expect(t).toContain("Modèle de régularité : 4 fois dans les 3 premières lors de ses 5 dernières courses, sans faute.");
    expect(t).not.toMatch(/Driver|Jockey|Trot|Plat|null|undefined/);
    expect(analyseCourte(sans, cheval(CTX, 17))).toBe(
      "Prix des Gobelins — Enghien (R1C1) | 2 875 m · 17 partants. Notre analyse place en tête IMAGE D'ATALANTE (n°17, F. Nivard), favorite du marché. Découvrez la sélection complète en 6 chevaux (Pro) et le plan de jeu élargi en 8 chevaux (Elite).",
    );
  });

  it("driver ou entraîneur absent : en-tête propre", () => {
    const ctx: ContexteCourse = {
      ...CTX,
      participants: PARTICIPANTS.map((p) => (p.numero === 17 ? { ...p, driver: null, entraineur: null, deferre: null } : p.numero === 16 ? { ...p, entraineur: null } : p)),
    };
    const t = analyseComplete(ctx, "PRO", L(CTX, [17, 16, 5, 13]), L(CTX, [10, 15]), []);
    expect(t).toContain("★ Notre Pivot — n°17 IMAGE D'ATALANTE (+25 m)\n");
    expect(t).toContain("• n°16 JAIN MAB (Driver : A. Barrier | +25 m)\n");
    expect(t).not.toMatch(/null|undefined|\(\)|\| \|/);
    expect(analyseCourte(ctx, cheval(CTX, 17))).toContain("Notre analyse place en tête IMAGE D'ATALANTE (n°17), favorite du marché.");
  });
});

// ── Analyse courte ──────────────────────────────────────────────────────────

describe("analyse courte", () => {
  it(`${ANALYSE_COURTE_MAX} caractères au plus, quel que soit le pivot`, () => {
    for (const ctx of [T, C, CTX]) {
      for (const p of ctx.participants.filter((x) => !x.nonPartant)) {
        expect(analyseCourte(ctx, cheval(ctx, p.numero)).length).toBeLessThanOrEqual(ANALYSE_COURTE_MAX);
      }
    }
  });

  it("trop long : l'invitation part d'abord, puis le contexte, jamais de mot coupé", () => {
    const x = (n: number) => analyseCourte(T, { numero: 12, rang: 1, nom: "X".repeat(n) });
    expect(x(120)).not.toContain("Découvrez");
    expect(x(120)).toContain("Épreuve européenne");
    expect(x(200)).not.toContain("Épreuve européenne");
    expect(x(200)).toContain("Grand Prix de la Ville Rose — Toulouse (R1C1)");
    expect(x(300)).toBe(`Notre analyse place en tête ${"X".repeat(300)} (n°12, Th. Briand), favori du marché.`);
    expect(x(400)).toBe("Notre analyse place en tête le n°12, favori du marché.");
  });

  it("pivot d'Argon qui n'est pas le favori du marché : son rang, jamais « favori »", () => {
    const ctx: ContexteCourse = { ...CTX_THEMIS, releveCotes: Date.UTC(2026, 9, 16, 18, 15, 30) };
    const t = analyseCourte(ctx, { numero: 12, rang: 5, nom: "JALENDRA DE MALAC" });
    expect(t).toContain("Notre analyse place en tête JALENDRA DE MALAC (n°12, M. Mottier), 5e du marché.");
    expect(t).not.toMatch(/favori/i);
  });

  it("le nombre de chevaux Elite suit la composition", () => {
    expect(analyseCourte(T, cheval(T, 12), 7)).toContain("le plan de jeu élargi en 7 chevaux (Elite).");
  });
});

// ── Noms des intervenants ───────────────────────────────────────────────────

describe("personne", () => {
  it.each([
    ["TH. BRIAND", "Th. Briand"],
    ["G.SIAS", "G. Sias"],
    ["J.-M. BAZIRE", "J.-M. Bazire"],
    ["Pierrick le Moel", "P. Le Moel"],
    ["Mme Maria TORNQVIST", "Mme M. Tornqvist"],
    ["Jean-Pierre DUBOIS", "J.-P. Dubois"],
    ["M. DELCHER SANCHEZ", "M. Delcher Sanchez"],
    ["SAINT MARTIN", "Saint Martin"],
    ["E. LIBAUD (s)", "E. Libaud"],
    ["A. DE LA MOTTE", "A. de la Motte"],
    ["Mlle C. LE BEC", "Mlle C. Le Bec"],
    ["C. COLLET-VIDAL", "C. Collet-Vidal"],
  ])("%s → %s", (brut, attendu) => {
    expect(personne(brut)).toBe(attendu);
  });
});

// ── Garanties ───────────────────────────────────────────────────────────────

describe("garanties", () => {
  const themis: ContexteCourse = { ...CTX_THEMIS, releveCotes: Date.UTC(2026, 9, 16, 18, 15, 30) };
  const TEXTES: Array<[ContexteCourse, string]> = [
    [T, COURTE_TOULOUSE], [T, PRO_TOULOUSE], [T, ELITE_TOULOUSE],
    [C, COURTE_CLAIREFONTAINE], [C, ELITE_CLAIREFONTAINE],
    [CTX, analyseComplete(CTX, "ELITE", L(CTX, [17, 16, 5, 13]), L(CTX, [10, 15]), L(CTX, [18, 11]), { couple: [17, 16], sniper: { numero: 13, cote: 6.5 } })],
    [CTX, analyseCourte(CTX, cheval(CTX, 17))],
    [A, analyseCourte(A, cheval(A, 9))],
    [A, analyseComplete(A, "ELITE", L(A, [9, 7, 5, 15]), L(A, [11, 16]), L(A, [2, 6]), { couple: [9, 7], sniper: { numero: 15, cote: 9.2 } })],
    [themis, analyseComplete(themis, "ELITE", L(themis, [3, 6, 12, 13]), L(themis, [7, 4]), L(themis, [11, 14]))],
  ];

  it("aucun numéro absent des données ; un non-partant n'est cité que comme forfait", () => {
    for (const [ctx, t] of TEXTES) {
      const re = /n°(\d+)/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(t)) !== null) expect(ctx.participants.map((p) => p.numero)).toContain(Number(m[1]));
      for (const np of ctx.participants.filter((p) => p.nonPartant)) {
        const lignes = t.split("\n").filter((l) => l.indexOf(np.nom) !== -1);
        for (const l of lignes) expect(l).toMatch(/forfait|Non-partant/);
      }
    }
  });

  it("chaque cheval d'une fiche porte son nom PMU", () => {
    for (const [ctx, t] of TEXTES) {
      for (const l of fiches(t)) {
        // Le nom peut lui-même contenir des parenthèses (« FREEDOM (NOR) ») : l'en-tête est le dernier groupe.
        const m = l.match(/n°(\d+) (.+?)(?: \([^()]*\))?$/);
        expect(m).not.toBeNull();
        expect(m![2]).toBe(ctx.participants.find((p) => p.numero === Number(m![1]))!.nom);
      }
    }
  });

  it("aucun mot interdit, aucun chiffre d'Argon, aucune valeur vide", () => {
    for (const [, t] of TEXTES) {
      const bas = t.toLowerCase();
      for (const mot of MOTS_INTERDITS) expect(bas).not.toContain(mot);
      // « Avantagée par son petit poids » est du modèle : on vise les chiffres d'Argon (%, étoiles, probabilités, points d'avantage).
      expect(t).not.toMatch(/%|étoile|probabilit|\bpts\b|null|undefined/i);
      expect(t).not.toContain("NaN");
    }
  });

  it("heureGmt", () => {
    expect(heureGmt(Date.parse("2026-10-07T09:05:00Z"))).toBe("09h05");
  });
});
