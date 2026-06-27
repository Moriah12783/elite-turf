import { MetadataRoute } from "next";
import { createServiceClient } from "@/lib/supabase/server";
import { BLOG_ARTICLES } from "@/lib/blog-data";
import { slugify } from "@/lib/seo/slugs";
import {
  generateRecentWeekParams, generateRecentMonthParams,
} from "@/lib/blog-auto/dates";
import { GRANDS_RENDEZ_VOUS_2026 } from "@/data/grands-rendez-vous-2026";

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
    { url: `${APP_URL}/calendrier`,             lastModified: now, changeFrequency: "weekly",  priority: 0.75 },
    { url: `${APP_URL}/performances`,           lastModified: now, changeFrequency: "weekly",  priority: 0.8  },
    { url: `${APP_URL}/abonnements`,            lastModified: now, changeFrequency: "monthly", priority: 0.85 },
    { url: `${APP_URL}/methodologie`,           lastModified: now, changeFrequency: "yearly",  priority: 0.7  },
    { url: `${APP_URL}/arnaques-pronostics`,    lastModified: now, changeFrequency: "monthly", priority: 0.7  },
    // ── Pages géo Afrique francophone + DOM-TOM (différenciation océan bleu) ──
    { url: `${APP_URL}/pronostics-pmu-cote-d-ivoire`,     lastModified: now, changeFrequency: "weekly", priority: 0.85 },
    { url: `${APP_URL}/pronostics-pmu-senegal`,           lastModified: now, changeFrequency: "weekly", priority: 0.8  },
    { url: `${APP_URL}/pronostics-pmu-cameroun`,          lastModified: now, changeFrequency: "weekly", priority: 0.75 },
    { url: `${APP_URL}/pronostics-pmu-maroc`,             lastModified: now, changeFrequency: "weekly", priority: 0.75 },
    { url: `${APP_URL}/pronostics-pmu-mali`,              lastModified: now, changeFrequency: "weekly", priority: 0.7  },
    // 🆕 Mai 2026 : 7 nouveaux pays
    { url: `${APP_URL}/pronostics-pmu-burkina-faso`,      lastModified: now, changeFrequency: "weekly", priority: 0.75 },
    { url: `${APP_URL}/pronostics-pmu-tchad`,             lastModified: now, changeFrequency: "weekly", priority: 0.7  },
    { url: `${APP_URL}/pronostics-pmu-gabon`,             lastModified: now, changeFrequency: "weekly", priority: 0.75 },
    { url: `${APP_URL}/pronostics-pmu-togo`,              lastModified: now, changeFrequency: "weekly", priority: 0.7  },
    { url: `${APP_URL}/pronostics-pmu-congo-brazzaville`, lastModified: now, changeFrequency: "weekly", priority: 0.7  },
    { url: `${APP_URL}/pronostics-pmu-madagascar`,        lastModified: now, changeFrequency: "weekly", priority: 0.8  },
    { url: `${APP_URL}/pronostics-pmu-reunion`,           lastModified: now, changeFrequency: "weekly", priority: 0.85 },
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

    // Acteurs : chevaux/jockeys/entraineurs — TOUS les acteurs "riches".
    // Cap relevé 1000 → 8000 par type (2026-06-27) pour exposer les ~6,5k chevaux
    // ≥3 courses (gros gisement long-tail jusque-là bridé). Le FILTRE
    // (nb_courses>=3 OR victoires/places>=1) est INCHANGÉ → ~99% des URLs restent
    // indexables côté page (pas de mismatch isIndexable). Total sitemap ~13k URLs
    // (< 50k → sitemap.xml unique OK).
    //
    // ⚠️ FILTRAGE : on aligne sur isIndexable() de lib/seo/acteurs.ts pour
    // ne pas créer de mismatch sitemap (URL listée) ↔ page (robots: noindex).
    //
    // Critères OR (un seul suffit, anti thin-content) :
    //   - nb_courses >= 3 (au moins 3 apparitions en BDD = historique reel)
    //   - nb_victoires >= 1 (cheval/jockey/entr gagnant = contenu pertinent)
    //   - nb_places >= 1 (au moins 1 top 3, idem)
    //
    // Historique :
    //   - 2026-05-15 : filtre `nb_courses >= 3` (mais BDD trop pauvre, ~500 URLs)
    //   - 2026-05-15 (PR souple) : `nb_courses >= 2 OR victoires/places >= 1`
    //     (passe à ~1600 URLs MAIS créait du mismatch isIndexable() vs sitemap)
    //   - 2026-05-18 (PR actuelle) : retour à `nb_courses >= 3` car le backfill
    //     historique a explosé la BDD (22 694 chevaux, 6 567 avec >= 3 courses).
    //     Cause GSC : 1286 pages "Exclue par balise noindex" car sitemap
    //     poussait des acteurs nb_courses=2 mais isIndexable() exigeait
    //     nb_courses_terminees >= 2 (mismatch). Avec >= 3, ~99% des URLs
    //     listées sont indexables côté page → bruit GSC réduit massivement.
    for (const t of ["chevaux", "jockeys", "entraineurs"] as const) {
      const { data } = await supabase
        .from(t)
        .select("slug, derniere_course_at, nb_courses, nb_victoires, nb_places")
        .or("nb_courses.gte.3,nb_victoires.gte.1,nb_places.gte.1")
        .order("derniere_course_at", { ascending: false, nullsFirst: false })
        .limit(8000);
      if (data) {
        for (const e of data as any[]) {
          acteurUrls.push({
            url: `${APP_URL}/${t}/${e.slug}`,
            lastModified: e.derniere_course_at ? new Date(e.derniere_course_at) : now,
            changeFrequency: "weekly" as const,
            // Plus de courses + victoires = plus prioritaire (0.55-0.75)
            priority: Math.min(
              0.75,
              0.55 + (e.nb_courses ?? 0) / 100 + (e.nb_victoires ?? 0) / 50,
            ),
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

  // ── Calendrier des grands rendez-vous 2026 (38 épreuves /calendrier/[slug]) ──
  const calendrierUrls: MetadataRoute.Sitemap = GRANDS_RENDEZ_VOUS_2026.map((evt) => ({
    url: `${APP_URL}/calendrier/${evt.slug}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: evt.prestige === "mythique" ? 0.8 : 0.6,
  }));

  return [
    ...staticPages,
    ...calendrierUrls,
    ...blogArticleUrls,
    ...autoBlogUrls,        // ~60 articles blog auto-générés (top-semaine + bilan-mensuel + decouvrir-hippodrome)
    ...temporalUrls,
    ...hippoUrls,
    ...acteurUrls,
    ...pronosticUrls,
    ...courseUrls,
  ];
}
