/**
 * scripts/preview-email-templates.ts
 *
 * Génère des fichiers HTML statiques pour TOUS les templates emails Elite Turf
 * dans `tmp/email-previews/` afin de visualiser le rendu localement dans le browser.
 *
 * Usage :
 *   npx tsx scripts/preview-email-templates.ts
 *   # puis ouvrir tmp/email-previews/index.html dans ton browser
 *
 * Note : APP_URL pointe vers la prod en local, donc les images des banners
 * seront chargées depuis https://www.elite-turf.fr/images/email/banners/
 * (celles que tu viens d'uploader, déployées via la PR feat/email-banners-html).
 *
 * Si tu veux tester en LOCAL avant déploiement, lance `pnpm dev` (ou `npm run dev`)
 * sur le projet et exporte NEXT_PUBLIC_APP_URL=http://localhost:3000 avant de lancer
 * ce script.
 */

import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

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

// Dossier de sortie
const OUT_DIR = join(process.cwd(), "tmp", "email-previews");
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

// Données mock pour chaque template
const PRENOM = "Stéphane";
const NOM_COMPLET = "Stéphane Yapi";
const EMAIL = "stephane@elite-turf.fr";

const previews: Array<{ slug: string; subject: string; html: string }> = [
  {
    slug: "01-bienvenue",
    ...templateBienvenue({ nomComplet: NOM_COMPLET, email: EMAIL }),
  },
  {
    slug: "02-welcome-j1",
    ...templateWelcomeJ1({ nomComplet: NOM_COMPLET }),
  },
  {
    slug: "03-welcome-j3",
    ...templateWelcomeJ3({ nomComplet: NOM_COMPLET }),
  },
  {
    slug: "04-welcome-j7",
    ...templateWelcomeJ7({ nomComplet: NOM_COMPLET }),
  },
  {
    slug: "05-confirmation-paiement",
    ...templateConfirmationPaiement({
      nomComplet: NOM_COMPLET,
      email: EMAIL,
      planNom: "Pro",
      montantEur: 65,
      dateDebut: "2026-05-10",
      dateFin: "2026-06-10",
      statutAbonnement: "PRO",
    }),
  },
  {
    slug: "06-confirmation-pack",
    ...templateConfirmationPack({
      nomComplet: NOM_COMPLET,
      email: EMAIL,
      planNom: "Pro",
      dateExpiration: "2026-06-10",
      nbAlertes: 20,
    }),
  },
  {
    slug: "07-rappel-expiration",
    ...templateRappelExpiration({
      nomComplet: NOM_COMPLET,
      email: EMAIL,
      planNom: "Pro",
      dateFin: "2026-05-12",
      joursRestants: 2,
      prixEur: 65,
    }),
  },
  {
    slug: "08-nouveau-pronostic",
    ...templateNouveauPronostic({
      nomComplet: NOM_COMPLET,
      hippodrome: "ParisLongchamp",
      dateString: "Dimanche 10 mai",
      typePari: "QUINTE_PLUS",
      niveauAcces: "ELITE",
      analysesCourte: "Sabroso (13) point d'appui solide, Avide (3) avec Fabre/Guyon en confiance.",
      nbPartants: 20,
      pronosticId: "test-pronostic-id",
    }),
  },
  {
    slug: "09-newsletter",
    ...templateNewsletter({
      prenom: PRENOM,
      segment: "actifs",
      editoTexte: "Cette semaine, le turf nous a réservé de belles surprises avec notamment un magnifique 47/1 sur le Quinté+ de Vincennes. Notre méthodologie continue de prouver son efficacité.",
      secretTitre: "Pourquoi les jockeys vétérans gagnent plus en handicap",
      secretTexte: "L'expérience d'un jockey en course handicap pèse plus que son palmarès récent. Voici comment on l'intègre à nos sélections.",
      bilanTexte: "47% de Quinté+ trouvés dans nos sélections, taux ROI +18% sur les Tiercés gratuits, gros gain de la quinzaine : 380€ sur le pronostic Elite du 25 avril.",
      numeroEdition: 12,
    }),
  },
  {
    slug: "10-newsletter-lancement",
    ...templateNewsletterLancement({
      prenom: PRENOM,
      numeroEdition: 1,
      reductionPct: 30,
      dateExpiration: "15 mai 2026",
      codePromo: "ELITE30",
    }),
  },
];

// Génère un fichier HTML par template
const indexEntries: string[] = [];
for (const { slug, subject, html } of previews) {
  const filename = `${slug}.html`;
  writeFileSync(join(OUT_DIR, filename), html, "utf8");
  indexEntries.push(`<li><a href="${filename}"><strong>${slug}</strong></a> — <em>${subject}</em></li>`);
  console.log(`✓ ${filename}`);
}

// Génère un index.html avec liens vers tous les previews
const indexHtml = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Previews emails Elite Turf</title>
  <style>
    body { font-family:system-ui,sans-serif; max-width:780px; margin:32px auto; padding:0 24px; color:#1F2937; }
    h1 { color:#1E3A5F; border-bottom:3px solid #C9A84C; padding-bottom:8px; }
    ul { list-style:none; padding:0; }
    li { padding:12px 16px; background:#F8FAFC; border:1px solid #E5E7EB; border-radius:8px; margin-bottom:8px; }
    a { color:#C9A84C; text-decoration:none; font-weight:700; }
    a:hover { color:#1E3A5F; }
    em { color:#6B7280; font-style:normal; font-size:14px; }
    .info { background:#FFFBF0; border:1px solid rgba(201,168,76,0.4); border-radius:8px; padding:16px; margin:24px 0; font-size:14px; line-height:1.6; }
  </style>
</head>
<body>
  <h1>📧 Previews emails Elite Turf</h1>
  <div class="info">
    <strong>10 templates générés.</strong> Clique sur un template pour le visualiser.<br>
    Les images des banners sont chargées depuis <code>https://www.elite-turf.fr/images/email/banners/</code>.<br>
    Si elles ne s'affichent pas → la PR n'est pas encore mergée en prod (l'URL n'existe pas encore).<br>
    Dans ce cas, regarde les autres aspects (titres, layout, couleurs) ; les images apparaîtront après merge.
  </div>
  <ul>
    ${indexEntries.join("\n    ")}
  </ul>
  <p style="color:#9CA3AF; font-size:12px; margin-top:32px;">
    Généré le ${new Date().toLocaleString("fr-FR")} · ${previews.length} templates
  </p>
</body>
</html>`;

writeFileSync(join(OUT_DIR, "index.html"), indexHtml, "utf8");
console.log(`\n✓ Index : tmp/email-previews/index.html`);
console.log(`\n→ Ouvre tmp/email-previews/index.html dans ton browser pour visualiser les 10 templates.`);
