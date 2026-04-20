/**
 * GET /api/cron/ia-pronostics
 *
 * Cron Vercel — 06h00 Paris (04h00 UTC) chaque jour
 *
 * 1. Lit les courses du jour depuis Supabase (déjà synchronisées par pmu-sync)
 * 2. Sélectionne les 2 meilleures (Quinté+ en priorité, puis nb_partants DESC)
 * 3. Appelle l'API Claude pour générer des pronostics structurés
 * 4. Sauvegarde dans la table pronostics avec publie=true
 * 5. Envoie une notification dans Slack #pronostics-quotidiens
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { logCronStart } from "@/lib/cron-logger";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const CRON_SECRET             = process.env.CRON_SECRET || "";
const ANTHROPIC_API_KEY       = process.env.ANTHROPIC_API_KEY || "";
const SLACK_WEBHOOK_PRONOSTICS = process.env.SLACK_WEBHOOK_PRONOSTICS || "";
const ANTHROPIC_MODEL         = "claude-sonnet-4-5"; // claude-sonnet-4-6 si disponible

// ── Prompt système Elite Turf ─────────────────────────────────────────────────

const SYSTEM_PROMPT = `Tu es l'analyste officiel d'Elite Turf. Tu analyses les courses hippiques avec méthode et rigueur.

Règles absolues :
- Tu ne promets jamais de gains garantis
- Tu ne dis jamais qu'un cheval "va gagner"
- Tu analyses les données disponibles et produis une sélection structurée et crédible
- Ton ton est professionnel, analytique, rassurant
- Pour chaque course tu fournis : analyse courte (3-4 phrases), sélection de 4-6 chevaux numérotés

Règle éditoriale Elite Turf : moins de bruit, plus de méthode.

IMPORTANT : Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour, sans markdown, sans explication. Format exact :
{
  "pronostics": [
    {
      "course_id": "uuid-de-la-course",
      "type_pari": "QUINTE_PLUS",
      "selection": [4, 3, 14, 1, 5],
      "confiance": "HAUTE",
      "analyse_courte": "Analyse en 3-4 phrases..."
    }
  ]
}
Les valeurs de confiance possibles : HAUTE, MOYENNE, FAIBLE.
Les valeurs de type_pari possibles : QUINTE_PLUS, QUARTE_PLUS, TIERCE, SIMPLE_GAGNANT.`;

// ── Types ─────────────────────────────────────────────────────────────────────

type Partant = {
  numero: number;
  nom_cheval: string;
  jockey: string | null;
  entraineur: string | null;
  cote: number | null;
  musique: string | null;
  non_partant: boolean | null;
};

type CourseWithPartants = {
  id: string;
  libelle: string;
  hippodrome: string;
  heure_depart: string | null;
  nb_partants: number;
  distance_metres: number;
  paris_disponibles: string[];
  partants: Partant[];
};

type ClaudePronostic = {
  course_id: string;
  type_pari: string;
  selection: number[];
  confiance: string;
  analyse_courte: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatHeure(raw: string | null): string {
  if (!raw) return "—";
  const [h, m] = raw.split(":");
  return `${h}h${m}`;
}

function getPriorityTypePari(paris: string[]): string {
  if (paris.includes("QUINTE_PLUS")) return "QUINTE_PLUS";
  if (paris.includes("QUARTE_PLUS")) return "QUARTE_PLUS";
  if (paris.includes("TIERCE"))       return "TIERCE";
  return paris[0] ?? "SIMPLE_GAGNANT";
}

function getNiveauAcces(typePari: string): string {
  if (typePari === "QUINTE_PLUS" || typePari === "QUARTE_PLUS") return "PRO";
  return "GRATUIT";
}

function buildUserPrompt(courses: CourseWithPartants[]): string {
  const dateStr = new Date().toLocaleDateString("fr-FR", {
    timeZone: "Europe/Paris",
    weekday: "long",
    day:     "numeric",
    month:   "long",
    year:    "numeric",
  });

  let prompt = `Voici les courses sélectionnées pour le ${dateStr}. Génère un pronostic pour CHACUNE des ${courses.length} courses listées ci-dessous.\n\n`;

  for (const course of courses) {
    const typePari    = getPriorityTypePari(course.paris_disponibles);
    const nbSelection = typePari === "QUINTE_PLUS" ? 5
                      : typePari === "QUARTE_PLUS" ? 4
                      : typePari === "TIERCE"       ? 3
                      : 1;

    prompt += `---\nCOURSE ID : ${course.id}\n`;
    prompt += `Nom        : ${course.libelle}\n`;
    prompt += `Hippodrome : ${course.hippodrome}\n`;
    prompt += `Heure      : ${formatHeure(course.heure_depart)}\n`;
    prompt += `Type pari  : ${typePari} (sélectionner ${nbSelection} chevaux)\n`;
    prompt += `Partants   : ${course.nb_partants}\n`;
    if (course.distance_metres > 0) prompt += `Distance   : ${course.distance_metres}m\n`;

    const partants = course.partants
      .filter((p) => !p.non_partant)
      .sort((a, b) => a.numero - b.numero);

    if (partants.length > 0) {
      prompt += `\nListe des partants :\n`;
      for (const p of partants) {
        const cote   = p.cote ? `  cote: ${p.cote}` : "";
        const jockey = p.jockey ? `  jockey: ${p.jockey}` : "";
        const musique = p.musique ? `  musique: ${p.musique}` : "";
        prompt += `  #${p.numero} ${p.nom_cheval}${cote}${jockey}${musique}\n`;
      }
    }
    prompt += "\n";
  }

  prompt += `\nRéponds UNIQUEMENT avec le JSON demandé. Inclus un objet par course dans le tableau "pronostics".`;
  return prompt;
}

// ── Appel API Claude ──────────────────────────────────────────────────────────

async function callClaude(userPrompt: string): Promise<ClaudePronostic[]> {
  if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY manquante");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method:  "POST",
    headers: {
      "x-api-key":         ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type":      "application/json",
    },
    body: JSON.stringify({
      model:      ANTHROPIC_MODEL,
      max_tokens: 1500,
      system:     SYSTEM_PROMPT,
      messages:   [{ role: "user", content: userPrompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API ${res.status}: ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  const raw  = data?.content?.[0]?.text ?? "";

  // Extraire le JSON même si Claude ajoute du texte autour
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`Réponse Claude non parseable: ${raw.slice(0, 300)}`);

  const parsed = JSON.parse(match[0]);
  return (parsed.pronostics ?? []) as ClaudePronostic[];
}

// ── Notification Slack ────────────────────────────────────────────────────────

async function sendSlack(pronostics: ClaudePronostic[], courses: CourseWithPartants[]): Promise<void> {
  if (!SLACK_WEBHOOK_PRONOSTICS) return;

  const dateStr = new Date().toLocaleDateString("fr-FR", {
    timeZone: "Europe/Paris",
    day:      "numeric",
    month:    "long",
    year:     "numeric",
  });

  const lines = [`🏇 *Pronostics Elite Turf — ${dateStr}*\n`];

  for (const prono of pronostics) {
    const course = courses.find((c) => c.id === prono.course_id);
    const nom    = course?.libelle ?? prono.course_id;
    const hippo  = course?.hippodrome ?? "";
    const heure  = formatHeure(course?.heure_depart ?? null);

    lines.push(`*${nom}* — ${hippo} · ${heure}`);
    lines.push(`📋 Type : ${prono.type_pari.replace("_", "+")} | Confiance : ${prono.confiance}`);
    lines.push(`🎯 Sélection : ${prono.selection.join(" - ")}`);
    lines.push(`💬 ${prono.analyse_courte}`);
    lines.push(`🔗 https://www.elite-turf.fr/pronostics`);
    lines.push("");
  }

  lines.push("_Généré automatiquement par Elite Turf IA · Jouer comporte des risques_");

  await fetch(SLACK_WEBHOOK_PRONOSTICS, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ text: lines.join("\n") }),
  }).catch(() => {/* Ne jamais faire crasher le cron à cause de Slack */});
}

