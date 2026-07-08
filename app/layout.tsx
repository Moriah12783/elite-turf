import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import OneSignalInit from "@/components/OneSignalInit";
import WhatsAppFloatingButton from "@/components/layout/WhatsAppFloatingButton";
import { WHATSAPP_SUPPORT_NUMBER } from "@/lib/constants/whatsapp";
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
    default: "Elite Turf — Analyses hippiques informatives",
    template: "%s | Elite Turf",
  },
  description:
    "Elite Turf propose des analyses hippiques, données de courses et contenus méthodologiques. Marque exploitée par TSALACH VENTURES LLC. Aucun gain garanti.",
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
    title: "Elite Turf — Analyses hippiques informatives",
    description:
      "Analyses hippiques, données de courses et contenus méthodologiques. Elite Turf est une marque exploitée par TSALACH VENTURES LLC.",
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
    title: "Elite Turf — Analyses hippiques informatives",
    description: "Analyses hippiques et contenus méthodologiques. Marque exploitée par TSALACH VENTURES LLC.",
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

// @id stables : socle du graphe d'entités relié (identité de marque pour les
// moteurs génératifs/IA + Google). L'Organization et le WebSite sont présents
// sur CHAQUE page (root layout) → les articles/pages peuvent y référer par @id.
const ORG_ID     = `${APP_URL}/#organization`;
const WEBSITE_ID = `${APP_URL}/#website`;

// JSON-LD — graphe Organisation (NewsMediaOrganization) + WebSite, reliés par @id.
const organizationJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
  // Double type : Organization (entité légale) + NewsMediaOrganization (éditeur
  // du contenu éditorial) → cohérent avec le `publisher` des articles.
  "@type": ["Organization", "NewsMediaOrganization"],
  "@id": ORG_ID,
  name: "Elite Turf",
  legalName: "TSALACH VENTURES LLC",
  alternateName: "Elite Turf",
  url: APP_URL,
  email: "contact@elite-turf.fr",
  logo: {
    "@type": "ImageObject",
    url:    `${APP_URL}/images/logo-v2/logo-square-1000.png`,
    width:  1000,
    height: 1000,
  },
  image: `${APP_URL}/images/logo-v2/logo-horizontal-1000.png`,
  description:
    "Elite Turf est une marque commerciale exploitée par TSALACH VENTURES LLC, dédiée aux analyses hippiques informatives.",
  // sameAs — profils officiels de la marque (signal fort d'identification pour
  // les IA et le Knowledge Graph). À compléter au fil de la création des comptes.
  sameAs: [
    "https://www.facebook.com/profile.php?id=61589172490141",
  ],
  publishingPrinciples:     `${APP_URL}/equipe-redactionnelle`,
  actionableFeedbackPolicy: `${APP_URL}/contact`,
  ethicsPolicy:             `${APP_URL}/equipe-redactionnelle`,
  // Fondateur — schema NewsMediaOrganization requiert founder ou employee identifiable
  founder: {
    "@type": "Person",
    name:    "Landry Stéphane Y.",
    jobTitle: "Directeur de la publication",
  },
  address: {
    "@type": "PostalAddress",
    streetAddress:   "30 N Gould St, STE R",
    addressLocality: "Sheridan",
    addressRegion:   "WY",
    postalCode:      "82801",
    addressCountry:  "US",
  },
  // ── ContactPoint ARRAY (vérification Meta WhatsApp Business API) ─────────
  // Meta exige que le téléphone administratif de l'entité légale (TSALACH
  // VENTURES LLC, États-Unis) figure dans le HTML du site pour valider que
  // le site est bien associé à l'entreprise. On expose 2 contactPoints :
  //   1. customer support → WhatsApp public FR (déjà utilisé par les visiteurs)
  //   2. administrative   → ligne TSALACH VENTURES LLC US (vérification Meta)
  contactPoint: [
    {
      "@type":           "ContactPoint",
      telephone:         WHATSAPP_SUPPORT_NUMBER,
      email:             "contact@elite-turf.fr",
      contactType:       "customer support",
      availableLanguage: ["French"],
      areaServed:        ["FR", "CI", "SN", "CM", "MA", "BF", "TG", "BJ", "ML"],
    },
    {
      "@type":           "ContactPoint",
      telephone:         "+13073819522",
      contactType:       "administrative",
      availableLanguage: ["English", "French"],
      areaServed:        "US",
    },
  ],
  // Numéros téléphoniques de l'entreprise (Schema.org standard, redondance
  // utile pour la vérification automatique Meta + Google KP)
  telephone: "+13073819522",
    },
    {
      "@type": "WebSite",
      "@id": WEBSITE_ID,
      url: APP_URL,
      name: "Elite Turf",
      alternateName: "Elite Turf — Pronostics PMU",
      description:
        "Analyses et pronostics hippiques PMU (Quinté+, Quarté+, Tiercé) pour les parieurs francophones — France et Afrique francophone.",
      inLanguage: "fr-FR",
      publisher: { "@id": ORG_ID },
    },
  ],
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
