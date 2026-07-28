import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { verifyIngestAuth } from "@/lib/consensus/ingest-auth";
import { parseIngestPayload, stripJsonFences } from "@/lib/consensus/ingest";
import { validateConsensusBlock } from "@/lib/consensus/validate";
import { resoudreCourseUnique } from "@/lib/courses/resolve-course";
import { sendEmail, APP_URL } from "@/lib/email";

export const dynamic = "force-dynamic";

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  const u8 = new Uint8Array(buf);
  let hex = "";
  for (let i = 0; i < u8.length; i++) hex += (u8[i] < 16 ? "0" : "") + u8[i].toString(16);
  return hex;
}

/**
 * POST /api/v1/ingest/consensus — le pipeline dépose un consensus + commentaires.
 * Auth : Bearer ELITE_INGEST_KEY (+ HMAC X-Signature si ELITE_INGEST_SECRET posé).
 * RIEN ne se publie : un BROUILLON est créé (consensus_drafts, status=draft),
 * l'admin relit puis publie via l'atelier. Toute tentative est journalisée.
 *
 * Réponses : 401/403 auth · 400 JSON · 422 payload/validation invalide (+report)
 *   · 200 { draft_id, status:'draft', validation_report, admin_review_url } (course rattachée)
 *   · 202 { draft_id, status:'orphan_draft', ... } (course inconnue → rattachement manuel)
 */
