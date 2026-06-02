/**
 * lib/email/templates/banners/header-banner.ts
 *
 * Banner header email Elite Turf — Direction artistique "Luxe & Clarté"
 *
 * Une fonction `renderHeaderBanner()` qui produit un bandeau visuel premium
 * (photo cheval en arrière-plan, overlay bleu nuit dégradé, titre serif blanc
 * + sous-titre en or brossé) compatible Gmail / Outlook / Apple Mail.
 *
 * Compatibilité :
 *   - Gmail web/mobile, Apple Mail, Outlook.com, iOS Mail, Android : background-image natif
 *   - Outlook Desktop 2007+ : fallback VML (commentaires <!--[if mso]-->)
 *
 * Les 4 photos de référence sont stockées en /public/images/email/banners/
 * (téléchargées depuis Pexels, libres de droits commerciaux).
 *
 * Usage :
 *   import { renderHeaderBanner, BANNER_BIENVENUE } from "./banners/header-banner";
 *   const content = `${renderHeaderBanner(BANNER_BIENVENUE)} <p>...</p>`;
 */

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://www.elite-turf.fr").replace(/\/$/, "");

export interface BannerConfig {
  /** Titre principal en serif blanc (ex: "Bienvenue chez Elite Turf") */
  title:    string;
  /** Sous-titre en or brossé sous une fine ligne dorée (ex: "Votre passe vers les pronostics premium") */
  subtitle: string;
  /** Nom du fichier dans /public/images/email/banners/ (ex: "cheval-3-violet.jpg") */
  photoFilename: string;
}

/**
 * Génère le HTML d'un banner header email (600×200 max).
 *
 * Structure :
 *   - Bandeau pleine largeur (max 600px), hauteur 200px
 *   - Photo de cheval en background-image (fallback bleu nuit pour Outlook)
 *   - Overlay dégradé bleu nuit opaque à gauche → transparent à droite
 *   - Texte côté gauche : titre serif blanc + ligne dorée + sous-titre or
 */
export function renderHeaderBanner({ title, subtitle, photoFilename }: BannerConfig): string {
  const photoUrl = `${APP_URL}/images/email/banners/${photoFilename}`;

  return `
<!-- ── Banner header (600×200) ─────────────────────────────────────── -->
<!--[if mso]>
<v:rect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office"
        fill="true" stroke="false" style="width:600px;height:200px;">
  <v:fill type="frame" src="${photoUrl}" color="#1E3A5F"/>
  <v:textbox inset="0,0,0,0">
<![endif]-->
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"
       style="width:100%;max-width:600px;height:200px;border-collapse:collapse;
              background-color:#1E3A5F;
              background-image:url('${photoUrl}');
              background-size:cover;background-position:center right;background-repeat:no-repeat;">
  <tr>
    <td height="200" valign="middle"
        style="height:200px;padding:0;background-image:linear-gradient(90deg,#1E3A5F 0%,#1E3A5F 50%,rgba(30,58,95,0.92) 65%,rgba(30,58,95,0.55) 85%,rgba(30,58,95,0.1) 100%);">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td valign="middle" style="padding:36px 32px;">

            <!-- Titre serif blanc — text-shadow renforcé pour clients qui ignorent les gradients CSS (Outlook web) -->
            <p style="margin:0 0 10px 0;font-family:Georgia,'Times New Roman',serif;
                      font-size:24px;font-weight:700;color:#FFFFFF;line-height:1.2;
                      letter-spacing:0.3px;text-shadow:0 2px 6px rgba(0,0,0,0.85), 0 0 12px rgba(0,0,0,0.5);">
              ${escapeHtml(title)}
            </p>

            <!-- Fine ligne décorative dorée -->
            <table role="presentation" cellpadding="0" cellspacing="0" border="0"
                   style="margin:0 0 10px 0;">
              <tr>
                <td style="width:60px;height:2px;font-size:0;line-height:0;
                           background:linear-gradient(90deg,#C9A84C,rgba(201,168,76,0.2));">&nbsp;</td>
              </tr>
            </table>

            <!-- Sous-titre or brossé — text-shadow renforcé idem -->
            <p style="margin:0;font-family:Georgia,'Times New Roman',serif;
                      font-size:13px;font-weight:600;color:#E8C97A;font-style:italic;
                      letter-spacing:0.4px;line-height:1.4;text-shadow:0 2px 5px rgba(0,0,0,0.8), 0 0 8px rgba(0,0,0,0.45);">
              ${escapeHtml(subtitle)}
            </p>

          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
<!--[if mso]>
  </v:textbox>
</v:rect>
<![endif]-->
`;
}

