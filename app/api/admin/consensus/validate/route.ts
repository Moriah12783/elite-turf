import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { validateConsensusBlock, type ValidationReport } from "@/lib/consensus/validate";

export const dynamic = "force-dynamic";

/** SHA-256 hex (Web Crypto, dispo sur Cloudflare Workers). ES5-safe (pas de spread). */
async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  const u8 = new Uint8Array(buf);
  let hex = "";
  for (let i = 0; i < u8.length; i++) hex += (u8[i] < 16 ? "0" : "") + u8[i].toString(16);
  return hex;
}

/**
 * POST /api/admin/consensus/validate — Lot 1 (contrat v2.4).
 * Valide un bloc consensus (module unique lib/consensus/validate) et JOURNALISE
 * la tentative dans `consensus_imports` (réussie ou non — piste d'audit).
 * Body : { date_course?, course_id?, nb_partants, nb_sources, texte }
 * Réponse : { report: ValidationReport } (200 même si non-ok : le rapport porte le verdict).
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const adminClient = createServiceClient();
  const { data: profile } = await adminClient
    .from("profiles").select("role").eq("id", user.id).single();
  if (!profile || profile.role !== "ADMIN") {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const texte = typeof body?.texte === "string" ? body.texte : "";
  const report: ValidationReport = validateConsensusBlock({
    nbPartants: Number(body?.nb_partants),
    nbSources: Number(body?.nb_sources),
    texte,
  });

  // Journalisation systématique (le rapport stocké n'embarque pas les partants :
  // le bloc brut + hash suffisent à rejouer, et on évite la redondance).
  try {
    await adminClient.from("consensus_imports").insert({
      date_course: body?.date_course || null,
      course_id: body?.course_id || null,
      raw_block: texte,
      raw_hash: await sha256Hex(texte),
      source: "manuel",
      validation_report: {
        ok: report.ok,
        errors: report.errors,
        warnings: report.warnings,
        seuil_base: report.seuil_base,
        echantillon_reduit: report.echantillon_reduit,
      },
      created_by: user.id,
    });
  } catch (e) {
    console.error("[consensus] journalisation import", e);
    // la journalisation ne doit pas bloquer le rapport — mais on le signale
  }

  return NextResponse.json({ report });
}
