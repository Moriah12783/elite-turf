import { NextRequest, NextResponse } from "next/server";
import { sendEmail } from "@/lib/email";
import { emailBase, emailButton, emailDivider } from "@/lib/email/base";
import { createServiceClient } from "@/lib/supabase/server";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://www.elite-turf.fr");

const secrets = [
  { num: "1", titre: `Décrypter la "Musique" du Cheval`, icon: "🎵" },
  { num: "2", titre: "Le Coefficient Jockey / Entraîneur",   icon: "🤝" },
  { num: "3", titre: "Le Déferrage : Le Turbo du Trotteur",  icon: "⚡" },
  { num: "4", titre: "La Règle des 5% de Bankroll",          icon: "💼" },
  { num: "5", titre: "L'Analyse de la Dernière Minute",      icon: "🔍" },
];

/**
 * Email de livraison du guide gratuit.
 * Utilise le template maison standard `emailBase` (en-tête logo fer-à-cheval +
 * bandes dorées + pied de page TSALACH/jeu responsable), comme tous les autres
 * emails — l'ancien template bespoke a été retiré.
 */
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

  const content = `
    <h1 style="margin:0 0 6px 0;font-family:Georgia,serif;font-size:26px;font-weight:700;color:#1E3A5F;line-height:1.3;">
      Bonjour ${prenom} !
    </h1>
    <p style="margin:0 0 8px 0;color:#C9A84C;font-size:13px;font-weight:600;letter-spacing:0.5px;">
      Votre guide exclusif est prêt à être téléchargé
    </p>
    <p style="margin:0 0 28px 0;color:#1F2937;font-size:15px;line-height:1.7;">
      Voici votre <strong style="color:#1E3A5F;">Guide de l'Initié — 5 Secrets d'Experts</strong>
      pour détecter les outsiders gagnants au PMU.
    </p>

    <!-- Bloc secrets -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0"
           style="border:1px solid #E5E7EB;border-radius:10px;margin-bottom:0;
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

    ${emailButton(`${APP_URL}/guide-initie.pdf`, "📥 Télécharger mon guide PDF")}

    ${emailDivider}

    <!-- Offre exclusive -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0"
           style="background:#FFFBF0;border:1px solid rgba(201,168,76,0.35);border-radius:10px;">
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
  `;

  return emailBase(content, "Votre Guide de l'Initié — 5 Secrets d'Experts est prêt.");
}

export async function POST(req: NextRequest) {
  try {
    const { email: rawEmail, nom, source } = await req.json();

    if (!rawEmail || !String(rawEmail).includes("@")) {
      return NextResponse.json({ error: "Email invalide" }, { status: 400 });
    }

    const email = String(rawEmail).trim().toLowerCase();
    const prenom = nom?.split(" ")[0] || "Turfiste";
    const leadSource =
      typeof source === "string" && source.trim()
        ? source.trim().slice(0, 40)
        : "guide-gratuit";

    const supabase = createServiceClient();
    // Anti-doublon : si le lead existe déjà (contrainte unique sur email),
    // on ignore l'erreur 23505 et on (re)envoie quand même le guide demandé.
    const { error: insertError } = await supabase
      .from("leads")
      .insert({ prenom, email, source: leadSource });
    if (insertError && insertError.code !== "23505") {
      console.error("[Guide API] insert lead", insertError);
    }

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
