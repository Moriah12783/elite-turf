import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * PUT /api/admin/partants/[courseId]
 * Remplace tous les partants d'une course (delete + insert).
 * Utilise le service client pour bypasser le RLS partants_service_all.
 * Body: { partants: Array<{...}> }
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: { courseId: string } }
) {
  try {
    const supabase = createServiceClient();
    const { partants } = await req.json();

    if (!Array.isArray(partants)) {
      return NextResponse.json({ error: "partants doit être un tableau" }, { status: 400 });
    }

    // Supprimer les anciens partants
    const { error: delErr } = await supabase
      .from("partants")
      .delete()
      .eq("course_id", params.courseId);

    if (delErr) {
      console.error("[PUT /api/admin/partants] Delete error:", delErr);
      return NextResponse.json({ error: delErr.message }, { status: 500 });
    }

    if (partants.length === 0) {
      // Mettre à jour nb_partants à 0
      await supabase
        .from("courses")
        .update({ nb_partants: 0 })
        .eq("id", params.courseId);
      return NextResponse.json({ inserted: 0 });
    }

    // Insérer les nouveaux partants
    const toInsert = partants.map((r: any) => ({
      course_id:   params.courseId,
      numero:      Number(r.numero),
      nom_cheval:  r.nom_cheval,
      jockey:      r.jockey || null,
      entraineur:  r.entraineur || null,
      cote:        r.cote != null && r.cote !== "" ? Number(r.cote) : null,
      musique:     r.musique || null,
      poids_kg:    r.poids_kg != null && r.poids_kg !== "" ? Number(r.poids_kg) : null,
      deferre:     r.deferre ?? false,
      non_partant: r.non_partant ?? false,
      scraped_at:  new Date().toISOString(),
    }));

    const { error: insErr } = await supabase.from("partants").insert(toInsert);
    if (insErr) {
      console.error("[PUT /api/admin/partants] Insert error:", insErr);
      return NextResponse.json({ error: insErr.message }, { status: 500 });
    }

    // Mettre à jour nb_partants sur la course
    await supabase
      .from("courses")
      .update({ nb_partants: partants.length })
      .eq("id", params.courseId);

    revalidatePath("/admin/courses");
    revalidatePath("/courses");

    return NextResponse.json({ inserted: partants.length });
  } catch (err: any) {
    console.error("[PUT /api/admin/partants] Unexpected error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
