import { describe, it, expect } from "vitest";
import {
  EDITO, PAYS_MIGRES, PAYS_NOINDEX, enteteDuJour, metaDescriptionPays, blocJouerDepuis,
  lignesNationales, faqPays, texteEditorial, heureFr,
} from "./contenu-pays";
import { FICHE_PAR_SLUG } from "./fiches";
import { COUNTRY_BY_SLUG } from "./countries";
import { analyserPages, SEUIL_SIMILARITE_MAX, SEUIL_PART_PROPRE_MIN, type PageMesuree } from "@/lib/seo/similarite";

const BF = EDITO["burkina-faso"];
const fBF = FICHE_PAR_SLUG["burkina-faso"];
const course = { libelle: "PRIX CEREALISTE", heure_depart: "15:15:00", hippodrome: { nom: "Auteuil" } };

describe("vague 1 : périmètre", () => {
  it("3 pages migrées, chacune avec fiche, texte éditorial et route existante", () => {
    expect(PAYS_MIGRES).toEqual(["burkina-faso", "cote-d-ivoire", "senegal"]);
    for (const slug of PAYS_MIGRES) {
      expect(EDITO[slug]?.slug).toBe(slug);
      expect(FICHE_PAR_SLUG[slug]?.slug).toBe(slug);
      expect(COUNTRY_BY_SLUG[slug]?.slug).toBe(slug);
    }
    expect(PAYS_NOINDEX).toEqual(["togo"]);
  });
});

describe("bloc 1 — Quinté+ du jour à l'heure locale", () => {
  it("phrase complète, heure de Ouagadougou de part et d'autre du 25/10", () => {
    expect(enteteDuJour(BF, fBF, "2026-10-24", course)?.phrase)
      .toBe("Quinté+ du jour depuis le Burkina Faso : PRIX CEREALISTE, Auteuil, départ à 13 h 15 (Ouagadougou)");
    expect(enteteDuJour(BF, fBF, "2026-10-26", course)?.heure).toBe("14 h 15");
  });

  it("hippodrome en tableau (jointure Supabase) accepté", () => {
    expect(enteteDuJour(BF, fBF, "2026-10-26", { ...course, hippodrome: [{ nom: "Auteuil" }] })?.hippodrome).toBe("Auteuil");
  });

  it("donnée manquante → null : bloc masqué, sans texte de remplacement", () => {
    expect(enteteDuJour(BF, fBF, "2026-10-26", null)).toBeNull();
    expect(enteteDuJour(BF, fBF, "2026-10-26", { ...course, libelle: null })).toBeNull();
    expect(enteteDuJour(BF, fBF, "2026-10-26", { ...course, heure_depart: null })).toBeNull();
    expect(enteteDuJour(BF, fBF, "2026-10-26", { ...course, hippodrome: null })).toBeNull();
  });

  it("meta description : course du jour si connue, texte fixe du pays sinon", () => {
    const e = enteteDuJour(BF, fBF, "2026-10-26", course);
    expect(metaDescriptionPays(BF, e)).toBe("Quinté+ du jour : PRIX CEREALISTE à Auteuil, départ à 14 h 15 à Ouagadougou. Le PMU'B de la LONAB, ses formules et notre pronostic.");
    expect(metaDescriptionPays(BF, null)).toBe(BF.metaParDefaut);
  });

  it("heureFr", () => {
    expect(heureFr("09:05")).toBe("09 h 05");
  });
});

