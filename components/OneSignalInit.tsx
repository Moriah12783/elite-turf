"use client";
import Script from "next/script";

const APP_ID = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;

/**
 * ⚠️ OneSignal est réglé en mode « Typical Site » : le SDK applique la
 * configuration du TABLEAU DE BORD OneSignal, pas les options passées à
 * `OneSignal.init` ci-dessous (demande d'abonnement, textes, délai, message
 * de bienvenue). Constaté le 07/10/2026 : en prod, la demande affichée est le
 * texte anglais par défaut du tableau de bord (« Subscribe to our
 * notifications… », 10 s), pas les textes français d'ici.
 *
 * Décision de Steph du 07/10/2026 : plus de demande d'abonnement automatique,
 * puisque plus aucun push ne part automatiquement (daily-push retiré, PR #380).
 * Le réglage qui compte se fait dans OneSignal (Permission Prompt Setup →
 * Auto-prompt désactivé). `autoPrompt: false` garde le code aligné si
 * l'intégration passe un jour en « Custom Code ». Revoir les textes avant
 * toute réactivation : ils promettent « les pronostics du jour ».
 */
export default function OneSignalInit() {
  if (!APP_ID) return null;

  return (
    <>
      <Script
        src="https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js"
        defer
        strategy="afterInteractive"
      />
      <Script id="onesignal-init" strategy="afterInteractive">{`
        window.OneSignalDeferred = window.OneSignalDeferred || [];
        OneSignalDeferred.push(async function(OneSignal) {
          await OneSignal.init({
            appId: "${APP_ID}",
            // Force la langue française pour TOUS les textes par défaut du SDK
            // (avant que les overrides text: ci-dessous ne s'appliquent au slidedown).
            // Évite l'affichage de "We'd like to show you notifications…" en anglais
            // si le visiteur a un navigateur en EN mais arrive sur notre site FR.
            language: "fr",
            notifyButton: { enable: false },
            welcomeNotification: {
              title: "Elite Turf",
              message: "Merci ! Vous recevrez les pronostics du jour 🏇",
            },
            promptOptions: {
              slidedown: {
                prompts: [{
                  type: "push",
                  autoPrompt: false,
                  text: {
                    actionMessage: "🏇 Recevez les pronostics Elite Turf directement sur votre appareil !",
                    acceptButton: "Oui, m'abonner",
                    cancelButton: "Plus tard",
                    // Messages d'état (succès, erreur, déjà abonné) en FR pour
                    // les rares cas où OneSignal ne pioche pas dans language: "fr".
                    negativeUpdateButton:  "Annuler",
                    positiveUpdateButton:  "Mettre à jour",
                    updateMessage:         "Souhaitez-vous mettre à jour vos préférences de notifications ?"
                  },
                  delay: { timeDelay: 5, pageViews: 1 }
                }]
              }
            }
          });
        });
      `}</Script>
    </>
  );
}