/**
 * Échappe les caractères HTML dangereux dans le texte du titre/sous-titre.
 * Important car titre/sous-titre peuvent contenir des données utilisateur (futur).
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ──────────────────────────────────────────────────────────────────────
// Configurations pré-définies pour les 10 templates emails Elite Turf
// ──────────────────────────────────────────────────────────────────────
//
// Mapping photo → banner (pour cohérence visuelle entre emails) :
//   - cheval-1-galop-vert.jpg     → Welcome J1 + Newsletter standard
//   - cheval-2-rose.jpg           → Confirmation paiement + Pack
//   - cheval-3-violet.jpg         → Bienvenue + Welcome J7 + Rappel expiration
//   - cheval-4-course-groupe.jpg  → Welcome J3 + Nouveau pronostic + Newsletter lancement

export const BANNER_BIENVENUE: BannerConfig = {
  title:         "Bienvenue chez Elite Turf",
  subtitle:      "Votre passe vers les pronostics premium",
  photoFilename: "cheval-3-violet.jpg",
};

export const BANNER_WELCOME_J1: BannerConfig = {
  title:         "Bien arrivé !",
  subtitle:      "Voici comment démarrer en 24h",
  photoFilename: "cheval-1-galop-vert.jpg",
};

export const BANNER_WELCOME_J3: BannerConfig = {
  title:         "Découvrez la méthode Elite",
  subtitle:      "3 jours avec nous, et après ?",
  photoFilename: "cheval-4-course-groupe.jpg",
};

export const BANNER_WELCOME_J7: BannerConfig = {
  title:         "Passez en mode Premium",
  subtitle:      "Une semaine avec nous, prêt à gagner ?",
  photoFilename: "cheval-3-violet.jpg",
};

export const BANNER_CONFIRMATION_PAIEMENT: BannerConfig = {
  title:         "Paiement validé",
  subtitle:      "Bienvenue dans le club Elite",
  photoFilename: "cheval-2-rose.jpg",
};

export const BANNER_CONFIRMATION_PACK: BannerConfig = {
  title:         "Votre pack est actif",
  subtitle:      "Profitez de toutes vos analyses",
  photoFilename: "cheval-2-rose.jpg",
};

export const BANNER_RAPPEL_EXPIRATION: BannerConfig = {
  title:         "Votre abonnement expire bientôt",
  subtitle:      "Renouvelez en 1 clic pour ne rien manquer",
  photoFilename: "cheval-3-violet.jpg",
};

export const BANNER_NOUVEAU_PRONOSTIC: BannerConfig = {
  title:         "Pronostic du jour disponible",
  subtitle:      "Notre analyse experte vient d'être publiée",
  photoFilename: "cheval-4-course-groupe.jpg",
};

export const BANNER_NEWSLETTER: BannerConfig = {
  title:         "L'actu Elite Turf",
  subtitle:      "Le meilleur du turf, par nos experts",
  photoFilename: "cheval-1-galop-vert.jpg",
};

export const BANNER_NEWSLETTER_LANCEMENT: BannerConfig = {
  title:         "Édition spéciale",
  subtitle:      "Un événement à ne pas manquer",
  photoFilename: "cheval-4-course-groupe.jpg",
};

export const BANNER_MIGRATION_PHONE: BannerConfig = {
  title:         "Complétez votre profil Elite Turf",
  subtitle:      "1 minute pour activer toutes les fonctionnalités",
  photoFilename: "cheval-1-galop-vert.jpg",
};

export const BANNER_PAIEMENT_ECHOUE: BannerConfig = {
  title:         "Votre paiement n'a pas abouti",
  subtitle:      "Reprenez en 1 clic — c'est rapide",
  photoFilename: "cheval-2-rose.jpg",
};
