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
    sitemap: `${APP_URL}/sitemap.xml`,
  };
}
