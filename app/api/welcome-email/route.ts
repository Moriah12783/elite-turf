/**
 * POST /api/welcome-email
 *
 * Envoie un email de bienvenue Premium via Resend
 * après la création d'un compte Elite Turf.
 *
 * Body : { email: string, nomComplet: string, pays?: string }
 */

import { NextRequest, NextResponse } from "next/server";

const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://elite-turf.fr";
const FROM_EMAIL = "noreply@elite-turf.fr";

export async function POST(req: NextRequest) {
  try {
    const { email, nomComplet, pays } = await req.json();

    if (!email) {
      return NextResponse.json({ error: "Email requis" }, { status: 400 });
    }

    if (!RESEND_API_KEY || RESEND_API_KEY === "your_resend_api_key") {
      console.warn("[Welcome Email] RESEND_API_KEY non configurée");
      return NextResponse.json({ ok: true, skipped: true });
    }

    const prenom = nomComplet?.split(" ")[0] || "Champion";

    const html = buildWelcomeEmail(prenom, email, pays || "", APP_URL);

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `Elite Turf <${FROM_EMAIL}>`,
        to: [email],
        subject: "🏇 Bienvenue chez Elite Turf — Vos pronostics experts vous attendent !",
        html,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("[Welcome Email] Resend error:", err);
      return NextResponse.json({ error: err }, { status: 500 });
    }

    const data = await res.json();
    console.log(`[Welcome Email] Envoyé à ${email} — ID: ${data.id}`);
    return NextResponse.json({ ok: true, id: data.id });

  } catch (err: any) {
    console.error("[Welcome Email] Erreur:", err?.message);
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}

// ─── Template HTML Elite Turf ──────────────────────────────────────────────

