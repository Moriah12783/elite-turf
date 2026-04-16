import { MetadataRoute } from "next";
import { createServiceClient } from "@/lib/supabase/server";
import { BLOG_ARTICLES } from "@/lib/blog-data";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.elite-turf.fr";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  // Pages statiques — seules les pages indexables et à valeur SEO
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
    // Pages légales — conservées pour la complétude mais noindex côté page
    { url: `${APP_URL}/mentions-legales`,       lastModified: now, changeFrequency: "yearly",  priority: 0.1  },
    { url: `${APP_URL}/confidentialite`,        lastModified: now, changeFrequency: "yearly",  priority: 0.1  },
    { url: `${APP_URL}/cgu`,                    lastModified: now, changeFrequency: "yearly",  priority: 0.1  },
    // /connexion et /inscription supprimés (pages auth → noindex)
  ];

  // Pronostics publiés dynamiques
  let pronosticUrls: MetadataRoute.Sitemap = [];
  try {
    const supabase = createServiceClient();
    const { data: pronostics } = await supabase
      .from("pronostics")
      .select("id, date_publication")
      .eq("publie", true)
      .eq("niveau_acces", "GRATUIT")
      .order("date_publication", { ascending: false })
      .limit(50);

    if (pronostics) {
      pronosticUrls = pronostics.map((p) => ({
        url: `${APP_URL}/pronostics/${p.id}`,
        lastModified: p.date_publication ? new Date(p.date_publication) : now,
        changeFrequency: "weekly" as const,
        priority: 0.7,
      }));
    }
  } catch {
    // Supabase pas encore configuré — on continue
  }

  // Articles de blog — 1 URL par article avec date réelle
  const blogArticleUrls: MetadataRoute.Sitemap = BLOG_ARTICLES.map((a) => ({
    url: `${APP_URL}/blog/${a.slug}`,
    lastModified: new Date(a.date),
    changeFrequency: "monthly" as const,
    priority: 0.75,
  }));

  return [...staticPages, ...blogArticleUrls, ...pronosticUrls];
}
