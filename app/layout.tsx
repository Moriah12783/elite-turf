import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import OneSignalInit from "@/components/OneSignalInit";
import WhatsAppFloatingButton from "@/components/layout/WhatsAppFloatingButton";
import Script from "next/script";

// Domaine canonique. Site hébergé sur Cloudflare Workers (pas Vercel).
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://www.elite-turf.fr");

// Next.js 14 : themeColor/appleWebApp/formatDetection dans viewport, pas metadata
export const viewport: Viewport = {
  themeColor: "#C9A84C",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  manifest: "/manifest.json",
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

// JSON-LD NewsMediaOrganization — schema.org enrichi pour Google News Publisher Center.
// Type "NewsMediaOrganization" (vs "Organization" classique) signale à Google que ce
// site est un éditeur de news → conditions requises pour figurer dans Google News.
// Référence : https://schema.org/NewsMediaOrganization
const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "NewsMediaOrganization",
  name: "Elite Turf",
  url: APP_URL,
  // Logo carré 1000x1000 (PNG rasterisé depuis le SVG V2 — fer à cheval or sur bleu nuit).
  // Format préconisé Google News : carré, lisible à 50px (Knowledge Graph + cartes article).
  logo: {
    "@type": "ImageObject",
    url:    `${APP_URL}/images/logo-v2/logo-square-1000.png`,
    width:  1000,
    height: 1000,
  },
  // Image de couverture additionnelle (variante horizontale pour Knowledge Graph)
  image: `${APP_URL}/images/logo-v2/logo-horizontal-1000.png`,
  description:
    "Pronostics PMU premium pour les parieurs francophones d'Afrique et d'Europe. Tiercé, Quarté+, Quinté+ analysés par des experts depuis Paris.",
  // Liens vers pages de transparence éditoriale — exigés par Google News Publisher Center
  publishingPrinciples:     `${APP_URL}/equipe-redactionnelle`,
  actionableFeedbackPolicy: `${APP_URL}/contact`,
  ethicsPolicy:             `${APP_URL}/equipe-redactionnelle`,
  // Fondateur — schema NewsMediaOrganization requiert founder ou employee identifiable
  founder: {
    "@type": "Person",
    name:    "Yapi Landry Stéphane",
    jobTitle: "Fondateur & Directeur de la publication",
  },
  address: {
    "@type": "PostalAddress",
    streetAddress:  "34 boulevard des Italiens",
    addressLocality: "Paris",
    postalCode:     "75009",
    addressCountry: "FR",
  },
  contactPoint: {
    "@type": "ContactPoint",
    telephone:        "+33-6-44-68-67-20",
    email:            "contact@elite-turf.fr",
    contactType:      "customer service",
    availableLanguage: "French",
    areaServed:       ["FR", "CI", "SN", "CM", "MA", "BF", "TG", "BJ", "ML"],
  },
  // Pas de sameAs Facebook/YouTube pour l'instant (comptes pas encore actifs).
  // À réactiver quand les comptes seront créés et alimentés.
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <head>
        {/* Preload LCP image — discovered immediately, before JS/CSS */}
        <link rel="preload" as="image" href="/images/heroes/hero-courses.jpg" fetchPriority="high" />
        {/* Google Tag Manager */}
        <Script
          id="gtm-script"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-PNDV7TKM');`,
          }}
        />
      </head>
      <body className="bg-bg-primary text-text-primary font-sans antialiased">
        {/* Google Tag Manager (noscript) */}
        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=GTM-PNDV7TKM"
            height="0"
            width="0"
            style={{ display: "none", visibility: "hidden" }}
          />
        </noscript>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <OneSignalInit />
        {children}
        <WhatsAppFloatingButton />
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
        {/* Microsoft Clarity — analyse comportementale */}
        <Script
          id="clarity-script"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(c,l,a,r,i,t,y){
        c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
        t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
        y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
    })(window, document, "clarity", "script", "wbinwswb7t");`,
          }}
        />
      </body>
    </html>
  );
}
