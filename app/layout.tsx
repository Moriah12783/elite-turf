import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import OneSignalInit from "@/components/OneSignalInit";

// VERCEL_URL est automatiquement injecté par Vercel (ex: elite-turf-xyz.vercel.app)
// Priorité : variable explicite > URL Vercel auto > fallback prod
const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://elite-turf.fr");

export const metadata: Metadata = {
  manifest: "/manifest.json",
  themeColor: "#C9A84C",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Elite Turf",
  },
  formatDetection: { telephone: false },
  title: {
    default: "Elite Turf — Pronostics PMU pour les parieurs francophones",
    template: "%s | Elite Turf",
  },
  description:
    "Elite Turf — Pronostics PMU premium pour les parieurs francophones. Tiercé, Quarté+, Quinté+ analysés par nos experts depuis Paris. Abonnement dès 65€. Orange Money, MTN, Wave acceptés.",
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
  // Pas de canonical global — chaque page gère le sien pour éviter le duplicate content
  openGraph: {
    title: "Elite Turf — Pronostics PMU pour les parieurs francophones",
    description:
      "Pronostics PMU premium depuis Paris. Tiercé, Quarté+, Quinté+ analysés par nos experts. Dès 65€ — Orange Money, MTN, Wave acceptés.",
    url: APP_URL,
    siteName: "Elite Turf",
    locale: "fr_FR",
    type: "website",
    images: [
      {
        url: `${APP_URL}/og-image.jpg`,
        width: 1200,
        height: 630,
        alt: "Elite Turf — Pronostics PMU pour les parieurs francophones",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Elite Turf — Pronostics PMU parieurs francophones",
    description: "Pronostics PMU experts depuis Paris. Tiercé, Quarté+, Quinté+ dès 65€.",
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

// JSON-LD Organisation — injecté une seule fois sur tout le site
const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Elite Turf",
  url: APP_URL,
  logo: `${APP_URL}/og-image.jpg`,
  description:
    "Pronostics PMU premium pour les parieurs francophones d'Afrique et d'Europe. Tiercé, Quarté+, Quinté+ analysés par des experts depuis Paris.",
  address: {
    "@type": "PostalAddress",
    streetAddress: "34 boulevard des Italiens",
    addressLocality: "Paris",
    postalCode: "75009",
    addressCountry: "FR",
  },
  contactPoint: {
    "@type": "ContactPoint",
    telephone: "+33-6-44-68-67-20",
    contactType: "customer service",
    availableLanguage: "French",
  },
  sameAs: [
    "https://www.facebook.com/eliteturf",
    "https://www.youtube.com/@eliteturf",
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body className="bg-bg-primary text-text-primary font-sans antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <OneSignalInit />
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
