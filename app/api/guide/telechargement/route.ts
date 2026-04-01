import { NextRequest, NextResponse } from "next/server";
import { sendEmail } from "@/lib/email";
import { createServiceClient } from "@/lib/supabase/server";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://elite-turf.fr";

const secrets = [
  { num: "1", titre: `Décrypter la "Musique" du Cheval`, icon: "🎵" },
  { num: "2", titre: "Le Coefficient Jockey / Entraîneur",   icon: "🤝" },
  { num: "3", titre: "Le Déferrage : Le Turbo du Trotteur",  icon: "⚡" },
  { num: "4", titre: "La Règle des 5% de Bankroll",          icon: "💼" },
  { num: "5", titre: "L'Analyse de la Dernière Minute",      icon: "🔍" },
];

function buildGuideEmail(prenom: string): string {
  const secretRows = secrets.map((s, i) => `
    <tr>
      <td style="padding:12px 16px;border-bottom:${i < secrets.length - 1 ? "1px solid #E5E7EB" : "none"};">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td width="40" style="vertical-align:middle;">
              <div style="width:32px;height:32px;background:linear-gradient(135deg,#D4AF5A,#C9A84C);
                          border-radius:50%;text-align:center;line-height:32px;font-size:15px;">
                ${s.icon}
              </div>
            </td>
            <td style="vertical-align:middle;padding-left:12px;">
              <span style="color:#9CA3AF;font-size:11px;text-transform:uppercase;
                           letter-spacing:0.5px;font-weight:600;">Secret ${s.num}</span><br/>
              <span style="color:#1F2937;font-size:14px;font-weight:600;line-height:1.4;">${s.titre}</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>`).join("");

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Elite Turf — Votre Guide de l'Initié</title>
  <style>
    body { margin:0;padding:0;background:#F9FAFB;font-family:'Helvetica Neue',Arial,sans-serif; }
    @media only screen and (max-width:600px) {
      .container { width:100% !important; padding:0 12px !important; }
      .btn { width:100% !important; display:block !important; text-align:center !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#F9FAFB;">

  <!-- Wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F9FAFB;padding:32px 0;">
    <tr>
      <td align="center">
        <table class="container" width="580" cellpadding="0" cellspacing="0" border="0"
               style="width:580px;max-width:580px;">

          <!-- Header Logo -->
          <tr>
            <td align="center" style="padding:0 0 0 0;">
              <table cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td style="background:#FFFFFF;border:1px solid #E5E7EB;border-bottom:3px solid #C9A84C;
                             border-radius:12px 12px 0 0;padding:18px 36px;text-align:center;">
                    <span style="font-family:Georgia,serif;font-size:11px;color:#9CA3AF;
                                 letter-spacing:4px;text-transform:uppercase;display:block;margin-bottom:4px;">
                      Maison de pronostics
                    </span>
                    <span style="font-family:Georgia,serif;font-size:26px;font-weight:700;
                                 color:#C9A84C;letter-spacing:3px;display:block;">
                      ELITE <span style="color:#1E3A5F;">TURF</span>
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Filet doré top -->
          <tr>
            <td style="background:linear-gradient(90deg,transparent,#C9A84C,transparent);height:1px;font-size:0;line-height:0;">&nbsp;</td>
          </tr>

          <!-- Corps blanc -->
          <tr>
            <td style="background:#FFFFFF;border-left:1px solid #E5E7EB;border-right:1px solid #E5E7EB;padding:40px 44px;">

              <!-- Salutation -->
              <h1 style="margin:0 0 6px 0;font-family:Georgia,serif;font-size:26px;
                         font-weight:700;color:#1E3A5F;line-height:1.3;">
                Bonjour ${prenom} !
              </h1>
              <p style="margin:0 0 8px 0;color:#C9A84C;font-size:13px;font-weight:600;letter-spacing:0.5px;">
                Votre guide exclusif est prêt à être téléchargé
              </p>
              <p style="margin:0 0 28px 0;color:#1F2937;font-size:15px;line-height:1.7;">
                Voici votre <strong style="color:#1E3A5F;">Guide de l'Initié — 5 Secrets d'Experts</strong>
                pour détecter les outsiders gagnants au PMU.
              </p>

              <!-- Bloc secrets — style menu étoilé -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0"
                     style="border:1px solid #E5E7EB;border-radius:10px;margin-bottom:28px;
                            background:#FFFFFF;overflow:hidden;">
                <tr>
                  <td style="background:#F8FAFC;border-bottom:1px solid #E5E7EB;padding:14px 16px;">
                    <span style="color:#1E3A5F;font-size:13px;font-weight:700;
                                 text-transform:uppercase;letter-spacing:0.5px;">
                      Ce que contient votre guide :
                    </span>
                  </td>
                </tr>
                ${secretRows}
              </table>

              <!-- Bouton CTA téléchargement -->
              <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 28px auto;">
                <tr>
                  <td align="center"
                      style="background:linear-gradient(135deg,#D4AF5A 0%,#C9A84C 50%,#B8942A 100%);
                             border:1px solid #A07A20;border-radius:10px;
                             box-shadow:0 2px 10px rgba(201,168,76,0.35);">
                    <a href="${APP_URL}/guide-initie.pdf" class="btn"
                       style="display:inline-block;padding:16px 40px;
                              font-family:'Helvetica Neue',Arial,sans-serif;
                              font-size:15px;font-weight:700;color:#1E3A5F;
                              text-decoration:none;border-radius:10px;letter-spacing:0.5px;">
                      📥 Télécharger mon guide PDF
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Filet doré -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px 0;">
                <tr>
                  <td style="background:linear-gradient(90deg,transparent,rgba(201,168,76,0.35),transparent);
                             height:1px;font-size:0;">&nbsp;</td>
                </tr>
              </table>

              <!-- Offre exclusive -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0"
                     style="background:#FFFBF0;border:1px solid rgba(201,168,76,0.35);
                            border-radius:10px;margin-bottom:0;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0 0 6px 0;color:#C9A84C;font-size:13px;font-weight:700;">
                      🎁 Offre exclusive
                    </p>
                    <p style="margin:0;color:#1F2937;font-size:13px;line-height:1.6;">
                      En tant que lecteur du guide, bénéficiez d'un accès à nos pronostics quotidiens.
                      <a href="${APP_URL}/abonnements"
                         style="color:#C9A84C;text-decoration:none;font-weight:700;">
                        Voir les offres →
                      </a>
                    </p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Filet doré bottom -->
          <tr>
            <td style="background:linear-gradient(90deg,transparent,#C9A84C,transparent);height:1px;font-size:0;line-height:0;">&nbsp;</td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#F3F4F6;border:1px solid #E5E7EB;border-top:0;
                       border-radius:0 0 12px 12px;padding:20px 40px;text-align:center;">
              <p style="margin:0 0 6px 0;color:#9CA3AF;font-size:11px;">
                Jouer comporte des risques. Pour être aidé : 09 74 75 13 13 (non surtaxé).
              </p>
              <p style="margin:0;font-size:10px;">
                EliteTurf · Paris, France &nbsp;·&nbsp;
                <a href="${APP_URL}/confidentialite"
                   style="color:#D1D5DB;text-decoration:none;">Se désabonner</a>
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
}

export async function POST(req: NextRequest) {
  try {
    const { email, nom } = await req.json();

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Email invalide" }, { status: 400 });
    }

    const prenom = nom?.split(" ")[0] || "Turfiste";

    const supabase = createServiceClient();
    await supabase.from("leads").insert({ prenom, email, source: "guide-gratuit" });

    await sendEmail({
      to: email,
      subject: `🏇 Votre Guide de l'Initié — 5 Secrets d'Experts EliteTurf`,
      html: buildGuideEmail(prenom),
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Guide API]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
