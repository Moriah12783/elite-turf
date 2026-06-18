import { emailBase, emailButton, emailDivider } from "../base";

/**
 * Réactivation R1 (J0) — « Valeur pure » (audit Sprint 1.5, Lot 4).
 *
 * Cible : inscrits non-payants (GRATUIT/EXPIRE), email_opted_out = false.
 * Aucune vente : on rappelle ce qui est GRATUIT (Notre sélection sur chaque
 * course) + le lien Performances (transparence). Lien de désinscription
 * 1-clic OBLIGATOIRE (/stop?t=<sms_unsub_token>).
 *
 * ⚠️ AUCUN envoi automatique : ce template est déclenché manuellement
 * (décision humaine) — voir scripts/export-reactivation-list.ts (dry-run).
 */
export function templateReactivationR1({
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
      ${prenom}, votre sélection gratuite vous attend chaque matin
    </h2>

    <p style="margin:0 0 16px 0;color:#1F2937;font-size:15px;line-height:1.7;">
      Vous avez créé votre compte Elite Turf — mais saviez-vous que
      <strong>« Sélection stats »</strong> est disponible <strong>gratuitement,
      sur chaque course du programme</strong> ? Une lecture statistique claire
      (favoris au marché, drivers reconnus, forme) pour structurer vos paris.
    </p>

    ${emailButton(`${appUrl}/courses`, "Voir la sélection du jour")}

    ${emailDivider}

    <p style="margin:0 0 16px 0;color:#1F2937;font-size:15px;line-height:1.7;">
      Et parce que la confiance se prouve : <strong>tous nos résultats sont
      publics</strong> — les victoires comme les défaites, horodatés avant
      chaque course.
    </p>

    <p style="margin:0 0 16px 0;">
      <a href="${appUrl}/performances" style="color:#C9A84C;font-weight:600;">Vérifier nos résultats →</a>
    </p>

    <p style="margin:24px 0 0 0;color:#9CA3AF;font-size:12px;line-height:1.6;">
      Vous recevez cet email car vous êtes inscrit sur elite-turf.fr.
      <a href="${appUrl}/stop?t=${unsubToken}" style="color:#9CA3AF;">Se désinscrire en un clic</a>.
    </p>
  `;

  return {
    subject: "Votre sélection gratuite du jour vous attend 🏇",
    html: emailBase(content, "La Sélection stats est gratuite sur chaque course — et nos résultats sont publics."),
  };
}
