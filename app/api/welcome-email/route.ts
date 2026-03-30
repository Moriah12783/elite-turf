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
<body style="margin:0;padding:0;background-color:#0D0D14;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">

  <!-- Wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0D0D14;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- ── HEADER / LOGO ── -->
          <tr>
            <td align="center" style="padding-bottom:32px;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:linear-gradient(135deg,#1B5E20,#2E7D32);border-radius:12px;padding:10px 14px;text-align:center;">
                    <span style="font-size:22px;">🏇</span>
                  </td>
                  <td style="padding-left:12px;">
                    <div style="font-size:22px;font-weight:800;background:linear-gradient(135deg,#C9A84C,#E8D5A3,#A07830);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;letter-spacing:2px;">ELITE</div>
                    <div style="font-size:11px;font-weight:600;color:#A07830;letter-spacing:4px;margin-top:-2px;">TURF</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ── HERO CARD ── -->
          <tr>
            <td style="background:linear-gradient(135deg,#161622 0%,#1A1A2E 50%,#161622 100%);border-radius:20px;border:1px solid #2A2A3E;overflow:hidden;">

              <!-- Gold top bar -->
              <div style="height:4px;background:linear-gradient(90deg,#C9A84C,#E8D5A3,#C9A84C);"></div>

              <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 40px 32px;">

                <!-- Bienvenue badge -->
                <tr>
                  <td align="center" style="padding-bottom:24px;">
                    <span style="display:inline-block;background:rgba(201,168,76,0.1);border:1px solid rgba(201,168,76,0.3);border-radius:50px;padding:6px 18px;font-size:12px;font-weight:700;color:#C9A84C;letter-spacing:2px;text-transform:uppercase;">
                      ✨ Compte activé
                    </span>
                  </td>
                </tr>

                <!-- Titre -->
                <tr>
                  <td align="center" style="padding-bottom:12px;">
                    <h1 style="margin:0;font-size:32px;font-weight:800;color:#F5F5F0;line-height:1.2;">
                      Bienvenue, ${prenom} ! 🎉
                    </h1>
                  </td>
                </tr>

                <!-- Sous-titre -->
                <tr>
                  <td align="center" style="padding-bottom:32px;">
                    <p style="margin:0;font-size:16px;color:#9898A8;line-height:1.6;max-width:480px;">
                      Vous faites maintenant partie des <strong style="color:#C9A84C;">parieurs les mieux informés</strong>
                      d'Afrique francophone. Nos experts parisiens analysent chaque jour le Quinté+ PMU pour vous.
                    </p>
                  </td>
                </tr>

                <!-- CTA Principal -->
                <tr>
                  <td align="center" style="padding-bottom:40px;">
                    <a href="${appUrl}/pronostics"
                       style="display:inline-block;background:linear-gradient(135deg,#C9A84C,#A07830);color:#0D0D14;font-size:15px;font-weight:800;padding:16px 40px;border-radius:12px;text-decoration:none;letter-spacing:0.5px;box-shadow:0 4px 20px rgba(201,168,76,0.3);">
                      🏇 Voir les pronostics du jour
                    </a>
                  </td>
                </tr>

                <!-- Divider -->
                <tr>
                  <td style="padding-bottom:32px;">
                    <div style="height:1px;background:linear-gradient(90deg,transparent,#2A2A3E,transparent);"></div>
                  </td>
                </tr>

                <!-- Ce que vous obtenez -->
                <tr>
                  <td style="padding-bottom:24px;">
                    <p style="margin:0 0 20px;font-size:14px;font-weight:700;color:#F5F5F0;text-transform:uppercase;letter-spacing:1.5px;">
                      Ce que vous obtenez gratuitement
                    </p>

                    <!-- Feature 1 -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
                      <tr>
                        <td width="44" valign="top">
                          <div style="width:36px;height:36px;background:rgba(201,168,76,0.1);border-radius:10px;text-align:center;line-height:36px;font-size:18px;">📊</div>
                        </td>
                        <td style="padding-left:12px;" valign="top">
                          <p style="margin:0;font-size:14px;font-weight:700;color:#F5F5F0;">Programme complet PMU</p>
                          <p style="margin:4px 0 0;font-size:13px;color:#9898A8;">Toutes les courses du jour — hippodromes, horaires, partants</p>
                        </td>
                      </tr>
                    </table>

                    <!-- Feature 2 -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
                      <tr>
                        <td width="44" valign="top">
                          <div style="width:36px;height:36px;background:rgba(201,168,76,0.1);border-radius:10px;text-align:center;line-height:36px;font-size:18px;">⭐</div>
                        </td>
                        <td style="padding-left:12px;" valign="top">
                          <p style="margin:0;font-size:14px;font-weight:700;color:#F5F5F0;">Pronostic Tiercé gratuit</p>
                          <p style="margin:4px 0 0;font-size:13px;color:#9898A8;">Accès au pronostic Nationale 3 — Tiercé chaque jour</p>
                        </td>
                      </tr>
                    </table>

                    <!-- Feature 3 -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
                      <tr>
                        <td width="44" valign="top">
                          <div style="width:36px;height:36px;background:rgba(201,168,76,0.1);border-radius:10px;text-align:center;line-height:36px;font-size:18px;">🌍</div>
                        </td>
                        <td style="padding-left:12px;" valign="top">
                          <p style="margin:0;font-size:14px;font-weight:700;color:#F5F5F0;">Courses jouables depuis ${pays || "l'Afrique"}</p>
                          <p style="margin:4px 0 0;font-size:13px;color:#9898A8;">LONACI, LONASE, PMU Maroc — toutes les Nationales 1/2/3</p>
                        </td>
                      </tr>
                    </table>

                    <!-- Feature 4 -->
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td width="44" valign="top">
                          <div style="width:36px;height:36px;background:rgba(201,168,76,0.1);border-radius:10px;text-align:center;line-height:36px;font-size:18px;">📚</div>
                        </td>
                        <td style="padding-left:12px;" valign="top">
                          <p style="margin:0;font-size:14px;font-weight:700;color:#F5F5F0;">Guide & Blog PMU</p>
                          <p style="margin:4px 0 0;font-size:13px;color:#9898A8;">Stratégies, analyses et conseils de nos experts parisiens</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Divider -->
                <tr>
                  <td style="padding-bottom:28px;">
                    <div style="height:1px;background:linear-gradient(90deg,transparent,#2A2A3E,transparent);"></div>
                  </td>
                </tr>

                <!-- Upgrade CTA -->
                <tr>
                  <td style="background:rgba(201,168,76,0.05);border:1px solid rgba(201,168,76,0.2);border-radius:14px;padding:24px;" align="center">
                    <p style="margin:0 0 6px;font-size:16px;font-weight:800;color:#C9A84C;">
                      Passez Premium pour le Quinté+
                    </p>
                    <p style="margin:0 0 16px;font-size:13px;color:#9898A8;">
                      Accédez aux analyses complètes Quarté+ et Quinté+ — dès <strong style="color:#F5F5F0;">29€/mois</strong>
                    </p>
                    <a href="${appUrl}/abonnements"
                       style="display:inline-block;background:transparent;color:#C9A84C;font-size:13px;font-weight:700;padding:10px 28px;border-radius:10px;text-decoration:none;border:1px solid rgba(201,168,76,0.4);">
                      Voir les offres →
                    </a>
                  </td>
                </tr>

              </table>
            </td>
          </tr>

          <!-- ── LIENS RAPIDES ── -->
          <tr>
            <td style="padding:24px 0 0;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="33%" align="center" style="padding:0 6px;">
                    <a href="${appUrl}/pronostics" style="display:block;background:#161622;border:1px solid #2A2A3E;border-radius:12px;padding:16px 12px;text-decoration:none;text-align:center;">
                      <div style="font-size:20px;margin-bottom:6px;">🏇</div>
                      <div style="font-size:12px;font-weight:700;color:#F5F5F0;">Pronostics</div>
                    </a>
                  </td>
                  <td width="33%" align="center" style="padding:0 6px;">
                    <a href="${appUrl}/courses" style="display:block;background:#161622;border:1px solid #2A2A3E;border-radius:12px;padding:16px 12px;text-decoration:none;text-align:center;">
                      <div style="font-size:20px;margin-bottom:6px;">📅</div>
                      <div style="font-size:12px;font-weight:700;color:#F5F5F0;">Courses</div>
                    </a>
                  </td>
                  <td width="33%" align="center" style="padding:0 6px;">
                    <a href="${appUrl}/espace-membre" style="display:block;background:#161622;border:1px solid #2A2A3E;border-radius:12px;padding:16px 12px;text-decoration:none;text-align:center;">
                      <div style="font-size:20px;margin-bottom:6px;">👤</div>
                      <div style="font-size:12px;font-weight:700;color:#F5F5F0;">Mon espace</div>
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ── FOOTER ── -->
          <tr>
            <td align="center" style="padding:32px 0 0;">
              <p style="margin:0 0 8px;font-size:12px;color:#555566;">
                Vous recevez cet email car vous venez de créer un compte sur
                <a href="${appUrl}" style="color:#C9A84C;text-decoration:none;">elite-turf.fr</a>
              </p>
              <p style="margin:0 0 8px;font-size:12px;color:#555566;">
                Une question ? <a href="mailto:contact@elite-turf.fr" style="color:#C9A84C;text-decoration:none;">contact@elite-turf.fr</a>
              </p>
              <p style="margin:0;font-size:11px;color:#3A3A4A;">
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
