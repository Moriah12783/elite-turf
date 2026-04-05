/**
 * POST/GET /api/admin/rapport-journalier/envoyer
 *
 * Génère le rapport post-course du jour ET envoie un email à l'admin.
 * Appelé par l'agent Claude programmé chaque soir à 21h UTC.
 *
 * Query params :
 *  ?date=YYYY-MM-DD  (défaut : aujourd'hui)
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "contact@elite-turf.fr";

// ── Helpers ───────────────────────────────────────────────────────────────

function resultEmoji(resultat: string) {
  if (resultat === "GAGNANT") return "✅";
  if (resultat === "PARTIEL") return "⚡";
  if (resultat === "PERDANT") return "❌";
  return "⏳";
}

function resultColor(resultat: string) {
  if (resultat === "GAGNANT") return "#22c55e";
  if (resultat === "PARTIEL") return "#f59e0b";
  if (resultat === "PERDANT") return "#ef4444";
  return "#6b7280";
}

function scoreColor(score: number) {
  if (score >= 80) return "#22c55e";
  if (score >= 50) return "#f59e0b";
  return "#ef4444";
}

function computeHits(selection: number[], arrivee: number[], topN: number): number[] {
  const top = new Set(arrivee.slice(0, topN));
  return selection.filter((n) => top.has(n));
}

function getTopN(selection: number[], typePari: string): number {
  const tp = typePari?.toLowerCase() ?? "";
  if (tp.includes("quinté") || selection.length >= 5) return 5;
  if (tp.includes("quarté") || selection.length >= 4) return 4;
  return 3;
}

// ── Template email HTML ───────────────────────────────────────────────────

function buildEmailHtml(data: {
  date: string;
  rapport: any[];
  gagnants: number;
  partiels: number;
  perdants: number;
  tauxJour: number;
}) {
  const { date, rapport, gagnants, partiels, perdants, tauxJour } = data;

  const lignesCourses = rapport.map((r: any) => `
    <tr>
      <td style="padding:12px 16px; border-bottom:1px solid #1e1e2e;">
        <div style="font-weight:700; color:#f0f0f5; font-size:14px;">${resultEmoji(r.resultat)} ${r.libelle}</div>
        <div style="color:#9ca3af; font-size:12px; margin-top:2px;">${r.hippodrome} · R${r.reunion}C${r.course} · ${r.typePari}</div>
      </td>
      <td style="padding:12px 16px; border-bottom:1px solid #1e1e2e; text-align:center; font-size:13px; color:#d1d5db;">
        ${r.selection.join(' - ')}
      </td>
      <td style="padding:12px 16px; border-bottom:1px solid #1e1e2e; text-align:center; font-size:13px; color:#d1d5db;">
        ${r.arriveeOfficielle.join(' - ')}
      </td>
      <td style="padding:12px 16px; border-bottom:1px solid #1e1e2e; text-align:center;">
        <span style="font-weight:700; color:${resultColor(r.resultat)}; font-size:13px;">
          ${r.resultat} (${r.hitsCount}/${r.totalSelection})
        </span>
        ${r.rapportPMU ? `<div style="color:#c9a84c; font-size:11px; margin-top:2px;">${r.rapportPMU.toFixed(2)}€ / 1€</div>` : ''}
      </td>
    </tr>
  `).join('');

  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0; padding:0; background:#0a0a14; font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:680px; margin:0 auto; padding:24px 16px;">

    <!-- Header -->
    <div style="text-align:center; margin-bottom:28px;">
      <div style="font-size:11px; letter-spacing:3px; text-transform:uppercase; color:#c9a84c; margin-bottom:6px;">
        Rapport Post-Course
      </div>
      <h1 style="margin:0; font-size:24px; font-weight:800; color:#f0f0f5;">
        ELITE TURF
      </h1>
      <div style="color:#9ca3af; font-size:13px; margin-top:4px;">${date}</div>
    </div>

    <!-- Score global -->
    <div style="background:#12121f; border:1px solid #2a2a45; border-radius:16px; padding:20px; margin-bottom:20px; text-align:center;">
      <div style="font-size:11px; text-transform:uppercase; letter-spacing:2px; color:#9ca3af; margin-bottom:10px;">Score du jour</div>
      <div style="font-size:48px; font-weight:800; color:${scoreColor(tauxJour)};">${tauxJour}%</div>
      <div style="display:flex; justify-content:center; gap:24px; margin-top:14px; flex-wrap:wrap;">
        <div style="text-align:center;">
          <div style="font-size:22px; font-weight:700; color:#22c55e;">${gagnants}</div>
          <div style="font-size:11px; color:#9ca3af; text-transform:uppercase;">Gagnants</div>
        </div>
        <div style="text-align:center;">
          <div style="font-size:22px; font-weight:700; color:#f59e0b;">${partiels}</div>
          <div style="font-size:11px; color:#9ca3af; text-transform:uppercase;">Partiels</div>
        </div>
        <div style="text-align:center;">
          <div style="font-size:22px; font-weight:700; color:#ef4444;">${perdants}</div>
          <div style="font-size:11px; color:#9ca3af; text-transform:uppercase;">Perdants</div>
        </div>
      </div>
    </div>

    <!-- Tableau des courses -->
    ${rapport.length > 0 ? `
    <div style="background:#12121f; border:1px solid #2a2a45; border-radius:16px; overflow:hidden; margin-bottom:20px;">
      <div style="padding:14px 16px; border-bottom:1px solid #2a2a45; background:#0e0e1c;">
        <span style="font-size:12px; text-transform:uppercase; letter-spacing:2px; color:#c9a84c; font-weight:700;">
          Détail des courses
        </span>
      </div>
      <table style="width:100%; border-collapse:collapse;">
        <thead>
          <tr style="background:#0e0e1c;">
            <th style="padding:10px 16px; text-align:left; font-size:11px; color:#6b7280; text-transform:uppercase; font-weight:600;">Course</th>
            <th style="padding:10px 16px; text-align:center; font-size:11px; color:#6b7280; text-transform:uppercase; font-weight:600;">Sélection</th>
            <th style="padding:10px 16px; text-align:center; font-size:11px; color:#6b7280; text-transform:uppercase; font-weight:600;">Arrivée</th>
            <th style="padding:10px 16px; text-align:center; font-size:11px; color:#6b7280; text-transform:uppercase; font-weight:600;">Résultat</th>
          </tr>
        </thead>
        <tbody>
          ${lignesCourses}
        </tbody>
      </table>
    </div>
    ` : `
    <div style="background:#12121f; border:1px solid #2a2a45; border-radius:16px; padding:24px; text-align:center; margin-bottom:20px;">
      <div style="color:#9ca3af; font-size:14px;">Aucun pronostic résolu pour cette date.</div>
    </div>
    `}

    <!-- Lien admin -->
    <div style="text-align:center; margin-bottom:24px;">
      <a href="https://www.elite-turf.fr/admin/pronostics"
         style="display:inline-block; background:#c9a84c; color:#0a0a14; font-weight:700; font-size:13px;
                padding:12px 28px; border-radius:12px; text-decoration:none; letter-spacing:0.5px;">
        Voir dans l'admin →
      </a>
    </div>

    <!-- Footer -->
    <div style="text-align:center; color:#4b5563; font-size:11px; padding-top:16px; border-top:1px solid #1e1e2e;">
      Elite Turf · Rapport automatique généré à ${new Date().toLocaleTimeString("fr-FR", { timeZone: "Africa/Abidjan", hour: "2-digit", minute: "2-digit" })} (Abidjan)
      <br>Ce message est envoyé uniquement à l'administrateur.
    </div>

  </div>
</body>
</html>`;
}

// ── Handler ───────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const url     = new URL(req.url);
  const dateISO = url.searchParams.get("date") || new Date().toISOString().split("T")[0];

  const supabase = createServiceClient();

  // 1. Récupérer les pronostics résolus du jour
  const { data: pronostics, error } = await supabase
    .from("pronostics")
    .select(`
      id, selection, type_pari, resultat, rapport_gagnant, confiance,
      course:courses (
        id, libelle, date_course, numero_reunion, numero_course,
        arrivee_officielle, hippodrome:hippodromes(nom)
      )
    `)
    .eq("publie", true)
    .neq("resultat", "EN_ATTENTE");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Filtrer sur la date
  const duJour = (pronostics ?? []).filter((p) => {
    const c = Array.isArray(p.course) ? p.course[0] : p.course as any;
    return c?.date_course === dateISO;
  });

  // 2. Construire le rapport
  const rapport = duJour.map((p) => {
    const course   = Array.isArray(p.course) ? p.course[0] : p.course as any;
    const hippNom  = Array.isArray(course?.hippodrome) ? course.hippodrome[0]?.nom : course?.hippodrome?.nom ?? "—";
    const selection: number[] = p.selection ?? [];
    const arrivee: number[]   = course?.arrivee_officielle ?? [];
    const topN                = getTopN(selection, p.type_pari ?? "");
    const hits                = computeHits(selection, arrivee, topN);

    return {
      libelle:           course?.libelle ?? "—",
      hippodrome:        hippNom,
      reunion:           course?.numero_reunion,
      course:            course?.numero_course,
      typePari:          p.type_pari ?? "—",
      selection,
      arriveeOfficielle: arrivee.slice(0, topN),
      hitsCount:         hits.length,
      totalSelection:    selection.length,
      resultat:          p.resultat,
      rapportPMU:        p.rapport_gagnant ?? null,
    };
  });

  const total    = rapport.length;
  const gagnants = rapport.filter(r => r.resultat === "GAGNANT").length;
  const partiels = rapport.filter(r => r.resultat === "PARTIEL").length;
  const perdants = rapport.filter(r => r.resultat === "PERDANT").length;
  const tauxJour = total > 0 ? Math.round(((gagnants + partiels * 0.5) / total) * 100) : 0;

  // 3. Envoyer l'email à l'admin
  const sujet = total === 0
    ? `[Elite Turf] Rapport du ${dateISO} — Aucun pronostic`
    : `[Elite Turf] Rapport du ${dateISO} — ${gagnants}✅ ${partiels}⚡ ${perdants}❌ · Score ${tauxJour}%`;

  const html = buildEmailHtml({ date: dateISO, rapport, gagnants, partiels, perdants, tauxJour });
  const sent = await sendEmail({ to: ADMIN_EMAIL, subject: sujet, html });

  return NextResponse.json({
    ok:       true,
    date:     dateISO,
    total,
    gagnants,
    partiels,
    perdants,
    tauxJour: `${tauxJour}%`,
    emailSent: sent,
    emailTo:  ADMIN_EMAIL,
  });
}

export async function POST(req: NextRequest) {
  return GET(req);
}
