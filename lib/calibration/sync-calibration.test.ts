import { describe, it, expect } from "vitest";
import { buildRows, runCalibrationSync } from "./sync-calibration";
import type { LigneCalibration } from "./radar-client";

const ligne = (tranche: LigneCalibration["tranche"], n = 100): LigneCalibration => ({
  tranche, n, annonce_pct: 10, reel_pct: 11, marche_pct: 9.5, gain_brier: 0.001,
});

describe("buildRows", () => {
  it("étiquette chaque ligne avec la semaine et le périmètre", () => {
    const rows = buildRows("2026-08-31", [ligne("<2")], [ligne("<2"), ligne("2-3")]);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({ semaine: "2026-08-31", perimetre: "SEMAINE", tranche: "<2" });
    expect(rows[2]).toMatchObject({ semaine: "2026-08-31", perimetre: "CUMUL", tranche: "2-3" });
  });
});

describe("runCalibrationSync", () => {
  it("scelle la semaine précédente avec les deux périmètres, en write-once", async () => {
    const appels: [string, string][] = [];
    let insertions: unknown[] = [];
    const res = await runCalibrationSync({
      now: new Date("2026-09-07T09:40:00Z"),
      fetchTranches: async (d, f) => { appels.push([d, f]); return [ligne("<2"), ligne("5-10")]; },
      insererWriteOnce: async (rows) => { insertions = rows; return rows.length; },
    });
    expect(appels).toEqual([["2026-08-31", "2026-09-06"], ["2026-07-22", "2026-09-06"]]);
    expect(res).toMatchObject({ semaine: "2026-08-31", statut: "OK", inseres: 4, ignores: 0, tranches_semaine: 2, tranches_cumul: 2 });
    expect(insertions).toHaveLength(4);
  });

  it("compte les doublons ignorés (semaine déjà scellée)", async () => {
    const res = await runCalibrationSync({
      semaine: "2026-08-31",
      fetchTranches: async () => [ligne("<2")],
      insererWriteOnce: async () => 0,
    });
    expect(res).toMatchObject({ inseres: 0, ignores: 2 });
  });

  it("n'écrit rien si Radar ne renvoie aucune tranche pour la semaine", async () => {
    let appele = false;
    const res = await runCalibrationSync({
      now: new Date("2026-09-14T09:40:00Z"),
      fetchTranches: async (d) => (d === "2026-09-07" ? [] : [ligne("<2")]),
      insererWriteOnce: async () => { appele = true; return 99; },
    });
    expect(res.statut).toBe("CALIBRATION_VIDE");
    expect(res.inseres).toBe(0);
    expect(appele).toBe(false);
  });

  it("ignore une semaine forcée invalide et retombe sur la semaine précédente", async () => {
    const res = await runCalibrationSync({
      now: new Date("2026-09-07T09:40:00Z"),
      semaine: "2026-09-02",
      fetchTranches: async () => [ligne("<2")],
      insererWriteOnce: async (rows) => rows.length,
    });
    expect(res.semaine).toBe("2026-08-31");
  });
});
