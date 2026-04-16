import type { Metadata } from "next";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.elite-turf.fr";

export const metadata: Metadata = {
  // guide-gratuit redirige vers guide-initie — on noindex pour éviter le doublon Google
  alternates: { canonical: `${APP_URL}/guide-initie` },
  robots: { index: false, follow: false },
};

export default function GuideGratuitLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
