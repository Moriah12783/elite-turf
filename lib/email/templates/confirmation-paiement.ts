import { emailBase, emailButton, emailDivider, emailBadge } from "../base";

interface ConfirmationPaiementData {
  nomComplet: string;
  email: string;
  planNom: string;
  montantEur: number;
  dateDebut: string;
  dateFin: string;
  statutAbonnement: "PREMIUM" | "VIP";
}

export function templateConfirmationPaiement(data: ConfirmationPaiementData): {
  subject: string;
  html: string;
} {
  const prenom = data.nomComplet.split(" ")[0] || data.nomComplet;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://elite-turf.fr";

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString("fr-FR", {
      day: "numeric", month: "long", year: "numeric",
    });

  const isVip = data.statutAbonnement === "VIP";
  const badgeLabel = isVip ? "✦ Plan Elite — Accès VIP" : "✦ Plan " + data.planNom + " — Accès Premium";
  const badgeColor = isVip ? "#7C3AED" : "#C9A84C";

  const features = isVip
    ? ["Pronostics VIP exclusifs débloqués",
       "Alertes illimitées activées",
       "Support WhatsApp prioritaire",
       "Analyses vidéo & export stats inclus"]
    : ["Pronostics Premium débloqués",
       "Analyses complètes d'expert incluses",
       "Accès Tiercé · Quarté+ · Quinté+",
       "Support WhatsApp sous 48h"];

  const content = `
    <!-- Icône succès -->
    <div style="text-align:center;margin-bottom:20px;">
      <div style="display:inline-block;width:64px;height:64px;background:#F0FDF4;
                  border:2px solid #86EFAC;border-radius:50%;line-height:64px;
                  font-size:28px;text-align:center;">✓</div>
    </div>

    <h1 style="margin:0 0 6px 0;font-family:Georgia,serif;font-size:24px;
               font-weight:700;color:#1E3A5F;text-align:center;line-height:1.3;">
      Paiement confirmé !
    </h1>
    <p style="margin:0 0 24px 0;color:#16A34A;font-size:14px;font-weight:600;
              text-align:center;letter-spacing:0.5px;">
      Votre abonnement est maintenant actif
    </p>

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
      Les pronostics du jour sont publiés avant 8h (heure de Paris)
    </p>

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
