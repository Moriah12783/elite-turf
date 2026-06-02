/**
 * POST /api/admin/relance-paiement
 *
 * Envoie l'e-mail "paiement échoué" (relance) à un client — déclenché manuellement.
 * Auth : Bearer CRON_SECRET (admin-grade).
 *
 * Body : { email: string, nomComplet?: string, planNom?: string, montantEur?: number }
 *   - email requis. nom_complet récupéré depuis `profiles` si trouvable.
 *   - planNom/montantEur : optionnels (le plan TENTÉ n'est pas dans le profil,
 *     `statut_abonnement` = état courant) → fournis par l'admin si connus, sinon
 *     le récap est masqué.
 *
 *   curl -X POST https://www.elite-turf.fr/api/admin/relance-paiement \
 *     -H "Authorization: Bearer $CRON_SECRET" -H "Content-Type: application/json" \
 *     -d '{"email":"client@x.com","planNom":"Elite","montantEur":65}'
 */

import { NextRequest, NextResponse } from "next/server";
import { sendEmailDetailed } from "@/lib/email";
import { templatePaiementEchoue } from "@/lib/email/templates/paiement-echoue";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic     = "force-dynamic";
export const maxDuration = 30;

const CRON_SECRET = process.env.CRON_SECRET || "";

export async function POST(req: NextRequest) {
  // ── 1. Auth Bearer obligatoire ───────────────────────────────────────
  const auth = req.headers.get("authorization") || "";
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── 2. Validation ────────────────────────────────────────────────────
  let body: { email?: string; nomComplet?: string; planNom?: string; montantEur?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = (body.email || "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Email invalide" }, { status: 400 });
  }

  // ── 3. Enrichir le nom depuis le profil (best-effort) ────────────────
  // Le PLAN tenté n'est PAS dans le profil → planNom vient du body uniquement.
  let nomComplet = (body.nomComplet || "").trim();
  try {
    const supabase = createServiceClient();
    const { data: profile } = await supabase
      .from("profiles").select("nom_complet").eq("email", email).maybeSingle();
    if (!nomComplet && profile?.nom_complet) nomComplet = profile.nom_complet;
  } catch { /* best-effort : on envoie quand même */ }
  if (!nomComplet) nomComplet = "cher client";

  // ── 4. Génération + envoi (réel, pas de préfixe [TEST]) ──────────────
  try {
    const { subject, html } = templatePaiementEchoue({
      nomComplet,
      email,
      planNom:    body.planNom,
      montantEur: body.montantEur,
    });

    const result = await sendEmailDetailed({ to: email, subject, html });
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error || "Échec envoi Resend" }, { status: 500 });
    }

    console.log(`[relance-paiement] ✓ → ${email}`);
    return NextResponse.json({ ok: true, email, subject });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[relance-paiement] ✗ → ${email} : ${msg}`);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
