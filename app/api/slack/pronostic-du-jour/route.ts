/**
 * GET /api/slack/pronostic-du-jour
 *
 * Retourne le pronostic vedette du jour (Quinté+ en priorité) au format JSON.
 * Conçu pour être appelé par Make.com qui formate et envoie ensuite dans Slack.
 *
 * Auth acceptée (l'une ou l'autre) :
 *   - Header  Authorization: Bearer <CRON_SECRET>
 *   - Header  clé API X: eliteturf-make-2026   (clé Make.com existante)
 * Réponse 200 : données + slack_text pré-formaté prêt à coller dans Make
 * Réponse 404 : aucun pronostic publié aujourd'hui
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const CRON_SECRET  = process.env.CRON_SECRET ?? "";
const MAKE_API_KEY = process.env.MAKE_API_KEY ?? "eliteturf-make-2026";
const APP_URL      = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.elite-turf.fr";

/** Date du jour heure Paris (YYYY-MM-DD) */
function getTodayParis(): string {
  return new Date().toLocaleString("sv-SE", { timeZone: "Europe/Paris" }).split(" ")[0];
}

/** Priorité nationale : Quinté+ = 1, Quarté+ = 2, Tiercé = 3, autre = 99 */
function natPriority(paris: string[]): number {
  if (paris.includes("QUINTE_PLUS") || paris.includes("QUINTE")) return 1;
  if (paris.includes("QUARTE_PLUS") || paris.includes("QUARTE")) return 2;
  if (paris.includes("TIERCE"))                                   return 3;
  return 99;
}

const CONFIANCE_LABEL: Record<number, string> = {
  1: "FAIBLE", 2: "FAIBLE", 3: "MOYEN", 4: "BON", 5: "FORT ⭐",
};

export async function GET(req: NextRequest) {
  // ── Auth optionnelle ──────────────────────────────────────────────────
  // Les données retournées sont déjà publiques sur le site.
  // Si un Bearer token est fourni et incorrect, on bloque quand même.
  const auth = req.headers.get("authorization");
  if (auth && CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const today    = getTodayParis();

  // ── Récupérer tous les pronostics publiés du jour ─────────────────────
  const { data: rows, error } = await supabase
    .from("pronostics")
    .select(`
      id, type_pari, confiance, analyse_courte, selection,
      course:courses(
        id, libelle, heure_depart, numero_reunion, numero_course,
        date_course, paris_disponibles,
        hippodrome:hippodromes(nom)
      )
    `)
    .eq("publie", true)
    .order("confiance", { ascending: false })
    .limit(20);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Filtrer sur date_course = aujourd'hui (Supabase retourne parfois un tableau)
  const todayRows = (rows ?? []).filter((p: any) => {
    const c = Array.isArray(p.course) ? p.course[0] : p.course;
    return c?.date_course === today;
  });

  if (!todayRows.length) {
    return NextResponse.json(
      { error: "Aucun pronostic publié aujourd'hui", date: today },
      { status: 404 }
    );
  }

  // Trier : priorité nationale d'abord, puis confiance descendante
  todayRows.sort((a: any, b: any) => {
    const ca = Array.isArray(a.course) ? a.course[0] : a.course;
    const cb = Array.isArray(b.course) ? b.course[0] : b.course;
    const pa = natPriority(ca?.paris_disponibles ?? []);
    const pb = natPriority(cb?.paris_disponibles ?? []);
    if (pa !== pb) return pa - pb;
    return (b.confiance ?? 0) - (a.confiance ?? 0);
  });

  const vedette: any  = todayRows[0];
  const course: any   = Array.isArray(vedette.course) ? vedette.course[0] : vedette.course;
  const hippodrome    = course?.hippodrome?.nom ?? "?";
  const heure         = (course?.heure_depart ?? "").substring(0, 5);
  const libelle       = course?.libelle ?? "Course du jour";
  const reunion       = `R${course?.numero_reunion ?? "?"}C${course?.numero_course ?? "?"}`;
  const selection     = Array.isArray(vedette.selection) ? vedette.selection : [];
  const confiance     = vedette.confiance ?? 3;
  const confianceLabel = CONFIANCE_LABEL[confiance] ?? "MOYEN";
  const analyse       = vedette.analyse_courte ?? "";
  const lien          = `${APP_URL}/pronostics/${vedette.id}`;

  // Étoiles confiance (ex: ★★★☆☆)
  const etoiles = "★".repeat(confiance) + "☆".repeat(Math.max(0, 5 - confiance));

  // Message Slack pré-formaté (Markdown Slack)
  const slack_text = [
    `🏇 *Quinté+ du jour — ${hippodrome}*`,
    `📍 *${libelle}* (${reunion})`,
    `🕐 Départ : *${heure}*`,
    `🎯 Sélection : *${selection.join(" - ")}*`,
    `${etoiles} Confiance : *${confianceLabel}*`,
    analyse ? `\n_« ${analyse} »_` : "",
    `\n🔗 <${lien}|Voir l'analyse complète sur Elite Turf>`,
  ].filter(Boolean).join("\n");

  return NextResponse.json({
    // Données brutes (pour Make si tu veux construire ton propre template)
    titre:            libelle,
    hippodrome,
    heure,
    reunion,
    type_pari:        vedette.type_pari,
    selection,
    selection_texte:  selection.join(" - "),
    confiance,
    confiance_label:  confianceLabel,
    analyse,
    lien,
    date:             today,
    // Message Slack clé-en-main — Make n'a qu'à l'envoyer directement
    slack_text,
  });
}
