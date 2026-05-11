/**
 * lib/email/templates/rappel-telephone.ts
 *
 * Email envoyé aux anciens inscrits qui ont créé leur compte AVANT la mise
 * en place de la collecte téléphone obligatoire (V2 inscription du 10 mai 2026).
 * Ces utilisateurs sont bloqués au middleware → redirigés en boucle sur
 * /completer-profil dès qu'ils tentent de naviguer. Avant qu'on les laisse
 * abandonner, on leur envoie un rappel email avec CTA direct.
 *
 * Variantes selon statut abonnement :
 *   - ELITE / PRO : ton "votre abonnement Elite est presque actif" — urgent
 *     car ils ont payé et perdent les avantages WhatsApp/SMS sans phone
 *   - GRATUIT     : ton "complétez votre inscription" — sans pression
 *
 * Photo banner : cheval-1-galop-vert (énergique, positive — pas d'alerte).
 */

import { emailBase, emailButton, emailDivider } from "../base";
import { renderHeaderBanner, BANNER_MIGRATION_PHONE } from "./banners/header-banner";

interface RappelTelephoneData {
  /** Prénom ou nom complet — utilisé pour la salutation */
  nomComplet:        string;
  /** Email du destinataire (affiché dans le corps pour transparence) */
  email:             string;
  /** Statut abonnement actuel — détermine le wording */
  statutAbonnement:  "GRATUIT" | "STARTER" | "PRO" | "ELITE";
}

