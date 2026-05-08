import { MetadataRoute } from "next";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://www.elite-turf.fr");

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/admin/",
          "/espace-membre",
          "/espace-membre/",
          "/api/",
          "/paiement/",
        ],
      },
    ],
    // Plusieurs sitemaps : le principal pour SEO classique, et un dédié
    // Google News (articles publiés <48h, namespace news:news). Google
    // News crawler récupère le second en plus de la déclaration manuelle
    // côté Publisher Center.
    sitemap: [
      `${APP_URL}/sitemap.xml`,
      `${APP_URL}/sitemap-news.xml`,
    ],
  };
}
