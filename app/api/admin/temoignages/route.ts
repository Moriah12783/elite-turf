/**
 * POST /api/admin/temoignages — saisie d'un témoignage réel (admin).
 *
 * Les témoignages arrivent par WhatsApp (CTA « Partager mon expérience ») et
 * sont saisis ici par l'admin, en statut `pending` par défaut. La publication
 * passe par PATCH /api/admin/temoignages/[id] (statut approved/rejected).
 * Voir docs/audit-sprint15.md (Lot 3).
 */

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAdminAuth } from "@/lib/auth/checkAdminAuth";

const PACKS    = ["Starter", "Pro", "Elite"];
const SOURCES  = ["whatsapp", "formulaire", "email"];

export async function POST(req: NextRequest) {
  const authError = await requireAdminAuth(req);
  if (authError) return authError;

  try {
    const body = await req.json();
    const nom_affiche = (body.nom_affiche || "").trim();
    const texte       = (body.texte || "").trim();

    if (!nom_affiche || !texte) {
      return NextResponse.json({ error: "nom_affiche et texte sont requis" }, { status: 400 });
    }
    if (body.pack && !PACKS.includes(body.pack)) {
      return NextResponse.json({ error: "pack invalide" }, { status: 400 });
    }
    const note = body.note != null ? Number(body.note) : null;
    if (note != null && (Number.isNaN(note) || note < 1 || note > 5)) {
      return NextResponse.json({ error: "note invalide (1-5)" }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("testimonials")
      .insert({
        nom_affiche,
        texte,
        ville:      (body.ville || "").trim() || null,
        pays:       (body.pays || "").trim() || null,
        pack:       body.pack || null,
        note,
        preuve_url: (body.preuve_url || "").trim() || null,
        source:     SOURCES.includes(body.source) ? body.source : "whatsapp",
      })
      .select("id")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    revalidatePath("/admin/temoignages");
    return NextResponse.json({ success: true, id: data.id });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Erreur" }, { status: 500 });
  }
}
