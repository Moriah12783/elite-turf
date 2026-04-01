import { emailBase, emailButton, emailDivider } from "../base";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://elite-turf.fr";

interface ConfirmationPackData {
  nomComplet: string;
  email: string;
  planNom: "Starter" | "Pro" | "Elite";
  dateExpiration: string; // YYYY-MM-DD
  nbAlertes: number;      // 5 | 20 | -1
}

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric", month: "long", year: "numeric",
  });
}

function avantagesRows(items: { icon: string; titre: string; desc: string }[]): string {
  return items.map((item, i) => `
    <tr>
      <td style="padding:14px 16px;${i < items.length - 1 ? "border-bottom:1px solid #E5E7EB;" : ""}">
        <table cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td width="44" style="vertical-align:top;padding-top:2px;">
              <div style="width:34px;height:34px;background:linear-gradient(135deg,#D4AF5A,#C9A84C);
                          border-radius:50%;text-align:center;line-height:34px;font-size:16px;">
                ${item.icon}
              </div>
            </td>
            <td style="vertical-align:top;padding-left:10px;">
              <p style="margin:0 0 3px 0;color:#1E3A5F;font-size:14px;font-weight:700;line-height:1.3;">
                ${item.titre}
              </p>
              <p style="margin:0;color:#6B7280;font-size:13px;line-height:1.5;">${item.desc}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>`).join("");
}

// ── PACK DÉCOUVERTE (Starter) ──────────────────────────────────────────────

function templateDecuverte(prenom: string, dateExp: string, nbAlertes: number): string {
  const avantages = [
    {
      icon: "📲",
      titre: `${nbAlertes} Alertes SMS/Push prioritaires ce mois`,
      desc: "Recevez nos meilleures pépites directement sur votre mobile.",
    },
    {
      icon: "📖",
      titre: "Analyses fondamentales",
      desc: "Accès aux décryptages de la \"Musique\" pour ne plus parier à l'aveugle.",
    },
    {
      icon: "⭐",
      titre: "Indice de Confiance",
      desc: "Chaque pronostic est noté pour sécuriser vos premiers pas.",
    },
  ];

  const content = `
    <!-- Badge statut -->
    <div style="text-align:center;margin-bottom:20px;">
      <span style="display:inline-block;padding:5px 18px;background:#F0FDF4;
                   border:1px solid #86EFAC;border-radius:20px;
                   color:#16A34A;font-size:12px;font-weight:700;letter-spacing:0.5px;">
        ✓ ACCÈS DÉCOUVERTE ACTIVÉ
      </span>
    </div>

    <h1 style="margin:0 0 6px 0;font-family:Georgia,serif;font-size:26px;
               font-weight:700;color:#1E3A5F;line-height:1.3;text-align:center;">
      Bienvenue, ${prenom} ! 🏇
    </h1>
    <p style="margin:0 0 6px 0;color:#C9A84C;font-size:13px;font-weight:600;
              text-align:center;letter-spacing:0.5px;">
      PACK DÉCOUVERTE — Votre aventure commence aujourd'hui
    </p>
    <p style="margin:0 0 24px 0;color:#6B7280;font-size:13px;text-align:center;">
      Accès actif jusqu'au ${fmtDate(dateExp)}
    </p>

    <p style="margin:0 0 20px 0;color:#1F2937;font-size:15px;line-height:1.7;">
      Nous confirmons la validation de votre <strong style="color:#1E3A5F;">Pack Découverte</strong>.
      Votre statut est désormais actif — voici vos privilèges pour débuter :
    </p>

    <!-- Avantages -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0"
           style="border:1px solid #E5E7EB;border-radius:10px;margin-bottom:28px;background:#FFFFFF;">
      <tr>
        <td style="background:#F8FAFC;border-bottom:1px solid #E5E7EB;padding:14px 16px;border-radius:10px 10px 0 0;">
          <span style="color:#1E3A5F;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">
            Vos privilèges Découverte
          </span>
        </td>
      </tr>
      ${avantagesRows(avantages)}
    </table>

    ${emailButton(`${APP_URL}/pronostics`, "🏇 Recevoir ma première alerte")}

    ${emailDivider}

    <p style="margin:0 0 8px 0;color:#1E3A5F;font-size:13px;font-weight:600;text-align:center;">
      Envie de passer à la vitesse supérieure ?
    </p>
    <p style="margin:0 0 16px 0;color:#6B7280;font-size:12px;text-align:center;line-height:1.6;">
      Le Pack Performance vous donne 2× plus d'alertes et des analyses expertes approfondies.
    </p>
    <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
      <tr>
        <td style="border:1px solid #E5E7EB;border-radius:8px;">
          <a href="${APP_URL}/abonnements"
             style="display:inline-block;padding:10px 24px;font-family:'Helvetica Neue',Arial,sans-serif;
                    font-size:13px;font-weight:600;color:#6B7280;text-decoration:none;border-radius:8px;">
            Voir les offres supérieures →
          </a>
        </td>
      </tr>
    </table>

    ${emailDivider}

    <p style="margin:0;color:#9CA3AF;font-size:12px;text-align:center;line-height:1.6;">
      L'aventure commence. Apprenez les codes de l'Élite.<br/>
      Questions ? <a href="mailto:contact@elite-turf.fr" style="color:#C9A84C;">contact@elite-turf.fr</a>
    </p>
  `;

  return emailBase(content, `Votre Pack Découverte Elite Turf est activé. ${nbAlertes} alertes SMS/Push disponibles.`);
}

