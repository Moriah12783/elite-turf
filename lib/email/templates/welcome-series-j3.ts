import { emailBase, emailButton, emailDivider } from "../base";
import { renderHeaderBanner, BANNER_WELCOME_J3 } from "./banners/header-banner";

/** J+3 après inscription — "Notre méthodologie + transparence" */
export function templateWelcomeJ3({ nomComplet }: { nomComplet: string }): {
  subject: string;
  html: string;
} {
  const prenom = nomComplet.split(" ")[0] || nomComplet;
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://www.elite-turf.fr");

  const content = `
    ${renderHeaderBanner(BANNER_WELCOME_J3)}

    <h2 style="margin:28px 0 16px 0;font-family:Georgia,serif;font-size:20px;font-weight:700;color:#1E3A5F;line-height:1.3;">
      ${prenom}, comment Elite Turf fait ses pronostics
    </h2>

    <p style="margin:0 0 16px 0;color:#1F2937;font-size:15px;line-height:1.7;">
      Beaucoup de sites turf prétendent avoir une "IA secrète" ou des "tuyaux exclusifs".
      Chez Elite Turf, on préfère expliquer exactement comment on travaille.
    </p>

    <div style="background:#F9F7F2;border:1px solid #E8DEB7;border-radius:12px;padding:20px;margin:20px 0;">
      <h2 style="margin:0 0 12px 0;font-family:Georgia,serif;font-size:18px;font-weight:700;color:#1E3A5F;">
        🔍 5 étapes vérifiables
      </h2>
      <ol style="margin:0;padding-left:20px;color:#1F2937;font-size:14px;line-height:1.7;">
        <li><strong>Sources officielles</strong> : programmes PMU France + flux Geny actualisés en continu</li>
        <li><strong>Analyse data-driven</strong> : 30+ critères mesurables (musique, jockey, terrain, etc.)</li>
        <li><strong>Validation experte</strong> : relecture humaine systématique avant publication</li>
        <li><strong>Publication horodatée</strong> : avant le départ de la course, sans réécriture après coup</li>
        <li><strong>Vérifiabilité publique</strong> : tous nos résultats consultables (gagnants ET perdants)</li>
      </ol>
    </div>

    <p style="margin:0 0 16px 0;color:#1F2937;font-size:15px;line-height:1.7;">
      Nous publions tout — y compris nos pronostics perdants. Notre taux de réussite affiché est
      calculé sur l'<strong>intégralité</strong> de l'historique, pas sur une sélection biaisée.
    </p>

    ${emailButton(`${appUrl}/methodologie`, "Lire la méthodologie complète")}

    ${emailDivider}

    <h2 style="margin:24px 0 12px 0;font-family:Georgia,serif;font-size:18px;font-weight:700;color:#1E3A5F;">
      🇨🇮🇸🇳🇨🇲🇲🇦 Vous nous lisez depuis l'Afrique francophone ?
    </h2>
    <p style="margin:0 0 12px 0;color:#1F2937;font-size:15px;line-height:1.7;">
      Nous avons des pages dédiées avec tarification en FCFA / Dirhams + paiement par carte bancaire
      (toutes cartes, tous pays). Le Mobile Money arrive bientôt. Choisissez votre pays :
    </p>
    <p style="margin:0 0 16px 0;color:#1F2937;font-size:14px;line-height:1.8;">
      <a href="${appUrl}/pronostics-pmu-cote-d-ivoire" style="color:#C9A84C;text-decoration:none;">🇨🇮 Côte d'Ivoire</a>
      &nbsp;·&nbsp;
      <a href="${appUrl}/pronostics-pmu-senegal" style="color:#C9A84C;text-decoration:none;">🇸🇳 Sénégal</a>
      &nbsp;·&nbsp;
      <a href="${appUrl}/pronostics-pmu-cameroun" style="color:#C9A84C;text-decoration:none;">🇨🇲 Cameroun</a>
      &nbsp;·&nbsp;
      <a href="${appUrl}/pronostics-pmu-maroc" style="color:#C9A84C;text-decoration:none;">🇲🇦 Maroc</a>
    </p>

    <p style="margin:24px 0 0 0;color:#6B7280;font-size:13px;line-height:1.6;font-style:italic;">
      Dans 4 jours, je vous montre une étude de cas réelle : un Quinté+ analysé du début à la fin.
    </p>
  `;

  return {
    subject: `📊 ${prenom}, notre méthodologie en 5 étapes (transparence totale)`,
    html:    emailBase(content),
  };
}
