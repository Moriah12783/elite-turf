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

// ── Algorithme de sélection ──────────────────────────────────────────────────

export function scoreCourse(c: any): number {
  let score = 0;
  const paris: string[] = c.paris_disponibles || [];
  // Critère principal : Tiercé disponible mais PAS Quinté+ (rester accessible)
  if (paris.includes("TIERCE") || paris.includes("TIERCE_ORDRE")) score += 10;
  if (!paris.includes("QUINTE_PLUS")) score += 8;
  // Quarté = bon niveau sans être le plus complexe
  if (paris.includes("QUARTE_PLUS") || paris.includes("QUARTE")) score += 3;
  // Nombre de partants idéal 8-12 (ni trop simple, ni trop complexe)
  const nb = c.nb_partants || 0;
  if (nb >= 8 && nb <= 12) score += 5;
  else if (nb >= 7 && nb <= 14) score += 2;
  // Départ en après-midi (13h-17h Paris) = meilleur pour le public africain
  const h = parseInt((c.heure_depart || "12:00").slice(0, 2));
  if (h >= 13 && h <= 16) score += 4;
  else if (h >= 12 && h <= 17) score += 2;
  return score;
}

export function generateAnalyse(course: any, partants: any[], selection: number[]): string {
  const hippodrome = course.hippodrome?.nom || "hippodrome";
  const distance   = course.distance_metres ? ` sur ${course.distance_metres}m` : "";
  const categorie  = course.categorie ? course.categorie.toLowerCase() : "plat";
  const terrain    = course.terrain
    ? ` — terrain ${course.terrain.toLowerCase().replace(/_/g, " ")}`
    : "";
  const nb = course.nb_partants || "?";

  const selectedPartants = partants
    .filter((p: any) => selection.includes(p.numero))
    .sort((a: any, b: any) => selection.indexOf(a.numero) - selection.indexOf(b.numero));

  const top3 = selectedPartants
    .slice(0, 3)
    .map((p: any) => `n°${p.numero} ${p.nom_cheval}`)
    .join(", ");

  return (
    `Course de ${categorie} à ${hippodrome}${distance} (${nb} partants${terrain}). ` +
    `Notre sélection du jour : ${top3}${selectedPartants.length > 3 ? " et 2 compléments." : "."} ` +
    `Résultat vérifiable ce soir sur Geny.`
  );
}

export function buildSelection(partants: any[]): number[] {
  // Trier par cote croissante (favoris en tête), prendre les 5 premiers
  const avecCote = [...partants]
    .filter((p: any) => p.cote && Number(p.cote) > 0)
    .sort((a: any, b: any) => Number(a.cote) - Number(b.cote));

  const sansCote = partants.filter((p: any) => !p.cote || Number(p.cote) <= 0);

  const ordered = [...avecCote, ...sansCote];
  return ordered.slice(0, 5).map((p: any) => p.numero).sort((a, b) => a - b);
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
