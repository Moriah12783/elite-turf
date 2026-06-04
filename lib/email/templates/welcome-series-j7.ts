import { emailBase, emailButton, emailDivider } from "../base";
import { renderHeaderBanner, BANNER_WELCOME_J7 } from "./banners/header-banner";

/** J+7 après inscription — "Étude de cas + offre Starter" */
export function templateWelcomeJ7({ nomComplet }: { nomComplet: string }): {
  subject: string;
  html: string;
} {
  const prenom = nomComplet.split(" ")[0] || nomComplet;
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://www.elite-turf.fr");

  const content = `
    ${renderHeaderBanner(BANNER_WELCOME_J7)}

    <h2 style="margin:28px 0 16px 0;font-family:Georgia,serif;font-size:20px;font-weight:700;color:#1E3A5F;line-height:1.3;">
      ${prenom}, prêt à passer à l'étape supérieure ?
    </h2>

    <p style="margin:0 0 16px 0;color:#1F2937;font-size:15px;line-height:1.7;">
      Vous nous suivez depuis une semaine maintenant. Vous avez vu nos pronostics gratuits,
      vous savez comment on travaille. Aujourd'hui je vous propose un retour d'expérience concret —
      puis, si ça vous intéresse, un accès à toutes nos analyses.
    </p>

    <div style="background:#FDF7E4;border:2px solid #C9A84C;border-radius:12px;padding:24px;margin:24px 0;">
      <h2 style="margin:0 0 12px 0;font-family:Georgia,serif;font-size:20px;font-weight:700;color:#1E3A5F;">
        💡 Ce que les abonnés Starter reçoivent
      </h2>
      <ul style="margin:0;padding-left:20px;color:#1F2937;font-size:15px;line-height:1.8;">
        <li>Le <strong>Quinté+ du jour</strong> avec sélection complète + analyse</li>
        <li>Le <strong>Tiercé / Quarté+</strong> chaque jour</li>
        <li>Accès aux <strong>archives</strong> : 30+ pronostics consultables</li>
        <li><strong>Notification email</strong> dès publication (entre 8h30 et 9h30 GMT chaque matin)</li>
        <li>Page <strong>"Mon ROI"</strong> : suivez vos gains théoriques cumulés</li>
      </ul>

      <p style="margin:16px 0 0 0;color:#1E3A5F;font-size:18px;font-weight:700;text-align:center;">
        65 € / mois — sans engagement
      </p>
      <p style="margin:4px 0 0 0;color:#6B7280;font-size:13px;text-align:center;">
        ≈ 42 500 FCFA · Orange Money, Wave, MTN MoMo acceptés
      </p>
    </div>

    ${emailButton(`${appUrl}/abonnements`, "Découvrir le pack Starter")}

    ${emailDivider}

    <h2 style="margin:24px 0 12px 0;font-family:Georgia,serif;font-size:18px;font-weight:700;color:#1E3A5F;">
      Vous hésitez ? Continuez avec le gratuit
    </h2>
    <p style="margin:0 0 12px 0;color:#1F2937;font-size:15px;line-height:1.7;">
      Aucune pression. Vous gardez votre compte gratuit aussi longtemps que vous voulez.
      Notre Tiercé/Quarté gratuit du jour reste accessible chaque matin.
    </p>
    <p style="margin:0 0 16px 0;color:#1F2937;font-size:14px;line-height:1.7;">
      Une question ? Notre support WhatsApp répond en moins de 20 minutes —
      <a href="https://wa.me/33644686720" style="color:#25D366;text-decoration:none;font-weight:600;">cliquez ici</a>
      pour démarrer une conversation.
    </p>
  `;

  return {
    subject: `🏆 ${prenom}, voici ce que reçoivent nos abonnés (offre découverte)`,
    html:    emailBase(content),
  };
}
