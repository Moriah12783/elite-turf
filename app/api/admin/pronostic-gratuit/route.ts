/**
 * POST /api/admin/pronostic-gratuit
 *
 * Crée et publie le pronostic gratuit du jour (Tiercé, 5 chevaux, GRATUIT).
 * Appelé par la page admin ou par le cron.
 *
 * Body : { course_id, selection: number[], analyse_courte, confiance }
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

const CRON_SECRET = process.env.CRON_SECRET || "";

function getTodayParis(): string {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date()).split("/").reverse().join("-");
}

// ── POST : créer le pronostic gratuit ───────────────────────────────────────

export async function POST(req: NextRequest) {
  // Auth : admin connecté OU cron secret
  const authHeader = req.headers.get("authorization") || "";
  const isCron = CRON_SECRET && authHeader === `Bearer ${CRON_SECRET}`;

  if (!isCron) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

    const adminClient = createServiceClient();
    const { data: profile } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || profile.role !== "ADMIN") {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }
  }

  const body = await req.json();
  const { course_id, selection, analyse_courte, confiance = 3 } = body;

  if (!course_id || !Array.isArray(selection) || selection.length === 0 || !analyse_courte) {
    return NextResponse.json({ error: "Données manquantes" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const today = getTodayParis();

  // Vérifier qu'il n'y en a pas déjà un aujourd'hui
  const { data: existing } = await supabase
    .from("pronostics")
    .select("id")
    .eq("niveau_acces", "GRATUIT")
    .eq("publie", true)
    .gte("date_publication", today)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "Un pronostic gratuit est déjà publié aujourd'hui" }, { status: 409 });
  }

  const { data, error } = await supabase
    .from("pronostics")
    .insert({
      course_id,
      niveau_acces:    "GRATUIT",
      type_pari:       "TIERCE",
      selection,
      confiance,
      analyse_courte,
      analyse_texte:   null,
      resultat:        "EN_ATTENTE",
      publie:          true,
      date_publication: new Date().toISOString(),
      nb_vues:         0,
      nb_likes:        0,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[pronostic-gratuit] Erreur insertion:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  console.log(`[pronostic-gratuit] Publié — id: ${data.id} — course: ${course_id}`);
  return NextResponse.json({ ok: true, pronostic_id: data.id });
}
