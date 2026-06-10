import { emailBase, emailButton, emailDivider } from "../base";
import { OFFRE_PRONOSTICS_EXPERTS } from "../../pricing";

/**
 * Réactivation R3 (J+7) — « L'essai sans risque » (audit Sprint 1.5, Lot 4).
 *
 * Pont vers le Pack Starter (65€ / 7 jours), adossé à la garantie réelle
 * « 1er pronostic expert perdant = 7 jours offerts » (décision Q2). Le palier
 * d'impulsion viendra au Sprint 2 — d'ici là, Starter est l'offre d'entrée.
 *
 * ⚠️ AUCUN envoi automatique — déclenchement manuel uniquement.
 */
export function templateReactivationR3({
  nomComplet,
  unsubToken,
}: {
  nomComplet: string;
  unsubToken: string;
}): { subject: string; html: string } {
  const prenom = nomComplet.split(" ")[0] || nomComplet;
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://www.elite-turf.fr");

  const content = `
    <h2 style="margin:8px 0 16px 0;font-family:Georgia,serif;font-size:20px;font-weight:700;color:#1E3A5F;line-height:1.3;">
      ${prenom}, prêt à passer à l'analyse experte ?
    </h2>

    <p style="margin:0 0 16px 0;color:#1F2937;font-size:15px;line-height:1.7;">
      La sélection gratuite vous montre <em>qui</em> regarder. Le
      <strong>Pack Starter</strong> vous donne l'analyse experte complète :
      ${OFFRE_PRONOSTICS_EXPERTS}, la base et les appuis nommés, le conseil de
      mise — pendant <strong>7 jours, pour 65€</strong>, sans engagement ni
      reconduction automatique.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px 0;">
      <tr>
        <td style="background:#FFFBEB;border:1px solid #C9A84C;border-radius:10px;padding:16px;text-align:center;">
          <span style="color:#1F2937;font-size:14px;line-height:1.6;">
            🎁 <strong>Notre garantie :</strong> si votre premier pronostic expert
            est perdant, nous prolongeons votre accès de <strong>7 jours, offerts</strong>.
          </span>
        </td>
      </tr>
    </table>

    ${emailButton(`${appUrl}/abonnements`, "Essayer le Pack Starter — 65€ / 7 jours")}

    ${emailDivider}

    <p style="margin:0 0 16px 0;color:#1F2937;font-size:14px;line-height:1.7;">
      Encore hésitant ? Nos résultats restent publics, victoires et défaites :
      <a href="${appUrl}/performances" style="color:#C9A84C;">consultez l'historique</a>.
      Une question ? Répondez à cet email ou écrivez-nous sur WhatsApp.
    </p>

    <p style="margin:24px 0 0 0;color:#9CA3AF;font-size:12px;line-height:1.6;">
      Le jeu comporte des risques : endettement, dépendance. Jouez de manière responsable.
      <br/>Vous recevez cet email car vous êtes inscrit sur elite-turf.fr.
      <a href="${appUrl}/stop?t=${unsubToken}" style="color:#9CA3AF;">Se désinscrire en un clic</a>.
    </p>
  `;

  return {
    subject: "Essayez l'analyse experte — garantie 7 jours offerts si le 1er pronostic perd",
    html: emailBase(content, "Pack Starter 7 jours, sans engagement — avec une vraie garantie."),
  };
}
