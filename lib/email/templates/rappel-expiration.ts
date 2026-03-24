import { emailBase, emailButton, emailDivider } from "../base";

interface RappelExpirationData {
  nomComplet: string;
  email: string;
  planNom: string;
  dateFin: string;
  joursRestants: number; // 3, 2, ou 1
  prixEur: number;
}

export function templateRappelExpiration(data: RappelExpirationData): {
  subject: string;
  html: string;
} {
  const prenom = data.nomComplet.split(" ")[0] || data.nomComplet;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://eliteturf.fr";

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString("fr-FR", {
      day: "numeric", month: "long", year: "numeric",
    });

  const urgenceColor = data.joursRestants === 1 ? "#EF4444" : data.joursRestants === 2 ? "#F97316" : "#C9A84C";
  const urgenceLabel =
    data.joursRestants === 1 ? "⚠ Dernier jour !" :
    data.joursRestants === 2 ? "⏰ Plus que 2 jours" :
    "🔔 Rappel d'expiration";

  const content = `
    <!-- Alerte -->
    <div style="background:rgba(201,168,76,0.08);border:1px solid rgba(201,168,76,0.25);
                border-radius:10px;padding:16px 20px;margin-bottom:24px;text-align:center;">
      <p style="margin:0;font-size:16px;font-weight:700;color:${urgenceColor};">${urgenceLabel}</p>
    </div>

    <h1 style="margin:0 0 6px 0;font-family:Georgia,serif;font-size:24px;
               font-weight:700;color:#F5F5F0;line-height:1.3;">
      Votre accès expire bientôt
    </h1>
    <p style="margin:0 0 20px 0;color:#9090A0;font-size:14px;line-height:1.6;">
      Bonjour ${prenom}, votre abonnement <strong style="color:#C9A84C;">Plan ${data.planNom}</strong>
      expire le <strong style="color:#F5F5F0;">${fmtDate(data.dateFin)}</strong>.
    </p>

    <!-- Compte à rebours -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0"
           style="background:#0F0F1A;border:1px solid ${urgenceColor}33;
                  border-radius:10px;margin:0 0 24px 0;">
      <tr>
        <td style="padding:20px 24px;text-align:center;">
          <p style="margin:0 0 6px 0;font-family:Georgia,serif;font-size:48px;
                    font-weight:700;color:${urgenceColor};line-height:1;">
            ${data.joursRestants}
          </p>
          <p style="margin:0;color:#9090A0;font-size:14px;">
            ${data.joursRestants === 1 ? "jour restant" : "jours restants"}
          </p>
        </td>
      </tr>
    </table>

    <p style="margin:0 0 16px 0;color:#C0C0D0;font-size:15px;line-height:1.7;">
      Sans renouvellement, vous perdrez l'accès à :
    </p>

    ${["Pronostics Premium & VIP exclusifs",
       "Analyses complètes d'expert",
       "Alertes avant le départ des courses",
       "Historique de performances complet"
      ].map(f => `
    <p style="margin:0 0 10px 0;color:#9090A0;font-size:14px;">
      <span style="color:#EF4444;margin-right:8px;">✕</span>${f}
    </p>`).join("")}

    ${emailDivider}

    <p style="margin:0 0 8px 0;color:#F5F5F0;font-size:15px;font-weight:600;text-align:center;">
      Continuez sans interruption
    </p>
    <p style="margin:0 0 4px 0;color:#9090A0;font-size:13px;text-align:center;">
      Renouvelez votre Plan ${data.planNom} — <strong style="color:#C9A84C;">${data.prixEur.toFixed(2).replace(".", ",")} €/mois</strong>
    </p>

    ${emailButton(`${appUrl}/abonnements`, "Renouveler mon abonnement")}

    ${emailDivider}

    <p style="margin:0;color:#5A5A7A;font-size:12px;text-align:center;line-height:1.7;">
      Si vous ne souhaitez pas renouveler, vous conserverez l'accès gratuit après expiration.<br/>
      Questions ? <a href="mailto:contact@eliteturf.fr" style="color:#C9A84C;">contact@eliteturf.fr</a>
    </p>
  `;

  const subjects: Record<number, string> = {
    3: `🔔 Votre abonnement Elite Turf expire dans 3 jours`,
    2: `⏰ Plus que 2 jours — Renouvelez votre accès Premium`,
    1: `⚠ Dernier jour ! Votre accès Elite Turf expire ce soir`,
  };

  return {
    subject: subjects[data.joursRestants] ?? `🔔 Votre abonnement Elite Turf expire bientôt`,
    html: emailBase(
      content,
      `Votre abonnement Plan ${data.planNom} expire dans ${data.joursRestants} jour${data.joursRestants > 1 ? "s" : ""}. Renouvelez maintenant.`
    ),
  };
}
