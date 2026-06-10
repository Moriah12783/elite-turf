/**
 * /stop?t=<token> — Désinscription SMS 1-clic.
 *
 * Avec un Sender ID alphanumérique (EliteTurf), le « STOP par réponse » ne
 * fonctionne plus (canal sortant uniquement). Ce lien opaque permet à
 * l'abonné de se désinscrire en un clic : on pose sms_opted_out = true sur le
 * profil portant ce token. Idempotent (re-cliquer ne change rien).
 */

import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function StopPage({
  searchParams,
}: {
  searchParams: { t?: string };
}) {
  const token = (searchParams.t || "").trim();
  let state: "ok" | "invalid" | "missing" = token ? "invalid" : "missing";

  if (token) {
    const supabase = createServiceClient();
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, sms_opted_out, email_opted_out")
      .eq("sms_unsub_token", token)
      .maybeSingle();

    if (profile) {
      // Désinscription des DEUX canaux marketing (SMS + email) en un clic —
      // audit S1.5 Lot 4. Les emails transactionnels ne sont pas concernés.
      if (!profile.sms_opted_out || !profile.email_opted_out) {
        const now = new Date().toISOString();
        await supabase
          .from("profiles")
          .update({
            sms_opted_out: true,    sms_opted_out_at: now,
            email_opted_out: true,  email_opted_out_at: now,
          })
          .eq("id", profile.id);
      }
      state = "ok";
    }
  }

  return (
    <div className="max-w-md mx-auto px-4 py-16 sm:py-24">
      <div className="card-base p-6 sm:p-8 text-center">
        {state === "ok" && (
          <>
            <div className="w-14 h-14 rounded-full bg-status-win/10 border border-status-win/30 flex items-center justify-center mx-auto mb-5">
              <span className="text-status-win text-2xl">✓</span>
            </div>
            <h1 className="font-serif text-2xl font-bold text-text-primary mb-3">
              Désinscription confirmée
            </h1>
            <p className="text-text-secondary text-sm mb-2">
              Vous ne recevrez plus de SMS ni d&apos;emails marketing d&apos;Elite Turf.
            </p>
            <p className="text-text-muted text-xs">
              Vous pourrez réactiver les alertes à tout moment depuis votre profil.
            </p>
          </>
        )}

        {state === "invalid" && (
          <>
            <h1 className="font-serif text-2xl font-bold text-text-primary mb-3">
              Lien invalide
            </h1>
            <p className="text-text-secondary text-sm">
              Ce lien de désinscription n&apos;est pas valide ou a expiré. Pour
              toute demande, contactez-nous à{" "}
              <a href="mailto:contact@elite-turf.fr" className="text-gold-primary hover:underline">
                contact@elite-turf.fr
              </a>.
            </p>
          </>
        )}

        {state === "missing" && (
          <>
            <h1 className="font-serif text-2xl font-bold text-text-primary mb-3">
              Désinscription SMS
            </h1>
            <p className="text-text-secondary text-sm">
              Lien de désinscription manquant. Utilisez le lien fourni dans le SMS,
              ou écrivez-nous à{" "}
              <a href="mailto:contact@elite-turf.fr" className="text-gold-primary hover:underline">
                contact@elite-turf.fr
              </a>.
            </p>
          </>
        )}

        <Link
          href="/"
          className="inline-flex items-center gap-2 mt-6 px-5 py-2.5 bg-gold-primary hover:bg-gold-dark text-bg-primary font-bold text-sm rounded-xl transition-all"
        >
          Retour à l&apos;accueil
        </Link>
      </div>
    </div>
  );
}
