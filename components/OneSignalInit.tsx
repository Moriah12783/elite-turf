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
                    cancelButton: "Plus tard"
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