export async function POST(req: NextRequest) {
  // Corps BRUT lu une seule fois (nécessaire pour vérifier le HMAC sur l'exact payload).
  const rawBody = await req.text();

  const auth = await verifyIngestAuth(
    req.headers.get("authorization"),
    req.headers.get("x-signature"),
    rawBody,
  );
  if (!auth.ok) return NextResponse.json({ error: "Non autorisé" }, { status: auth.status || 401 });

  let payload: any;
  try {
    // Tolère un emballage markdown ```json … ``` (fréquent quand un LLM génère
    // le payload). Le HMAC (si activé) reste calculé sur rawBody inchangé.
    payload = JSON.parse(stripJsonFences(rawBody));
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const admin = createServiceClient();
  const rawHash = await sha256Hex(rawBody);

  // Journalise TOUTE tentative (audit), même refusée plus bas.
  async function journalize(dateCourse: string | null, courseId: string | null, report: unknown) {
    try {
      await admin.from("consensus_imports").insert({
        date_course: dateCourse,
        course_id: courseId,
        raw_block: rawBody.slice(0, 20000),
        raw_hash: rawHash,
        source: "api",
        validation_report: report,
        created_by: null,
      });
    } catch (e) {
      console.error("[ingest] journalize", e);
    }
  }

  // 1) Structure de l'enveloppe (contrat v2.4)
  const parsedRes = parseIngestPayload(payload);
  if (!parsedRes.ok || !parsedRes.parsed) {
    await journalize(null, null, { ok: false, error: parsedRes.error });
    return NextResponse.json({ error: parsedRes.error, code: "PAYLOAD_INVALIDE" }, { status: 422 });
  }
  const p = parsedRes.parsed;

  // 2) Validation métier STRICTE (Lot 1, source de vérité unique)
  const report = validateConsensusBlock({
    nbPartants: p.nb_partants,
    nbSources: p.nb_sources,
    texte: p.texteBloc,
  });
  if (!report.ok) {
    await journalize(p.date_course, null, {
      ok: false, errors: report.errors, warnings: report.warnings,
      seuil_base: report.seuil_base, echantillon_reduit: report.echantillon_reduit,
    });
    return NextResponse.json(
      { error: "Bloc rejeté par la validation", code: "VALIDATION", validation_report: report },
      { status: 422 },
    );
  }

  // 3) Rattachement de la course par (date, RxCx). Jamais de course fantôme créée.
  //
  // ⚠️ (date, R, C) N'IDENTIFIE PAS une course : 429 clés ambiguës en base au
  // 28/07/2026, car deux réunions de province distinctes peuvent porter le même
  // numéro le même jour (Karukéra et Avignon toutes deux « R8 » le 26/07).
  // L'ancien `.limit(1)` rattachait donc SILENCIEUSEMENT le consensus à une
  // course prise au hasard. On récupère toutes les candidates, on départage par
  // l'hippodrome de la charge utile, et sans certitude on laisse ORPHELIN —
  // le mail d'alerte demande alors un rattachement manuel.
  let courseId: string | null = null;
  const rc = p.reunion_course.match(/^R(\d+)C(\d+)$/i);
  if (rc) {
    const { data: candidats } = await admin
      .from("courses")
      .select("id, hippodrome:hippodromes(nom)")
      .eq("date_course", p.date_course)
      .eq("numero_reunion", parseInt(rc[1], 10))
      .eq("numero_course", parseInt(rc[2], 10));

    const resolution = resoudreCourseUnique(
      (candidats ?? []).map((c: any) => ({
        id: c.id,
        hippodrome_nom: c.hippodrome?.nom ?? null,
      })),
      p.hippodrome,
    );

    if (resolution.statut === "TROUVEE") {
      courseId = resolution.course.id;
    } else if (resolution.statut === "AMBIGUE") {
      console.warn(
        `[ingest consensus] ${p.date_course} ${p.reunion_course} : ` +
        `${resolution.candidats.length} courses candidates et l'hippodrome ` +
        `« ${p.hippodrome ?? "—"} » ne départage pas → laissé orphelin`,
      );
    }
  }

  // 4) Un consensus déjà PUBLIÉ n'est JAMAIS écrasé (contrat v2.4) : re-POST du
  //    même run après publication → 409, la décision humaine est finale.
  //    (draft/reviewed/rejected restent remplaçables : un re-POST = données
  //    corrigées par le pipeline → le brouillon re-surface pour relecture.)
  const { data: existing } = await admin
    .from("consensus_drafts")
    .select("id, status")
    .eq("date_course", p.date_course)
    .eq("reunion_course", p.reunion_course)
    .eq("run_type", p.run_type)
    .maybeSingle();

  if (existing && existing.status === "published") {
    await journalize(p.date_course, courseId, { ok: true, note: "déjà publié — non écrasé (409)" });
    return NextResponse.json(
      {
        draft_id: existing.id,
        status: "already_published",
        error: "Ce consensus a déjà été publié par l'admin — il n'est jamais écrasé.",
      },
      { status: 409 },
    );
  }

  // 5) Upsert idempotent (date, RxCx, run_type). Un re-POST du même run remplace
  //    le brouillon non publié — jamais de doublon (created_at préservé).
  // Les non-partants déclarés par le pipeline sont marqués DANS les citations
  // (`np: true`) — pas de colonne dédiée, l'atelier les lit de là.
  const npSet: Record<number, boolean> = {};
  for (let i = 0; i < p.non_partants.length; i++) npSet[p.non_partants[i]] = true;
  const citationsForDraft = p.citations.map((c) => {
    const row: { numero: number; citations: number; bases: number; cote?: number; np?: true } = {
      numero: c.numero, citations: c.citations, bases: c.bases,
    };
    if (c.cote != null) row.cote = c.cote;   // cote PMU du pipeline (priorité LONACI côté atelier)
    if (npSet[c.numero]) row.np = true;
    return row;
  });

  const draftRow = {
    date_course: p.date_course,
    reunion_course: p.reunion_course,
    hippodrome: p.hippodrome,
    nb_partants: p.nb_partants,
    course_id: courseId,
    run_type: p.run_type,
    contract_version: p.contract_version,
    type_pari: p.type_pari,
    nb_sources: p.nb_sources,
    nb_sources_brut: p.nb_sources_brut,
    echantillon_reduit: report.echantillon_reduit,
    citations: citationsForDraft,
    commentaires: p.commentaires,
    validation_report: {
      ok: report.ok, warnings: report.warnings,
      seuil_base: report.seuil_base, echantillon_reduit: report.echantillon_reduit,
    },
    raw_hash: rawHash,
    status: "draft",
    updated_at: new Date().toISOString(),
  };

  const { data: upserted, error: upsertErr } = await admin
    .from("consensus_drafts")
    .upsert(draftRow, { onConflict: "date_course,reunion_course,run_type" })
    .select("id")
    .single();

  await journalize(p.date_course, courseId, {
    ok: true, warnings: report.warnings,
    seuil_base: report.seuil_base, echantillon_reduit: report.echantillon_reduit,
  });

  if (upsertErr || !upserted) {
    console.error("[ingest] upsert draft", upsertErr);
    return NextResponse.json({ error: "Erreur enregistrement brouillon" }, { status: 500 });
  }

  // 6) Notification à l'admin (best-effort : n'échoue jamais la requête)
  const reviewUrl = `${APP_URL}/admin/consensus/brouillons`;
  const orphan = !courseId;
  try {
    await sendEmail({
      to: "manuel.conti2008@gmail.com",
      subject: `Consensus ${p.date_course} ${p.hippodrome || p.reunion_course} prêt à relire${orphan ? " (à rattacher)" : ""}`,
      html: `<p>Un consensus (<b>${p.run_type}</b>) est prêt à relire.</p>
<p><b>${p.hippodrome || "—"} ${p.reunion_course}</b> · ${p.nb_sources} sources${report.echantillon_reduit ? " · <b>⚠️ échantillon réduit</b>" : ""}${orphan ? "<br><b>⚠️ Course non trouvée</b> — à rattacher manuellement." : ""}</p>
<p><a href="${reviewUrl}">Ouvrir les brouillons →</a></p>`,
    });
  } catch (e) {
    console.error("[ingest] email", e);
  }

  return NextResponse.json(
    {
      draft_id: upserted.id,
      status: orphan ? "orphan_draft" : "draft",
      validation_report: { ok: true, warnings: report.warnings, echantillon_reduit: report.echantillon_reduit },
      admin_review_url: reviewUrl,
    },
    { status: orphan ? 202 : 200 },
  );
}
