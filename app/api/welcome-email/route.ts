/**
 * POST /api/welcome-email
 *
 * Envoie l'email de bienvenue Elite Turf via le template centralisé
 * `templateBienvenue` (banner cheval, design 2026).
 *
 * Body : { email: string, nomComplet: string, pays?: string }
 *
 * Note : `pays` est accepté pour rétro-compat avec le client inscription,
 * mais le template ne l'utilise plus (généralisé pour tous les abonnés).
 */

import { NextRequest, NextResponse } from "next/server";
import { sendEmail } from "@/lib/email";
import { templateBienvenue } from "@/lib/email/templates/bienvenue";
import { sendWelcomeSms } from "@/lib/sms-welcome";

export async function POST(req: NextRequest) {
  try {
    const { email, nomComplet, smsOptIn } = await req.json();

    if (!email) {
      return NextResponse.json({ error: "Email requis" }, { status: 400 });
    }

    const { subject, html } = templateBienvenue({
      nomComplet: nomComplet || "Champion",
      email,
    });

    const ok = await sendEmail({ to: email, subject, html });

    // SMS de bienvenue (best-effort, canal indépendant de l'email — ne throw
    // jamais, n'envoie que si le profil a un numéro + opt-in + Twilio configuré).
    await sendWelcomeSms({ email, smsOptIn });

    if (!ok) {
      return NextResponse.json({ error: "Envoi Resend échoué" }, { status: 500 });
    }

    console.log(`[Welcome Email] Envoyé à ${email}`);
    return NextResponse.json({ ok: true });

  } catch (err: any) {
    console.error("[Welcome Email] Erreur:", err?.message);
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}
