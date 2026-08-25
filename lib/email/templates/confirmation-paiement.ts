import { emailBase, emailButton, emailDivider, emailBadge } from "../base";
import { blocModeEmploi } from "./bloc-mode-emploi";
import { renderHeaderBanner, BANNER_CONFIRMATION_PAIEMENT } from "./banners/header-banner";

interface ConfirmationPaiementData {
  nomComplet: string;
  email: string;
  planNom: string;
  montantEur: number;
  dateDebut: string;
  dateFin: string;
  statutAbonnement: "STARTER" | "PRO" | "ELITE";
}

export function templateConfirmationPaiement(data: ConfirmationPaiementData): {
  subject: string;
  html: string;
} {
  const prenom = data.nomComplet.split(" ")[0] || data.nomComplet;
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://elite-turf.fr");

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString("fr-FR", {
      day: "numeric", month: "long", year: "numeric",
    });

  const isElite = data.statutAbonnement === "ELITE";
  const badgeLabel = isElite ? "✦ Plan Elite — Accès Elite" : "✦ Plan " + data.planNom + " — Accès Pro";
  const badgeColor = isElite ? "#7C3AED" : "#C9A84C";

  const features = isElite
    ? ["Pronostics Elite exclusifs débloqués",
       "Alertes illimitées activées",
       "Support WhatsApp prioritaire",
       "Analyses vidéo & export stats inclus"]
    : ["Pronostics Pro débloqués",
       "Analyses complètes d'expert incluses",
       "Accès Tiercé · Quarté+ · Quinté+",
       "Support WhatsApp sous 48h"];

  const content = `
    ${renderHeaderBanner(BANNER_CONFIRMATION_PAIEMENT)}

    <!-- Icône succès sous le banner -->
    <div style="text-align:center;margin:28px 0 16px 0;">
      <div style="display:inline-block;width:48px;height:48px;background:#F0FDF4;
                  border:2px solid #86EFAC;border-radius:50%;line-height:48px;
                  font-size:22px;text-align:center;">✓</div>
    </div>

    <!-- Badge plan -->
    <div style="text-align:center;margin-bottom:24px;">
      ${emailBadge(badgeLabel, badgeColor)}
    </div>

    <!-- Récapitulatif -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0"
           style="background:#F8FAFC;border:1px solid #E5E7EB;border-radius:10px;
                  margin:0 0 24px 0;">
      <tr>
        <td style="padding:20px 24px;">
          <p style="margin:0 0 14px 0;color:#1E3A5F;font-size:13px;font-weight:700;
                    letter-spacing:0.5px;text-transform:uppercase;">Récapitulatif de votre commande</p>

          ${[
            ["Abonné", data.nomComplet],
            ["Email", data.email],
            ["Plan souscrit", `Plan ${data.planNom}`],
            ["Montant payé", `${data.montantEur.toFixed(2).replace(".", ",")} €`],
            ["Date de début", fmtDate(data.dateDebut)],
            ["Accès jusqu'au", fmtDate(data.dateFin)],
          ].map(([label, value]) => `
          <table width="100%" cellpadding="0" cellspacing="0" border="0"
                 style="border-bottom:1px solid #E5E7EB;">
            <tr>
              <td style="color:#6B7280;font-size:13px;padding:8px 0;">${label}</td>
              <td style="color:#1F2937;font-size:13px;font-weight:600;text-align:right;padding:8px 0;">${value}</td>
            </tr>
          </table>`).join("")}
        </td>
      </tr>
    </table>

    <!-- Accès débloqués -->
    <p style="margin:0 0 12px 0;color:#1E3A5F;font-size:14px;font-weight:700;">
      🔓 Ce qui est maintenant débloqué pour vous :
    </p>
    ${features.map(f => `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-bottom:1px solid #F3F4F6;">
      <tr>
        <td style="padding:8px 0;color:#1F2937;font-size:14px;line-height:1.5;">
          <span style="color:#16A34A;margin-right:8px;font-weight:700;">✓</span>${f}
        </td>
      </tr>
    </table>`).join("")}

    ${emailDivider}

    <p style="margin:0 0 8px 0;color:#1E3A5F;font-size:15px;font-weight:700;text-align:center;">
      Commencez dès maintenant 🏇
    </p>
    <p style="margin:0 0 4px 0;color:#6B7280;font-size:13px;text-align:center;">
      Les pronostics du jour sont publiés entre 8h30 et 9h30 (heure GMT)
    </p>

    ${blocModeEmploi}

    ${emailButton(`${appUrl}/pronostics`, "Voir les pronostics du jour")}

    ${emailDivider}

    <p style="margin:0;color:#9CA3AF;font-size:12px;text-align:center;line-height:1.7;">
      Votre abonnement se renouvelle manuellement — vous recevrez un rappel 3 jours avant expiration.<br/>
      Pour toute question : <a href="mailto:contact@elite-turf.fr" style="color:#C9A84C;">contact@elite-turf.fr</a>
    </p>
  `;

  return {
    subject: `✓ Paiement confirmé — Plan ${data.planNom} actif`,
    html: emailBase(
      content,
      `Votre abonnement Plan ${data.planNom} est actif. Accédez aux pronostics PMU Premium dès maintenant.`
    ),
  };
}
