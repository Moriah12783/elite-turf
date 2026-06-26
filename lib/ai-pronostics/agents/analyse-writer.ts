/**
 * lib/ai-pronostics/agents/analyse-writer.ts
 *
 * Worker Agent #4 — AnalyseWriter (cahier des charges §12).
 *
 * 🎯 RÔLE
 *   Rédige le contenu final adapté au niveau d'accès (FREE/STARTER/PRO/ELITE).
 *   Ne CHOISIT PAS les chevaux. Ne MODIFIE PAS la sélection. N'INVENTE PAS
 *   de données. Transforme l'analyse technique en texte clair, premium,
 *   utile et responsable pour l'Afrique francophone.
 *
 * 🧠 MODÈLE
 *   Claude Haiku 3.5 — tâche de rédaction structurée (pas de reasoning lourd).
 *   ~$0.005 par run × 3 niveaux/jour = ~$0.015/jour.
 *
 * 🛡️ RÈGLES (cahier §12.2)
 *   - Mention obligatoire Afrique (Validation LONACI directe OU corroborée)
 *   - Heure Abidjan en priorité, Paris en complément
 *   - Jamais : "tuyau sûr", "base garantie", "100% sûr", promesses de gain
 *   - Toujours mentionner ≥ 1 risque
 *   - Ne pas masquer l'incertitude
 *   - Ton premium, sérieux, accessible, pédagogique
 *   - Note responsable obligatoire
 *
 * 📐 STRUCTURE PAR NIVEAU
 *   FREE  : intro + course + sélection 6 + mini-analyse + 1 risque + note
 *   PRO/STARTER : titre + badge + contexte + Quinté 8 + bases + appuis + outsiders + risques + synthèse
 *   ELITE : titre premium + badge + pourquoi + lecture course + Quinté 6 +
 *           base prio + appuis + outsider + écartés + risques + note stratégique
 *
 * 📜 Conforme cahier §12.
 */

import { callClaude, CLAUDE_MODELS } from "../claude-client";
import type {
  AnalyseWriterResult,
  ConfidenceLevel,
  DraftStatus,
  ElitePlanDeJeu,
  FieldAnalyzerResult,
  NiveauAcces,
  RunnerRole,
  SelectionBuilderResult,
  ValidationStatus,
} from "../types";
import { VALIDATION_BADGES } from "../types";
import { RESPONSIBLE_NOTE_LONG } from "../forbidden-expressions";
import { buildElitePlanDeJeu, type EliteRunnerInput } from "../elite-plan";

// ─────────────────────────────────────────────────────────────────────────
// Input / Output
// ─────────────────────────────────────────────────────────────────────────

export interface AnalyseWriterInput {
  selection:          SelectionBuilderResult;
  field:              FieldAnalyzerResult;
  access_level:       NiveauAcces;
  validation_status:  ValidationStatus;
  course_libelle:     string;
  course_hippodrome:  string;
  course_meeting:     string;        // "R1"
  course_race_number: string;        // "C3"
  start_time_paris:   string;        // "16:50"
  start_time_abidjan: string;        // "15:50"
  /**
   * Paris disponibles sur la course (ex: ["QUINTE_PLUS","QUARTE_PLUS","TIERCE"]).
   * Utilisé pour le plan de jeu ELITE. Optionnel — défaut Quinté+ (les courses
   * ELITE sont les grands coups Quinté+ du jour ; l'admin affine en review).
   */
  paris_disponibles?: string[];
  /** ID du draft (pour audit) — accepté optionnel et propagé tel quel */
  draft_id?:          string;
}

export interface AnalyseWriterRunOutput {
  result:        AnalyseWriterResult;
  tokens_input:  number;
  tokens_output: number;
}

// ─────────────────────────────────────────────────────────────────────────
// Templates de rappel selon niveau (pour le prompt LLM)
// ─────────────────────────────────────────────────────────────────────────