// ── PACK PERFORMANCE (Pro) ─────────────────────────────────────────────────

function templatePerformance(prenom: string, dateExp: string, nbAlertes: number): string {
  const avantages = [
    {
      icon: "📲",
      titre: `${nbAlertes} Alertes SMS/Push par mois`,
      desc: "Doublez vos opportunités de gain avec une présence accrue sur les plus belles courses.",
    },
    {
      icon: "🤝",
      titre: "Le Coefficient Jockey / Entraîneur",
      desc: "Accédez au secret n°2 pour repérer les \"courses visées\" avant tout le monde.",
    },
    {
      icon: "💼",
      titre: "Gestion de Bankroll Assistée",
      desc: "Appliquez la règle des 5% avec nos outils dédiés pour protéger et faire croître votre capital.",
    },
  ];

  const content = `
    <!-- Badge statut -->
    <div style="text-align:center;margin-bottom:20px;">
      <span style="display:inline-block;padding:5px 18px;background:#FFFBF0;
                   border:1px solid rgba(201,168,76,0.5);border-radius:20px;
                   color:#C9A84C;font-size:12px;font-weight:700;letter-spacing:0.5px;">
        ⭐ STATUT VIP PERFORMANCE ACTIVÉ
      </span>
    </div>

    <h1 style="margin:0 0 6px 0;font-family:Georgia,serif;font-size:26px;
               font-weight:700;color:#1E3A5F;line-height:1.3;text-align:center;">
      Félicitations, ${prenom} ! ⭐
    </h1>
    <p style="margin:0 0 6px 0;color:#C9A84C;font-size:13px;font-weight:600;
              text-align:center;letter-spacing:0.5px;">
      PACK PERFORMANCE — Vous faites partie de notre cercle VIP
    </p>
    <p style="margin:0 0 24px 0;color:#6B7280;font-size:13px;text-align:center;">
      Accès VIP actif jusqu'au ${fmtDate(dateExp)}
    </p>

    <p style="margin:0 0 20px 0;color:#1F2937;font-size:15px;line-height:1.7;">
      Votre paiement pour le <strong style="color:#1E3A5F;">Pack Performance</strong> a été validé.
      Passez à la vitesse supérieure avec vos nouveaux avantages exclusifs :
    </p>

    <!-- Avantages -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0"
           style="border:1px solid #E5E7EB;border-radius:10px;margin-bottom:28px;background:#FFFFFF;">
      <tr>
        <td style="background:#FFFBF0;border-bottom:1px solid #E5E7EB;padding:14px 16px;border-radius:10px 10px 0 0;">
          <span style="color:#1E3A5F;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">
            Vos avantages VIP Performance
          </span>
        </td>
      </tr>
      ${avantagesRows(avantages)}
    </table>

    ${emailButton(`${APP_URL}/espace-membre`, "⭐ Accéder à mon Dashboard VIP")}

    ${emailDivider}

    <p style="margin:0 0 8px 0;color:#1E3A5F;font-size:13px;font-weight:600;text-align:center;">
      Vous voulez aller encore plus loin ?
    </p>
    <p style="margin:0 0 16px 0;color:#6B7280;font-size:12px;text-align:center;line-height:1.6;">
      Le Pack Elite vous donne accès à l'algorithme IA complet et aux alertes Dernière Minute.
    </p>
    <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
      <tr>
        <td style="border:1px solid #E5E7EB;border-radius:8px;">
          <a href="${APP_URL}/abonnements"
             style="display:inline-block;padding:10px 24px;font-family:'Helvetica Neue',Arial,sans-serif;
                    font-size:13px;font-weight:600;color:#6B7280;text-decoration:none;border-radius:8px;">
            Découvrir le Pack Elite →
          </a>
        </td>
      </tr>
    </table>

    ${emailDivider}

    <p style="margin:0;color:#9CA3AF;font-size:12px;text-align:center;line-height:1.6;">
      Plus d'alertes, plus de précision, plus de performance.<br/>
      Questions ? <a href="mailto:contact@elite-turf.fr" style="color:#C9A84C;">contact@elite-turf.fr</a>
    </p>
  `;

  return emailBase(content, `Votre Pack Performance VIP Elite Turf est activé. ${nbAlertes} alertes SMS/Push disponibles.`);
}

// ── PACK ELITE ─────────────────────────────────────────────────────────────

