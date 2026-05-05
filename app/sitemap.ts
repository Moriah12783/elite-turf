import { MetadataRoute } from "next";
import { createServiceClient } from "@/lib/supabase/server";
import { BLOG_ARTICLES } from "@/lib/blog-data";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.elite-turf.fr";

// Cache 1h pour ne pas marteler Supabase à chaque crawl Google
export const revalidate = 3600;

/**
 * Sitemap programmatique :
 *  - 10 pages statiques cœur
 *  - Articles de blog
 *  - Pronostics publiés (gratuits + payants : Google les voit, le contenu
 *    est paywallé via JS mais l'URL reste indexable, ce que les concurrents
 *    Geny/Zone-Turf font aussi)
 *  - Courses des 30 derniers + 7 prochains jours (≈ 700-1500 URLs/run)
 *
 * Volume cible : ≈ 1 000 URLs vs 40 avant la PR.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  // ── Pages statiques cœur ─────────────────────────────────────────────────
  const staticPages: MetadataRoute.Sitemap = [
    { url: APP_URL,                             lastModified: now, changeFrequency: "daily",   priority: 1.0  },
    { url: `${APP_URL}/pronostics`,             lastModified: now, changeFrequency: "daily",   priority: 0.95 },
    { url: `${APP_URL}/courses`,                lastModified: now, changeFrequency: "daily",   priority: 0.9  },
    { url: `${APP_URL}/performances`,           lastModified: now, changeFrequency: "weekly",  priority: 0.8  },
    { url: `${APP_URL}/abonnements`,            lastModified: now, changeFrequency: "monthly", priority: 0.85 },
    { url: `${APP_URL}/guide-initie`,           lastModified: now, changeFrequency: "monthly", priority: 0.8  },
    { url: `${APP_URL}/blog`,                   lastModified: now, changeFrequency: "weekly",  priority: 0.8  },
    { url: `${APP_URL}/archives`,               lastModified: now, changeFrequency: "weekly",  priority: 0.65 },
    { url: `${APP_URL}/a-propos`,               lastModified: now, changeFrequency: "yearly",  priority: 0.5  },
    { url: `${APP_URL}/contact`,                lastModified: now, changeFrequency: "yearly",  priority: 0.4  },
  ];

  // ── Articles de blog ─────────────────────────────────────────────────────
  const blogArticleUrls: MetadataRoute.Sitemap = BLOG_ARTICLES.map((a) => ({
    url: `${APP_URL}/blog/${a.slug}`,
    lastModified: new Date(a.date),
    changeFrequency: "monthly" as const,
    priority: 0.75,
  }));

  // ── Pronostics publiés (tous niveaux) ────────────────────────────────────
  let pronosticUrls: MetadataRoute.Sitemap = [];
  // ── Courses des 30 derniers + 7 prochains jours ──────────────────────────
  let courseUrls: MetadataRoute.Sitemap = [];

  try {
    const supabase = createServiceClient();
    const today = new Date();
    const minus30 = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
      .toISOString().split("T")[0];
    const plus7 = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
      .toISOString().split("T")[0];

    // Pronostics
    const { data: pronostics } = await supabase
      .from("pronostics")
      .select("id, date_publication, updated_at")
      .eq("publie", true)
      .order("date_publication", { ascending: false })
      .limit(500);
    if (pronostics) {
      pronosticUrls = pronostics.map((p) => ({
        url: `${APP_URL}/pronostics/${p.id}`,
        lastModified: p.date_publication
          ? new Date(p.date_publication)
          : (p.updated_at ? new Date(p.updated_at) : now),
        changeFrequency: "weekly" as const,
        priority: 0.7,
      }));
    }

    // Courses dans la fenêtre [-30j, +7j]
    const { data: courses } = await supabase
      .from("courses")
      .select("id, date_course, updated_at, statut")
      .gte("date_course", minus30)
      .lte("date_course", plus7)
      .neq("statut", "ANNULE")
      .order("date_course", { ascending: false })
      .limit(2000);
    if (courses) {
      courseUrls = courses.map((c) => ({
        url: `${APP_URL}/courses/${c.id}`,
        lastModified: c.updated_at ? new Date(c.updated_at) : new Date(c.date_course),
        // Course terminée : contenu stable (résultats), check moins fréquent
        changeFrequency: c.statut === "TERMINE" ? ("monthly" as const) : ("daily" as const),
        // Course du jour ou à venir : priorité haute pour les requêtes long-tail
        priority: c.statut === "TERMINE" ? 0.5 : 0.7,
      }));
    }
  } catch {
    // Supabase indisponible — on retourne au moins les pages statiques
  }

  return [...staticPages, ...blogArticleUrls, ...pronosticUrls, ...courseUrls];
}