function getLevelGuidance(level: NiveauAcces): string {
  switch (level) {
    case "FREE":
      return `NIVEAU FREE — Fidélisation. Style : clair, court, accessible, sans donner toute la profondeur premium. 6 chevaux. Mini-analyse 2-3 phrases. 1 risque clair. Note responsable.`;
    case "STARTER":
      return `NIVEAU STARTER — Équivalent Pro pendant la période active. Style : pédagogique, structuré. 8 chevaux. Bases + chances régulières + outsiders. Mention Afrique obligatoire.`;
    case "PRO":
      return `NIVEAU PRO — Sélection Quinté large, utile, exploitable. 8 chevaux. Bases + chances régulières + outsiders. Classement conseillé. Analyse intermédiaire.`;
    case "ELITE":
      return `NIVEAU ELITE — Contenu le plus premium, sélectif, argumenté. 6 chevaux. Pourquoi cette course est retenue + lecture de course + base prioritaire + appuis + outsider + écartés + risques + note stratégique réservée Elite.`;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// System prompt
// ─────────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Tu es AnalyseWriter, rédacteur premium Elite-Turf.

PUBLIC PRIORITAIRE : Afrique francophone (Côte d'Ivoire ~90%, Sénégal, Burkina, Bénin, Mali, Gabon, Cameroun, Togo, Tchad, Maroc, Algérie, Tunisie, France outre-mer).

MISSION : Transformer une sélection technique en contenu éditorial premium pour la WEB de Elite Turf.

RÈGLES ABSOLUES :
- Tu NE peux PAS modifier la sélection. Tu n'ajoutes ni ne retires de chevaux.
- Tu N'inventes AUCUNE donnée (cote, musique, état du terrain, performance passée).
- Tu DOIS afficher exactement la mention obligatoire fournie ("Validation LONACI directe" OU "Validation Afrique corroborée" OU "Validation PMU international").
- Tu DOIS afficher l'heure Abidjan en priorité, suivie de l'heure Paris.
- Tu DOIS mentionner au moins 1 risque réaliste dans risks[].
- Tu DOIS conclure avec une note responsable.
- Vocabulaire recommandé : "base intéressante", "profil solide", "chance régulière", "outsider à surveiller", "possibilité intéressante", "prudence nécessaire", "course ouverte".
- Vocabulaire INTERDIT (rejet automatique) : "gain garanti", "sûr à 100%", "tuyau sûr", "impossible à battre", "banque absolue", "misez gros", "all-in", "certitude du jour", "base infaillible", "imparable", "imbattable", "sans aucun risque".
- Ne JAMAIS prononcer ce qu'un cheval VA faire ; toujours formuler en termes de probabilité, de profil, de signaux.
- Ne pas faire de référence franco-française obscure sans contexte (ex : éviter argot turfistes Paris).

CONFIDENCE_LEVEL :
- HIGH  : sélection serrée, data solide, base évidente, ELITE quasi exclusivement
- MEDIUM : sélection cohérente avec quelques incertitudes
- LOW   : course ouverte, peu de bases tranchantes, FREE souvent

Pour CHAQUE cheval de la sélection :
- Mentionner son rôle (BASE / APPUI / OUTSIDER / COMPLEMENT) en termes pédagogiques (pas le mot brut).
- Citer 1-2 signaux factuels parmi strengths/reason_codes (musique, régularité, jockey, cote intéressante…).
- Mentionner une faiblesse ou un risque s'il y a doute.
- Longueur du texte par cheval : 80-200 chars.

Sortie : JSON STRICT conforme au schéma fourni. AUCUN texte hors JSON.`;

// ─────────────────────────────────────────────────────────────────────────
// User prompt
// ─────────────────────────────────────────────────────────────────────────

interface LlmWriterDecision {
  title:              string;
  intro:              string;
  course_context:     string;
  race_reading:       string;
  selection: Array<{
    rank:      number;
    runner_id: string;
    number:    number;
    name:      string;
    role:      RunnerRole;
    text:      string;
  }>;
  main_pick: {
    runner_id: string;
    number:    number;
    name:      string;
    text:      string;
  };
  supporting_picks: Array<{
    runner_id: string;
    number:    number;
    name:      string;
    text:      string;
  }>;
  outsider: {
    runner_id: string;
    number:    number;
    name:      string;
    text:      string;
  };
  risks:             string[];
  suggested_ticket:  string;
  confidence_level:  ConfidenceLevel;
  why_this_pronostic: string;
  points_to_verify_before_publish: string[];
}

function buildUserPrompt(input: AnalyseWriterInput): string {
  const badge = VALIDATION_BADGES[input.validation_status];
  const runnersDetail = input.selection.selected_runners.map((r) => {
    // Récupère le profile depuis FieldAnalyzer pour donner du contexte au LLM
    const field = input.field.runners_analysis.find((a) => a.runner_id === r.runner_id);
    return {
      rank:             r.rank,
      runner_id:        r.runner_id,
      number:           r.number,
      name:             r.name,
      role:             r.role,
      confidence_score: r.confidence_score,
      risk_score:       r.risk_score,
      reason_codes:     r.reason_codes,
      profile:          field?.profile,
      strengths:        field?.strengths   ?? [],
      weaknesses:       field?.weaknesses ?? [],
      missing_data:     field?.missing_data ?? [],
    };
  });

  return `## Contexte course
- Course : ${input.course_meeting}${input.course_race_number} — ${input.course_libelle}
- Hippodrome : ${input.course_hippodrome}
- Départ : ${input.start_time_abidjan} (Abidjan) / ${input.start_time_paris} (Paris)
- Niveau d'accès : ${input.access_level}
- Mention obligatoire à afficher : "${badge}"

## Guidance niveau
${getLevelGuidance(input.access_level)}

## Sélection figée (NE PAS MODIFIER)
Taille attendue : ${input.selection.expected_runner_count}
selection_confidence_score : ${input.selection.selection_confidence_score}/100
Self-critique SelectionBuilder :
- main_risk : ${input.selection.self_critique.main_risk}
- why_fits_level : ${input.selection.self_critique.why_this_selection_fits_access_level}

Chevaux sélectionnés (avec contexte FieldAnalyzer) :
${JSON.stringify(runnersDetail, null, 2)}

## Field global (synthèse)
- field_quality_score : ${input.field.field_quality_score}/100
- data_completeness_score : ${input.field.data_completeness_score}/100
- race_complexity : ${input.field.race_complexity}
- main_risks : ${JSON.stringify(input.field.main_risks)}
- top_signals : ${JSON.stringify(input.field.top_signals)}
- red_flags : ${JSON.stringify(input.field.red_flags)}

## Sortie attendue
JSON strict avec ces clés exactes :
{
  "title": "string",
  "intro": "string (≥ 80 chars, mentionner niveau + course + badge Afrique)",
  "course_context": "string (contexte course, hippodrome, conditions)",
  "race_reading": "string (lecture du field, principal enseignement)",
  "selection": [
    { "rank": 1, "runner_id": "...", "number": 0, "name": "...", "role": "BASE|APPUI|OUTSIDER|COMPLEMENT", "text": "80-200 chars" }
  ],
  "main_pick": { "runner_id": "...", "number": 0, "name": "...", "text": "..." },
  "supporting_picks": [ { "runner_id": "...", "number": 0, "name": "...", "text": "..." } ],
  "outsider": { "runner_id": "...", "number": 0, "name": "...", "text": "..." },
  "risks": ["≥ 1 risque concret"],
  "suggested_ticket": "court (ex: 'Quinté en 6 → 720 combinaisons')",
  "confidence_level": "LOW | MEDIUM | HIGH",
  "why_this_pronostic": "1-2 phrases pour l'admin (audit)",
  "points_to_verify_before_publish": ["point 1", "point 2"]
}

IMPORTANT :
- "selection" doit contenir EXACTEMENT les ${input.selection.expected_runner_count} chevaux ci-dessus (mêmes runner_id, mêmes ranks).
- "main_pick" doit être le rank 1.
- "supporting_picks" doit contenir les chevaux APPUI.
- "outsider" doit être un cheval avec rôle OUTSIDER (s'il y en a) — sinon le cheval rank max parmi value_score élevés.
- Inclure "${badge}" dans "intro" OU "course_context" textuellement.`;
}

// ─────────────────────────────────────────────────────────────────────────
// Construction du résultat final
// ─────────────────────────────────────────────────────────────────────────

function buildResult(
  input:    AnalyseWriterInput,
  decision: LlmWriterDecision,
): AnalyseWriterResult {
  const badge = VALIDATION_BADGES[input.validation_status];

  // Garde-fou : si selection n'a pas la taille exacte → NEEDS_HUMAN_REVIEW
  let status: DraftStatus = "DRAFT_READY";
  if (decision.selection.length !== input.selection.expected_runner_count) {
    status = "NEEDS_HUMAN_REVIEW";
  }
  // Garde-fou : mention obligatoire dans le texte agrégé
  const fullText = `${decision.intro} ${decision.course_context} ${decision.race_reading}`;
  if (!fullText.toLowerCase().includes(badge.toLowerCase())) {
    // On force la présence en la collant au début de l'intro
    decision.intro = `${badge}. ${decision.intro}`.trim();
  }

  // Garde-fou risks : au moins 1 risque
  if (!decision.risks || decision.risks.length === 0) {
    decision.risks = [input.field.main_risks[0]?.description ?? "Incertitude liée à l'ouverture de la course"];
  }

  // Plan de jeu ELITE (déterministe, cf. elite-plan.ts) — la différence de
  // NATURE vs Pro. Le value_score vient du FieldAnalyzer ; paris_disponibles
  // défaut Quinté+ (course ELITE = grand coup du jour ; l'admin affine en review).
  let plan_de_jeu: ElitePlanDeJeu | undefined;
  if (input.access_level === "ELITE") {
    const eliteRunners: EliteRunnerInput[] = input.selection.selected_runners.map((r) => {
      const fa = input.field.runners_analysis.find((a) => a.runner_id === r.runner_id);
      return {
        number:           r.number,
        name:             r.name,
        role:             r.role,
        confidence_score: r.confidence_score,
        value_score:      fa?.value_score ?? 0,
      };
    });
    plan_de_jeu = buildElitePlanDeJeu({
      runners:           eliteRunners,
      paris_disponibles: input.paris_disponibles ?? ["QUINTE_PLUS", "QUARTE_PLUS", "TIERCE"],
    });
  }

  return {
    agent:        "AnalyseWriter",
    draft_id:     input.draft_id ?? "",
    course_id:    input.field.course_id,
    access_level: input.access_level,
    title:        decision.title,
    status,
    validation_badge: badge,
    subscriber_content: {
      intro:           decision.intro,
      course_context:  decision.course_context,
      race_reading:    decision.race_reading,
      selection:       decision.selection,
      main_pick:       decision.main_pick,
      supporting_picks: decision.supporting_picks,
      outsider:        decision.outsider,
      risks:           decision.risks,
      suggested_ticket: decision.suggested_ticket,
      confidence_level: decision.confidence_level,
      responsible_note: RESPONSIBLE_NOTE_LONG,
      ...(plan_de_jeu ? { plan_de_jeu } : {}),
    },
    admin_notes: {
      why_this_pronostic:               decision.why_this_pronostic,
      points_to_verify_before_publish:  decision.points_to_verify_before_publish ?? [],
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Point d'entrée
// ─────────────────────────────────────────────────────────────────────────

export async function runAnalyseWriterAgent(
  input: AnalyseWriterInput,
): Promise<AnalyseWriterRunOutput> {
  // ── Garde-fou : statut Afrique acceptable ──────────────────────────────
  // 3 paliers acceptés (cahier §4 amendé 2026-05-14) :
  //   LONACI directe > Afrique corroborée > PMU international
  const validStatuses: ValidationStatus[] = [
    "VALIDATION_LONACI_DIRECTE",
    "VALIDATION_AFRIQUE_CORROBOREE",
    "VALIDATION_PMU_INTERNATIONAL",
  ];
  if (!validStatuses.includes(input.validation_status)) {
    return {
      result: {
        agent:        "AnalyseWriter",
        draft_id:     input.draft_id ?? "",
        course_id:    input.field.course_id,
        access_level: input.access_level,
        title:        "Rédaction bloquée — Validation Afrique manquante",
        status:       "NEEDS_HUMAN_REVIEW",
        validation_badge: VALIDATION_BADGES[input.validation_status] ?? "",
        subscriber_content: {
          intro:           "Rédaction non autorisée sans validation Afrique.",
          course_context:  "",
          race_reading:    "",
          selection:       [],
          main_pick:       { runner_id: "", number: 0, name: "", text: "" },
          supporting_picks: [],
          outsider:        { runner_id: "", number: 0, name: "", text: "" },
          risks:           ["Validation Afrique absente — pronostic non publiable"],
          suggested_ticket: "",
          confidence_level: "LOW",
          responsible_note: RESPONSIBLE_NOTE_LONG,
        },
        admin_notes: {
          why_this_pronostic:               "Validation Afrique requise (cahier §12.2)",
          points_to_verify_before_publish:  ["Confirmer source LONACI ou corroboration Afrique"],
        },
      },
      tokens_input:  0,
      tokens_output: 0,
    };
  }

  // ── Appel LLM Haiku ────────────────────────────────────────────────────
  const userPrompt = buildUserPrompt(input);
  const llm = await callClaude<LlmWriterDecision>({
    model:        CLAUDE_MODELS.HAIKU,
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    maxTokens:    2500,           // contenu long pour ELITE
    expectJson:   true,
  });

  if (!llm.parsed) {
    throw new Error("AnalyseWriter LLM n'a pas retourné de JSON parseable");
  }

  const result = buildResult(input, llm.parsed);

  return {
    result,
    tokens_input:  llm.tokens_input,
    tokens_output: llm.tokens_output,
  };
}
