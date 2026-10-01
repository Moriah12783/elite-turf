import { describe, it, expect } from "vitest";
import { FICHES, FICHE_PAR_SLUG } from "./index";
import { estPubliable, tousPubliables, anomaliesFiche, type Fait } from "./types";
import { COUNTRIES } from "@/lib/geo/countries";

const fait = (extra: Partial<Fait<string>> = {}): Fait<string> => ({
  valeur: "LONAB", source: "https://www.lonab.bf/", verifieLe: "2026-10-01", verifiePar: "recherche", ...extra,
});

describe("estPubliable — rien d'inventé", () => {
  it("source http(s) + date valide → publiable", () => {
    expect(estPubliable(fait())).toBe(true);
    expect(estPubliable(fait({ verifiePar: "steph" }))).toBe(true);
  });

  it("sans source, source non-URL ou date invalide → non publié", () => {
    expect(estPubliable(undefined)).toBe(false);
    expect(estPubliable(fait({ source: "" }))).toBe(false);
    expect(estPubliable(fait({ source: "site officiel" }))).toBe(false);
    expect(estPubliable(fait({ verifieLe: "" }))).toBe(false);
    expect(estPubliable(fait({ verifieLe: "2026-13-45" }))).toBe(false);
  });

  it("un bloc exige que TOUS ses faits soient publiables", () => {
    expect(tousPubliables([fait(), fait()])).toBe(true);
    expect(tousPubliables([fait(), undefined])).toBe(false);
    expect(tousPubliables([])).toBe(false);
  });
});

describe("registre des 12 fiches", () => {
  it("une fiche par page pays, mêmes slugs que les 12 routes", () => {
    expect(FICHES.map((f) => f.slug).sort()).toEqual(COUNTRIES.map((c) => c.slug).sort());
    expect(Object.keys(FICHE_PAR_SLUG)).toHaveLength(12);
  });

  it("aucune anomalie (fuseau valide, faits sourcés et datés, FAQ complète)", () => {
    const anomalies = FICHES.map(anomaliesFiche).reduce((a, b) => a.concat(b), [] as string[]);
    expect(anomalies).toEqual([]);
  });

  it("aucun fait daté du futur", () => {
    const demain = Date.now() + 86400000;
    for (const f of FICHES) {
      for (const cle of ["operateur", "modesDeJeu", "heureLimite", "reunionsProposees", "parisLocaux", "vocabulaire"] as const) {
        const x = f[cle];
        if (x) expect(Date.parse(x.verifieLe + "T00:00:00Z"), `${f.slug}.${cle}`).toBeLessThan(demain);
      }
    }
  });

  it("aucune question de FAQ reprise d'une page à l'autre (même pays retiré)", () => {
    const vues: Record<string, string> = {};
    for (const f of FICHES) {
      for (const q of f.faq) {
        const cle = q.q.toLowerCase().replace(/[^a-zàâäçéèêëîïôöùûü]+/g, " ").trim();
        expect(vues[cle], `« ${q.q} » (${f.slug}) déjà posée sur ${vues[cle]}`).toBeUndefined();
        vues[cle] = f.slug;
      }
    }
  });

  it("aucun nom de concurrent dans le contenu des fiches", () => {
    const interdits = [
      "geny", "zone-turf", "zone turf", "paris-turf", "paris turf", "turfomania", "canalturf",
      "malian turf", "fasonet", "aide pmu", "capbleu", "cap bleu", "wari turf",
    ];
    for (const f of FICHES) {
      const texte = JSON.stringify(f).toLowerCase();
      for (const nom of interdits) expect(texte.includes(nom), `${f.slug} cite « ${nom} »`).toBe(false);
    }
  });
});
