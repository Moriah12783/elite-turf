import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import type { RapportsPMU } from "@/lib/sync/geny-rapports-parser";

/**
 * POST /api/admin/arrivees
 *
 * Crée ou met à jour une arrivée + ses rapports PMU pour une course donnée.
 * Cette route est utilisée par la page /admin/arrivees pour la saisie manuelle
 * ou la validation d'un pré-remplissage Geny.
 *
 * Side-effects :
 *  - Upsert dans `arrivees` (clé : course_id)
 *  - Update `courses.arrivee_officielle` + `statut = TERMINE`
 *  - Revalidate les pages publiques /arrivees/<date> + /quinte-plus/<date>
 *    (les pages today sont déjà full-dynamic mais on revalide explicitement
 *    pour les autres dates et le sitemap-news)
 *
 * Auth : protégée par middleware (/admin) — ce endpoint est appelé depuis
 * la page admin via fetch (cookies session inclus).
 */

interface PostBody {
  course_id:      string;
  ordre_arrivee:  number[];
  rapports_pmu?:  RapportsPMU | null;
  commentaire?:   string | null;
}

function isValidArrivee(arr: unknown): arr is number[] {
  return (
    Array.isArray(arr)
    && arr.length >= 3
    && arr.length <= 20
    && arr.every((n) => Number.isInteger(n) && n >= 1 && n <= 99)
    && new Set(arr).size === arr.length // pas de doublons
  );
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    const body = (await req.json()) as PostBody;

    // ── Validation ───────────────────────────────────────────────────────
    if (!body.course_id) {
      return NextResponse.json(
        { error: "course_id manquant" },
        { status: 400 },
      );
    }
    if (!isValidArrivee(body.ordre_arrivee)) {
      return NextResponse.json(
        { error: "ordre_arrivee invalide (3-20 numéros uniques entre 1 et 99)" },
        { status: 400 },
      );
    }

    // ── Vérifier que la course existe ────────────────────────────────────
    const { data: course, error: courseErr } = await supabase
      .from("courses")
      .select("id, date_course, numero_reunion, numero_course")
      .eq("id", body.course_id)
      .single();

    if (courseErr || !course) {
      return NextResponse.json(
        { error: "Course introuvable" },
        { status: 404 },
      );
    }

    // ── Upsert dans arrivees ─────────────────────────────────────────────
    // Note : la table arrivees a aussi des champs legacy rapport_quinte/
    // quarte/tierce (numeric) qu'on extrait des rapports_pmu pour les
    // garder consistants avec l'historique.
    const rapports = body.rapports_pmu ?? null;
    const arriveePayload = {
      course_id:       body.course_id,
      ordre_arrivee:   body.ordre_arrivee,
      rapport_quinte:  rapports?.quinte_plus?.ordre ?? null,
      rapport_quarte:  rapports?.quarte_plus?.ordre ?? null,
      rapport_tierce:  rapports?.tierce?.ordre ?? null,
      rapports_pmu:    rapports,
      commentaire:     body.commentaire?.trim() || null,
      horodatage:      new Date().toISOString(),
    };

    const { error: arriveeErr } = await supabase
      .from("arrivees")
      .upsert(arriveePayload, { onConflict: "course_id" });

    if (arriveeErr) {
      console.error("[POST /api/admin/arrivees] arrivees upsert:", arriveeErr);
      return NextResponse.json(
        { error: arriveeErr.message },
        { status: 500 },
      );
    }

    // ── Update courses.arrivee_officielle + statut ───────────────────────
    const { error: courseUpdateErr } = await supabase
      .from("courses")
      .update({
        arrivee_officielle: body.ordre_arrivee,
        statut:             "TERMINE",
      })
      .eq("id", body.course_id);

    if (courseUpdateErr) {
      console.error("[POST /api/admin/arrivees] courses update:", courseUpdateErr);
      // On ne fail pas — l'arrivée est sauvée, le statut peut être corrigé manuellement
    }

    // ── Revalidate pages publiques ───────────────────────────────────────
    try {
      revalidatePath(`/arrivees/${course.date_course}`);
      revalidatePath(`/quinte-plus/${course.date_course}`);
      revalidatePath(`/programme/${course.date_course}`);
      revalidatePath(`/courses/${body.course_id}`);
      revalidatePath("/sitemap-news.xml");
    } catch {
      // best-effort : revalidatePath peut échouer en dev
    }

    return NextResponse.json({
      ok:           true,
      course_id:    body.course_id,
      reference:    `R${course.numero_reunion}C${course.numero_course}`,
      date_course:  course.date_course,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    console.error("[POST /api/admin/arrivees] exception:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/arrivees?course_id=<id>
 *
 * Supprime l'arrivée d'une course (rétablit statut PROGRAMME).
 * Utile en cas d'erreur de saisie ou de course annulée.
 */
export async function DELETE(req: NextRequest) {
  try {
    const courseId = req.nextUrl.searchParams.get("course_id");
    if (!courseId) {
      return NextResponse.json(
        { error: "course_id manquant" },
        { status: 400 },
      );
    }

    const supabase = createServiceClient();

    const { data: course } = await supabase
      .from("courses")
      .select("date_course")
      .eq("id", courseId)
      .single();

    await supabase.from("arrivees").delete().eq("course_id", courseId);
    await supabase
      .from("courses")
      .update({ arrivee_officielle: null, statut: "PROGRAMME" })
      .eq("id", courseId);

    if (course) {
      try {
        revalidatePath(`/arrivees/${course.date_course}`);
        revalidatePath(`/quinte-plus/${course.date_course}`);
        revalidatePath(`/programme/${course.date_course}`);
        revalidatePath(`/courses/${courseId}`);
      } catch {
        // best-effort
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    console.error("[DELETE /api/admin/arrivees] exception:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
