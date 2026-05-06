import { emailBase, emailButton, emailDivider } from "../base";

/** J+1 après inscription — "Votre 1er pronostic gratuit" */
export function templateWelcomeJ1({ nomComplet }: { nomComplet: string }): {
  subject: string;
  html: string;
} {
  const prenom = nomComplet.split(" ")[0] || nomComplet;
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://www.elite-turf.fr");

  const content = `
    <h1 style="margin:0 0 6px 0;font-family:Georgia,serif;font-size:26px;font-weight:700;color:#1E3A5F;line-height:1.3;">
      ${prenom}, voici comment lire un pronostic Elite Turf
    </h1>
    <p style="margin:0 0 24px 0;color:#C9A84C;font-size:14px;font-weight:600;letter-spacing:0.5px;">
      Jour 2 de votre découverte
    </p>

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
      <li><strong>La sélection</strong> : 5 à 8 chevaux classés par ordre de préférence</li>
      <li><strong>Le score de confiance</strong> : 1 à 5 étoiles, attribué par notre expert</li>
      <li><strong>L'analyse courte</strong> : 2-3 lignes pour les abonnés Starter, accessible à tous en preview</li>
      <li><strong>L'analyse complète</strong> : 1-2 paragraphes détaillés, réservée Pro/Elite</li>
      <li><strong>L'arrivée officielle</strong> : mise à jour automatiquement après la course (transparence totale)</li>
    </ul>

    ${emailDivider}

    <h2 style="margin:24px 0 12px 0;font-family:Georgia,serif;font-size:20px;font-weight:700;color:#1E3A5F;">
      Le pronostic gratuit du jour est disponible
    </h2>
    <p style="margin:0 0 16px 0;color:#1F2937;font-size:15px;line-height:1.7;">
      Aucun engagement — chaque jour nos experts publient un Tiercé/Quarté gratuit
      pour vous permettre de tester nos analyses en conditions réelles.
    </p>

    ${emailButton(`${appUrl}/pronostics?niveau=GRATUIT`, "Voir le pronostic gratuit du jour")}

    <p style="margin:24px 0 0 0;color:#6B7280;font-size:13px;line-height:1.6;font-style:italic;">
      Demain, je vous explique notre méthodologie complète : data PMU officielles + IA + validation humaine.
    </p>
  `;

  return {
    subject: `🏇 ${prenom}, voici comment lire un pronostic Elite Turf`,
    html:    emailBase(content),
  };
}
