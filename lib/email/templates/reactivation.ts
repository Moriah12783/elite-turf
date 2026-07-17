/**
 * lib/email/templates/reactivation.ts
 *
 * E-mail de RÉACTIVATION pour les inscrits dont l'e-mail n'a jamais été
 * confirmé (à cause d'un défaut de délivrabilité des mails de confirmation,
 * corrigé le 2026-07-17 via SMTP Resend). On confirme leur compte côté admin
 * puis on les prévient qu'ils peuvent enfin se connecter.
 *
 * FR + brandé Elite Turf. PUR (aucune I/O).
 */
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || "https://elite-turf.fr").trim();

export function templateReactivation(opts: { prenom?: string | null }): { subject: string; html: string } {
  const prenom = (opts.prenom || "Turfiste").trim();
  const loginUrl = `${APP_URL}/connexion`;
  const resetUrl = `${APP_URL}/mot-de-passe-oublie`;

  const subject = "Votre compte Elite Turf est activé 🐎";

  const html = `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1ea;padding:24px 0;font-family:Arial,Helvetica,sans-serif;">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border:1px solid #e6ddc7;border-radius:12px;overflow:hidden;">
      <tr><td style="background:#12100b;padding:22px 32px;text-align:center;">
        <span style="color:#c9a84c;font-size:20px;font-weight:bold;letter-spacing:2px;">ELITE TURF</span>
      </td></tr>
      <tr><td style="padding:32px;">
        <h1 style="margin:0 0 12px;font-size:22px;color:#1a1712;">Bonne nouvelle, ${prenom} !</h1>
        <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#44403a;">
          Votre compte Elite Turf est désormais <strong>actif</strong>. Un souci technique de notre côté
          avait empêché la confirmation de votre inscription — c'est réglé, et nous en sommes désolés.
        </p>
        <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#44403a;">
          Vous pouvez dès maintenant vous connecter et accéder aux pronostics PMU du jour :
        </p>
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 20px;"><tr><td align="center" style="border-radius:10px;background:#c9a84c;">
          <a href="${loginUrl}" style="display:inline-block;padding:14px 30px;font-size:15px;font-weight:bold;color:#12100b;text-decoration:none;">Accéder à mon compte</a>
        </td></tr></table>
        <p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:#8a8172;">
          Mot de passe oublié ? Réinitialisez-le en un clic :
          <a href="${resetUrl}" style="color:#9c7c25;">${resetUrl}</a>
        </p>
      </td></tr>
      <tr><td style="background:#faf7ef;padding:18px 32px;text-align:center;border-top:1px solid #e6ddc7;">
        <span style="font-size:12px;color:#a49a86;">Elite Turf · Pronostics PMU premium · <a href="https://elite-turf.fr" style="color:#9c7c25;text-decoration:none;">elite-turf.fr</a></span>
      </td></tr>
    </table>
  </td></tr>
</table>`.trim();

  return { subject, html };
}
