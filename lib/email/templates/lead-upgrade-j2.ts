import { emailBase, emailButton, emailDivider } from "../base";

/**
 * J+2 après le téléchargement du guide (LEAD) — « passez à la pratique ».
 * Anti-fabrication strict : aucune stat/taux/garantie. Offre + pronostic gratuit.
 */
export function templateLeadUpgradeJ2(
  { prenom, email, unsubscribeUrl }: { prenom: string; email?: string; unsubscribeUrl: string },
): { subject: string; html: string } {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://www.elite-turf.fr";
  const p = prenom?.trim() || "Turfiste";
  // Lien d'inscription pré-rempli : 66 % des prospects n'avaient jamais créé
  // de compte (mesuré le 25/08/2026), et aucune relance ne le leur proposait.
  const lienInscription = `${appUrl}/inscription${email ? `?email=${encodeURIComponent(email)}` : ""}`;

  const content = `
    <h2 style="margin:0 0 16px 0;font-family:Georgia,serif;font-size:22px;font-weight:700;color:#1E3A5F;line-height:1.3;">
      ${p}, prêt à passer de la théorie à la pratique ?
    </h2>

    <p style="margin:0 0 16px 0;color:#1F2937;font-size:15px;line-height:1.7;">
      Il y a deux jours, vous avez téléchargé notre <strong>Guide de l'Initié</strong>.
      Vous connaissez maintenant les bases : lire la musique d'un cheval, le rôle du
      déferrage, la gestion de bankroll… La suite logique, c'est de voir ces principes
      appliqués <strong>chaque jour</strong>, course par course.
    </p>

    <p style="margin:0 0 16px 0;color:#1F2937;font-size:15px;line-height:1.7;">
      Sur Elite Turf, nos experts publient des pronostics construits sur une méthode
      claire : <strong>données PMU officielles + analyse IA + validation humaine</strong>.
      Chaque sélection est argumentée, et l'arrivée officielle est affichée après la course.
    </p>

    ${emailDivider}

    <h2 style="margin:0 0 12px 0;font-family:Georgia,serif;font-size:18px;font-weight:700;color:#1E3A5F;">
      Commencez sans vous engager
    </h2>
    <p style="margin:0 0 4px 0;color:#1F2937;font-size:15px;line-height:1.7;">
      Sur <strong>chaque course</strong>, notre <strong>Sélection stats</strong> (gratuite)
      met en avant les chevaux qui ressortent statistiquement — de quoi vous faire l'œil et
      tester notre approche en conditions réelles. Et pour l'analyse complète de nos experts,
      les formules restent flexibles, sans engagement.
    </p>

    ${emailButton(lienInscription, "Créer mon compte gratuit")}

    <p style="margin:14px 0 0 0;color:#6B7280;font-size:13px;text-align:center;line-height:1.6;">
      Gratuit et sans engagement — le compte donne accès au pronostic gratuit du
      jour et aux résultats vérifiés.<br/>
      <a href="${appUrl}/abonnements" style="color:#C9A84C;">Ou voir directement les formules →</a>
    </p>

    <p style="margin:20px 0 0 0;color:#6B7280;font-size:13px;line-height:1.6;">
      Vous préférez d'abord observer ?
      <a href="${appUrl}/courses" style="color:#C9A84C;font-weight:600;">Découvrir la Sélection stats du jour</a>.
    </p>

    <p style="margin:24px 0 0 0;color:#9CA3AF;font-size:11px;line-height:1.5;text-align:center;">
      Vous recevez cet email car vous avez téléchargé notre guide gratuit.
      <a href="${unsubscribeUrl}" style="color:#9CA3AF;text-decoration:underline;">Ne plus recevoir ces rappels</a>.
    </p>
  `;

  return {
    subject: `${p}, vos premiers pronostics vous attendent 🏇`,
    html: emailBase(content, "Passez de la théorie à la pratique avec les pronostics du jour."),
  };
}