describe("bloc 2 — Jouer depuis le pays (faits du registre)", () => {
  it("chaque page migrée a un opérateur publiable et la mention d'indépendance", () => {
    for (const slug of PAYS_MIGRES) {
      const b = blocJouerDepuis(EDITO[slug], FICHE_PAR_SLUG[slug]);
      expect(b, slug).not.toBeNull();
      expect(b!.mention).toMatch(/^Elite Turf est un service indépendant d'analyse, sans lien avec la LON(AB|ACI|ASE)\.$/);
      expect(b!.operateur.source.url).toMatch(/^https:\/\//);
    }
  });

  it("n'affiche que les faits publiables : l'heure limite n'existe qu'au Burkina", () => {
    expect(blocJouerDepuis(BF, fBF)?.heureLimite?.texte).toContain("arrêt des jeux");
    expect(blocJouerDepuis(EDITO["senegal"], FICHE_PAR_SLUG["senegal"])?.heureLimite).toBeUndefined();
    expect(blocJouerDepuis(EDITO["cote-d-ivoire"], FICHE_PAR_SLUG["cote-d-ivoire"])?.heureLimite).toBeUndefined();
  });

  it("sans opérateur publiable, le bloc entier est masqué", () => {
    expect(blocJouerDepuis(BF, { ...fBF, operateur: { ...fBF.operateur!, source: "" } })).toBeNull();
    expect(blocJouerDepuis(BF, { ...fBF, operateur: undefined })).toBeNull();
  });
});

describe("bloc 3 — Nationales du jour (LONACI)", () => {
  const fCI = FICHE_PAR_SLUG["cote-d-ivoire"];
  it("triées, à l'heure d'Abidjan, lignes incomplètes écartées", () => {
    const lignes = lignesNationales([
      { nationale: 2, libelle: "PRIX DES ROUGES-GORGES", heure_depart: "19:20:00", numero_reunion: 5, numero_course: 6, hippodrome: { nom: "Cabourg" } },
      { nationale: 1, libelle: "PRIX CEREALISTE", heure_depart: "13:57:00", numero_reunion: 1, numero_course: 1, hippodrome: { nom: "Auteuil" } },
      { nationale: 3, libelle: null, heure_depart: "17:05:00", numero_reunion: 9, numero_course: 7, hippodrome: { nom: "Meknes" } },
    ], fCI, "2026-10-01");
    expect(lignes).toEqual([
      { rang: "Nationale 1", course: "R1 C1 · Auteuil · PRIX CEREALISTE", heure: "11 h 57" },
      { rang: "Nationale 2", course: "R5 C6 · Cabourg · PRIX DES ROUGES-GORGES", heure: "17 h 20" },
    ]);
  });

  it("seule la Côte d'Ivoire affiche le programme de son opérateur", () => {
    expect(PAYS_MIGRES.filter((s) => EDITO[s].coursesOperateur)).toEqual(["cote-d-ivoire"]);
  });
});

describe("bloc 6 — FAQ", () => {
  it("FAQ affichée = FAQ du registre validé (même texte pour l'écran et le JSON-LD)", () => {
    for (const slug of PAYS_MIGRES) {
      const fiche = FICHE_PAR_SLUG[slug];
      expect(faqPays(fiche)).toEqual(fiche.faq.map((f) => ({ q: f.q, a: f.a })));
      expect(fiche.faq.length, slug).toBeGreaterThanOrEqual(4);
      expect(fiche.faq.length, slug).toBeLessThanOrEqual(6);
    }
  });
});

describe("garde-fou anti « doorway pages » (brief §5) sur les pages migrées", () => {
  const pages: PageMesuree[] = PAYS_MIGRES.map((slug) => {
    const c = COUNTRY_BY_SLUG[slug];
    const e = EDITO[slug];
    const op = c.operateurOfficiel;
    return {
      slug,
      titre: e.titre,
      h1: e.h1,
      metaDescription: e.metaParDefaut,
      texte: texteEditorial(e, FICHE_PAR_SLUG[slug]),
      jetons: {
        pays: [c.nom, c.nomComplet],
        capitale: [c.capitale],
        operateur: op ? [op.nom] : [],
        devise: ["fcfa", "f cfa", "francs cfa", "xof", "€", "euros"],
      },
    };
  });
  const r = analyserPages(pages);

  it(`similarité de chaque paire ≤ ${SEUIL_SIMILARITE_MAX}`, () => {
    for (const p of r.paires) expect(p.similarite, `${p.a} / ${p.b}`).toBeLessThanOrEqual(SEUIL_SIMILARITE_MAX);
  });

  it(`au moins ${SEUIL_PART_PROPRE_MIN * 100} % de 5-grammes propres par page`, () => {
    for (const p of r.pages) expect(p.partPropre, p.slug).toBeGreaterThanOrEqual(SEUIL_PART_PROPRE_MIN);
  });

  it("titres, H1 et meta descriptions uniques", () => {
    expect(r.doublons).toEqual([]);
  });
});
