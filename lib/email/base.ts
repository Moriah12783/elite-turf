/**
 * Layout HTML de base pour tous les emails Elite Turf.
 * Dark/or, responsive, compatible Gmail/Outlook/Apple Mail.
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
    body { margin:0; padding:0; background:#0D0D14; font-family:'Helvetica Neue',Arial,sans-serif; }
    a { color:#C9A84C; }
    @media only screen and (max-width:600px) {
      .container { width:100% !important; padding:0 12px !important; }
      .btn { width:100% !important; display:block !important; text-align:center !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#0D0D14;">

  ${previewText ? `<div style="display:none;font-size:1px;color:#0D0D14;overflow:hidden;max-height:0;">${previewText}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>` : ""}

  <!-- Wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0D0D14;padding:24px 0;">
    <tr>
      <td align="center">
        <!-- Container -->
        <table class="container" width="560" cellpadding="0" cellspacing="0" border="0"
               style="width:560px;max-width:560px;">

          <!-- Header / Logo -->
          <tr>
            <td align="center" style="padding:0 0 24px 0;">
              <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="background:#161622;border:1px solid rgba(201,168,76,0.3);border-radius:12px;padding:14px 28px;">
                    <span style="font-family:Georgia,serif;font-size:22px;font-weight:700;color:#C9A84C;letter-spacing:2px;">ELITE TURF</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Bande dorée top -->
          <tr>
            <td style="background:linear-gradient(90deg,transparent,#C9A84C,transparent);height:1px;font-size:0;line-height:0;">&nbsp;</td>
          </tr>

          <!-- Corps -->
          <tr>
            <td style="background:#161622;border-left:1px solid #2A2A3E;border-right:1px solid #2A2A3E;padding:36px 40px;">
              ${content}
            </td>
          </tr>

          <!-- Bande dorée bottom -->
          <tr>
            <td style="background:linear-gradient(90deg,transparent,#C9A84C,transparent);height:1px;font-size:0;line-height:0;">&nbsp;</td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#111118;border:1px solid #1E1E2E;border-top:0;border-radius:0 0 12px 12px;padding:20px 40px;text-align:center;">
              <p style="margin:0 0 6px 0;color:#5A5A7A;font-size:11px;">
                Elite Turf · 75008 Paris, France · <a href="mailto:contact@eliteturf.fr" style="color:#5A5A7A;">contact@eliteturf.fr</a>
              </p>
              <p style="margin:0;color:#3A3A5A;font-size:10px;">
                Pronostics PMU pour l'parieurs francophones — Les courses françaises, analysées depuis Paris.
              </p>
              <p style="margin:8px 0 0 0;color:#3A3A5A;font-size:10px;">
                <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://eliteturf.fr"}/confidentialite" style="color:#3A3A5A;">Politique de confidentialité</a>
                &nbsp;·&nbsp;
                <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://eliteturf.fr"}/abonnements" style="color:#3A3A5A;">Gérer mon abonnement</a>
              </p>
            </td>
          </tr>

          <!-- Spacer -->
          <tr><td style="height:24px;">&nbsp;</td></tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`;
}

/** Bouton CTA gold */
export function emailButton(href: string, label: string): string {
  return `<table cellpadding="0" cellspacing="0" border="0" style="margin:24px auto 0 auto;">
  <tr>
    <td align="center" style="background:#C9A84C;border-radius:10px;">
      <a href="${href}" class="btn"
         style="display:inline-block;padding:14px 32px;font-family:'Helvetica Neue',Arial,sans-serif;
                font-size:14px;font-weight:700;color:#0D0D14;text-decoration:none;
                border-radius:10px;letter-spacing:0.5px;">
        ${label}
      </a>
    </td>
  </tr>
</table>`;
}

/** Ligne de séparation dorée */
export const emailDivider = `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
  <tr>
    <td style="background:linear-gradient(90deg,transparent,rgba(201,168,76,0.4),transparent);height:1px;font-size:0;">&nbsp;</td>
  </tr>
</table>`;

/** Badge statut */
export function emailBadge(text: string, color = "#C9A84C"): string {
  return `<span style="display:inline-block;padding:4px 12px;background:rgba(201,168,76,0.12);
    border:1px solid rgba(201,168,76,0.3);border-radius:20px;
    font-size:12px;font-weight:700;color:${color};letter-spacing:0.5px;">${text}</span>`;
}