function templateElite(prenom: string, dateExp: string): string {
  const avantages = [
    {
      icon: "📲",
      titre: "Alertes SMS/Push Illimitées",
      desc: "Un flux constant d'opportunités pour ne rater aucun coup fumant, toute l'année.",
    },
    {
      icon: "⚡",
      titre: "Alertes \"Dernière Minute\"",
      desc: "Soyez informé des mouvements de cotes stratégiques 15 min avant le départ.",
    },
    {
      icon: "🤖",
      titre: "Accès Total Algorithme IA",
      desc: "L'alliance de l'expertise hippique et de la précision digitale, sans aucune limite.",
    },
  ];

  const content = `
    <!-- Badge statut -->
    <div style="text-align:center;margin-bottom:20px;">
      <span style="display:inline-block;padding:5px 18px;background:#F5F3FF;
                   border:1px solid #C4B5FD;border-radius:20px;
                   color:#7C3AED;font-size:12px;font-weight:700;letter-spacing:0.5px;">
        🏆 PACK ELITE — ACCÈS PREMIUM TOTAL ACTIVÉ
      </span>
    </div>

    <h1 style="margin:0 0 6px 0;font-family:Georgia,serif;font-size:26px;
               font-weight:700;color:#1E3A5F;line-height:1.3;text-align:center;">
      Bienvenue au sommet, ${prenom} ! 🏆
    </h1>
    <p style="margin:0 0 6px 0;color:#C9A84C;font-size:13px;font-weight:600;
              text-align:center;letter-spacing:0.5px;">
      PACK ELITE — Excellence Totale · L'accès absolu
    </p>
    <p style="margin:0 0 24px 0;color:#6B7280;font-size:13px;text-align:center;">
      Accès Elite actif jusqu'au ${fmtDate(dateExp)}
    </p>

    <p style="margin:0 0 20px 0;color:#1F2937;font-size:15px;line-height:1.7;">
      Bienvenue dans <strong style="color:#1E3A5F;">l'élite absolue du turf international</strong>.
      Votre Pack Elite est validé — voici votre arsenal complet :
    </p>

    <!-- Avantages -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0"
           style="border:2px solid #C9A84C;border-radius:10px;margin-bottom:28px;background:#FFFFFF;">
      <tr>
        <td style="background:linear-gradient(135deg,#FFFBF0,#FFF8E7);border-bottom:1px solid #E5E7EB;
                   padding:14px 16px;border-radius:8px 8px 0 0;">
          <span style="color:#1E3A5F;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">
            ✦ L'arsenal complet de l'investisseur Elite
          </span>
        </td>
      </tr>
      ${avantagesRows(avantages)}
    </table>

    ${emailButton(`${APP_URL}/pronostics`, "🏆 Dominer la piste maintenant")}

    ${emailDivider}

    <!-- Message exclusif -->
    <div style="background:#FFFBF0;border:1px solid rgba(201,168,76,0.35);border-radius:10px;padding:16px 20px;text-align:center;">
      <p style="margin:0 0 6px 0;color:#C9A84C;font-size:13px;font-weight:700;">✦ Message de l'équipe Elite Turf</p>
      <p style="margin:0;color:#374151;font-size:13px;line-height:1.7;font-style:italic;">
        "Le sommet vous appartient. En choisissant le Pack Elite, vous rejoignez les rares
        qui comprennent que le turf est un art qui se maîtrise. Vous êtes désormais l'Élite."
      </p>
    </div>

    ${emailDivider}

    <p style="margin:0;color:#9CA3AF;font-size:12px;text-align:center;line-height:1.6;">
      Support prioritaire WhatsApp — Réponse sous 30 min ·
      <a href="https://wa.me/+33644686720" style="color:#C9A84C;">Nous écrire</a><br/>
      <a href="mailto:contact@elite-turf.fr" style="color:#9CA3AF;text-decoration:none;">contact@elite-turf.fr</a>
    </p>
  `;

  return emailBase(content, `Votre Pack Elite est activé. Alertes illimitées et accès total à l'algorithme IA.`);
}

// ── Export principal ────────────────────────────────────────────────────────

export function templateConfirmationPack(data: ConfirmationPackData): { subject: string; html: string } {
  const prenom = data.nomComplet.split(" ")[0] || data.nomComplet;

  switch (data.planNom) {
    case "Starter":
      return {
        subject: "🏇 Bienvenue chez Elite Turf — Votre accès Découverte est activé !",
        html: templateDecuverte(prenom, data.dateExpiration, data.nbAlertes),
      };
    case "Pro":
      return {
        subject: "⭐ Félicitations — Votre Statut VIP Performance est activé !",
        html: templatePerformance(prenom, data.dateExpiration, data.nbAlertes),
      };
    case "Elite":
      return {
        subject: "🏆 Excellence Totale — Bienvenue au sommet avec le PACK ELITE",
        html: templateElite(prenom, data.dateExpiration),
      };
    default:
      return {
        subject: "✓ Paiement validé — Votre accès Elite Turf est actif",
        html: templatePerformance(prenom, data.dateExpiration, data.nbAlertes),
      };
  }
}
