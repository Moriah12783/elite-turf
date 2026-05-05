import type { Metadata } from "next";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://www.elite-turf.fr");

export const metadata: Metadata = {
  title: "Guide Initié PMU — 5 Secrets des Parieurs Professionnels | Elite Turf",
  description: "Téléchargez gratuitement le Guide Initié Elite Turf : 5 secrets des parieurs professionnels pour analyser les courses PMU comme un expert. Tiercé, Quarté+, Quinté+.",
  alternates: { canonical: `${APP_URL}/guide-initie` },
  robots: { index: true, follow: true },
};

export default function GuideInitieLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
