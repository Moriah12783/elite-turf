import { emailBase, emailButton, emailDivider } from "../base";

/**
 * J+5 après le téléchargement du guide (LEAD) — « transparence / anti-arnaque ».
 * Aligné sur le positionnement transparence d'Elite Turf. Anti-fabrication
 * strict : aucune stat/taux/garantie. Renvoie vers /performances et /arnaques-pronostics.
 */
export function templateLeadProofJ5(
  { prenom, unsubscribeUrl }: { prenom: string; unsubscribeUrl: string },
): { subject: string; html: string } {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://www.elite-turf.fr";
  const p = prenom?.trim() || "Turfiste";

  const content = `
    <h2 style="margin:0 0 16px 0;font-family:Georgia,serif;font-size:22px;font-weight:700;color:#1E3A5F;line-height:1.3;">
      ${p}, comment reconnaître un pronostiqueur fiable ?
    </h2>

    <p style="margin:0 0 16px 0;color:#1F2937;font-size:15px;line-height:1.7;">
      C'est la question que tout parieur devrait se poser. La réponse tient en un mot :
      <strong>la transparence</strong>. Beaucoup de vendeurs de pronostics n'affichent que
      leurs réussites et effacent les pertes. Nous faisons l'inverse.
    </p>

    <h2 style="margin:24px 0 12px 0;font-family:Georgia,serif;font-size:18px;font-weight:700;color:#1E3A5F;">
      Ce qu'Elite Turf s'engage à faire
    </h2>
    <ul style="margin:0 0 16px 0;padding-left:20px;color:#1F2937;font-size:15px;line-height:1.7;">
      <li>Chaque pronostic est <strong>horodaté</strong> et publié <strong>avant</strong> la course.</li>
      <li>L'<strong>arrivée officielle</strong> est affichée après la course — <strong>gagné comme perdu</strong>.</li>
      <li>Aucun « ticket garanti », aucune promesse de gain : parier comporte toujours un risque.</li>
    </ul>

    ${emailButton(`${appUrl}/performances`, "Voir nos performances publiques")}

    ${emailDivider}

    <p style="margin:0 0 16px 0;color:#1F2937;font-size:15px;line-height:1.7;">
      Pour vous protéger, nous avons aussi écrit un guide pour
      <a href="${appUrl}/arnaques-pronostics" style="color:#C9A84C;font-weight:600;">repérer les arnaques aux pronostics</a> —
      à lire avant de faire confiance à qui que ce soit, nous y compris.
    </p>

    <p style="margin:0;color:#1F2937;font-size:15px;line-height:1.7;">
      Quand vous voulez l'accès complet à nos analyses quotidiennes :
      <a href="${appUrl}/abonnements" style="color:#C9A84C;font-weight:600;">voir les formules</a>.
    </p>

    <p style="margin:24px 0 0 0;color:#9CA3AF;font-size:11px;line-height:1.5;text-align:center;">
      Vous recevez cet email car vous avez téléchargé notre guide gratuit.
      <a href="${unsubscribeUrl}" style="color:#9CA3AF;text-decoration:underline;">Ne plus recevoir ces rappels</a>.
    </p>
  `;

  return {
    subject: `${p}, la transparence avant tout 🔍`,
    html: emailBase(content, "Résultats publics, horodatés, gagnés comme perdus — la transparence Elite Turf."),
  };
}