function buildWelcomeEmail(prenom: string, email: string, pays: string, appUrl: string): string {
  const year = new Date().getFullYear();

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Bienvenue chez Elite Turf</title>
</head>
<body style="margin:0;padding:0;background-color:#F7F5F0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F7F5F0;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- ── HEADER ── -->
          <tr>
            <td align="center" style="padding-bottom:36px;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background-color:#1a1a2e;border-radius:12px;padding:10px 16px;text-align:center;">
                    <span style="font-size:20px;">🏇</span>
                  </td>
                  <td style="padding-left:10px;">
                    <div style="font-size:20px;font-weight:900;color:#C9A84C;letter-spacing:3px;">ELITE</div>
                    <div style="font-size:10px;font-weight:700;color:#A07830;letter-spacing:5px;margin-top:-3px;">TURF</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ── CARTE PRINCIPALE ── -->
          <tr>
            <td style="background-color:#ffffff;border-radius:16px;overflow:hidden;">

              <!-- Barre dorée en haut -->
              <div style="height:3px;background:linear-gradient(90deg,#C9A84C,#E8D5A3,#C9A84C);"></div>

              <table width="100%" cellpadding="0" cellspacing="0" style="padding:48px 48px 40px;">

                <!-- Salutation -->
                <tr>
                  <td style="padding-bottom:8px;">
                    <p style="margin:0;font-size:14px;font-weight:600;color:#A07830;letter-spacing:2px;text-transform:uppercase;">Bienvenue chez Elite Turf</p>
                  </td>
                </tr>

                <!-- Titre principal -->
                <tr>
                  <td style="padding-bottom:20px;">
                    <h1 style="margin:0;font-size:34px;font-weight:800;color:#1a1a2e;line-height:1.2;">
                      Bonjour, ${prenom} ! 🎉
                    </h1>
                  </td>
                </tr>

                <!-- Texte intro -->
                <tr>
                  <td style="padding-bottom:32px;">
                    <p style="margin:0 0 14px;font-size:16px;color:#444455;line-height:1.7;">
                      Nous sommes ravis de vous accueillir au sein de la communauté <strong style="color:#1a1a2e;">Elite Turf</strong>.
                      Vous faites désormais partie du cercle restreint des parieurs qui font confiance à l'analyse et à la précision.
                    </p>
                    <p style="margin:0;font-size:16px;color:#444455;line-height:1.7;">
                      Nos experts parisiens analysent chaque jour le Quinté+ PMU pour vous offrir les meilleures sélections —
                      des courses jouables depuis <strong style="color:#1a1a2e;">${pays || "l'Afrique francophone"}</strong>.
                    </p>
                  </td>
                </tr>

                <!-- Séparateur -->
                <tr>
                  <td style="padding-bottom:32px;">
                    <div style="height:1px;background-color:#EEEBE4;"></div>
                  </td>
                </tr>

                <!-- Ce que vous obtenez -->
                <tr>
                  <td style="padding-bottom:32px;">
                    <p style="margin:0 0 20px;font-size:12px;font-weight:700;color:#A07830;text-transform:uppercase;letter-spacing:2px;">
                      Ce que vous obtenez gratuitement
                    </p>

                    <!-- Feature 1 -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:18px;">
                      <tr>
                        <td width="40" valign="top">
                          <div style="width:32px;height:32px;background-color:#F7F5F0;border-radius:8px;text-align:center;line-height:32px;font-size:16px;">📊</div>
                        </td>
                        <td style="padding-left:14px;" valign="top">
                          <p style="margin:0;font-size:14px;font-weight:700;color:#1a1a2e;">Programme complet PMU</p>
                          <p style="margin:3px 0 0;font-size:13px;color:#888899;line-height:1.5;">Toutes les courses du jour — hippodromes, horaires, partants</p>
                        </td>
                      </tr>
                    </table>

                    <!-- Feature 2 -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:18px;">
                      <tr>
                        <td width="40" valign="top">
                          <div style="width:32px;height:32px;background-color:#F7F5F0;border-radius:8px;text-align:center;line-height:32px;font-size:16px;">⭐</div>
                        </td>
                        <td style="padding-left:14px;" valign="top">
                          <p style="margin:0;font-size:14px;font-weight:700;color:#1a1a2e;">Pronostic Tiercé gratuit</p>
                          <p style="margin:3px 0 0;font-size:13px;color:#888899;line-height:1.5;">Accès au pronostic Nationale 3 — Tiercé chaque jour</p>
                        </td>
                      </tr>
                    </table>

                    <!-- Feature 3 -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:18px;">
                      <tr>
                        <td width="40" valign="top">
                          <div style="width:32px;height:32px;background-color:#F7F5F0;border-radius:8px;text-align:center;line-height:32px;font-size:16px;">🌍</div>
                        </td>
                        <td style="padding-left:14px;" valign="top">
                          <p style="margin:0;font-size:14px;font-weight:700;color:#1a1a2e;">Courses jouables depuis ${pays || "l'Afrique"}</p>
                          <p style="margin:3px 0 0;font-size:13px;color:#888899;line-height:1.5;">LONACI, LONASE, PMU Maroc — toutes les Nationales 1/2/3</p>
                        </td>
                      </tr>
                    </table>

                    <!-- Feature 4 -->
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td width="40" valign="top">
                          <div style="width:32px;height:32px;background-color:#F7F5F0;border-radius:8px;text-align:center;line-height:32px;font-size:16px;">📚</div>
                        </td>
                        <td style="padding-left:14px;" valign="top">
                          <p style="margin:0;font-size:14px;font-weight:700;color:#1a1a2e;">Guide & Blog PMU</p>
                          <p style="margin:3px 0 0;font-size:13px;color:#888899;line-height:1.5;">Stratégies, analyses et conseils de nos experts parisiens</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- CTA Principal -->
                <tr>
                  <td align="center" style="padding-bottom:32px;">
                    <a href="${appUrl}/pronostics"
                       style="display:inline-block;background-color:#C9A84C;color:#ffffff;font-size:15px;font-weight:800;padding:16px 44px;border-radius:8px;text-decoration:none;letter-spacing:0.5px;">
                      🏇 Voir les pronostics du jour
                    </a>
                  </td>
                </tr>

                <!-- Séparateur -->
                <tr>
                  <td style="padding-bottom:28px;">
                    <div style="height:1px;background-color:#EEEBE4;"></div>
                  </td>
                </tr>

                <!-- Bloc Premium -->
                <tr>
                  <td style="background-color:#FDFAF3;border-left:3px solid #C9A84C;border-radius:0 8px 8px 0;padding:20px 24px;">
                    <p style="margin:0 0 4px;font-size:15px;font-weight:800;color:#1a1a2e;">
                      Passez Premium pour le Quinté+
                    </p>
                    <p style="margin:0 0 14px;font-size:13px;color:#888899;line-height:1.5;">
                      Accédez aux analyses complètes Quarté+ et Quinté+ — dès <strong style="color:#1a1a2e;">109€/mois</strong>
                    </p>
                    <a href="${appUrl}/abonnements"
                       style="display:inline-block;color:#C9A84C;font-size:13px;font-weight:700;text-decoration:none;">
                      Voir les offres →
                    </a>
                  </td>
                </tr>

                <!-- Signature -->
                <tr>
                  <td style="padding-top:36px;">
                    <p style="margin:0 0 4px;font-size:15px;color:#444455;">À très vite sur la piste,</p>
                    <p style="margin:0;font-size:15px;font-weight:700;color:#1a1a2e;">L'Équipe Elite Turf</p>
                    <p style="margin:4px 0 0;font-size:13px;color:#A07830;">L'élite du pronostic hippique.</p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>

          <!-- ── LIENS RAPIDES ── -->
          <tr>
            <td style="padding:20px 0 0;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="33%" align="center" style="padding:0 5px;">
                    <a href="${appUrl}/pronostics" style="display:block;background-color:#ffffff;border-radius:10px;padding:14px 10px;text-decoration:none;text-align:center;">
                      <div style="font-size:20px;margin-bottom:6px;">🏇</div>
                      <div style="font-size:12px;font-weight:700;color:#1a1a2e;">Pronostics</div>
                    </a>
                  </td>
                  <td width="33%" align="center" style="padding:0 5px;">
                    <a href="${appUrl}/courses" style="display:block;background-color:#ffffff;border-radius:10px;padding:14px 10px;text-decoration:none;text-align:center;">
                      <div style="font-size:20px;margin-bottom:6px;">📅</div>
                      <div style="font-size:12px;font-weight:700;color:#1a1a2e;">Courses</div>
                    </a>
                  </td>
                  <td width="33%" align="center" style="padding:0 5px;">
                    <a href="${appUrl}/espace-membre" style="display:block;background-color:#ffffff;border-radius:10px;padding:14px 10px;text-decoration:none;text-align:center;">
                      <div style="font-size:20px;margin-bottom:6px;">👤</div>
                      <div style="font-size:12px;font-weight:700;color:#1a1a2e;">Mon espace</div>
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ── FOOTER ── -->
          <tr>
            <td align="center" style="padding:28px 0 0;">
              <p style="margin:0 0 6px;font-size:12px;color:#AAAAAA;">
                Vous recevez cet email car vous venez de créer un compte sur
                <a href="${appUrl}" style="color:#C9A84C;text-decoration:none;">elite-turf.fr</a>
              </p>
              <p style="margin:0 0 6px;font-size:12px;color:#AAAAAA;">
                Une question ? <a href="mailto:contact@elite-turf.fr" style="color:#C9A84C;text-decoration:none;">contact@elite-turf.fr</a>
              </p>
              <p style="margin:0;font-size:11px;color:#CCCCCC;">
                © ${year} Elite Turf · Experts PMU depuis Paris · Les pronostics sont fournis à titre informatif
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>
`.trim();
}
