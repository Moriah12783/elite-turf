/**
 * POST /api/admin/email-test
 *
 * Endpoint admin pour tester l'envoi d'un template email à une adresse arbitraire.
 * Authentifié par CRON_SECRET (header Authorization: Bearer <CRON_SECRET>).
 *
 * Usage :
 *   curl -X POST https://www.elite-turf.fr/api/admin/email-test \
 *     -H "Authorization: Bearer $CRON_SECRET" \
 *     -H "Content-Type: application/json" \
 *     -d '{"template":"bienvenue","email":"steph2008.yapi@gmail.com"}'
 *
 * Templates dispo :
 *   bienvenue, welcome-j1, welcome-j3, welcome-j7,
 *   confirmation-paiement, confirmation-pack, rappel-expiration,
 *   nouveau-pronostic, newsletter, newsletter-lancement
 *
 * Sécurité :
 *   - Auth Bearer obligatoire (CRON_SECRET) → empêche le spam externe
 *   - Sujet préfixé "[TEST]" → identifiable dans la boîte de réception
 *   - Logué côté serveur pour audit
 */

import { NextRequest, NextResponse } from "next/server";
import { sendEmailDetailed } from "@/lib/email";
import { templateBienvenue } from "@/lib/email/templates/bienvenue";
import { templateWelcomeJ1 } from "@/lib/email/templates/welcome-series-j1";
import { templateWelcomeJ3 } from "@/lib/email/templates/welcome-series-j3";
import { templateWelcomeJ7 } from "@/lib/email/templates/welcome-series-j7";
import { templateConfirmationPaiement } from "@/lib/email/templates/confirmation-paiement";
import { templateConfirmationPack } from "@/lib/email/templates/confirmation-pack";
import { templateRappelExpiration } from "@/lib/email/templates/rappel-expiration";
import { templateNouveauPronostic } from "@/lib/email/templates/nouveau-pronostic";
import { templateNewsletter } from "@/lib/email/templates/newsletter";
import { templateNewsletterLancement } from "@/lib/email/templates/newsletter-lancement";

export const dynamic     = "force-dynamic";
export const maxDuration = 30;

const CRON_SECRET = process.env.CRON_SECRET || "";
const NOM_COMPLET = "Stéphane Yapi";
const PRENOM      = "Stéphane";

const TEMPLATES: Record<string, (email: string) => { subject: string; html: string }> = {
  "bienvenue":              (email) => templateBienvenue({ nomComplet: NOM_COMPLET, email }),
  "welcome-j1":             ()      => templateWelcomeJ1({ nomComplet: NOM_COMPLET }),
  "welcome-j3":             ()      => templateWelcomeJ3({ nomComplet: NOM_COMPLET }),
  "welcome-j7":             ()      => templateWelcomeJ7({ nomComplet: NOM_COMPLET }),
  "confirmation-paiement":  (email) => templateConfirmationPaiement({
    nomComplet: NOM_COMPLET, email,
    planNom: "Pro", montantEur: 65,
    dateDebut: "2026-05-10", dateFin: "2026-06-10",
    statutAbonnement: "PRO",
  }),
  "confirmation-pack":      (email) => templateConfirmationPack({
    nomComplet: NOM_COMPLET, email,
    planNom: "Pro", dateExpiration: "2026-06-10", nbAlertes: 20,
  }),
  "rappel-expiration":      (email) => templateRappelExpiration({
    nomComplet: NOM_COMPLET, email,
    planNom: "Pro", dateFin: "2026-05-12",
    joursRestants: 2, prixEur: 65,
  }),
  "nouveau-pronostic":      ()      => templateNouveauPronostic({
    nomComplet: NOM_COMPLET,
    hippodrome: "ParisLongchamp",
    dateString: "Dimanche 10 mai",
    typePari: "QUINTE_PLUS",
    niveauAcces: "ELITE",
    analysesCourte: "Sabroso (13) point d'appui solide, Avide (3) avec Fabre/Guyon en confiance.",
    nbPartants: 20,
    pronosticId: "test-pronostic-id",
  }),
  "newsletter":             ()      => templateNewsletter({
    prenom: PRENOM, segment: "actifs",
    editoTexte: "Cette semaine, le turf nous a réservé de belles surprises avec notamment un magnifique 47/1 sur le Quinté+ de Vincennes.",
    secretTitre: "Pourquoi les jockeys vétérans gagnent plus en handicap",
    secretTexte: "L'expérience d'un jockey en course handicap pèse plus que son palmarès récent.",
    bilanTexte: "47% de Quinté+ trouvés dans nos sélections, taux ROI +18% sur les Tiercés gratuits.",
    numeroEdition: 12,
  }),
  "newsletter-lancement":   ()      => templateNewsletterLancement({
    prenom: PRENOM, numeroEdition: 1, reductionPct: 30,
    dateExpiration: "15 mai 2026", codePromo: "ELITE30",
  }),
};

export async function POST(req: NextRequest) {
  // ── 1. Auth Bearer obligatoire ───────────────────────────────────────
  const auth = req.headers.get("authorization") || "";
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── 2. Validation des paramètres ─────────────────────────────────────
  let body: { template?: string; email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { template, email } = body;
  if (!template || !email) {
    return NextResponse.json({
      error:           "template et email sont requis",
      templates_dispo: Object.keys(TEMPLATES),
    }, { status: 400 });
  }

  const generator = TEMPLATES[template];
  if (!generator) {
    return NextResponse.json({
      error:           `Template inconnu : "${template}"`,
      templates_dispo: Object.keys(TEMPLATES),
    }, { status: 400 });
  }

  // Validation basique format email
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Email invalide" }, { status: 400 });
  }

  // ── 3. Génération + envoi ────────────────────────────────────────────
  try {
    const { subject, html } = generator(email);

    const result = await sendEmailDetailed({
      to:      email,
      subject: `[TEST] ${subject}`,
      html,
    });

    if (!result.ok) {
      return NextResponse.json({
        ok:       false,
        error:    result.error || "Échec envoi Resend",
        template,
        email,
        subject,
      }, { status: 500 });
    }

    console.log(`[email-test] ✓ ${template} → ${email} (${subject})`);
    return NextResponse.json({
      ok:       true,
      template,
      email,
      subject,
      message:  "Email envoyé avec succès",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[email-test] ✗ ${template} → ${email} : ${msg}`);
    return NextResponse.json({
      ok:       false,
      error:    msg,
      template,
      email,
    }, { status: 500 });
  }
}
