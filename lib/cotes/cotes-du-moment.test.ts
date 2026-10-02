import { describe, it, expect } from "vitest";
import { appliquerCotesCsv, fenetreCotesDuMoment } from "./cotes-du-moment";
import type { PmuCoteRow } from "./pmu-csv";

const ligne = (num: number, cheval: string, coteDirecte?: number, nonPartant = false): PmuCoteRow =>
  ({ date: "2026-10-02", reunion: 1, course: 4, num, cheval, statut: nonPartant ? "NP" : "PARTANT", coteDirecte, nonPartant });

const csv = new Map<string, PmuCoteRow>([
  ["1|4|1", ligne(1, "JADE DE NAVARY", 64)],
  ["1|4|2", ligne(2, "JUNIOR STEED", 34)],
  ["1|4|3", ligne(3, "JYTRACE DE HOUELLE", 16)],
  ["1|4|4", ligne(4, "JAIFA DE L'ITON", 5.1)],
  ["1|4|5", ligne(5, "JOHORE", 15)],
]);

const base = [
  { numero: 1, nom_cheval: "JADE DE NAVARY", cote: 70 as number | null, non_partant: false },
  { numero: 2, nom_cheval: "JUNIOR STEED", cote: 30 as number | null, non_partant: false },
  { numero: 3, nom_cheval: "JYTRACE DE HOUELLE", cote: 18 as number | null, non_partant: false },
  { numero: 4, nom_cheval: "JAIFA DE L'ITON", cote: 5.4 as number | null, non_partant: false },
  { numero: 5, nom_cheval: "JOHORE", cote: null as number | null, non_partant: false },
];

describe("appliquerCotesCsv — cotes du moment depuis le CSV PMU", () => {
  it("remplace les cotes de la base par celles du CSV", () => {
    expect(appliquerCotesCsv(base, 1, 4, csv).map((p) => p.cote)).toEqual([64, 34, 16, 5.1, 15]);
  });

  it("garde la cote de la base si le nom ne correspond pas (autre course, mêmes R et C)", () => {
    const autres = base.map((p) => (p.numero === 2 ? { ...p, nom_cheval: "AUTRE CHEVAL" } : p));
    expect(appliquerCotesCsv(autres, 1, 4, csv)[1].cote).toBe(30);
  });

  it("CSV sans cette course → partants inchangés (même tableau)", () => {
    expect(appliquerCotesCsv(base, 2, 1, csv)).toBe(base);
  });

  it("résultat non plausible (cotes factices) → partants inchangés", () => {
    const factice = new Map(Array.from(csv.entries()).map(([k, r]) => [k, { ...r, coteDirecte: 1.2 }] as [string, PmuCoteRow]));
    expect(appliquerCotesCsv(base, 1, 4, factice)).toBe(base);
  });
});

describe("fenetreCotesDuMoment — la course part dans l'heure", () => {
  const depart = new Date("2026-10-02T18:15:00Z");
  const a = (iso: string) => Date.parse(iso);
  it("de 60 min avant à 15 min après l'heure prévue", () => {
    expect(fenetreCotesDuMoment(depart, a("2026-10-02T17:20:00Z"))).toBe(true);
    expect(fenetreCotesDuMoment(depart, a("2026-10-02T18:25:00Z"))).toBe(true);
  });
  it("pas avant, ni longtemps après, ni sans heure", () => {
    expect(fenetreCotesDuMoment(depart, a("2026-10-02T17:00:00Z"))).toBe(false);
    expect(fenetreCotesDuMoment(depart, a("2026-10-02T18:40:00Z"))).toBe(false);
    expect(fenetreCotesDuMoment(null)).toBe(false);
  });
});
