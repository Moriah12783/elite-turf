/**
 * Newsletter de lancement Elite Turf — "L'Œil de l'Élite, Édition N°1"
 * Objectif : convertir les prospects en abonnés payants.
 * Ton : Premium · Exclusif · Personnalisé.
 * Compatible : Gmail · Outlook · Apple Mail · Yahoo.
 */

import { renderHeaderBanner } from "./banners/header-banner";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.elite-turf.fr";

export interface NewsletterLancementData {
  prenom: string;
  numeroEdition?: number;
  reductionPct: number;       // ex: 30
  dateExpiration: string;     // ex: "4 mai 2026"
  codePromo?: string;         // ex: "ELITE30"
  titreHero?: string;         // Accroche personnalisée sur le hero
  sousTitreHero?: string;
  editoTexte?: string;        // Texte éditorial personnalisé
  resultatsRecents?: Array<{
    date: string;
    course: string;
    hippodrome: string;
    resultat: "GAGNANT" | "PARTIEL";
    rapport: string;
  }>;
}

export function templateNewsletterLancement(data: NewsletterLancementData): {
  subject: string;
  html: string;
} {
  const {
    prenom,
    numeroEdition = 1,
    reductionPct = 30,
    dateExpiration,
    codePromo,
    titreHero = "La méthode que les parieurs gagnants gardent pour eux.",
    sousTitreHero = "Et que vous allez découvrir aujourd'hui.",
    editoTexte,
    resultatsRecents = [
      { date: "25 avr.", course: "Grand Steeple-Chase Masters", hippodrome: "Auteuil",        resultat: "GAGNANT", rapport: "210,60 €" },
      { date: "25 avr.", course: "Prix Gérald de Rochefort",    hippodrome: "Auteuil",        resultat: "GAGNANT", rapport: "135,60 €" },
      { date: "24 avr.", course: "Prix du Jardin Chanot",       hippodrome: "Marseille-Borély", resultat: "GAGNANT", rapport: "—" },
      { date: "23 avr.", course: "Prix du Panthéon",            hippodrome: "ParisLongchamp", resultat: "GAGNANT", rapport: "—" },
    ],
  } = data;

  // Calcul des prix réduits
  const plans = [
    { nom: "Starter", prixBase: 65,  devise: "€", acces: "Tiercés + analyses" },
    { nom: "Pro",     prixBase: 152, devise: "€", acces: "Quinté+ · Quarté+ · 20 alertes SMS" },
    { nom: "Elite",   prixBase: 208, devise: "€", acces: "Accès total · Alertes illimitées · WhatsApp prioritaire" },
  ].map(p => ({
    ...p,
    prixReduit: (Math.round(p.prixBase * (1 - reductionPct / 100) * 100) / 100).toFixed(2),
    economie:   (Math.round(p.prixBase * reductionPct / 100 * 100) / 100).toFixed(2),
  }));

  const edito = editoTexte || `C'est avec une immense fierté que je vous écris ce message aujourd'hui.
Vous avez eu la curiosité de découvrir Elite Turf. Cette curiosité, elle vaut de l'or.
<br/><br/>
Pendant des années, j'ai vu des turfistes talentueux perdre non par manque de passion,
mais par manque de méthode. C'est exactement pour eux — pour <strong>vous</strong> — qu'Elite Turf existe.
<br/><br/>
Cette semaine encore, nos membres ont encaissé des rapports que la plupart des parieurs
n'osent même pas espérer. Et ce n'est pas de la chance — c'est de l'analyse.`;

  const resultatsRows = resultatsRecents.map(r => `
    <tr style="border-bottom:1px solid #F3F4F6;">
      <td style="padding:12px 8px;color:#6B7280;font-size:12px;white-space:nowrap;">${r.date}</td>
      <td style="padding:12px 8px;">
        <p style="margin:0;font-size:13px;font-weight:600;color:#1E3A5F;">${r.course}</p>
        <p style="margin:2px 0 0;font-size:11px;color:#9CA3AF;">${r.hippodrome}</p>
      </td>
      <td style="padding:12px 8px;text-align:center;">
        <span style="display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;
          ${r.resultat === "GAGNANT"
            ? "background:#DCFCE7;color:#16A34A;border:1px solid #86EFAC;"
            : "background:#FEF9C3;color:#CA8A04;border:1px solid #FDE047;"
          }">
          ${r.resultat === "GAGNANT" ? "✓ GAGNANT" : "~ PARTIEL"}
        </span>
      </td>
      <td style="padding:12px 8px;text-align:right;font-size:13px;font-weight:700;
                 color:${r.rapport !== "—" ? "#16A34A" : "#9CA3AF"};">
        ${r.rapport !== "—" ? `+${r.rapport}` : "—"}
      </td>
    </tr>`).join("");

  const plansRows = plans.map((p, i) => `
    <tr>
      <td style="padding:${i === 0 ? "20px 24px 12px" : "12px 24px"} 24px;
                 border-bottom:${i < plans.length - 1 ? "1px solid rgba(201,168,76,0.15)" : "none"};">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td>
              <p style="margin:0 0 2px;font-size:15px;font-weight:700;color:#1E3A5F;">
                ${i === 1 ? "⭐ " : ""}Pack ${p.nom}
                ${i === 1 ? `<span style="display:inline-block;margin-left:8px;padding:2px 8px;
                  background:#C9A84C;border-radius:10px;font-size:10px;color:#fff;font-weight:700;">
                  LE PLUS CHOISI</span>` : ""}
              </p>
              <p style="margin:0;font-size:12px;color:#6B7280;">${p.acces}</p>
            </td>
            <td style="text-align:right;white-space:nowrap;padding-left:16px;">
              <p style="margin:0;font-size:11px;color:#9CA3AF;text-decoration:line-through;">
                ${p.prixBase.toFixed(2).replace(".", ",")} ${p.devise}
              </p>
              <p style="margin:0;font-size:18px;font-weight:700;color:#C9A84C;">
                ${p.prixReduit.replace(".", ",")} ${p.devise}
              </p>
              <p style="margin:0;font-size:10px;color:#16A34A;font-weight:600;">
                −${reductionPct}% · économie ${p.economie.replace(".", ",")} ${p.devise}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>`).join("");

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>L'Œil de l'Élite N°${numeroEdition} — Elite Turf</title>
  <style>
    body{margin:0;padding:0;background:#0F1923;font-family:'Helvetica Neue',Arial,sans-serif;}
    @media only screen and (max-width:600px){
      .container{width:100%!important;}
      .hero-img{width:100%!important;height:200px!important;}
      .body-pad{padding:28px 20px!important;}
      .plan-pad{padding:16px!important;}
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#0F1923;">

  <!-- Texte de prévisualisation (invisible) -->
  <div style="display:none;font-size:1px;overflow:hidden;max-height:0;color:#0F1923;">
    ${prenom}, votre première analyse exclusive vous attend — offre de lancement −${reductionPct}% jusqu'au ${dateExpiration}.&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;
  </div>

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0F1923;padding:24px 0 40px;">
    <tr>
      <td align="center">
        <table class="container" width="580" cellpadding="0" cellspacing="0" border="0" style="max-width:580px;">

          <!-- ══════════════════════════════════════
               LOGO TOP (fond nuit)
          ══════════════════════════════════════ -->
          <tr>
            <td style="padding:0 0 0 0;text-align:center;background:#0F1923;
                       border-radius:16px 16px 0 0;padding:20px 0 16px;">
              <span style="font-family:Georgia,'Times New Roman',serif;
                           font-size:11px;color:#C9A84C;letter-spacing:5px;
                           text-transform:uppercase;display:block;margin-bottom:6px;">
                Maison de pronostics
              </span>
              <span style="font-family:Georgia,'Times New Roman',serif;
                           font-size:30px;font-weight:700;letter-spacing:4px;color:#C9A84C;">
                ELITE&nbsp;<span style="color:#FFFFFF;">TURF</span>
              </span>
              <span style="display:block;margin-top:8px;font-family:Georgia,serif;
                           font-size:12px;color:rgba(201,168,76,0.6);letter-spacing:3px;
                           font-style:italic;">
                L'Œil de l'Élite — N°${numeroEdition}
              </span>
            </td>
          </tr>

          <!-- Filet doré -->
          <tr>
            <td style="height:1px;background:linear-gradient(90deg,transparent,#C9A84C,transparent);font-size:0;">&nbsp;</td>
          </tr>

          <!-- ══════════════════════════════════════
               BANNER HERO PHOTO + TITRES (dynamique)
          ══════════════════════════════════════ -->
          <tr>
            <td style="padding:0;font-size:0;line-height:0;
                       border-left:1px solid #E5E7EB;border-right:1px solid #E5E7EB;">
              ${renderHeaderBanner({
                title:         titreHero,
                subtitle:      sousTitreHero,
                photoFilename: "cheval-4-course-groupe.jpg",
              })}
            </td>
          </tr>

          <!-- Pastille édition sous le banner -->
          <tr>
            <td style="background:#FFFFFF;border-left:1px solid #E5E7EB;border-right:1px solid #E5E7EB;
                       padding:16px 40px 0;text-align:center;">
              <span style="display:inline-block;padding:4px 16px;
                           background:rgba(201,168,76,0.12);border:1px solid rgba(201,168,76,0.4);
                           border-radius:20px;font-size:11px;font-weight:700;
                           color:#C9A84C;letter-spacing:1px;">
                ✦ ÉDITION EXCLUSIVE · LANCEMENT
              </span>
            </td>
          </tr>

          <!-- ══════════════════════════════════════
               CORPS BLANC
          ══════════════════════════════════════ -->
          <tr>
            <td class="body-pad"
                style="background:#FFFFFF;padding:40px 44px;
                       border-left:1px solid #E5E7EB;border-right:1px solid #E5E7EB;">

              <!-- Salutation personnalisée -->
              <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:#C9A84C;
                        text-transform:uppercase;letter-spacing:1px;">
                ✦ Message personnel
              </p>
              <h2 style="margin:0 0 18px;font-family:Georgia,serif;font-size:22px;
                         font-weight:700;color:#1E3A5F;line-height:1.3;">
                ${prenom},<br/>vous méritez mieux que le hasard.
              </h2>
              <p style="margin:0 0 28px;font-size:15px;color:#374151;line-height:1.85;">
                ${edito}
              </p>

              <!-- Séparateur -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px;">
                <tr>
                  <td style="height:1px;background:linear-gradient(90deg,transparent,rgba(201,168,76,0.3),transparent);font-size:0;">&nbsp;</td>
                </tr>
              </table>

              <!-- ── BLOC RÉSULTATS ── -->
              <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#C9A84C;
                        text-transform:uppercase;letter-spacing:1px;">
                📊 Nos résultats cette semaine
              </p>
              <p style="margin:0 0 16px;font-size:13px;color:#6B7280;">
                Vérifiables sur <a href="https://www.geny.com" style="color:#C9A84C;">Geny.com</a> — nous ne cachons rien.
              </p>

              <table width="100%" cellpadding="0" cellspacing="0" border="0"
                     style="border:1px solid #E5E7EB;border-radius:12px;overflow:hidden;
                            margin-bottom:12px;">
                <thead>
                  <tr style="background:#F8FAFC;">
                    <th style="padding:10px 8px;text-align:left;font-size:11px;font-weight:700;
                               color:#9CA3AF;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #E5E7EB;">
                      Date
                    </th>
                    <th style="padding:10px 8px;text-align:left;font-size:11px;font-weight:700;
                               color:#9CA3AF;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #E5E7EB;">
                      Course
                    </th>
                    <th style="padding:10px 8px;text-align:center;font-size:11px;font-weight:700;
                               color:#9CA3AF;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #E5E7EB;">
                      Résultat
                    </th>
                    <th style="padding:10px 8px;text-align:right;font-size:11px;font-weight:700;
                               color:#9CA3AF;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #E5E7EB;">
                      Rapport
                    </th>
                  </tr>
                </thead>
                <tbody>
                  ${resultatsRows}
                </tbody>
              </table>

              <p style="margin:0 0 28px;font-size:12px;color:#9CA3AF;text-align:center;font-style:italic;">
                Transparence totale : gains et partiels publiés. Aucun chiffre retouché.
              </p>

              <!-- Séparateur -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px;">
                <tr>
                  <td style="height:1px;background:linear-gradient(90deg,transparent,rgba(201,168,76,0.3),transparent);font-size:0;">&nbsp;</td>
                </tr>
              </table>

              <!-- ── BLOC OFFRE LANCEMENT ── -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0"
                     style="background:linear-gradient(135deg,#0F1923 0%,#1E3A5F 100%);
                            border-radius:14px;overflow:hidden;margin-bottom:24px;">

                <!-- Badge urgence -->
                <tr>
                  <td style="padding:20px 24px 0;text-align:center;">
                    <span style="display:inline-block;padding:6px 18px;
                                 background:rgba(201,168,76,0.2);
                                 border:1px solid rgba(201,168,76,0.5);
                                 border-radius:20px;font-size:11px;font-weight:700;
                                 color:#C9A84C;letter-spacing:1px;">
                      ⏰ OFFRE DE LANCEMENT — ${reductionPct}% DE RÉDUCTION
                    </span>
                  </td>
                </tr>

                <tr>
                  <td style="padding:14px 24px 4px;text-align:center;">
                    <p style="margin:0;font-family:Georgia,serif;font-size:20px;
                               font-weight:700;color:#FFFFFF;line-height:1.35;">
                      Rejoignez l'élite aujourd'hui.
                    </p>
                    <p style="margin:8px 0 0;font-size:13px;color:rgba(201,168,76,0.7);">
                      Offre valable jusqu'au <strong style="color:#C9A84C;">${dateExpiration}</strong>
                      ${codePromo ? ` · Code : <strong style="color:#C9A84C;font-family:monospace;">${codePromo}</strong>` : ""}
                    </p>
                  </td>
                </tr>

                <!-- Plans tarifaires -->
                <tr>
                  <td style="padding:16px 8px 0;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0"
                           style="background:rgba(255,255,255,0.05);border:1px solid rgba(201,168,76,0.2);
                                  border-radius:10px;overflow:hidden;">
                      ${plansRows}
                    </table>
                  </td>
                </tr>

                <!-- Moyens de paiement -->
                <tr>
                  <td style="padding:16px 24px;text-align:center;">
                    <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.5);">
                      Paiement sécurisé via
                      <strong style="color:#C9A84C;">Orange Money</strong> ·
                      <strong style="color:#C9A84C;">MTN MoMo</strong> ·
                      <strong style="color:#C9A84C;">Wave</strong> ·
                      <strong style="color:#C9A84C;">Carte bancaire</strong>
                    </p>
                    <p style="margin:6px 0 0;font-size:11px;color:rgba(255,255,255,0.35);">
                      Activation immédiate · Aucun engagement · Résiliable à tout moment
                    </p>
                  </td>
                </tr>

              </table>

              <!-- ── CTA UNIQUE ── -->
              <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 8px;width:100%;">
                <tr>
                  <td align="center"
                      style="background:linear-gradient(135deg,#D4AF5A 0%,#C9A84C 50%,#B8942A 100%);
                             border-radius:12px;box-shadow:0 4px 16px rgba(201,168,76,0.4);">
                    <a href="${APP_URL}/abonnements"
                       style="display:block;padding:18px 40px;
                              font-family:'Helvetica Neue',Arial,sans-serif;
                              font-size:16px;font-weight:700;color:#0F1923;
                              text-decoration:none;letter-spacing:0.5px;text-align:center;">
                      🏇 Je prends mon abonnement maintenant
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:10px 0 0;text-align:center;font-size:11px;color:#9CA3AF;">
                Accès activé en moins de 2 minutes après paiement.
              </p>

              <!-- Séparateur -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:32px 0 24px;">
                <tr>
                  <td style="height:1px;background:linear-gradient(90deg,transparent,rgba(201,168,76,0.3),transparent);font-size:0;">&nbsp;</td>
                </tr>
              </table>

              <!-- ── BLOC CONFIANCE ── -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td width="33%" style="padding:8px;text-align:center;vertical-align:top;">
                    <p style="margin:0 0 4px;font-size:22px;">🔒</p>
                    <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#1E3A5F;">Paiement sécurisé</p>
                    <p style="margin:0;font-size:11px;color:#9CA3AF;">Cryptage SSL · Zéro fraude</p>
                  </td>
                  <td width="33%" style="padding:8px;text-align:center;vertical-align:top;">
                    <p style="margin:0 0 4px;font-size:22px;">📊</p>
                    <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#1E3A5F;">Transparence totale</p>
                    <p style="margin:0;font-size:11px;color:#9CA3AF;">Tous les résultats publiés</p>
                  </td>
                  <td width="33%" style="padding:8px;text-align:center;vertical-align:top;">
                    <p style="margin:0 0 4px;font-size:22px;">⚡</p>
                    <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#1E3A5F;">Accès immédiat</p>
                    <p style="margin:0;font-size:11px;color:#9CA3AF;">Pronostics dès aujourd'hui</p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Filet doré bas -->
          <tr>
            <td style="height:1px;background:linear-gradient(90deg,transparent,#C9A84C,transparent);font-size:0;">&nbsp;</td>
          </tr>

          <!-- ══════════════════════════════════════
               FOOTER
          ══════════════════════════════════════ -->
          <tr>
            <td style="background:#0F1923;border-radius:0 0 16px 16px;
                       padding:24px 36px;text-align:center;">
              <p style="margin:0 0 10px;font-family:Georgia,serif;font-size:14px;
                         font-weight:700;color:#C9A84C;letter-spacing:2px;">
                ELITE TURF
              </p>
              <p style="margin:0 0 4px;font-size:11px;color:rgba(255,255,255,0.35);">
                Vous recevez cet email car vous avez manifesté votre intérêt pour Elite Turf.
              </p>
              <p style="margin:0;font-size:11px;">
                <a href="${APP_URL}/confidentialite" style="color:rgba(201,168,76,0.5);text-decoration:none;">
                  Politique de confidentialité
                </a>
                &nbsp;·&nbsp;
                <a href="${APP_URL}/confidentialite#desinscription" style="color:rgba(201,168,76,0.5);text-decoration:none;">
                  Se désabonner
                </a>
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

  const subject = `${prenom}, votre première analyse Elite Turf — ${reductionPct}% offerts jusqu'au ${dateExpiration} 🏇`;

  return { subject, html };
}
