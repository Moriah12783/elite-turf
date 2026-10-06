import { emailBase, emailButton, emailDivider } from "../base";
import { renderHeaderBanner, BANNER_WELCOME_J1 } from "./banners/header-banner";

/**
 * J+1 après inscription — lire un pronostic + l'offre gratuite.
 * Depuis juillet 2026, plus de pronostic gratuit quotidien : l'e-mail renvoie
 * vers la Sélection stats et le Radar de la presse (01/10/2026).
 */
export function templateWelcomeJ1({ nomComplet }: { nomComplet: string }): {
  subject: string;
  html: string;
} {
  const prenom = nomComplet.split(" ")[0] || nomComplet;
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://www.elite-turf.fr");

  const content = `
    ${renderHeaderBanner(BANNER_WELCOME_J1)}

    <h2 style="margin:28px 0 16px 0;font-family:Georgia,serif;font-size:20px;font-weight:700;color:#1E3A5F;line-height:1.3;">
      ${prenom}, voici comment lire un pronostic Elite Turf
    </h2>

    <p style="margin:0 0 16px 0;color:#1F2937;font-size:15px;line-height:1.7;">
      Bienvenue à nouveau ! Hier vous avez créé votre compte. Aujourd'hui je vous montre concrètement
      comment fonctionne un de nos pronostics — pour que vous compreniez la rigueur derrière chaque sélection.
    </p>

    <h2 style="margin:24px 0 12px 0;font-family:Georgia,serif;font-size:20px;font-weight:700;color:#1E3A5F;">
      Anatomie d'un pronostic Elite Turf
    </h2>
    <p style="margin:0 0 12px 0;color:#1F2937;font-size:15px;line-height:1.7;">
      Chaque pronostic publié sur le site contient :
    </p>
    <ul style="margin:0 0 16px 0;padding-left:20px;color:#1F2937;font-size:15px;line-height:1.7;">
      <li><strong>La sélection</strong> : 6 chevaux classés par ordre de préférence (et, pour les abonnés Elite, le plan de jeu : la base de 3 chevaux et les values)</li>
      <li><strong>Le score de confiance</strong> : 1 à 5 étoiles, attribué par notre expert</li>
      <li><strong>L'analyse courte</strong> : 2-3 lignes pour aller à l'essentiel</li>
      <li><strong>L'analyse complète</strong> : 1-2 paragraphes détaillés, pour les abonnés Starter, Pro et Elite</li>
      <li><strong>L'arrivée officielle</strong> : mise à jour automatiquement après la course (transparence totale)</li>
    </ul>

    ${emailDivider}

    <h2 style="margin:24px 0 12px 0;font-family:Georgia,serif;font-size:20px;font-weight:700;color:#1E3A5F;">
      Testez gratuitement notre lecture des courses
    </h2>
    <p style="margin:0 0 16px 0;color:#1F2937;font-size:15px;line-height:1.7;">
      Aucun engagement : sur chaque course du programme, notre <strong>Sélection stats</strong>
      met en avant les chevaux qui ressortent statistiquement, et le <strong>Radar de la presse</strong>
      résume ce que pronostiquent les journaux. De quoi juger notre approche en conditions réelles.
    </p>

    ${emailButton(`${appUrl}/courses`, "Voir la Sélection stats du jour")}

    <p style="margin:24px 0 0 0;color:#6B7280;font-size:13px;line-height:1.6;font-style:italic;">
      Demain, je vous explique notre méthodologie complète : data PMU officielles + IA + validation humaine.
    </p>
  `;

  return {
    subject: `🏇 ${prenom}, voici comment lire un pronostic Elite Turf`,
    html:    emailBase(content),
  };
}
