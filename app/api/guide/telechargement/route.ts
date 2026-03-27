import { NextRequest, NextResponse } from "next/server";
import { sendEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const { email, nom } = await req.json();

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Email invalide" }, { status: 400 });
    }

    const prenom = nom?.split(" ")[0] || "Turfiste";

    // Envoyer le guide par email
    await sendEmail({
      to: email,
      subject: `🏇 Votre Guide de l'Initié — 5 Secrets d'Experts EliteTurf`,
      html: `
        <div style="background:#0D0D14;color:#F5F5F0;font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px 24px;">
          <div style="text-align:center;margin-bottom:24px;">
            <span style="color:#C9A84C;font-size:22px;font-weight:800;letter-spacing:2px;">ELITE TURF</span>
          </div>

          <h1 style="color:#C9A84C;font-size:22px;font-weight:700;margin-bottom:8px;">
            Bonjour ${prenom} !
          </h1>
          <p style="color:#9898B0;font-size:15px;line-height:1.6;margin-bottom:24px;">
            Voici votre <strong style="color:#F5F5F0;">Guide de l'Initié — 5 Secrets d'Experts</strong> pour détecter les outsiders gagnants au PMU.
          </p>

          <div style="background:#161622;border:1px solid #2A2A3E;border-radius:12px;padding:20px;margin-bottom:24px;">
            <p style="color:#C9A84C;font-weight:700;margin-bottom:12px;">Ce que contient votre guide :</p>
            <ul style="color:#9898B0;font-size:14px;line-height:1.8;padding-left:20px;margin:0;">
              <li>Secret 1 — Décrypter la "Musique" du Cheval</li>
              <li>Secret 2 — Le Coefficient Jockey/Entraîneur</li>
              <li>Secret 3 — Le Déferrage : Le Turbo du Trotteur</li>
              <li>Secret 4 — La Règle des 5% de Bankroll</li>
              <li>Secret 5 — L'Analyse de la Dernière Minute</li>
            </ul>
          </div>

          <div style="text-align:center;margin-bottom:28px;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://eliteturf.fr"}/guide-initie.pdf"
               style="display:inline-block;background:#C9A84C;color:#0D0D14;font-weight:700;padding:14px 32px;border-radius:12px;text-decoration:none;font-size:14px;">
              📥 Télécharger mon guide PDF
            </a>
          </div>

          <div style="background:#1A1628;border:1px solid #C9A84C30;border-radius:12px;padding:16px;margin-bottom:24px;">
            <p style="color:#C9A84C;font-size:13px;font-weight:700;margin-bottom:6px;">🎁 Offre exclusive</p>
            <p style="color:#9898B0;font-size:13px;line-height:1.6;margin:0;">
              En tant que lecteur du guide, bénéficiez d'un accès à nos pronostics quotidiens.
              <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://eliteturf.fr"}/abonnements"
                 style="color:#C9A84C;text-decoration:none;font-weight:600;"> Voir les offres →</a>
            </p>
          </div>

          <p style="color:#4A4A60;font-size:11px;text-align:center;line-height:1.5;">
            Jouer comporte des risques. Pour être aidé : 09 74 75 13 13 (non surtaxé).<br/>
            EliteTurf — Paris, France · <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://eliteturf.fr"}/confidentialite" style="color:#4A4A60;">Se désabonner</a>
          </p>
        </div>
      `,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Guide API]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
