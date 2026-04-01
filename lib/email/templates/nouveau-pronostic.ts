import { emailBase, emailButton, emailDivider, emailBadge } from "../base";

interface NouveauPronosticData {
  nomComplet: string;
  hippodrome: string;
  dateString: string;
  typePari: string;
  niveauAcces: "GRATUIT" | "PREMIUM" | "VIP";
  analysesCourte: string;
  nbPartants: number;
  pronosticId: string;
}

export function templateNouveauPronostic(data: NouveauPronosticData): {
  subject: string;
  html: string;
} {
  const prenom = data.nomComplet.split(" ")[0] || data.nomComplet;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://elite-turf.fr";

  const isVip = data.niveauAcces === "VIP";
  const isPremium = data.niveauAcces === "PREMIUM";

  const niveauLabel = isVip ? "✦ VIP Exclusif" : isPremium ? "★ Premium" : "Gratuit";
  const niveauColor = isVip ? "#7C3AED" : isPremium ? "#C9A84C" : "#16A34A";

  const content = `
    <!-- En-tête course -->
    <div style="background:#FFFBF0;border:1px solid rgba(201,168,76,0.35);
                border-radius:10px;padding:16px 20px;margin-bottom:24px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td>
            <p style="margin:0 0 4px 0;color:#9CA3AF;font-size:11px;
                      text-transform:uppercase;letter-spacing:1px;">Nouveau pronostic publié</p>
            <p style="margin:0;color:#1E3A5F;font-size:18px;font-weight:700;
                      font-family:Georgia,serif;">${data.hippodrome}</p>
            <p style="margin:4px 0 0 0;color:#C9A84C;font-size:13px;font-weight:600;">
              ${data.dateString} · ${data.typePari}
            </p>
          </td>
          <td style="text-align:right;vertical-align:top;">
            ${emailBadge(niveauLabel, niveauColor)}
          </td>
        </tr>
      </table>
    </div>

    <h1 style="margin:0 0 6px 0;font-family:Georgia,serif;font-size:22px;
               font-weight:700;color:#1E3A5F;line-height:1.3;">
      ${data.typePari} du jour — Nos experts ont parlé 🏇
    </h1>
    <p style="margin:0 0 20px 0;color:#1F2937;font-size:14px;line-height:1.6;">
      Bonjour ${prenom}, notre analyse pour le <strong style="color:#C9A84C;">${data.typePari}</strong>
      de <strong style="color:#1E3A5F;">${data.hippodrome}</strong> est disponible.
    </p>

    <!-- Aperçu analyse -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0"
           style="background:#F8FAFC;border:1px solid #E5E7EB;
                  border-radius:10px;margin:0 0 24px 0;">
      <tr>
        <td style="padding:20px 24px;">
          <p style="margin:0 0 10px 0;color:#C9A84C;font-size:12px;font-weight:700;
                    text-transform:uppercase;letter-spacing:0.5px;">Aperçu de l'analyse</p>
          <p style="margin:0;color:#374151;font-size:14px;line-height:1.7;
                    font-style:italic;">
            "${data.analysesCourte}"
          </p>
        </td>
      </tr>
    </table>

    <!-- Stats course -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0"
           style="margin:0 0 24px 0;">
      <tr>
        <td width="50%" style="padding-right:6px;">
          <div style="background:#F8FAFC;border:1px solid #E5E7EB;border-radius:8px;
                      padding:14px;text-align:center;">
            <p style="margin:0 0 4px 0;font-size:22px;font-weight:700;
                      color:#C9A84C;font-family:Georgia,serif;">${data.nbPartants}</p>
            <p style="margin:0;color:#9CA3AF;font-size:11px;text-transform:uppercase;
                      letter-spacing:0.5px;">Partants</p>
          </div>
        </td>
        <td width="50%" style="padding-left:6px;">
          <div style="background:#F8FAFC;border:1px solid #E5E7EB;border-radius:8px;
                      padding:14px;text-align:center;">
            <p style="margin:0 0 4px 0;font-size:22px;font-weight:700;
                      color:#1E3A5F;font-family:Georgia,serif;">${data.typePari}</p>
            <p style="margin:0;color:#9CA3AF;font-size:11px;text-transform:uppercase;
                      letter-spacing:0.5px;">Type de pari</p>
          </div>
        </td>
      </tr>
    </table>

    ${(isPremium || isVip) ? `
    <div style="background:#FFFBF0;border:1px solid rgba(201,168,76,0.35);
                border-radius:8px;padding:14px 18px;margin-bottom:24px;text-align:center;">
      <p style="margin:0;color:#C9A84C;font-size:13px;font-weight:700;">
        🔒 La sélection complète et l'analyse détaillée sont réservées aux abonnés ${niveauLabel}
      </p>
    </div>` : ""}

    ${emailDivider}

    ${emailButton(`${appUrl}/pronostics/${data.pronosticId}`, "Voir la sélection complète →")}

    ${emailDivider}

    <p style="margin:0;color:#9CA3AF;font-size:12px;text-align:center;line-height:1.7;">
      Vous recevez cet email car vous êtes abonné aux alertes Elite Turf.<br/>
      <a href="${appUrl}/espace-membre" style="color:#9CA3AF;text-decoration:none;">Gérer mes alertes</a>
    </p>
  `;

  return {
    subject: `🏇 ${data.typePari} ${data.hippodrome} — Pronostic publié`,
    html: emailBase(
      content,
      `Pronostic ${data.typePari} publié pour ${data.hippodrome}. Consultez notre sélection.`
    ),
  };
}
