import { MetadataRoute } from "next";
import { createServiceClient } from "@/lib/supabase/server";
import { BLOG_ARTICLES } from "@/lib/blog-data";
import { slugify } from "@/lib/seo/slugs";
import {
  generateRecentWeekParams, generateRecentMonthParams,
} from "@/lib/blog-auto/dates";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://www.elite-turf.fr");

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
    { url: `${APP_URL}/methodologie`,           lastModified: now, changeFrequency: "yearly",  priority: 0.7  },
    // ── Pages géo Afrique francophone (différenciation océan bleu) ──
    { url: `${APP_URL}/pronostics-pmu-cote-d-ivoire`, lastModified: now, changeFrequency: "weekly", priority: 0.85 },
    { url: `${APP_URL}/pronostics-pmu-senegal`,       lastModified: now, changeFrequency: "weekly", priority: 0.8  },
    { url: `${APP_URL}/pronostics-pmu-cameroun`,      lastModified: now, changeFrequency: "weekly", priority: 0.75 },
    { url: `${APP_URL}/pronostics-pmu-maroc`,         lastModified: now, changeFrequency: "weekly", priority: 0.75 },
    { url: `${APP_URL}/pronostics-pmu-mali`,          lastModified: now, changeFrequency: "weekly", priority: 0.7  },
    { url: `${APP_URL}/hippodromes`,            lastModified: now, changeFrequency: "weekly",  priority: 0.7  },
    { url: `${APP_URL}/chevaux`,                lastModified: now, changeFrequency: "daily",   priority: 0.7  },
    { url: `${APP_URL}/jockeys`,                lastModified: now, changeFrequency: "daily",   priority: 0.7  },
    { url: `${APP_URL}/entraineurs`,            lastModified: now, changeFrequency: "daily",   priority: 0.7  },
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

  // ── Articles blog auto-générés (template-based) ─────────────────────────
  // Volume cumul : ~13 semaines + 13 mois + N hippodromes (tous) ≈ 60+ URLs
  const autoBlogUrls: MetadataRoute.Sitemap = [
    // Top hebdomadaire : dernières 13 semaines (3 mois)
    ...generateRecentWeekParams().map((w) => ({
      url: `${APP_URL}/blog/top-semaine/${w.semaine}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    // Bilan mensuel : 13 derniers mois
    ...generateRecentMonthParams().map((m) => ({
      url: `${APP_URL}/blog/bilan-mensuel/${m.mois}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.75,
    })),
  ];

  // ── Pages temporelles SEO (programme/quinte-plus/arrivees par date) ──────
  // Fenêtre [-30j, +7j] pour matcher la stratégie courses ci-dessous.
  // Volume : 38 dates × 3 pages = 114 URLs (négligeable, fort levier SEO).
  const temporalUrls: MetadataRoute.Sitemap = [];
  const todayStr = now.toISOString().split("T")[0];
  for (let i = -30; i <= 7; i++) {
    const d = new Date(now.getTime() + i * 24 * 60 * 60 * 1000)
      .toISOString().split("T")[0];
    const isFutureDate = d > todayStr;
    const isTodayDate  = d === todayStr;

    // /programme/[date] — toujours indexable (programme passé/présent/futur)
    temporalUrls.push({
      url: `${APP_URL}/programme/${d}`,
      lastModified: now,
      changeFrequency: isFutureDate ? "daily" : isTodayDate ? "hourly" : "monthly",
      priority: isTodayDate ? 0.9 : isFutureDate ? 0.7 : 0.6,
    });

    // /quinte-plus/[date] — fort levier SEO ("quinté+ du jour" #1 turf FR)
    temporalUrls.push({
      url: `${APP_URL}/quinte-plus/${d}`,
      lastModified: now,
      changeFrequency: isFutureDate ? "daily" : isTodayDate ? "hourly" : "weekly",
      priority: isTodayDate ? 0.95 : isFutureDate ? 0.8 : 0.7,
    });

    // /arrivees/[date] — pas indexable dans le futur (pas de résultats)
    if (!isFutureDate) {
      temporalUrls.push({
        url: `${APP_URL}/arrivees/${d}`,
        lastModified: now,
        changeFrequency: isTodayDate ? "hourly" : "monthly",
        priority: isTodayDate ? 0.85 : 0.6,
      });
    }
  }

  // ── Pronostics publiés (tous niveaux) ────────────────────────────────────
  let pronosticUrls: MetadataRoute.Sitemap = [];
  // ── Courses des 30 derniers + 7 prochains jours ──────────────────────────
  let courseUrls: MetadataRoute.Sitemap = [];
  // ── Hippodromes (dérivés du nom via slugify) ──────────────────────────────
  let hippoUrls: MetadataRoute.Sitemap = [];
  // ── Acteurs (chevaux/jockeys/entraineurs avec slug) ──────────────────────
  let acteurUrls: MetadataRoute.Sitemap = [];

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

    // Hippodromes actifs : 2 URLs par hippo
    //   /hippodromes/[slug]                  → index data brut
    //   /blog/decouvrir-hippodrome/[slug]    → guide narratif (article)
    const { data: hippos } = await supabase
      .from("hippodromes")
      .select("nom")
      .eq("actif", true);
    if (hippos) {
      for (const h of hippos as any[]) {
        const slug = slugify(h.nom);
        hippoUrls.push({
          url: `${APP_URL}/hippodromes/${slug}`,
          lastModified: now,
          changeFrequency: "weekly" as const,
          priority: 0.7,
        });
        // Guide blog-auto correspondant
        autoBlogUrls.push({
          url: `${APP_URL}/blog/decouvrir-hippodrome/${slug}`,
          lastModified: now,
          changeFrequency: "monthly" as const,
          priority: 0.65,
        });
      }
    }

    // Acteurs : chevaux/jockeys/entraineurs (top 1000 chacun par activité récente)
    // Volume cumulé ≈ 3000 URLs SEO. Cap pour ne pas exploser sitemap.xml.
    for (const t of ["chevaux", "jockeys", "entraineurs"] as const) {
      const { data } = await supabase
        .from(t)
        .select("slug, derniere_course_at")
        .order("derniere_course_at", { ascending: false, nullsFirst: false })
        .limit(1000);
      if (data) {
        for (const e of data as any[]) {
          acteurUrls.push({
            url: `${APP_URL}/${t}/${e.slug}`,
            lastModified: e.derniere_course_at ? new Date(e.derniere_course_at) : now,
            changeFrequency: "weekly" as const,
            priority: 0.55,
          });
        }
      }
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

  return [
    ...staticPages,
    ...blogArticleUrls,
    ...autoBlogUrls,        // ~60 articles blog auto-générés (top-semaine + bilan-mensuel + decouvrir-hippodrome)
    ...temporalUrls,
    ...hippoUrls,
    ...acteurUrls,
    ...pronosticUrls,
    ...courseUrls,
  ];
}
