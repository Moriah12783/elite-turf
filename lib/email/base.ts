/**
 * Layout HTML de base pour tous les emails Elite Turf.
 * Direction artistique : Luxe & Clarté — Blanc immaculé, Or brossé, Bleu Nuit.
 * Compatible Gmail / Outlook / Apple Mail.
 */
export function emailBase(content: string, previewText = ""): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Elite Turf</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
  <style>
    body { margin:0; padding:0; background:#F3F4F6; font-family:'Helvetica Neue',Arial,sans-serif; }
    a { color:#C9A84C; }
    @media only screen and (max-width:600px) {
      .container { width:100% !important; padding:0 12px !important; }
      .btn { width:100% !important; display:block !important; text-align:center !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#F3F4F6;">

  ${previewText ? `<div style="display:none;font-size:1px;color:#F3F4F6;overflow:hidden;max-height:0;">${previewText}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>` : ""}

  <!-- Wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F3F4F6;padding:32px 0;">
    <tr>
      <td align="center">
        <!-- Container -->
        <table class="container" width="580" cellpadding="0" cellspacing="0" border="0"
               style="width:580px;max-width:580px;">

          <!-- Header / Logo -->
          <tr>
            <td align="center" style="padding:0 0 20px 0;">
              <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="background:#FFFFFF;border:1px solid #E5E7EB;border-bottom:3px solid #C9A84C;border-radius:12px 12px 0 0;padding:18px 36px;text-align:center;">
                    <span style="font-family:Georgia,'Times New Roman',serif;font-size:11px;font-weight:400;color:#9CA3AF;letter-spacing:4px;text-transform:uppercase;display:block;margin-bottom:4px;">Maison de pronostics</span>
                    <span style="font-family:Georgia,'Times New Roman',serif;font-size:26px;font-weight:700;color:#C9A84C;letter-spacing:3px;display:block;">ELITE <span style="color:#1E3A5F;">TURF</span></span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Bande dorée top -->
          <tr>
            <td style="background:linear-gradient(90deg,transparent,#C9A84C,transparent);height:1px;font-size:0;line-height:0;">&nbsp;</td>
          </tr>

          <!-- Corps — carte blanche immaculée -->
          <tr>
            <td style="background:#FFFFFF;border-left:1px solid #E5E7EB;border-right:1px solid #E5E7EB;padding:40px 44px;">
              ${content}
            </td>
          </tr>

          <!-- Bande dorée bottom -->
          <tr>
            <td style="background:linear-gradient(90deg,transparent,#C9A84C,transparent);height:1px;font-size:0;line-height:0;">&nbsp;</td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#F3F4F6;border:1px solid #E5E7EB;border-top:0;border-radius:0 0 12px 12px;padding:24px 40px;text-align:center;">

              <!-- Icônes réseaux sociaux -->
              <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 16px auto;">
                <tr>
                  <td style="padding:0 5px;">
                    <a href="#" style="display:inline-block;width:30px;height:30px;background:#D1D5DB;border-radius:50%;text-align:center;line-height:30px;text-decoration:none;font-size:13px;color:#FFFFFF;font-weight:700;">f</a>
                  </td>
                  <td style="padding:0 5px;">
                    <a href="#" style="display:inline-block;width:30px;height:30px;background:#D1D5DB;border-radius:50%;text-align:center;line-height:30px;text-decoration:none;font-size:12px;color:#FFFFFF;font-weight:700;">▶</a>
                  </td>
                  <td style="padding:0 5px;">
                    <a href="#" style="display:inline-block;width:30px;height:30px;background:#D1D5DB;border-radius:50%;text-align:center;line-height:30px;text-decoration:none;font-size:13px;color:#FFFFFF;font-weight:700;">♪</a>
                  </td>
                  <td style="padding:0 5px;">
                    <a href="#" style="display:inline-block;width:30px;height:30px;background:#D1D5DB;border-radius:50%;text-align:center;line-height:30px;text-decoration:none;font-size:13px;color:#FFFFFF;font-weight:700;">𝕏</a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 5px 0;color:#6B7280;font-size:11px;font-weight:600;">
                Elite Turf
              </p>
              <p style="margin:0 0 4px 0;color:#9CA3AF;font-size:11px;">
                📍 34, boulevard des Italiens, 75009 Paris, France
              </p>
              <p style="margin:0 0 8px 0;color:#9CA3AF;font-size:11px;">
                📞 +33 6 44 68 67 20 &nbsp;·&nbsp;
                <a href="mailto:contact@elite-turf.fr" style="color:#9CA3AF;">contact@elite-turf.fr</a>
              </p>
              <p style="margin:0 0 8px 0;color:#D1D5DB;font-size:10px;">
                Pronostics PMU pour les parieurs francophones — Analyses depuis Paris.
              </p>
              <p style="margin:0;font-size:10px;">
                <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://elite-turf.fr"}/confidentialite" style="color:#D1D5DB;text-decoration:none;">Politique de confidentialité</a>
                &nbsp;·&nbsp;
                <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://elite-turf.fr"}/abonnements" style="color:#D1D5DB;text-decoration:none;">Gérer mon abonnement</a>
              </p>
            </td>
          </tr>

          <!-- Spacer -->
          <tr><td style="height:32px;">&nbsp;</td></tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`;
}

/** Bouton CTA — dégradé doré, texte Bleu Nuit */
export function emailButton(href: string, label: string): string {
  return `<table cellpadding="0" cellspacing="0" border="0" style="margin:28px auto 0 auto;">
  <tr>
    <td align="center" style="background:linear-gradient(135deg,#D4AF5A 0%,#C9A84C 50%,#B8942A 100%);border:1px solid #A07A20;border-radius:10px;box-shadow:0 2px 8px rgba(201,168,76,0.35);">
      <a href="${href}" class="btn"
         style="display:inline-block;padding:15px 36px;font-family:'Helvetica Neue',Arial,sans-serif;
                font-size:14px;font-weight:700;color:#1E3A5F;text-decoration:none;
                border-radius:10px;letter-spacing:0.5px;">
        ${label}
      </a>
    </td>
  </tr>
</table>`;
}

/** Ligne de séparation dorée */
export const emailDivider = `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0;">
  <tr>
    <td style="background:linear-gradient(90deg,transparent,rgba(201,168,76,0.35),transparent);height:1px;font-size:0;">&nbsp;</td>
  </tr>
</table>`;

/** Badge statut */
export function emailBadge(text: string, color = "#C9A84C"): string {
  return `<span style="display:inline-block;padding:4px 14px;background:#FFFBF0;
    border:1px solid rgba(201,168,76,0.5);border-radius:20px;
    font-size:12px;font-weight:700;color:${color};letter-spacing:0.5px;">${text}</span>`;
}
