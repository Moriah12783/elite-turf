import { emailBase, emailButton, emailDivider } from "../base";

/**
 * Réactivation R2 (J+3) — « La preuve » (audit Sprint 1.5, Lot 4).
 *
 * Bilan RÉEL des 14 derniers jours : les chiffres sont passés en paramètres
 * par l'expéditeur (calculés au moment de l'envoi via getHomeStats() —
 * JAMAIS codés en dur, anti-fabrication). Si gagnants = 0, NE PAS envoyer
 * ce template (décision humaine).
 *
 * ⚠️ AUCUN envoi automatique — déclenchement manuel uniquement.
 */
export function templateReactivationR2({
  nomComplet,
  unsubToken,
  gagnants14j,
  pronostics14j,
}: {
  nomComplet: string;
  unsubToken: string;
  /** Nombre RÉEL de pronostics gagnants sur 14 jours (getHomeStats().gagnantsRecents). */
  gagnants14j: number;
  /** Nombre RÉEL de pronostics terminés sur 14 jours (getHomeStats().pronosticsCumule30j). */
  pronostics14j: number;
}): { subject: string; html: string } {
  const prenom = nomComplet.split(" ")[0] || nomComplet;
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://www.elite-turf.fr");

  const content = `
    <h2 style="margin:8px 0 16px 0;font-family:Georgia,serif;font-size:20px;font-weight:700;color:#1E3A5F;line-height:1.3;">
      ${prenom}, le bilan transparent de nos 14 derniers jours
    </h2>

    <p style="margin:0 0 16px 0;color:#1F2937;font-size:15px;line-height:1.7;">
      Pas de promesses — des chiffres, vérifiables en ligne :
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px 0;">
      <tr>
        <td style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:10px;padding:18px;text-align:center;">
          <span style="font-family:Georgia,serif;font-size:26px;font-weight:700;color:#16A34A;">${gagnants14j}</span>
          <span style="color:#1F2937;font-size:14px;"> pronostics gagnants</span>
          <span style="color:#6B7280;font-size:13px;"> sur ${pronostics14j} publiés (14 jours)</span>
        </td>
      </tr>
    </table>

    <p style="margin:0 0 16px 0;color:#1F2937;font-size:15px;line-height:1.7;">
      Chaque pronostic est <strong>horodaté avant la course</strong> et son
      résultat reste public — les bons comme les mauvais. C'est notre façon
      de mériter votre confiance.
    </p>

    ${emailButton(`${appUrl}/performances`, "Vérifier l'historique complet")}

    ${emailDivider}

    <p style="margin:0 0 16px 0;color:#1F2937;font-size:14px;line-height:1.7;">
      En attendant, <strong>la Sélection stats gratuite</strong> reste disponible
      chaque matin sur <a href="${appUrl}/courses" style="color:#C9A84C;">toutes les courses du jour</a>.
    </p>

    <p style="margin:24px 0 0 0;color:#9CA3AF;font-size:12px;line-height:1.6;">
      Les performances passées ne préjugent pas des résultats futurs. Le jeu comporte des risques.
      <br/>Vous recevez cet email car vous êtes inscrit sur elite-turf.fr.
      <a href="${appUrl}/stop?t=${unsubToken}" style="color:#9CA3AF;">Se désinscrire en un clic</a>.
    </p>
  `;

  return {
    subject: `${gagnants14j} pronostics gagnants en 14 jours — bilan vérifiable`,
    html: emailBase(content, "Notre bilan des 14 derniers jours, en toute transparence."),
  };
}
