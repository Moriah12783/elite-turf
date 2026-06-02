import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email";
import { templatePaiementEchoue } from "@/lib/email/templates/paiement-echoue";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://www.elite-turf.fr");

function redirect(path: string) {
  return NextResponse.redirect(`${APP_URL}${path}`, { status: 302 });
}

/**
 * POST /api/admin/paiements/relance
 *
 * Envoie l'e-mail « paiement échoué » (relance) au membre d'une transaction —
 * déclenché depuis le bouton de la page admin. Auth = session admin (pas de
 * CRON_SECRET à manipuler). Form POST → redirect vers /admin/paiements.
 */
export async function POST(req: NextRequest) {
  // ── Auth admin (session) ─────────────────────────────────────────────────
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect("/connexion?redirect=/admin/paiements");

  const admin = createServiceClient();
  const { data: adminProfile } = await admin
    .from("profiles").select("role").eq("id", user.id).single();
  if (!adminProfile || adminProfile.role !== "ADMIN") return redirect("/");

  // ── Transaction → membre ─────────────────────────────────────────────────
  const formData = await req.formData();
  const txId = formData.get("id") as string | null;
  if (!txId) return redirect("/admin/paiements?error=id_manquant");

  const { data: tx, error: txErr } = await admin
    .from("transactions")
    .select("id, user_id, montant_fcfa")
    .eq("id", txId)
    .single();
  if (txErr || !tx) return redirect("/admin/paiements?error=transaction_introuvable");

  const { data: member } = await admin
    .from("profiles").select("email, nom_complet").eq("id", tx.user_id).single();
  if (!member?.email) return redirect("/admin/paiements?error=email_introuvable");

  // ── Envoi du mail de relance ─────────────────────────────────────────────
  // Montant EUR depuis le FCFA (même taux fixe que la page paiements).
  const montantEur = tx.montant_fcfa
    ? Math.round((tx.montant_fcfa / 655.957) * 100) / 100
    : undefined;

  const { subject, html } = templatePaiementEchoue({
    nomComplet: member.nom_complet || member.email.split("@")[0],
    email:      member.email,
    montantEur,
  });

  const sent = await sendEmail({ to: member.email, subject, html });
  if (!sent) return redirect("/admin/paiements?error=erreur_envoi");

  console.log(`[Relance] ✓ Mail paiement-echoue → ${member.email}`);
  return redirect("/admin/paiements?relance=ok");
}
