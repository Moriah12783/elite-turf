/**
 * Bloc « mode d'emploi » — inséré dans les e-mails d'ACTIVATION d'abonnement.
 *
 * Deux messages, demandés par Steph (25/08/2026) :
 *   1. la notice d'exploitation des pronostics vit dans l'espace abonné —
 *      inviter explicitement à la lire ;
 *   2. Elite Turf RECOMMANDE le jeu en champ réduit ou complet, mais la
 *      décision appartient à l'abonné — le dire sans ambiguïté.
 *
 * ⚠️ Le second point n'est pas cosmétique : recommander une façon de miser
 * engage. La formulation dit « nous recommandons » et « à votre appréciation »,
 * jamais « il faut ». Ne pas durcir ce ton sans y repenser — un conseil de mise
 * présenté comme une consigne expose (DGCCRF, jeu d'argent) et contredit la
 * ligne de transparence du projet.
 *
 * Rendu en HTML d'e-mail : tables + styles inline uniquement (Gmail, Outlook et
 * les webmails africains ignorent <style> et flexbox). Pas de var CSS.
 */

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://elite-turf.fr";

/**
 * Encadré doré, volontairement bien visible — c'est le bloc que Steph veut que
 * l'abonné ne rate pas en ouvrant son e-mail d'activation.
 */
export const blocModeEmploi = `
  <table width="100%" cellpadding="0" cellspacing="0" border="0"
         style="border:2px solid #C9A84C;border-radius:10px;background:#FFFBF0;margin:0 0 28px 0;">
    <tr>
      <td style="padding:18px 20px;">

        <p style="margin:0 0 10px 0;color:#8A6D1F;font-size:13px;font-weight:700;
                  text-transform:uppercase;letter-spacing:0.5px;">
          📘 Avant votre premier pronostic
        </p>

        <p style="margin:0 0 14px 0;color:#1F2937;font-size:14px;line-height:1.7;">
          Un <strong>mode d'emploi complet</strong> vous attend dans votre espace
          abonné, section <strong>« Exploiter vos pronostics »</strong>. Il explique
          comment lire notre sélection — la base, la value, le coup — et comment
          repérer le <strong>cheval pivot</strong> autour duquel construire vos tickets.
          <strong>Prenez deux minutes pour le lire avant de jouer :</strong> la même
          sélection ne se joue pas de la même façon selon la méthode retenue.
        </p>

        <table cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px 0;">
          <tr>
            <td style="background:#C9A84C;border-radius:8px;">
              <a href="${APP_URL}/espace-membre"
                 style="display:inline-block;padding:11px 22px;font-family:'Helvetica Neue',Arial,sans-serif;
                        font-size:13px;font-weight:700;color:#FFFFFF;text-decoration:none;border-radius:8px;">
                📘 Lire le mode d'emploi →
              </a>
            </td>
          </tr>
        </table>

        <table width="100%" cellpadding="0" cellspacing="0" border="0"
               style="border-top:1px solid #E8D9A8;">
          <tr>
            <td style="padding:14px 0 0 0;">
              <p style="margin:0 0 6px 0;color:#8A6D1F;font-size:13px;font-weight:700;">
                🎯 Notre recommandation de jeu
              </p>
              <p style="margin:0;color:#1F2937;font-size:14px;line-height:1.7;">
                Pour tirer le meilleur de nos sélections, <strong>Elite Turf recommande
                le jeu en champ réduit ou en champ complet</strong>. Cette méthode couvre
                la course de façon cohérente avec la façon dont nos pronostics sont
                construits.
                <br/><br/>
                <span style="color:#6B7280;font-size:13px;">
                  Cela dit, <strong style="color:#1F2937;">le choix vous appartient
                  entièrement</strong> : jouez selon votre lecture de la course, votre
                  expérience et votre budget. Nous vous donnons la sélection et la
                  méthode ; la décision finale reste la vôtre.
                </span>
              </p>
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
`;
