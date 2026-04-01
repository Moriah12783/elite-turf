import { emailBase, emailButton, emailDivider } from "../base";

interface BienvenueData {
  nomComplet: string;
  email: string;
}

export function templateBienvenue({ nomComplet, email }: BienvenueData): {
  subject: string;
  html: string;
} {
  const prenom = nomComplet.split(" ")[0] || nomComplet;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://elite-turf.fr";

  const content = `
    <!-- Titre -->
    <h1 style="margin:0 0 6px 0;font-family:Georgia,serif;font-size:26px;
               font-weight:700;color:#1E3A5F;line-height:1.3;">
      Bienvenue, ${prenom} ! 🏇
    </h1>
    <p style="margin:0 0 24px 0;color:#C9A84C;font-size:14px;font-weight:600;
              letter-spacing:0.5px;">
      Votre compte Elite Turf est actif
    </p>

    <p style="margin:0 0 16px 0;color:#1F2937;font-size:15px;line-height:1.7;">
      Votre inscription a bien été confirmée pour <strong style="color:#1E3A5F;">${email}</strong>.
      Vous avez maintenant accès aux pronostics PMU gratuits publiés chaque matin par nos experts depuis Paris.
    </p>

    <!-- Points forts -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0"
           style="background:#F8FAFC;border:1px solid #E5E7EB;border-radius:10px;
                  margin:0 0 24px 0;padding:0;">
      <tr>
        <td style="padding:20px 24px;">
          <p style="margin:0 0 16px 0;color:#1E3A5F;font-size:13px;font-weight:700;
                    letter-spacing:0.5px;text-transform:uppercase;">
            ✦ Ce que vous recevez gratuitement
          </p>
          ${["Pronostics Quinté+ publiés avant 8h (heure de Paris)",
             "Analyse des courses à Vincennes, Longchamp, Chantilly",
             "Statistiques de performance de nos experts",
             "Guide PMU pour maximiser vos gains"
            ].map(f => `
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-bottom:1px solid #E5E7EB;">
            <tr>
              <td style="padding:10px 0;color:#1F2937;font-size:14px;line-height:1.5;">
                <span style="color:#C9A84C;margin-right:10px;font-weight:700;">▸</span>${f}
              </td>
            </tr>
          </table>`).join("")}
        </td>
      </tr>
    </table>

    ${emailDivider}

    <!-- CTA passer premium -->
    <p style="margin:0 0 8px 0;color:#1E3A5F;font-size:15px;font-weight:700;text-align:center;">
      Débloquez tous les pronostics Premium
    </p>
    <p style="margin:0;color:#6B7280;font-size:13px;text-align:center;line-height:1.6;">
      Accédez aux analyses complètes Tiercé · Quarté+ · Quinté+<br/>
      dès <strong style="color:#C9A84C;">29€</strong>
    </p>

    ${emailButton(`${appUrl}/abonnements`, "Voir les formules d'abonnement")}

    ${emailDivider}

    <p style="margin:0;color:#9CA3AF;font-size:12px;text-align:center;line-height:1.6;">
      Des questions ? Répondez directement à cet email ou contactez-nous sur WhatsApp.<br/>
      Notre équipe répond sous 24h.
    </p>
  `;

  return {
    subject: `Bienvenue chez Elite Turf, ${prenom} ! 🏇`,
    html: emailBase(
      content,
      `Votre compte Elite Turf est confirmé. Accédez aux pronostics PMU du jour.`
    ),
  };
}