// ── Route principale ──────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const logger = logCronStart("ia-pronostics");

  // Auth
  const auth = req.headers.get("authorization") || "";
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const today    = new Date().toLocaleString("sv-SE", { timeZone: "Europe/Paris" }).split(" ")[0];

  try {
    // ── 1. Vérifier qu'on n'a pas déjà généré des pronostics IA aujourd'hui ─
    const { data: existingIA } = await supabase
      .from("pronostics")
      .select("id")
      .eq("source", "ia-cron")
      .gte("created_at", `${today}T00:00:00+02:00`)
      .limit(1);

    if (existingIA && existingIA.length > 0) {
      await logger.finish("skip", { reason: "Pronostics IA déjà générés aujourd'hui" });
      return NextResponse.json({ ok: true, skipped: true, reason: "Déjà générés aujourd'hui" });
    }

    // ── 2. Récupérer les courses du jour ──────────────────────────────────
    const { data: coursesRaw, error: coursesErr } = await supabase
      .from("courses")
      .select(`
        id, libelle, heure_depart, nb_partants, distance_metres, paris_disponibles,
        hippodrome:hippodromes ( nom )
      `)
      .eq("date_course", today)
      .not("paris_disponibles", "is", null)
      .order("heure_depart", { ascending: true });

    if (coursesErr) throw new Error(`Supabase courses: ${coursesErr.message}`);
    if (!coursesRaw || coursesRaw.length === 0) {
      await logger.finish("skip", { reason: `Aucune course trouvée pour ${today}` });
      return NextResponse.json({ ok: true, skipped: true, reason: "Aucune course aujourd'hui" });
    }

    // ── 3. Prioriser : Quinté+ d'abord, puis Quarté+, puis nb_partants DESC ─
    type RawCourse = typeof coursesRaw[0];

    function coursePriority(c: RawCourse): number {
      const paris = (c.paris_disponibles as string[]) ?? [];
      if (paris.includes("QUINTE_PLUS")) return 0;
      if (paris.includes("QUARTE_PLUS")) return 1;
      if (paris.includes("TIERCE"))       return 2;
      return 3;
    }

    const sorted = [...coursesRaw].sort((a, b) => {
      const pd = coursePriority(a) - coursePriority(b);
      if (pd !== 0) return pd;
      return (b.nb_partants ?? 0) - (a.nb_partants ?? 0);
    });

    const selectedCourses = sorted.slice(0, 2);

    // ── 4. Charger les partants pour chaque course sélectionnée ──────────
    const coursesWithPartants: CourseWithPartants[] = [];

    for (const c of selectedCourses) {
      const hippodromeRaw = Array.isArray(c.hippodrome) ? c.hippodrome[0] : c.hippodrome;
      const hippodrome    = (hippodromeRaw as { nom: string } | null)?.nom ?? "Inconnu";

      const { data: partantsData } = await supabase
        .from("partants")
        .select("numero, nom_cheval, jockey, entraineur, cote, musique, non_partant")
        .eq("course_id", c.id)
        .order("numero", { ascending: true })
        .limit(25);

      coursesWithPartants.push({
        id:               c.id,
        libelle:          c.libelle ?? "",
        hippodrome,
        heure_depart:     c.heure_depart ?? null,
        nb_partants:      c.nb_partants ?? 0,
        distance_metres:  c.distance_metres ?? 0,
        paris_disponibles: (c.paris_disponibles as string[]) ?? [],
        partants:         (partantsData ?? []) as Partant[],
      });
    }

    // ── 5. Appeler Claude ─────────────────────────────────────────────────
    const userPrompt = buildUserPrompt(coursesWithPartants);
    const claudePronostics = await callClaude(userPrompt);

    if (!claudePronostics || claudePronostics.length === 0) {
      throw new Error("Claude n'a retourné aucun pronostic");
    }

    // ── 6. Sauvegarder dans Supabase ──────────────────────────────────────
    const now       = new Date().toISOString();
    const inserted: string[] = [];

    for (const prono of claudePronostics) {
      // Valider que le course_id existe dans nos courses sélectionnées
      const course = coursesWithPartants.find((c) => c.id === prono.course_id);
      if (!course) continue;

      const typePari    = prono.type_pari ?? getPriorityTypePari(course.paris_disponibles);
      const niveauAcces = getNiveauAcces(typePari);

      const { data: insertedRow, error: insertErr } = await supabase
        .from("pronostics")
        .insert({
          course_id:        prono.course_id,
          type_pari:        typePari,
          selection:        prono.selection,
          confiance:        prono.confiance ?? "MOYENNE",
          analyse_courte:   prono.analyse_courte ?? "",
          niveau_acces:     niveauAcces,
          publie:           true,
          date_publication: now,
          resultat:         "EN_ATTENTE",
          source:           "ia-cron",
        })
        .select("id")
        .single();

      if (insertErr) {
        console.error(`[ia-pronostics] Insert error: ${insertErr.message}`);
      } else if (insertedRow) {
        inserted.push(insertedRow.id);
      }
    }

    // ── 7. Notification Slack ─────────────────────────────────────────────
    await sendSlack(claudePronostics, coursesWithPartants);

    const stats = { inserted: inserted.length, pronostics: inserted, date: today };
    await logger.finish("success", stats);

    return NextResponse.json({ ok: true, ...stats });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[ia-pronostics] Erreur:", msg);
    await logger.finish("failure", { error: msg });
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
