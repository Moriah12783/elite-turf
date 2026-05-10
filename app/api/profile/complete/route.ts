/**
 * POST /api/profile/complete
 *
 * Endpoint serveur pour compléter le profil d'un utilisateur authentifié.
 * Utilisé par /completer-profil pour mettre à jour phone + pays + nom_complet
 * SANS passer par le client RLS (qui a une récursion infinie sur la table
 * profiles à corriger plus tard).
 *
 * Auth : session cookie Supabase (l'utilisateur doit être connecté).
 * Bypass RLS : utilise service_role pour faire l'UPDATE.
 *
 * Body :
 *   {
 *     phone:       string  (8+ chiffres requis)
 *     pays:        string  (valeur de la liste PAYS_OPTIONS)
 *     nomComplet:  string  (au moins 1 caractère)
 *   }
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export const dynamic     = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  // ── 1. Auth via session cookie ───────────────────────────────────────
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: "Non authentifié", reason: "Veuillez vous reconnecter." },
      { status: 401 },
    );
  }

  // ── 2. Validation du body ────────────────────────────────────────────
  let body: { phone?: string; pays?: string; nomComplet?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body JSON invalide" }, { status: 400 });
  }

  const phone      = (body.phone ?? "").trim();
  const pays       = (body.pays ?? "").trim();
  const nomComplet = (body.nomComplet ?? "").trim();

  // Validation phone (au moins 8 chiffres, cohérent avec front)
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 8) {
    return NextResponse.json({
      error:  "Téléphone invalide",
      reason: "Au moins 8 chiffres requis.",
    }, { status: 400 });
  }
  if (!nomComplet) {
    return NextResponse.json({
      error:  "Nom complet requis",
    }, { status: 400 });
  }
  if (!pays) {
    return NextResponse.json({
      error:  "Pays requis",
    }, { status: 400 });
  }

  // ── 3. UPDATE bypass RLS via service_role ────────────────────────────
  const svc = createServiceClient();
  const { error: updateErr } = await svc
    .from("profiles")
    .update({
      phone,
      pays,
      nom_complet: nomComplet,
      updated_at:  new Date().toISOString(),
    })
    .eq("id", user.id);

  if (updateErr) {
    console.error(`[profile/complete] UPDATE failed for user ${user.id} : ${updateErr.message}`);
    return NextResponse.json({
      error:  "Erreur base de données",
      reason: updateErr.message,
    }, { status: 500 });
  }

  console.log(`[profile/complete] ✓ Profile complété pour ${user.email} (phone=${phone}, pays=${pays})`);
  return NextResponse.json({
    ok:      true,
    message: "Profil complété avec succès",
  });
}
