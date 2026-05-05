# 02 — Performance & Core Web Vitals

## Mesures (5 mai 2026, depuis Madrid/Lisbonne edge Cloudflare)

| Page | TTFB | Total | HTML | Imgs | Scripts | Liens |
|---|---:|---:|---:|---:|---:|---:|
| `/` | **1,47 s** | 1,48 s | 385 KB | 11 | 14 | 79 |
| `/courses` | 0,69 s | 0,70 s | **538 KB** | 88 | 14 | 387 |
| `/pronostics` | **2,19 s** | 2,19 s | 304 KB | 3 | 14 | 59 |
| `/abonnements` | 0,36 s | 0,36 s | 166 KB | 3 | 14 | 37 |
| `/blog` | 0,52 s | 0,54 s | 158 KB | 18 | 14 | 68 |
| `/blog/[slug]` | 0,39 s | 0,40 s | 94 KB | 10 | 14 | 46 |
| `/courses/[id]` | 0,57 s | 0,70 s | 90 KB | 4 | 14 | 39 |

**Lighthouse synthétique** : non mesurable lors de l'audit (quota PSI API épuisé). À mesurer manuellement avec `npx lighthouse https://www.elite-turf.fr/ --view` ou via PSI dans Search Console.

## Constats

### 🚨 1. Aucun cache edge Cloudflare (le plus gros problème de l'axe)

```
$ curl -I https://www.elite-turf.fr/courses
Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate
```

**Toutes** les pages publiques renvoient `Cache-Control: no-store`. Le CDN Cloudflare est inutile : chaque requête frappe le Worker, qui frappe Supabase, qui rend la page from scratch.

Origine : combinaison de
- Page courses [`app/(public)/courses/page.tsx:23`](../app/(public)/courses/page.tsx#L23) `export const dynamic = "force-dynamic"`.
- Page courses/[id] [`app/(public)/courses/[id]/page.tsx:16`](../app/(public)/courses/[id]/page.tsx#L16) idem.
- Header global hardcodé dans [`vercel.json`](../vercel.json) qui force `no-store` sur `/api/*` (ce qui est OK pour les API mais semble se propager).

**Impact** :
- TTFB élevé (1,5–2,2 s) sur pages clés.
- Charge Supabase qui scale linéairement avec le trafic.
- Coût Cloudflare Workers requests qui scale linéairement.
- Lighthouse mobile probablement <50 sur LCP.

**Fix** :

```ts
// app/(public)/courses/page.tsx
export const dynamic = "force-dynamic"; // ❌ supprimer
export const revalidate = 60; // ✅ ISR : régénère toutes les 60 s

// Ou cache headers ciblés via headers() dans next.config.js
// pour ajouter Cache-Control sur certains paths
```

Pour les pages dont le contenu dépend du user connecté (header, badge premium…), utiliser `revalidate` + composants client pour les parties personnalisées (CSR pour le header), ou Partial Prerendering (Next 15).

**Gain attendu** : TTFB <50 ms en cache hit (≥99 % du trafic après warm-up). Score Lighthouse +30–40 points.

### 2. HTML page `/courses` : 538 KB, 387 liens

[`app/(public)/courses/page.tsx`](../app/(public)/courses/page.tsx) rend la liste complète des courses du jour sans pagination ni virtualisation. À mesure que le trafic grandit (ex : jour de Quinté+ Vincennes avec 90 courses + intl), la page va atteindre 800 KB+.

**Fix** :
- Couper en 2 sections : « Courses du moment » (les 5–10 prochaines) en SSR, le reste en CSR avec pagination.
- Supprimer les `<img>` inutiles ou utiliser `next/image` pour les optimiser (88 images sur cette page !).
- Lazyload les sections en bas de page.

### 3. 14 scripts par page (bundle Next 14)

Toutes les pages chargent 14 scripts. Standard Next.js, mais peut être optimisé :

```bash
# À mesurer
npx @next/bundle-analyzer
```

**Hypothèse** : le bundle contient probablement du JS inutile (lib/email, lib/pmu-api...) tiré par les imports en chaîne. Vérifier que les composants client n'importent pas du code server-only.

### 4. Images non optimisées (88 sur /courses)

```bash
$ grep -oE "<img[^>]*src" /tmp/courses.html | wc -l
88
```

`<img>` natif au lieu de `next/image`. Pas de srcset, pas de lazy loading, pas de format moderne (AVIF/WebP).

**Fix** : remplacer `<img>` par `next/image` partout. Effort : 2 h (grep + replace + tests).

### 5. Pas de hreflang FR/CI

Le site cible France + Côte d'Ivoire (et autres pays francophones). Aucune balise `<link rel="alternate" hreflang="...">`. Pour Google, c'est UN seul site français.

**Action** : 2 options :
- **Option simple** : 1 seule version FR (ce qu'on a), ajouter `hreflang="fr"` (et c'est tout).
- **Option ambitieuse** : sous-dossiers `/fr/`, `/ci/`, `/sn/`, `/ma/` avec contenu localisé (devises, paiement, mentions légales). Pas pour MVP, mais à 6 mois.

### 6. LCP image preload : bon point

```tsx
// app/layout.tsx:125
<link rel="preload" as="image" href="/images/heroes/hero-courses.jpg" fetchPriority="high" />
```

Bonne pratique. Mais vérifier que cette image est bien le LCP de chaque page (probablement non sur `/blog/[slug]` par exemple).

## Recommandations

| # | Reco | Effort | Gain Lighthouse |
|---|---|---|---|
| 1 | Activer cache edge sur pages publiques (`s-maxage=60`) | 2 h | +30 LCP, +40 Speed Index |
| 2 | Remplacer `<img>` par `next/image` | 2 h | +10 LCP |
| 3 | Pagination/virtualisation `/courses` | 1 j | -300 KB HTML |
| 4 | `next/bundle-analyzer` + tree shaking imports server-only | 4 h | -50 KB JS |
| 5 | hreflang minimum (`fr`) sur toutes les pages | 1 h | (SEO, pas perf) |
| 6 | Préchargement hero adapté par template (blog/course/etc.) | 2 h | +5 LCP |
| 7 | `Cache-Control` browser sur `/api/stats`, `/api/ticker-data` | 30 min | charge Worker -20 % |
