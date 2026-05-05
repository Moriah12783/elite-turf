/**
 * /hippodromes — Index public des hippodromes (France + Afrique).
 *
 * Levier SEO :
 *  - "hippodrome longchamp", "hippodrome paris-vincennes", "hippodrome chantilly"
 *  - Hub interne pour /hippodromes/[slug] (poursuit le PageRank)
 *
 * Inclut compteur courses 30 derniers jours pour pertinence SEO + UX.
 */

import { Metadata } from "next";
import Link from "next/link";
import { MapPin, ChevronRight } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/server";
import PageHero from "@/components/layout/PageHero";
import { slugify } from "@/lib/seo/slugs";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://www.elite-turf.fr");

export const revalidate = 3600; // index hippo bouge rarement

export const metadata: Metadata = {
  title: "Hippodromes | Programme courses & pronostics — Elite Turf",
  description:
    "Tous les hippodromes : Longchamp, Vincennes, Chantilly, Cagnes-sur-Mer, Abidjan… Programme, pronostics et résultats par hippodrome.",
  alternates: { canonical: `${APP_URL}/hippodromes` },
};

interface HippoStats {
  id:        string;
  nom:       string;
  pays:      string;
  ville:     string;
  nb_courses_30j: number;
}

export default async function HippodromesIndexPage() {
  const supabase = createServiceClient();

  // 1. Tous les hippodromes actifs
  const { data: hippos } = await supabase
    .from("hippodromes")
    .select("id, nom, pays, ville")
    .eq("actif", true)
    .order("nom");

  // 2. Courses 30j par hippodrome (pour pertinence + tri)
  const minus30 = new Date(Date.now() - 30 * 24 * 3600 * 1000)
    .toISOString().split("T")[0];
  const { data: counts } = await supabase
    .from("courses")
    .select("hippodrome_id")
    .gte("date_course", minus30)
    .neq("statut", "ANNULE");

  const countMap = new Map<string, number>();
  for (const c of counts ?? []) {
    countMap.set(c.hippodrome_id, (countMap.get(c.hippodrome_id) ?? 0) + 1);
  }

  const all: HippoStats[] = (hippos ?? []).map((h: any) => ({
    id:    h.id,
    nom:   h.nom,
    pays:  h.pays,
    ville: h.ville,
    nb_courses_30j: countMap.get(h.id) ?? 0,
  }));

  // Regrouper par pays
  const byPays: Record<string, HippoStats[]> = {};
  for (const h of all) {
    const key = h.pays || "Autre";
    if (!byPays[key]) byPays[key] = [];
    byPays[key].push(h);
  }

  // Tri pays : France d'abord, puis Côte d'Ivoire (LONACI), puis alpha
  const paysOrdered = Object.keys(byPays).sort((a, b) => {
    if (a === "France") return -1;
    if (b === "France") return 1;
    if (a === "Côte d'Ivoire" || a === "Cote d'Ivoire") return -1;
    if (b === "Côte d'Ivoire" || b === "Cote d'Ivoire") return 1;
    return a.localeCompare(b);
  });

  // ── Schema.org ItemList ──────────────────────────────────────────
  const itemListLd = {
    "@context": "https://schema.org",
    "@type":    "ItemList",
    name:        "Hippodromes — Elite Turf",
    numberOfItems: all.length,
    itemListElement: all.slice(0, 50).map((h, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      item: {
        "@type": "Place",
        name:    h.nom,
        url:     `${APP_URL}/hippodromes/${slugify(h.nom)}`,
        address: {
          "@type":          "PostalAddress",
          addressLocality:  h.ville,
          addressCountry:   h.pays,
        },
      },
    })),
  };

  return (
    <div className="min-h-screen bg-bg-primary">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }}
      />

      <PageHero
        image="/images/heroes/hero-courses.jpg"
        titre="Hippodromes"
        sousTitre={`${all.length} hippodromes — France, Afrique, international`}
      />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        <nav className="mb-6 flex items-center gap-2 text-xs text-text-muted">
          <Link href="/" className="hover:text-gold-primary">Accueil</Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-text-secondary">Hippodromes</span>
        </nav>

        {paysOrdered.map((pays) => (
          <section key={pays} className="mb-8">
            <header className="flex items-center gap-2 mb-4">
              <MapPin className="w-4 h-4 text-gold-primary" />
              <h2 className="font-serif font-bold text-text-primary text-lg">{pays}</h2>
              <span className="text-text-muted text-xs">·</span>
              <span className="text-text-muted text-xs">{byPays[pays].length} hippodromes</span>
            </header>
            <hr className="gold-divider mb-4" />
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {byPays[pays]
                .sort((a, b) => b.nb_courses_30j - a.nb_courses_30j || a.nom.localeCompare(b.nom))
                .map((h) => (
                  <Link
                    key={h.id}
                    href={`/hippodromes/${slugify(h.nom)}`}
                    className="card-base p-4 hover:border-gold-primary/40 transition-all group"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3 className="font-serif font-semibold text-text-primary text-sm leading-tight">
                        {h.nom}
                      </h3>
                      <ChevronRight className="w-4 h-4 text-text-muted group-hover:text-gold-primary flex-shrink-0 transition-colors" />
                    </div>
                    <p className="text-text-muted text-xs">{h.ville}</p>
                    {h.nb_courses_30j > 0 && (
                      <p className="text-gold-primary text-xs font-mono mt-2">
                        {h.nb_courses_30j} course{h.nb_courses_30j > 1 ? "s" : ""} (30j)
                      </p>
                    )}
                  </Link>
                ))}
            </div>
          </section>
        ))}

      </div>
    </div>
  );
}
