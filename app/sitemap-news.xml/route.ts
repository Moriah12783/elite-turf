/**
 * /sitemap-news.xml — Sitemap dédié Google News.
 *
 * Format Google News : XML avec namespace dédié `news:news`. Nécessite un
 * route handler custom (Next.js sitemap() ne supporte pas le namespace).
 *
 * Règle Google News : uniquement les articles publiés dans les **48 dernières
 * heures**. On y inclut :
 *  - Articles BLOG_ARTICLES statiques publiés < 48h
 *  - Top-semaine actuel (régénéré weekly)
 *  - Bilan-mensuel courant si publié < 48h (= 1er au 2 du mois)
 *
 * Référence : https://developers.google.com/search/docs/crawling-indexing/sitemaps/news-sitemap
 *
 * Pour soumission Google News : https://news.google.com/publisher-center
 */

import { NextResponse } from "next/server";
import { BLOG_ARTICLES } from "@/lib/blog-data";
import { currentWeekISO, currentMonth, formatWeekHumanLong, formatMonthHuman } from "@/lib/blog-auto/dates";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://www.elite-turf.fr");

// Cache 30 min — le contenu News bouge peu sur cette fenêtre
export const revalidate = 1800;
export const dynamic = "force-static";

interface NewsItem {
  url:        string;
  title:      string;
  pubDate:    Date;
  keywords?:  string[];
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildNewsXml(items: NewsItem[]): string {
  const urls = items.map((item) => `
  <url>
    <loc>${escapeXml(item.url)}</loc>
    <news:news>
      <news:publication>
        <news:name>Elite Turf</news:name>
        <news:language>fr</news:language>
      </news:publication>
      <news:publication_date>${item.pubDate.toISOString()}</news:publication_date>
      <news:title>${escapeXml(item.title)}</news:title>
      ${item.keywords && item.keywords.length > 0 ? `<news:keywords>${escapeXml(item.keywords.join(", "))}</news:keywords>` : ""}
    </news:news>
  </url>`).join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">${urls}
</urlset>`;
}

export async function GET() {
  const now = new Date();
  const cutoff = new Date(now.getTime() - 48 * 60 * 60 * 1000); // 48h

  const items: NewsItem[] = [];

  // 1. Articles blog statiques publiés < 48h
  for (const a of BLOG_ARTICLES) {
    const pub = new Date(a.date);
    if (pub >= cutoff) {
      items.push({
        url:      `${APP_URL}/blog/${a.slug}`,
        title:    a.titre,
        pubDate:  pub,
        keywords: a.keywords?.slice(0, 10),
      });
    }
  }

  // 2. Top-semaine actuel (toujours considéré "frais" puisque régénéré chaque semaine)
  const weekISO = currentWeekISO();
  const weekHuman = formatWeekHumanLong(weekISO);
  // Date de "publication" = lundi de la semaine en cours
  const todayWeekday = now.getUTCDay() || 7; // 1=lundi
  const monday = new Date(now.getTime() - (todayWeekday - 1) * 24 * 3600 * 1000);
  monday.setUTCHours(7, 0, 0, 0);
  if (monday >= cutoff) {
    items.push({
      url:     `${APP_URL}/blog/top-semaine/${weekISO}`,
      title:   `Top performers PMU — ${weekHuman}`,
      pubDate: monday,
      keywords: ["pronostic PMU", "bilan turf", "top jockeys", "semaine"],
    });
  }

  // 3. Bilan mensuel : "publication" = 1er du mois à 7h. Inclus si <48h.
  const month = currentMonth();
  const monthHuman = formatMonthHuman(month);
  const firstOfMonth = new Date(now.getUTCFullYear(), now.getUTCMonth(), 1, 7, 0, 0);
  if (firstOfMonth >= cutoff) {
    items.push({
      url:     `${APP_URL}/blog/bilan-mensuel/${month}`,
      title:   `Bilan PMU — ${monthHuman}`,
      pubDate: firstOfMonth,
      keywords: ["pronostic PMU", "bilan mensuel", "statistiques turf"],
    });
  }

  const xml = buildNewsXml(items);

  return new NextResponse(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600",
    },
  });
}
