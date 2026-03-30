"use client";

import { usePathname } from "next/navigation";

/**
 * Fond subtil par page — image fantôme à très faible opacité
 * Chaque route affiche l'image correspondante à son héro
 * Aucun impact sur la lisibilité des contenus
 */

const PAGE_BACKGROUNDS: { path: string; image: string }[] = [
  { path: "/pronostics",     image: "/images/heroes/hero-pronostics.jpg" },
  { path: "/courses",        image: "/images/heroes/hero-courses.jpg" },
  { path: "/performances",   image: "/images/heroes/hero-performances.jpg" },
  { path: "/abonnements",    image: "/images/heroes/hero-abonnements.jpg" },
  { path: "/a-propos",       image: "/images/heroes/hero-a-propos.jpg" },
  { path: "/blog",           image: "/images/heroes/hero-blog.jpg" },
  { path: "/guide-initie",   image: "/images/heroes/hero-guide.jpg" },
  { path: "/contact",        image: "/images/heroes/hero-contact.jpg" },
  { path: "/mentions-legales", image: "/images/heroes/hero-legal.jpg" },
  { path: "/confidentialite",  image: "/images/heroes/hero-legal.jpg" },
  { path: "/cgu",              image: "/images/heroes/hero-legal.jpg" },
];

const DEFAULT_BG = "/images/heroes/hero-courses.jpg";

export default function DynamicPageBackground() {
  const pathname = usePathname();

  const matched = PAGE_BACKGROUNDS.find(({ path }) =>
    pathname === path || pathname.startsWith(path + "/")
  );

  const bgImage = matched?.image ?? DEFAULT_BG;

  return (
    <>
      {/* Image fantôme fixe — suit le scroll, reste derrière tout le contenu */}
      <div
        aria-hidden="true"
        className="fixed inset-0 pointer-events-none select-none"
        style={{
          backgroundImage: `url('${bgImage}')`,
          backgroundSize: "cover",
          backgroundPosition: "center top",
          opacity: 0.07,
          zIndex: 0,
        }}
      />
      {/* Vignette sur les bords — donne de la profondeur */}
      <div
        aria-hidden="true"
        className="fixed inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 40%, rgba(28,28,28,0.85) 100%)",
          zIndex: 0,
        }}
      />
    </>
  );
}
