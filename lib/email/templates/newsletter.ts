/**
 * Template Newsletter "L'Œil de l'Élite" — Bimensuelle Elite Turf
 * Design : Fond gris perle #F3F4F6 · Carte blanche · Accents Or/Bleu Nuit
 */

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://elite-turf.fr";

export interface NewsletterData {
  prenom: string;
  segment: "prospects" | "actifs" | "elite";
  // Sections éditoriaux
  editoTexte: string;
  secretTitre: string;
  secretTexte: string;
  bilanTexte: string;
  // Numéro de l'édition
  numeroEdition?: number;
}

export function templateNewsletter(data: NewsletterData): { subject: string; html: string } {
  const { prenom, segment, editoTexte, secretTitre, secretTexte, bilanTexte, numeroEdition } = data;

  const editionLabel = numeroEdition ? `N°${numeroEdition}` : "";

  // CTA personnalisé selon le segment
  const ctaBlock = segment === "elite"
    ? `
    <table width="100%" cellpadding="0" cellspacing="0" border="0"
           style="background:linear-gradient(135deg,#F5F3FF,#EDE9FE);border:2px solid #C4B5FD;
                  border-radius:12px;margin-bottom:0;">
      <tr>
        <td style="padding:24px 28px;text-align:center;">
          <p style="margin:0 0 6px 0;color:#7C3AED;font-size:13px;font-weight:700;letter-spacing:0.5px;">
            🏆 RÉSERVÉ AUX MEMBRES ELITE
          </p>
          <p style="margin:0 0 16px 0;color:#1F2937;font-size:15px;font-weight:700;line-height:1.5;">
            Votre signal de dernière minute arrive demain matin.
          </p>
          <p style="margin:0;color:#6B7280;font-size:13px;line-height:1.6;">
            En tant que membre Elite, vous recevrez en priorité le prochain tuyau WhatsApp
            sur la course identifiée par notre IA. Restez connecté.
          </p>
        </td>
      </tr>
    </table>`
    : segment === "actifs"
    ? `
    <table width="100%" cellpadding="0" cellspacing="0" border="0"
           style="background:linear-gradient(135deg,#FFFBF0,#FFF8E7);border:2px solid rgba(201,168,76,0.5);
                  border-radius:12px;margin-bottom:0;">
      <tr>
        <td style="padding:24px 28px;">
          <p style="margin:0 0 6px 0;color:#C9A84C;font-size:12px;font-weight:700;
                    text-transform:uppercase;letter-spacing:0.5px;text-align:center;">
            ⭐ L'OFFRE DE LA QUINZAINE
          </p>
          <p style="margin:0 0 12px 0;color:#1E3A5F;font-size:17px;font-weight:700;
                    text-align:center;line-height:1.4;">
            Prêt à passer au niveau supérieur ?
          </p>
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:16px;">
            <tr>
              <td style="padding:6px 0;border-bottom:1px solid rgba(201,168,76,0.2);">
                <table width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="color:#6B7280;font-size:13px;">Pack Performance</td>
                    <td style="color:#C9A84C;font-size:13px;font-weight:700;text-align:right;">152 €</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:6px 0;">
                <table width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="color:#6B7280;font-size:13px;">Pack Elite <span style="color:#9CA3AF;font-size:11px;">— Arsenal complet</span></td>
                    <td style="color:#7C3AED;font-size:13px;font-weight:700;text-align:right;">208 €</td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
          <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
            <tr>
              <td align="center"
                  style="background:linear-gradient(135deg,#D4AF5A 0%,#C9A84C 50%,#B8942A 100%);
                         border:1px solid #A07A20;border-radius:10px;
                         box-shadow:0 2px 8px rgba(201,168,76,0.35);">
                <a href="${APP_URL}/abonnements"
                   style="display:inline-block;padding:14px 36px;
                          font-family:'Helvetica Neue',Arial,sans-serif;
                          font-size:14px;font-weight:700;color:#1E3A5F;
                          text-decoration:none;letter-spacing:0.5px;">
                  ⚡ JE REJOINS L'ÉLITE
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`
    : /* prospects */ `
    <table width="100%" cellpadding="0" cellspacing="0" border="0"
           style="background:linear-gradient(135deg,#FFFBF0,#FFF8E7);border:2px solid rgba(201,168,76,0.5);
                  border-radius:12px;margin-bottom:0;">
      <tr>
        <td style="padding:24px 28px;">
          <p style="margin:0 0 6px 0;color:#C9A84C;font-size:12px;font-weight:700;
                    text-transform:uppercase;letter-spacing:0.5px;text-align:center;">
            🎁 L'OFFRE DE LA QUINZAINE
          </p>
          <p style="margin:0 0 12px 0;color:#1E3A5F;font-size:17px;font-weight:700;
                    text-align:center;line-height:1.4;">
            Arrêtez de parier.<br/>Commencez à investir.
          </p>
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:16px;">
            <tr>
              <td style="padding:6px 0;border-bottom:1px solid rgba(201,168,76,0.2);">
                <table width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="color:#6B7280;font-size:13px;">Pack Découverte <span style="color:#9CA3AF;font-size:11px;">— Pour bien débuter</span></td>
                    <td style="color:#1E3A5F;font-size:13px;font-weight:700;text-align:right;">65 €</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:6px 0;border-bottom:1px solid rgba(201,168,76,0.2);">
                <table width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="color:#6B7280;font-size:13px;">Pack Performance <span style="color:#9CA3AF;font-size:11px;">— 20 alertes SMS/mois</span></td>
                    <td style="color:#C9A84C;font-size:13px;font-weight:700;text-align:right;">152 €</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:6px 0;">
                <table width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="color:#6B7280;font-size:13px;">Pack Elite <span style="color:#9CA3AF;font-size:11px;">— Arsenal complet</span></td>
                    <td style="color:#7C3AED;font-size:13px;font-weight:700;text-align:right;">208 €</td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
          <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
            <tr>
              <td align="center"
                  style="background:linear-gradient(135deg,#D4AF5A 0%,#C9A84C 50%,#B8942A 100%);
                         border:1px solid #A07A20;border-radius:10px;
                         box-shadow:0 2px 8px rgba(201,168,76,0.35);">
                <a href="${APP_URL}/abonnements"
                   style="display:inline-block;padding:14px 36px;
                          font-family:'Helvetica Neue',Arial,sans-serif;
                          font-size:14px;font-weight:700;color:#1E3A5F;
                          text-decoration:none;letter-spacing:0.5px;">
                  🏇 JE REJOINS L'ÉLITE
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`;

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>L'Œil de l'Élite ${editionLabel} — Elite Turf</title>
  <style>
    body { margin:0;padding:0;background:#F3F4F6;font-family:'Helvetica Neue',Arial,sans-serif; }
    a { color:#C9A84C; }
    @media only screen and (max-width:600px) {
      .container { width:100% !important; padding:0 12px !important; }
      .btn { width:100% !important; display:block !important; text-align:center !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#F3F4F6;">

  <!-- Preview text -->
  <div style="display:none;font-size:1px;color:#F3F4F6;overflow:hidden;max-height:0;">
    Le secret que les parieurs ignorent à Vincennes... &nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
  </div>

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F3F4F6;padding:32px 0;">
    <tr>
      <td align="center">
        <table class="container" width="600" cellpadding="0" cellspacing="0" border="0"
               style="width:600px;max-width:600px;">

          <!-- ── HEADER LOGO ── -->
          <tr>
            <td align="center" style="padding:0 0 0 0;">
              <table cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td style="background:#FFFFFF;border:1px solid #E5E7EB;border-bottom:3px solid #C9A84C;
                             border-radius:12px 12px 0 0;padding:20px 36px;text-align:center;">
                    <span style="font-family:Georgia,serif;font-size:11px;color:#9CA3AF;
                                 letter-spacing:4px;text-transform:uppercase;display:block;margin-bottom:4px;">
                      Maison de pronostics
                    </span>
                    <span style="font-family:Georgia,serif;font-size:28px;font-weight:700;
                                 color:#C9A84C;letter-spacing:3px;display:block;">
                      ELITE <span style="color:#1E3A5F;">TURF</span>
                    </span>
                    <span style="font-family:Georgia,serif;font-size:13px;color:#6B7280;
                                 letter-spacing:2px;display:block;margin-top:6px;font-style:italic;">
                      L'Œil de l'Élite ${editionLabel}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Filet doré -->
          <tr>
            <td style="background:linear-gradient(90deg,transparent,#C9A84C,transparent);
                       height:1px;font-size:0;line-height:0;">&nbsp;</td>
          </tr>

          <!-- ── CORPS BLANC ── -->
          <tr>
            <td style="background:#FFFFFF;border-left:1px solid #E5E7EB;border-right:1px solid #E5E7EB;
                       padding:40px 44px;">

              <!-- ÉDITO -->
              <p style="margin:0 0 4px 0;color:#C9A84C;font-size:11px;font-weight:700;
                        text-transform:uppercase;letter-spacing:1px;">
                ✦ Édito de Stéphane
              </p>
              <h1 style="margin:0 0 16px 0;font-family:Georgia,serif;font-size:24px;
                         font-weight:700;color:#1E3A5F;line-height:1.3;">
                Bonjour ${prenom} !
              </h1>
              <p style="margin:0 0 28px 0;color:#374151;font-size:15px;line-height:1.8;">
                ${editoTexte}
              </p>

              <!-- Filet séparateur -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px 0;">
                <tr>
                  <td style="background:linear-gradient(90deg,transparent,rgba(201,168,76,0.4),transparent);
                             height:1px;font-size:0;">&nbsp;</td>
                </tr>
              </table>

              <!-- SECRET DU MOIS -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0"
                     style="background:#F8FAFC;border:1px solid #E5E7EB;border-left:4px solid #C9A84C;
                            border-radius:0 10px 10px 0;margin-bottom:28px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="margin:0 0 8px 0;color:#C9A84C;font-size:11px;font-weight:700;
                              text-transform:uppercase;letter-spacing:1px;">
                      🔑 Le Secret du Mois
                    </p>
                    <p style="margin:0 0 12px 0;font-family:Georgia,serif;font-size:17px;
                              font-weight:700;color:#1E3A5F;line-height:1.3;">
                      ${secretTitre}
                    </p>
                    <p style="margin:0;color:#374151;font-size:14px;line-height:1.8;">
                      ${secretTexte}
                    </p>
                  </td>
                </tr>
              </table>

              <!-- BILAN IA -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0"
                     style="background:#F0FDF4;border:1px solid #86EFAC;
                            border-radius:10px;margin-bottom:28px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="margin:0 0 8px 0;color:#16A34A;font-size:11px;font-weight:700;
                              text-transform:uppercase;letter-spacing:1px;">
                      📊 Bilan des 15 derniers jours
                    </p>
                    <p style="margin:0;color:#374151;font-size:14px;line-height:1.8;">
                      ${bilanTexte}
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Filet séparateur -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px 0;">
                <tr>
                  <td style="background:linear-gradient(90deg,transparent,rgba(201,168,76,0.4),transparent);
                             height:1px;font-size:0;">&nbsp;</td>
                </tr>
              </table>

              <!-- CTA selon segment -->
              ${ctaBlock}

            </td>
          </tr>

          <!-- Filet doré bottom -->
          <tr>
            <td style="background:linear-gradient(90deg,transparent,#C9A84C,transparent);
                       height:1px;font-size:0;line-height:0;">&nbsp;</td>
          </tr>

          <!-- ── FOOTER ── -->
          <tr>
            <td style="background:#F3F4F6;border:1px solid #E5E7EB;border-top:0;
                       border-radius:0 0 12px 12px;padding:24px 40px;text-align:center;">

              <!-- Icônes réseaux sociaux -->
              <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 14px auto;">
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

              <p style="margin:0 0 4px 0;color:#6B7280;font-size:11px;font-weight:600;">Elite Turf</p>
              <p style="margin:0 0 3px 0;color:#9CA3AF;font-size:11px;">
                📍 34, boulevard des Italiens, 75009 Paris, France
              </p>
              <p style="margin:0 0 8px 0;color:#9CA3AF;font-size:11px;">
                📞 +33 6 44 68 67 20 &nbsp;·&nbsp;
                <a href="mailto:contact@elite-turf.fr" style="color:#9CA3AF;text-decoration:none;">contact@elite-turf.fr</a>
              </p>
              <p style="margin:0 0 4px 0;color:#D1D5DB;font-size:10px;">
                Vous recevez cet email car vous êtes abonné à la newsletter Elite Turf.
              </p>
              <p style="margin:0;font-size:10px;">
                <a href="${APP_URL}/confidentialite" style="color:#D1D5DB;text-decoration:none;">Politique de confidentialité</a>
                &nbsp;·&nbsp;
                <a href="${APP_URL}/confidentialite" style="color:#D1D5DB;text-decoration:none;">Se désabonner</a>
              </p>
            </td>
          </tr>

          <tr><td style="height:32px;">&nbsp;</td></tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`;

  const subject = `🏇 L'Œil de l'Élite ${editionLabel} : Le secret que les parieurs ignorent à Vincennes...`;

  return { subject, html };
}