export function templateRappelTelephone({
  nomComplet, email, statutAbonnement,
}: RappelTelephoneData): { subject: string; html: string } {
  const prenom = nomComplet.split(" ")[0] || nomComplet;
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://www.elite-turf.fr").replace(/\/$/, "");
  const isAbonne = statutAbonnement !== "GRATUIT";

  // Subject + wording adaptatif selon abonné payant vs gratuit
  const subject = isAbonne
    ? `🏇 ${prenom}, complétez votre profil pour activer pleinement votre abonnement Elite`
    : `🏇 ${prenom}, finalisez votre inscription Elite Turf (1 minute)`;

  const introMessage = isAbonne
    ? `<p style="margin:0 0 16px 0;color:#1F2937;font-size:15px;line-height:1.7;">
         Nous avons remarqué que votre <strong style="color:#1E3A5F;">abonnement
         ${statutAbonnement} Elite Turf</strong> est actif, mais que votre numéro
         de téléphone n'a pas encore été renseigné dans votre profil.
       </p>
       <p style="margin:0 0 24px 0;color:#1F2937;font-size:15px;line-height:1.7;">
         Pour <strong style="color:#1E3A5F;">profiter pleinement de votre abonnement</strong>
         (notifications WhatsApp des pronostics du jour, suivi de paiement, support prioritaire),
         il vous suffit de compléter votre profil en 1 minute.
       </p>`
    : `<p style="margin:0 0 16px 0;color:#1F2937;font-size:15px;line-height:1.7;">
         Vous avez créé votre compte Elite Turf avant la mise à jour de notre
         processus d'inscription. <strong style="color:#1E3A5F;">Il vous reste
         une dernière étape</strong> pour finaliser votre profil et accéder à
         toutes les fonctionnalités.
       </p>
       <p style="margin:0 0 24px 0;color:#1F2937;font-size:15px;line-height:1.7;">
         En complétant votre numéro de téléphone, vous pourrez recevoir nos
         <strong style="color:#1E3A5F;">notifications pronostics par WhatsApp</strong>
         et accéder à votre espace membre sans redirection.
       </p>`;

  const benefits = [
    {
      icon: "📲",
      title: "Notifications WhatsApp",
      desc:  "Recevez les pronostics du jour directement sur votre mobile",
    },
    {
      icon: "🔒",
      title: "Sécurité renforcée",
      desc:  "Double vérification de votre compte en cas de perte d'accès",
    },
    {
      icon: isAbonne ? "💳" : "🎯",
      title: isAbonne ? "Suivi paiement Mobile Money" : "Personnalisation",
      desc:  isAbonne
        ? "Confirmation automatique et historique transactions"
        : "Pronostics adaptés à votre pays (LONACI, PMU France, Maroc)",
    },
  ];

  const content = `
    ${renderHeaderBanner(BANNER_MIGRATION_PHONE)}

    <h2 style="margin:28px 0 16px 0;font-family:Georgia,serif;font-size:20px;
               font-weight:700;color:#1E3A5F;line-height:1.3;">
      Bonjour ${prenom} 👋
    </h2>

    ${introMessage}

    <!-- CTA Hero -->
    <table cellpadding="0" cellspacing="0" border="0" align="center" style="margin:8px auto 8px auto;">
      <tr>
        <td align="center" style="background:linear-gradient(135deg,#D4AF5A 0%,#C9A84C 50%,#B8942A 100%);border:1px solid #A07A20;border-radius:10px;box-shadow:0 4px 14px rgba(201,168,76,0.4);">
          <a href="${appUrl}/completer-profil"
             style="display:inline-block;padding:16px 40px;font-family:'Helvetica Neue',Arial,sans-serif;font-size:15px;font-weight:800;color:#1E3A5F;text-decoration:none;border-radius:10px;letter-spacing:0.5px;">
            ✓ Compléter mon profil maintenant
          </a>
        </td>
      </tr>
    </table>

    <p style="margin:12px 0 24px 0;text-align:center;color:#9CA3AF;font-size:12px;font-style:italic;">
      ⏱ 1 minute · Compte associé à <strong>${email}</strong>
    </p>

    <!-- Bénéfices -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0"
           style="background:#F8FAFC;border:1px solid #E5E7EB;border-radius:10px;
                  margin:8px 0 24px 0;">
      <tr>
        <td style="padding:20px 24px;">
          <p style="margin:0 0 16px 0;color:#1E3A5F;font-size:13px;font-weight:700;
                    letter-spacing:0.5px;text-transform:uppercase;">
            ✦ Pourquoi compléter votre profil
          </p>
          ${benefits.map((b) => `
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 12px 0;">
            <tr>
              <td width="32" valign="top" style="padding-top:2px;">
                <span style="font-size:18px;line-height:1;">${b.icon}</span>
              </td>
              <td valign="top">
                <p style="margin:0;color:#1E3A5F;font-size:14px;font-weight:700;line-height:1.4;">
                  ${b.title}
                </p>
                <p style="margin:2px 0 0 0;color:#4B5563;font-size:13px;line-height:1.5;">
                  ${b.desc}
                </p>
              </td>
            </tr>
          </table>`).join("")}
        </td>
      </tr>
    </table>

    ${emailDivider}

    <!-- Rassurance + lien de secours -->
    <p style="margin:0 0 12px 0;color:#1F2937;font-size:13px;line-height:1.6;">
      <strong style="color:#1E3A5F;">Vos données restent strictement confidentielles.</strong>
      Votre numéro est utilisé uniquement pour les notifications de pronostics et
      la sécurité de votre compte — jamais partagé avec des tiers.
    </p>

    <p style="margin:0;color:#9CA3AF;font-size:12px;line-height:1.6;">
      Le bouton ne fonctionne pas ? Copiez ce lien dans votre navigateur :<br/>
      <a href="${appUrl}/completer-profil" style="color:#C9A84C;text-decoration:underline;word-break:break-all;">
        ${appUrl}/completer-profil
      </a>
    </p>

    <p style="margin:24px 0 0 0;color:#9CA3AF;font-size:12px;line-height:1.6;text-align:center;">
      Une question ? Répondez directement à cet email — notre équipe répond sous 24h.
    </p>
  `;

  const preview = isAbonne
    ? `Votre abonnement ${statutAbonnement} Elite Turf attend votre numéro de téléphone — 1 minute pour activer les notifications WhatsApp.`
    : `Une dernière étape pour finaliser votre inscription Elite Turf et accéder aux notifications WhatsApp pronostics.`;

  return {
    subject,
    html: emailBase(content, preview),
  };
}
