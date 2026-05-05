# 03 — SEO technique & content

C'est l'axe avec le **plus gros potentiel de croissance trafic** d'Elite Turf. Geny.com fait probablement 3–8 M visites/mois ; Zone-Turf 1–3 M ; Paris-Turf 1–2 M (estimation SimilarWeb gross). Elite Turf, avec 40 URLs indexées et `noindex` sur ses fiches courses, ne joue pas dans la même cour.

## Sitemap actuel : 40 URLs

[`app/sitemap.ts`](../app/sitemap.ts) :

```
$ curl -s https://www.elite-turf.fr/sitemap.xml | grep -c "<url>"
40
```

Composition :
- 10 pages statiques (home, courses, pronostics, blog, abonnements, etc.)
- 7 articles blog hardcodés dans [`lib/blog-data.ts`](../lib/blog-data.ts)
- ≤ 50 pronostics gratuits publiés (avec `.eq("niveau_acces", "GRATUIT").limit(50)`)

**Pas dans le sitemap, alors qu'on les a en DB** :
- 1 824 courses (`courses` table)
- 106 hippodromes (`hippodromes` table)
- 0 chevaux/jockeys/entraîneurs (tables vides — voir axe 5 pour les remplir)
- Pronostics premium (PRO/ELITE)

## 🚨 Pages courses individuelles : `noindex`

