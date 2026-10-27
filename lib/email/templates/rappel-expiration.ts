import { emailBase, emailButton, emailDivider } from "../base";
import { renderHeaderBanner, BANNER_RAPPEL_EXPIRATION } from "./banners/header-banner";
import { formatPrice } from "@/lib/geo/countries";
import { PLAN_DE_JEU_ELITE, PRO_OFFRE_LABEL, STARTER_OFFRE_LABEL } from "@/lib/pricing";
import type { Plan } from "@/types";

interface RappelExpirationData {
  nomComplet: string;
  email: string;
  /**
   * Formule de l'abonnement (PLAN_CONFIG). null si elle est inconnue : l'e-mail
   * ne cite alors ni formule ni prix. Avant le 27/10/2026, le cron ne retrouvait
   * jamais la formule (UUID de la table `plans` comparé aux ids de PLAN_CONFIG)
   * et tout abonné lisait « Plan Pro — 9,90 €/mois ».
   */
  plan: Plan | null;
  dateFin: string;
  joursRestants: number;
}

/** « Pack Elite » ; null si la formule est inconnue. */
export function nomPackRappel(plan: Plan | null): string | null {
  return plan ? `Pack ${plan.nom}` : null;
}

/** « 208 € / 30 jours (136 500 FCFA) », d'après PLAN_CONFIG ; null si la formule est inconnue. */
export function prixRappel(plan: Plan | null): string | null {
  if (!plan) return null;
  return `${formatPrice(plan.prix_eur, "EUR")} / ${plan.duree_jours} jours (${formatPrice(plan.prix_eur, "XOF")})`;
}

/** Ce que l'abonné perd à l'expiration : l'offre de SA formule (lib/pricing.ts), puis le commun. */
export function pertesRappel(plan: Plan | null): string[] {
  const offre =
    plan?.id === "elite"
      ? [`Le plan de jeu Elite chaque jour : ${PLAN_DE_JEU_ELITE}`, `Tout le Pack Pro : ${PRO_OFFRE_LABEL}`]
      : plan?.id === "pro"
        ? [`Votre pronostic expert : ${PRO_OFFRE_LABEL}`]
        : plan?.id === "starter"
          ? [`Votre pronostic expert : ${STARTER_OFFRE_LABEL}`]
          : ["Vos pronostics experts du jour"];
  return offre.concat([
    "Analyses complètes d'expert",
    "Alertes avant le départ des courses",
    "Historique de performances complet",
  ]);
}

export function templateRappelExpiration(data: RappelExpirationData): {
  subject: string;
  html: string;
} {
  const prenom = data.nomComplet.split(" ")[0] || data.nomComplet;
  const pack = nomPackRappel(data.plan);
  const prix = prixRappel(data.plan);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://elite-turf.fr";

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString("fr-FR", {
      day: "numeric", month: "long", year: "numeric",
    });

  const urgenceColor = data.joursRestants === 1 ? "#DC2626" : data.joursRestants === 2 ? "#EA580C" : "#C9A84C";
  const urgenceBg = data.joursRestants === 1 ? "#FEF2F2" : data.joursRestants === 2 ? "#FFF7ED" : "#FFFBF0";
  const urgenceBorder = data.joursRestants === 1 ? "#FECACA" : data.joursRestants === 2 ? "#FED7AA" : "rgba(201,168,76,0.35)";
  const urgenceLabel =
    data.joursRestants === 1 ? "⚠ Dernier jour !" :
    data.joursRestants === 2 ? "⏰ Plus que 2 jours" :
    "🔔 Rappel d'expiration";

  const content = `
    ${renderHeaderBanner(BANNER_RAPPEL_EXPIRATION)}

    <!-- Alerte d'urgence sous le banner -->
    <div style="background:${urgenceBg};border:1px solid ${urgenceBorder};
                border-radius:10px;padding:16px 20px;margin:28px 0 24px 0;text-align:center;">
      <p style="margin:0;font-size:16px;font-weight:700;color:${urgenceColor};">${urgenceLabel}</p>
    </div>

    <p style="margin:0 0 20px 0;color:#1F2937;font-size:14px;line-height:1.6;">
      Bonjour ${prenom}, votre abonnement${pack ? ` <strong style="color:#C9A84C;">${pack}</strong>` : ""}
      expire le <strong style="color:#1E3A5F;">${fmtDate(data.dateFin)}</strong>.
    </p>

    <!-- Compte à rebours -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0"
           style="background:#F8FAFC;border:2px solid ${urgenceColor}33;
                  border-radius:10px;margin:0 0 24px 0;">
      <tr>
        <td style="padding:24px;text-align:center;">
          <p style="margin:0 0 6px 0;font-family:Georgia,serif;font-size:52px;
                    font-weight:700;color:${urgenceColor};line-height:1;">
            ${data.joursRestants}
          </p>
          <p style="margin:0;color:#6B7280;font-size:14px;">
            ${data.joursRestants === 1 ? "jour restant" : "jours restants"}
          </p>
        </td>
      </tr>
    </table>

    <p style="margin:0 0 12px 0;color:#1E3A5F;font-size:14px;font-weight:700;">
      Sans renouvellement, vous perdrez l'accès à :
    </p>

    ${pertesRappel(data.plan).map(f => `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-bottom:1px solid #F3F4F6;">
      <tr>
        <td style="padding:8px 0;color:#1F2937;font-size:14px;line-height:1.5;">
          <span style="color:#DC2626;margin-right:8px;font-weight:700;">✕</span>${f}
        </td>
      </tr>
    </table>`).join("")}

    ${emailDivider}

    <p style="margin:0 0 8px 0;color:#1E3A5F;font-size:15px;font-weight:700;text-align:center;">
      Continuez sans interruption
    </p>
    <p style="margin:0 0 4px 0;color:#6B7280;font-size:13px;text-align:center;">
      ${pack && prix
        ? `Renouvelez votre ${pack} — <strong style="color:#C9A84C;">${prix}</strong>`
        : "Renouvelez votre abonnement en quelques clics"}
    </p>

    ${emailButton(`${appUrl}/abonnements`, "Renouveler mon abonnement")}

    ${emailDivider}

    <p style="margin:0;color:#9CA3AF;font-size:12px;text-align:center;line-height:1.7;">
      Si vous ne souhaitez pas renouveler, vous conserverez l'accès gratuit après expiration.<br/>
      Questions ? <a href="mailto:contact@elite-turf.fr" style="color:#C9A84C;">contact@elite-turf.fr</a>
    </p>
  `;

  const subjects: Record<number, string> = {
    3: `🔔 Votre abonnement Elite Turf expire dans 3 jours`,
    2: `⏰ Plus que 2 jours — Renouvelez votre ${pack ?? "accès Elite Turf"}`,
    1: `⚠ Dernier jour ! Votre accès Elite Turf expire ce soir`,
  };

  return {
    subject: subjects[data.joursRestants] ?? `🔔 Votre abonnement Elite Turf expire bientôt`,
    html: emailBase(
      content,
      `Votre abonnement${pack ? ` ${pack}` : ""} expire dans ${data.joursRestants} jour${data.joursRestants > 1 ? "s" : ""}. Renouvelez maintenant.`
    ),
  };
}
