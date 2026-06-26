import { describe, it, expect } from "vitest";
import { runSelectionBuilderAgent } from "./agents/selection-builder";
import type { FieldAnalyzerResult, RunnerAnalysis, RunnerProfile } from "./types";

function runner(n: number, score: number, value: number, profile: RunnerProfile = "FAVORI_LOGIQUE"): RunnerAnalysis {
  return {
    runner_id: `r${n}`, number: n, name: `H${n}`,
    global_score: score, confidence_score: score, regularity_score: score,
    form_score: score, distance_score: 50, terrain_score: 50,
    jockey_driver_score: 50, trainer_score: 50, value_score: value, risk_score: 20,
    profile, strengths: [], weaknesses: [], missing_data: [],
    notes_for_selection_builder: "",
  };
}

const field: FieldAnalyzerResult = {
  agent: "FieldAnalyzer", course_id: "c1", validation_status: "VALIDATION_PMU_INTERNATIONAL",
  status: "OK", data_completeness_score: 70, field_quality_score: 70, race_complexity: "MEDIUM",
  main_risks: [], top_signals: [], red_flags: [],
  runners_analysis: [
    runner(1, 85, 20), runner(2, 80, 25), runner(3, 75, 30), runner(4, 70, 35),
    runner(5, 60, 40), runner(6, 55, 60, "OUTSIDER"), runner(7, 50, 85, "OUTSIDER"),
    runner(8, 45, 55, "OUTSIDER"),
  ],
};

describe("SelectionBuilder ELITE", () => {
  it("met le banker (meilleur score) en tête et garantit le MEILLEUR value pick (n°7)", async () => {
    const { result } = await runSelectionBuilderAgent({
      field, access_level: "ELITE", validation_status: "VALIDATION_PMU_INTERNATIONAL",
      course_libelle: "Test", course_hippodrome: "Vincennes",
    });
    const nums = result.selected_runners.map((r) => r.number);
    expect(result.selected_runners[0].number).toBe(1); // banker = meilleur score en tête
    expect(nums).toContain(7);                          // le MEILLEUR value pick (value 85) est retenu
    expect(result.selected_runners).toHaveLength(6);
  });
});