[`app/(public)/courses/[id]/page.tsx:45`](../app/(public)/courses/[id]/page.tsx#L45) :

```ts
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  // ...
  return {
    title: `${c.libelle} — ${(c.hippodrome as any)?.nom || ""} | Elite Turf`,
    alternates: { canonical: `${APP_URL}/courses/${params.id}` },
    // Pages de course individuelles : peu de valeur SEO (UUID, contenu dynamique éphémère)
    robots: { index: false, follow: false },
  };
}
```

Le commentaire « peu de valeur SEO (UUID, contenu dynamique éphémère) » est **faux pour deux raisons** :

1. **L'URL avec UUID** est effectivement non-SEO-friendly. Mais c'est un problème à fixer (URL canonique slugifiée), pas une raison de noindex.
2. **Le contenu dynamique éphémère** rapporte un trafic massif sur les long-traînées :
   - « Quinté+ R2C3 Vincennes 5 mai 2026 »
   - « Pronostic Prix Coq Hardi Bordeaux 5 mai »
   - « Cote Lovely Warrior course du jour »

Geny et concurrents indexent **toutes** leurs fiches courses (pages programme et fiches partants). Ils touchent ainsi des centaines de milliers de requêtes long-tail par mois. Elite Turf renonce volontairement à ce trafic.

**Action critique** :

1. Slugifier l'URL : `/courses/2026-05-05-bordeaux-le-bouscat-r2c1-prix-coq-hardi` (cf format Geny). Garder l'UUID en interne.
2. Retirer `noindex`.
3. Ajouter au sitemap les courses des **30 derniers jours + 7 prochains** (≈ 700 URLs).
4. Page de course individuelle = page éditoriale enrichie : récap pronostic Elite Turf + résultat à postériori + cotes finales + contexte course.

**Estimation gain** : 30–80 K visites/mois à 6 mois (cf Top 10 trafic).

## Schema.org : présent mais incomplet

Schémas actuellement injectés :

| Page | Schemas | Manquants critiques |
|---|---|---|
| `/` (home) | Organization, FAQPage, BreadcrumbList | WebSite + SearchAction |
| `/courses` | — | **ItemList, BreadcrumbList** |
| `/courses/[id]` | — | **SportsEvent**, BreadcrumbList |
| `/pronostics` | BreadcrumbList | ItemList, Article on each |
| `/pronostics/[id]` | — | **Article** + author Person |
| `/blog` | BreadcrumbList | ItemList |
| `/blog/[slug]` | Article (déjà OK) | Author Person, datePublished |
| `/abonnements` | BreadcrumbList | **Product** + Offer + AggregateRating |
| `/performances` | BreadcrumbList | Dataset (résultats publics) |
| `/a-propos` | — | AboutPage, Organization étendu |

**Schema le plus impactant à ajouter** : `SportsEvent` sur les fiches course. Format :

```json
{
  "@context": "https://schema.org",
  "@type": "SportsEvent",
  "name": "Prix Coq Hardi",
  "startDate": "2026-05-05T11:05:00+02:00",
  "location": {
    "@type": "Place",
    "name": "Bordeaux Le Bouscat",
    "address": "Le Bouscat, France"
  },
  "sport": "Horse racing",
  "subEvent": [{
    "@type": "Event",
    "name": "R2C1 — 9 partants — 1 600 m"
  }]
}
```

Apparaît potentiellement dans **Google Discover**, **événements sportifs Knowledge Panel**, **carousels résultats**.

## Robots.txt : audit complet

[`https://www.elite-turf.fr/robots.txt`](https://www.elite-turf.fr/robots.txt) — bon : bloque `/admin/`, `/connexion`, `/inscription`, `/paiement/`. Mais quelques points :

- Préfixe Cloudflare-managed (content signals) ajouté automatiquement — OK.
- ❌ `Disallow: ClaudeBot` (et autres AI bots) : choix défendable mais coupe l'accès aux moteurs IA (Perplexity, etc.) qui commencent à diriger du trafic.
- ✅ Sitemap référencé.

## E-E-A-T : faible

Google E-E-A-T (Experience, Expertise, Authoritativeness, Trustworthiness) : pour le YMYL (Your Money Your Life — paris d'argent), c'est critique.

**Manque** :
- Pas de page auteur. Qui rédige les pronostics ? CV, photo, parcours, signatures ?
- Pas de date de publication / modification visible sur les articles.
- Pas de mentions légales jeu d'argent (responsable, ANJ, ARJEL si applicable, mentions Côte d'Ivoire).
- Pas de schema `Person` pour les rédacteurs.

**Action** :
- Page `/equipe` ou `/auteurs` avec photos, parcours, ROI réel publié.
- Schema `Person` lié aux articles (`author: { @type: Person, name: ..., url: ... }`).
- Footer : « Site édité par X. Mentions légales jeu d'argent : ... ».
- Sur chaque article/pronostic : datePublished, dateModified, sameAs (lien LinkedIn auteur).

## Long-tail / requêtes cibles

Recommandation pour le contenu programmatique (cf [05 — Acquisition](./05-acquisition.md)) :

| Type de page | Volume potentiel (estimation) | Long-tail typique |
|---|---|---|
| `/courses/[date]/[hippodrome]/[ref]` | 700+ | « pronostic R2C3 Vincennes 12 mai » |
| `/hippodromes/[slug]` | 106 | « Hippodrome Bordeaux Le Bouscat » |
| `/chevaux/[slug]` | À créer | « Performance Lovely Warrior » |
| `/jockeys/[slug]` | À créer | « Stats I. Mendizabal 2026 » |
| `/programme/[date]` | 365/an | « Programme PMU 5 mai 2026 » |
| `/quinte-plus/[date]` | 365/an | « Quinté+ du jour 12 mai » |
| `/arrivees/[date]` | 365/an | « Arrivée Vincennes hier » |

## hreflang : absent

Aucune balise `<link rel="alternate" hreflang>`. Pour un site qui cible **France + Afrique francophone**, c'est une perte modeste mais réelle. Minimum à mettre : `<link rel="alternate" hreflang="fr" href="..."/>`. Si segmentation plus tard : `fr-FR`, `fr-CI`, `fr-SN`, etc.

## Recommandations

| # | Reco | Effort | Impact SEO |
|---|---|---|---|
| 1 | Retirer `noindex` fiches course + slug + sitemap programmatique | 2 j | ★★★★★ |
| 2 | Schema `SportsEvent` sur fiches course | 4 h | ★★★★ |
| 3 | Schema `Article` + `Person` auteur sur pronostics et blog | 1 j | ★★★ |
| 4 | Pages programmatiques `/hippodromes/[slug]`, `/programme/[date]` | 3 j | ★★★★★ |
| 5 | Pages `/quinte-plus/[date]`, `/arrivees/[date]` | 2 j | ★★★★ |
| 6 | E-E-A-T : page auteurs + dates visibles + CV | 2 j | ★★★ |
| 7 | hreflang `fr` minimum | 1 h | ★ |
| 8 | sitemap-news.xml pour Google News (cf Zone-Turf) | 4 h | ★★★ |
| 9 | URL slugifiées (vs UUID) sur courses + pronostics | 1 j | ★★ |
| 10 | Schema `Product` + `AggregateRating` sur `/abonnements` | 4 h | ★★ (rich snippet) |
