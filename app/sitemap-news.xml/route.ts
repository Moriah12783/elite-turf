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
import { createServiceClient } from "@/lib/supabase/server";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://www.elite-turf.fr");

// Cache 30 min — le contenu News bouge peu sur cette fenêtre.
// On passe en force-dynamic car on lit Supabase pour les arrivées du jour.
export const revalidate = 1800;
export const dynamic = "force-dynamic";

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

  // 4. Pages programme + quinté+ + arrivées des 2 derniers jours.
  // Ces pages sont CRITIQUES pour Google News : c'est là que se concentrent
  // les requêtes "pronostic Quinté+", "résultats PMU 7 mai", "rapports PMU…".
  // Concurrents (Geny, Paris-Turf) trustent grâce à leur sitemap-news.
  //
  // IMPORTANT : pour Google News, le contenu FRAIS (pronostic publié aujourd'hui
  // avant la course) est aussi valuable que les résultats post-course. On ne
  // filtre PAS sur statut = TERMINE — on inclut dès qu'une course existe pour
  // la date (≈ programme défini, donc pronostic potentiellement publié).
  try {
    const supabase = createServiceClient();
    const today = new Date();
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const datesToCheck = [
      today.toISOString().split("T")[0],
      yesterday.toISOString().split("T")[0],
    ];

    for (const dateISO of datesToCheck) {
      // Toutes les courses du jour (PAS de limit, PAS de filtre TERMINE).
      // On regarde séparément :
      //  - courses avec arrivée → légitime /arrivees/<date>
      //  - courses QUINTE_PLUS → légitime /quinte-plus/<date> (toujours, pronostic ou arrivée)
      const { data: courses } = await supabase
        .from("courses")
        .select("id, paris_disponibles, statut, arrivee_officielle")
        .eq("date_course", dateISO);

      if (!courses?.length) continue;

      const isToday = dateISO === today.toISOString().split("T")[0];
      // Pour aujourd'hui : pubDate = now (frais). Pour hier : 21h UTC du jour.
      const pubDate = isToday
        ? now
        : new Date(`${dateISO}T21:00:00.000Z`);
      if (pubDate < cutoff) continue;

      const dateHuman = new Date(dateISO + "T12:00:00").toLocaleDateString("fr-FR", {
        day: "numeric", month: "long", year: "numeric",
      });

      // /programme/<date> : programme du jour (toujours news-worthy s'il y a des courses)
      items.push({
        url:      `${APP_URL}/programme/${dateISO}`,
        title:    `Programme PMU du ${dateHuman} : courses, partants, pronostics`,
        pubDate,
        keywords: ["programme PMU", "courses du jour", "partants", "pronostics PMU"],
      });

      // /quinte-plus/<date> : page focus Quinté+ — incluse si AU MOINS 1 course
      // QUINTE_PLUS existe (pronostic publié ou arrivée disponible, peu importe).
      const quintePlusExists = courses.some((c: any) =>
        Array.isArray(c.paris_disponibles)
        && (c.paris_disponibles.includes("QUINTE_PLUS") || c.paris_disponibles.includes("QUINTE")),
      );
      if (quintePlusExists) {
        items.push({
          url:      `${APP_URL}/quinte-plus/${dateISO}`,
          title:    `Quinté+ du ${dateHuman} : pronostic, partants et arrivée`,
          pubDate,
          keywords: ["quinté+ du jour", "pronostic quinté", "arrivée quinté", "rapports quinté"],
        });
      }

      // /arrivees/<date> : uniquement si AU MOINS 1 course terminée avec arrivée
      const hasArrivee = courses.some((c: any) =>
        c.statut === "TERMINE" && c.arrivee_officielle !== null,
      );
      if (hasArrivee) {
        items.push({
          url:      `${APP_URL}/arrivees/${dateISO}`,
          title:    `Arrivées et rapports PMU du ${dateHuman}`,
          pubDate,
          keywords: ["arrivée PMU", "rapports PMU", "résultats hippiques", "tiercé", "quarté", "quinté"],
        });
      }
    }
  } catch (err) {
    // Best-effort : si Supabase est down, on reste avec les items blog.
    console.error("[sitemap-news] Failed to load arrivees:", err);
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
