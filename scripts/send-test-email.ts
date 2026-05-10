/**
 * scripts/send-test-email.ts
 *
 * Envoie un email de test à une adresse, en utilisant directement les templates
 * locaux + la clé Resend de .env.local. Ne passe PAS par Next.js — pas besoin
 * de redeploy pour tester.
 *
 * Usage :
 *   npx tsx scripts/send-test-email.ts <template> <email>
 *
 * Templates dispo :
 *   bienvenue, welcome-j1, welcome-j3, welcome-j7,
 *   confirmation-paiement, confirmation-pack,
 *   rappel-expiration, nouveau-pronostic,
 *   newsletter, newsletter-lancement
 *
 * Exemple :
 *   npx tsx scripts/send-test-email.ts bienvenue steph2008.yapi@gmail.com
 */

import { readFileSync } from "fs";
import { join } from "path";

// ── Charger .env.local manuellement (pas de dotenv installé) ──────────────
function loadEnvLocal() {
  try {
    const content = readFileSync(join(process.cwd(), ".env.local"), "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let value = trimmed.slice(eqIdx + 1).trim();
      // Strip optional surrounding quotes
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  } catch (err) {
    console.error("⚠ Impossible de charger .env.local :", err);
    process.exit(1);
  }
}

loadEnvLocal();

// Force APP_URL vers la prod pour que les images des banners soient chargées
// depuis https://www.elite-turf.fr/images/email/banners/...
process.env.NEXT_PUBLIC_APP_URL = "https://www.elite-turf.fr";

// ── Imports tardifs pour avoir les env vars chargées ─────────────────────
import { sendEmailDetailed } from "../lib/email";
import { templateBienvenue } from "../lib/email/templates/bienvenue";
import { templateWelcomeJ1 } from "../lib/email/templates/welcome-series-j1";
import { templateWelcomeJ3 } from "../lib/email/templates/welcome-series-j3";
import { templateWelcomeJ7 } from "../lib/email/templates/welcome-series-j7";
import { templateConfirmationPaiement } from "../lib/email/templates/confirmation-paiement";
import { templateConfirmationPack } from "../lib/email/templates/confirmation-pack";
import { templateRappelExpiration } from "../lib/email/templates/rappel-expiration";
import { templateNouveauPronostic } from "../lib/email/templates/nouveau-pronostic";
import { templateNewsletter } from "../lib/email/templates/newsletter";
import { templateNewsletterLancement } from "../lib/email/templates/newsletter-lancement";

// ── CLI args ─────────────────────────────────────────────────────────────
const [, , templateName, emailDest] = process.argv;
if (!templateName || !emailDest) {
  console.error("Usage: npx tsx scripts/send-test-email.ts <template> <email>");
  console.error("Ex:    npx tsx scripts/send-test-email.ts bienvenue steph2008.yapi@gmail.com");
  process.exit(1);
}

const PRENOM = "Stéphane";
const NOM_COMPLET = "Stéphane Yapi";

const TEMPLATES: Record<string, () => { subject: string; html: string }> = {
  "bienvenue":              () => templateBienvenue({ nomComplet: NOM_COMPLET, email: emailDest }),
  "welcome-j1":             () => templateWelcomeJ1({ nomComplet: NOM_COMPLET }),
  "welcome-j3":             () => templateWelcomeJ3({ nomComplet: NOM_COMPLET }),
  "welcome-j7":             () => templateWelcomeJ7({ nomComplet: NOM_COMPLET }),
  "confirmation-paiement":  () => templateConfirmationPaiement({
    nomComplet: NOM_COMPLET, email: emailDest,
    planNom: "Pro", montantEur: 65,
    dateDebut: "2026-05-10", dateFin: "2026-06-10",
    statutAbonnement: "PRO",
  }),
  "confirmation-pack":      () => templateConfirmationPack({
    nomComplet: NOM_COMPLET, email: emailDest,
    planNom: "Pro", dateExpiration: "2026-06-10", nbAlertes: 20,
  }),
  "rappel-expiration":      () => templateRappelExpiration({
    nomComplet: NOM_COMPLET, email: emailDest,
    planNom: "Pro", dateFin: "2026-05-12",
    joursRestants: 2, prixEur: 65,
  }),
  "nouveau-pronostic":      () => templateNouveauPronostic({
    nomComplet: NOM_COMPLET,
    hippodrome: "ParisLongchamp",
    dateString: "Dimanche 10 mai",
    typePari: "QUINTE_PLUS",
    niveauAcces: "ELITE",
    analysesCourte: "Sabroso (13) point d'appui solide, Avide (3) avec Fabre/Guyon en confiance.",
    nbPartants: 20,
    pronosticId: "test-pronostic-id",
  }),
  "newsletter":             () => templateNewsletter({
    prenom: PRENOM, segment: "actifs",
    editoTexte: "Cette semaine, le turf nous a réservé de belles surprises avec notamment un magnifique 47/1 sur le Quinté+ de Vincennes.",
    secretTitre: "Pourquoi les jockeys vétérans gagnent plus en handicap",
    secretTexte: "L'expérience d'un jockey en course handicap pèse plus que son palmarès récent.",
    bilanTexte: "47% de Quinté+ trouvés dans nos sélections, taux ROI +18% sur les Tiercés gratuits.",
    numeroEdition: 12,
  }),
  "newsletter-lancement":   () => templateNewsletterLancement({
    prenom: PRENOM, numeroEdition: 1, reductionPct: 30,
    dateExpiration: "15 mai 2026", codePromo: "ELITE30",
  }),
};

const generator = TEMPLATES[templateName];
if (!generator) {
  console.error(`❌ Template inconnu : "${templateName}"`);
  console.error(`   Templates dispo : ${Object.keys(TEMPLATES).join(", ")}`);
  process.exit(1);
}

(async () => {
  console.log(`📧 Envoi de "${templateName}" à ${emailDest}...`);
  const { subject, html } = generator();
  console.log(`   Sujet : ${subject}`);

  const result = await sendEmailDetailed({
    to: emailDest,
    subject:`[TEST] ${subject}`,
    html,
  });

  if (result.ok) {
    console.log(`✅ Email envoyé avec succès !`);
  } else {
    console.error(`❌ Échec : ${result.error}`);
    process.exit(1);
  }
})();
