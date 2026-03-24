import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "react-hot-toast";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://eliteturf.fr";

export const metadata: Metadata = {
  title: {
    default: "Elite Turf — Pronostics PMU pour l'Afrique francophone",
    template: "%s | Elite Turf",
  },
  description:
    "Elite Turf — Pronostics PMU premium pour les parieurs d'Afrique francophone. Tiercé, Quarté+, Quinté+ analysés par nos experts depuis Paris. Abonnement dès 9,90€/mois. Orange Money, MTN, Wave acceptés.",
  keywords: [
    "pronostic PMU",
    "pronostic Quinté+",
    "pronostic Quinté+ gratuit",
    "pronostic trot Vincennes",
    "pronostic PMU Côte d'Ivoire",
    "pronostic PMU Maroc",
    "pronostic PMU Sénégal",
    "pronostic courses françaises Afrique",
    "tiercé quarté quinté pronostic",
    "PMU pronostic gagnant",
    "meilleur pronostic PMU francophone",
    "analyse Quinté+ du jour",
  ],
  authors: [{ name: "Elite Turf", url: APP_URL }],
  creator: "Elite Turf",
  publisher: "Elite Turf",
  metadataBase: new URL(APP_URL),
  alternates: {
    canonical: APP_URL,
  },
  openGraph: {
    title: "Elite Turf — Pronostics PMU pour l'Afrique francophone",
    description:
      "Pronostics PMU premium depuis Paris. Tiercé, Quarté+, Quinté+ analysés par nos experts. Dès 9,90€/mois — Orange Money, MTN, Wave acceptés.",
    url: APP_URL,
    siteName: "Elite Turf",
    locale: "fr_FR",
    type: "website",
    images: [
      {
        url: `${APP_URL}/og-image.jpg`,
        width: 1200,
        height: 630,
        alt: "Elite Turf — Pronostics PMU pour l'Afrique francophone",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Elite Turf — Pronostics PMU Afrique francophone",
    description: "Pronostics PMU experts depuis Paris. Tiercé, Quarté+, Quinté+ dès 9,90€/mois.",
    images: [`${APP_URL}/og-image.jpg`],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body className="bg-bg-primary text-text-primary font-sans antialiased">
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: "#161622",
              color: "#F5F5F0",
              border: "1px solid #2A2A3E",
            },
            success: {
              iconTheme: { primary: "#C9A84C", secondary: "#0D0D14" },
            },
            error: {
              iconTheme: { primary: "#EF4444", secondary: "#0D0D14" },
            },
          }}
        />
      </body>
    </html>
  );
}
