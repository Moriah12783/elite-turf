import { emailBase, emailButton, emailDivider } from "../base";
import { renderHeaderBanner, BANNER_PAIEMENT_ECHOUE } from "./banners/header-banner";

interface PaiementEchoueData {
  nomComplet: string;
  email: string;
  planNom?: string;
  montantEur?: number;
}

/**
 * E-mail transactionnel « paiement échoué » — relance bienveillante invitant le
 * client à refaire son paiement. Déculpabilisant, aucun montant débité, aucune
 * promesse de gain. CTA → /abonnements.
 */
export function templatePaiementEchoue(data: PaiementEchoueData): {
  subject: string;
  html: string;
} {
  const prenom = (data.nomComplet || "").split(" ")[0] || data.nomComplet || "cher client";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://elite-turf.fr";

  const hasRecap = !!data.planNom || data.montantEur != null;
  const recap = hasRecap ? `
    <table width="100%" cellpadding="0" cellspacing="0" border="0"
           style="background:#F8FAFC;border:1px solid rgba(201,168,76,0.35);border-radius:10px;margin:0 0 24px 0;">
      <tr>
        <td style="padding:18px 22px;">
          ${data.planNom ? `<p style="margin:0 0 4px 0;color:#6B7280;font-size:13px;">Abonnement choisi</p>
          <p style="margin:0 0 ${data.montantEur != null ? "12px" : "0"} 0;color:#1E3A5F;font-size:16px;font-weight:700;">Plan ${data.planNom}</p>` : ""}
          ${data.montantEur != null ? `<p style="margin:0 0 4px 0;color:#6B7280;font-size:13px;">Montant</p>
          <p style="margin:0;color:#C9A84C;font-size:16px;font-weight:700;">${data.montantEur.toFixed(2).replace(".", ",")} €</p>` : ""}
        </td>
      </tr>
    </table>` : "";

  const content = `
    ${renderHeaderBanner(BANNER_PAIEMENT_ECHOUE)}

    <p style="margin:28px 0 16px 0;color:#1F2937;font-size:14px;line-height:1.6;">
      Bonjour ${prenom}, votre paiement n'a malheureusement pas pu aboutir —
      <strong style="color:#1E3A5F;">aucun montant n'a été débité</strong>.
    </p>

    <p style="margin:0 0 16px 0;color:#4B5563;font-size:14px;line-height:1.6;">
      Cela arrive parfois (une vérification de sécurité de votre banque, une carte
      non autorisée à l'international…), ce n'est pas grave et c'est vite réglé.
    </p>

    <p style="margin:0 0 20px 0;color:#4B5563;font-size:14px;line-height:1.6;">
      <strong style="color:#1E3A5F;">Pour finaliser, choisissez le paiement par carte bancaire</strong> :
      toutes les cartes de tous les pays sont acceptées — prépayée, virtuelle ou débit.
      Astuce : vous pouvez même créer en quelques secondes une <strong>carte Visa virtuelle</strong>
      depuis votre application Orange Money ou Wave, puis l'utiliser pour payer.
    </p>

    ${recap}

    ${emailButton(`${appUrl}/abonnements`, "Reprendre mon paiement")}

    ${emailDivider}

    <p style="margin:0;color:#9CA3AF;font-size:12px;text-align:center;line-height:1.7;">
      Un souci persiste ? Répondez simplement à cet e-mail ou écrivez-nous à
      <a href="mailto:contact@elite-turf.fr" style="color:#C9A84C;">contact@elite-turf.fr</a> —
      nous activons votre accès rapidement.
    </p>
  `;

  return {
    subject: "Votre paiement Elite Turf n'a pas abouti — finalisez en 1 clic",
    html: emailBase(
      content,
      "Votre paiement n'a pas abouti — aucun montant débité. Reprenez en 1 clic.",
    ),
  };
}
