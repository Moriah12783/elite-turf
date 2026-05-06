"use client";
import Script from "next/script";

const APP_ID = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;

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
                  autoPrompt: true,
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
