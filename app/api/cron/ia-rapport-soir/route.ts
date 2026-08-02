/**
 * GET /api/cron/ia-rapport-soir
 *
 * Cron Vercel — 21h00 Paris (19h00 UTC) chaque jour
 *
 * 1. Récupère les pronostics du jour (résolus et en attente) depuis Supabase
 * 2. Calcule le taux de réussite de la journée
 * 3. Déclenche une dernière sync des résultats via sync-resultats
 * 4. Envoie un rapport complet dans Slack #alertes-ia
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { logCronStart } from "@/lib/cron-logger";
import { requeteInterne, lireReponse } from "@/lib/http/requete-interne";
import { POST as synchroniserResultats } from "@/app/api/admin/sync-resultats/route";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const CRON_SECRET         = process.env.CRON_SECRET || "";
const SLACK_WEBHOOK_ALERTES = process.env.SLACK_WEBHOOK_ALERTES || "";
const APP_URL             = (process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://www.elite-turf.fr");

// ── Helpers ───────────────────────────────────────────────────────────────────

function emojiResultat(r: string): string {
  if (r === "GAGNANT") return "✅";
  if (r === "PARTIEL") return "⚡";
  if (r === "PERDANT") return "❌";
  return "⏳";
}

function formatHeure(raw: string | null): string {
  if (!raw) return "—";
  const [h, m] = raw.split(":");
  return `${h}h${m}`;
}

// ── Route principale ──────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const logger = logCronStart("ia-rapport-soir");

  // Auth
  const auth = req.headers.get("authorization") || "";
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const today    = new Date().toLocaleString("sv-SE", { timeZone: "Europe/Paris" }).split(" ")[0];

  try {
    // ── 1. Déclencher une dernière sync des résultats, EN PROCESSUS ───────
    // ⚠️ L'ancien `fetch` vers l'URL publique échouait en silence : un Worker
    // Cloudflare qui s'appelle lui-même reçoit « error code: 522 ». Comme le
    // résultat n'était pas vérifié, le rapport du soir se construisait sur des
    // résultats non resynchronisés SANS que rien ne le signale. On appelle
    // désormais le handler directement, et on journalise l'issue.
    //
    // L'attente de 3 s n'a plus lieu d'être : l'appel en processus est await,
    // donc la synchronisation est terminée quand on reprend la main.
    try {
      const res = await synchroniserResultats(requeteInterne("/api/admin/sync-resultats"));
      const { ok, statut, donnees, texte } = await lireReponse(res);
      if (!ok) {
        console.error(`[ia-rapport-soir] sync-resultats a échoué (${statut}) :`, texte ?? donnees);
      }
    } catch (e) {
      // Non bloquant — le rapport reste utile même sans resynchronisation,
      // mais l'échec est désormais VISIBLE dans les logs.
      console.error("[ia-rapport-soir] sync-resultats indisponible :", e);
    }

    // ── 2. Récupérer tous les pronostics du jour ──────────────────────────
    const { data: pronostics, error: fetchErr } = await supabase
      .from("pronostics")
      .select(`
        id, type_pari, selection, resultat, rapport_gagnant, confiance,
        course:courses (
          libelle, heure_depart, date_course,
          hippodrome:hippodromes ( nom )
        )
      `)
      .eq("publie", true);

    if (fetchErr) throw new Error(`Fetch pronostics: ${fetchErr.message}`);

    // Filtrer sur la date du jour
    const todayPronostics = (pronostics ?? []).filter((p) => {
      const courseRaw = Array.isArray(p.course) ? p.course[0] : p.course;
      return (courseRaw as { date_course: string } | null)?.date_course === today;
    });

    // ── 3. Calculer les statistiques du jour ──────────────────────────────
    const termines  = todayPronostics.filter((p) => p.resultat !== "EN_ATTENTE");
    const enAttente = todayPronostics.filter((p) => p.resultat === "EN_ATTENTE");
    const gagnants  = termines.filter((p) => p.resultat === "GAGNANT");
    const partiels  = termines.filter((p) => p.resultat === "PARTIEL");
    const perdants  = termines.filter((p) => p.resultat === "PERDANT");

    const tauxJour = termines.length > 0
      ? Math.round(((gagnants.length + partiels.length * 0.5) / termines.length) * 100)
      : null;

    // ── 4. Statistiques globales (tous les pronostics historiques) ─────────
    const { data: allResults } = await supabase
      .from("pronostics")
      .select("resultat")
      .eq("publie", true)
      .neq("resultat", "EN_ATTENTE");

    const totalHistorique = allResults?.length ?? 0;
    const gagnantsHisto   = allResults?.filter((p: { resultat: string }) => p.resultat === "GAGNANT").length ?? 0;
    const tauxHistorique  = totalHistorique > 0
      ? Math.round((gagnantsHisto / totalHistorique) * 100)
      : 0;

    // ── 5. Construire le rapport Slack ────────────────────────────────────
    if (SLACK_WEBHOOK_ALERTES) {
      const dateLabel = new Date().toLocaleDateString("fr-FR", {
        timeZone: "Europe/Paris",
        weekday:  "long",
        day:      "numeric",
        month:    "long",
      });

      const lines: string[] = [
        `📊 *Rapport Elite Turf — ${dateLabel}*`,
        "",
      ];

      if (todayPronostics.length === 0) {
        lines.push("_Aucun pronostic publié aujourd'hui._");
      } else {
        // Résumé stats
        if (tauxJour !== null) {
          const trendEmoji = tauxJour >= 60 ? "🟢" : tauxJour >= 40 ? "🟡" : "🔴";
          lines.push(`${trendEmoji} *Taux du jour : ${tauxJour}%* — ${gagnants.length}G / ${partiels.length}P / ${perdants.length}L sur ${termines.length} terminés`);
        } else {
          lines.push(`⏳ Résultats en attente (${enAttente.length} course${enAttente.length > 1 ? "s" : ""})`);
        }
        lines.push(`📈 Taux historique global : *${tauxHistorique}%* (${totalHistorique} pronostics)`);
        lines.push("");

        // Détail de chaque pronostic du jour
        lines.push("*Détail des pronostics du jour :*");
        for (const p of todayPronostics) {
          const courseRaw   = Array.isArray(p.course) ? p.course[0] : p.course;
          const course      = courseRaw as { libelle: string; heure_depart: string | null; hippodrome: { nom: string } | { nom: string }[] } | null;
          const hippoRaw    = Array.isArray(course?.hippodrome) ? course?.hippodrome[0] : course?.hippodrome;
          const hippodrome  = (hippoRaw as { nom: string } | null)?.nom ?? "—";
          const libelle     = course?.libelle ?? "—";
          const heure       = formatHeure(course?.heure_depart ?? null);
          const selectionStr = (p.selection as number[])?.join("-") ?? "—";
          const rapport      = p.rapport_gagnant ? ` | Rapport : ${p.rapport_gagnant}€` : "";

          lines.push(
            `${emojiResultat(p.resultat)} *${libelle}* — ${hippodrome} · ${heure}`
          );
          lines.push(`   Sélection : ${selectionStr} · ${p.type_pari}${rapport}`);
        }
      }

      lines.push("");
      lines.push(`🔗 ${APP_URL}/performances`);
      lines.push("_Elite Turf — Jouer comporte des risques · 09 74 75 13 13_");

      await fetch(SLACK_WEBHOOK_ALERTES, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ text: lines.join("\n") }),
      }).catch(() => {/* Non bloquant */});
    }

    // ── 6. Résultat final ─────────────────────────────────────────────────
    const stats = {
      date:             today,
      total_jour:       todayPronostics.length,
      termines:         termines.length,
      gagnants:         gagnants.length,
      partiels:         partiels.length,
      perdants:         perdants.length,
      en_attente:       enAttente.length,
      taux_jour:        tauxJour !== null ? `${tauxJour}%` : "N/A",
      taux_historique:  `${tauxHistorique}%`,
      total_historique: totalHistorique,
    };

    await logger.finish("success", stats);
    return NextResponse.json({ ok: true, ...stats });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[ia-rapport-soir] Erreur:", msg);
    await logger.finish("failure", { error: msg });
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
