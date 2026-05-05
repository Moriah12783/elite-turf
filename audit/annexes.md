# Annexes

## A. Métriques mesurées

### Performance pages publiques (curl, edge Cloudflare Madrid/Lisbonne, 5 mai 2026)

| Page | TTFB | Total | HTML | `<img>` | `<script src>` | `<a>` |
|---|---:|---:|---:|---:|---:|---:|
| `/` | 1,47 s | 1,48 s | 385 KB | 11 | 14 | 79 |
| `/courses` | 0,69 s | 0,70 s | 538 KB | 88 | 14 | 387 |
| `/pronostics` | 2,19 s | 2,19 s | 304 KB | 3 | 14 | 59 |
| `/abonnements` | 0,36 s | 0,36 s | 166 KB | 3 | 14 | 37 |
| `/blog` | 0,52 s | 0,54 s | 158 KB | 18 | 14 | 68 |
| `/blog/comment-gagner-au-quinte-plus` | 0,39 s | 0,40 s | 94 KB | 10 | 14 | 46 |
| `/courses/b29f3900-...` | 0,57 s | 0,70 s | 90 KB | 4 | 14 | 39 |

### HTTP headers / cache

```
HTTP/1.1 200 OK
Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate
Vary: RSC, Next-Router-State-Tree, Next-Router-Prefetch
x-opennext: 1
x-powered-by: Next.js
Server: cloudflare
```

### Volumes DB Supabase (snapshot 5 mai 2026)

| Table | Lignes | RLS |
|---|---:|---|
| profiles | 22 | ✅ |
| hippodromes | 106 | ✅ |
| courses | 1 824 | ✅ |
| jockeys | 0 | ✅ |
| entraineurs | 0 | ✅ |
| chevaux | 0 | ✅ |
| plans | 3 | ✅ |
| abonnements | 0 | ✅ |
| transactions | 14 | ✅ |
| pronostics | 98 | ✅ |
| notifications | 2 | ✅ |
| leads | 25 | ✅ |
| partants | 392 | ✅ |
| arrivees | 3 | ✅ |
| cron_logs | 287 | ✅ |
| ingestion_events | 19 | ✅ |

### Couverture data 14 derniers jours (5 mai 2026)

| Date | Courses | Hippos | Terminées | Avec arrivée |
|---|---:|---:|---:|---:|
| 2026-05-05 | 87 | 12 | 0 | 0 |
| 2026-05-04 | 89 | 13 | 0 | 0 |
| 2026-05-03 | 81 | 12 | 3 | 3 |
| 2026-05-02 | 31 | 6 | 0 | 0 |
| 2026-05-01 | 21 | 3 | 3 | 3 |
| 2026-04-30 | 30 | 5 | 0 | 0 |
| 2026-04-29 | 60 | 8 | 3 | 3 |
| 2026-04-28 | 28 | 4 | 0 | 0 |
| 2026-04-27 | 29 | 5 | 0 | 0 |
| 2026-04-26 | 27 | 5 | 0 | 0 |
| 2026-04-25 | 70 | 9 | 2 | 0 |
| 2026-04-24 | 65 | 9 | 2 | 2 |
| 2026-04-23 | 41 | 6 | 3 | 0 |
| 2026-04-22 | 29 | 4 | 0 | 0 |
| 2026-04-21 | 57 | 8 | 0 | 0 |
| **Total** | **745** | | **16 (2 %)** | **14 (1,9 %)** |

### Cron health 14 derniers jours

| Cron | Total | Succès | Échecs | Skips | Avg ms | %success |
|---|---:|---:|---:|---:|---:|---:|
| pmu-sync | 39 | 1 | 38 | 0 | 8 948 | 2,6 % |
| pmu-demain | 15 | 1 | 14 | 0 | 7 496 | 6,7 % |
| geny-arrivees | 94 | 86 | 8 | 0 | 10 864 | 91,5 % |
| lonaci-sync | 30 | 28 | 2 | 0 | 7 320 | 93,3 % |
| ia-pronostics | 13 | 2 | 1 | 10 | 2 720 | 15,4 % |
| ia-rapport-soir | 13 | 13 | 0 | 0 | 8 034 | 100 % |
| ia-auto-publish | 12 | 0 | 0 | 12 | 892 | 0 % |
| pronostic-gratuit | 13 | 0 | 0 | 13 | 993 | 0 % |
| resultats-pronostics | 57 | 57 | 0 | 0 | 3 467 | 100 % |
| elite-turf-daily-pronostics | 1 | 1 | 0 | 0 | — | 100 % |

### Funnel paiement 30 derniers jours

```
leads (guide gratuit)         : 17
profiles GRATUIT              : 19
profiles abonnés actifs       : 3
transactions tentées          : 9
transactions SUCCES (30j)     : 0  ← 🚨
transactions SUCCES total     : 5  (sur 14 lignes total)
transactions EN_ATTENTE       : 9
```

### Sitemap

```
URLs déclarées : 40
URLs potentielles à 6 mois (avec pages programmatiques) : ~5 000
```

### Indicateurs code source

```
Fichiers app/: 124 dossiers
Fichiers components/: 42 fichiers
Fichiers lib/: 28 fichiers
Routes API: 53
Pages: 39
Migrations Supabase: 9

Tests : 0
Sentry : non configuré

`as any` / `: any` occurrences : 189
console.error occurrences : 61
console.log occurrences : 30
```

---

## B. Bugs / dette repérés (fichier:ligne)

| # | Sévérité | Localisation | Description |
|---|---|---|---|
| 1 | 🚨 sec | [`.env.local.example:4`](../.env.local.example) | Clé `service_role` Supabase commit dans repo public |
| 2 | 🚨 sec | [`supabase/migrations/`](../supabase/migrations/) (default `role`) | Default `role = '''ADMIN''::text'::text` cassé |
| 3 | 🚨 sec | [`app/api/paiement/webhook/route.ts:11`](../app/api/paiement/webhook/route.ts) | Pas de vérif HMAC ni idempotence webhook CinetPay |
| 4 | 🚨 fonc | DB cron_logs | `pmu-sync` 38/39 échecs sur 14 j |
| 5 | 🚨 fonc | DB cron_logs | `pmu-demain` 14/15 échecs |
| 6 | 🚨 fonc | DB cron_logs | `pronostic-gratuit` 0 exec (13 SKIP) |
| 7 | 🚨 fonc | DB cron_logs | `ia-auto-publish` 0 exec (12 SKIP) |
| 8 | 🚨 SEO | [`app/(public)/courses/[id]/page.tsx:45`](../app/(public)/courses/[id]/page.tsx#L45) | `noindex` sur 1 824 fiches courses |
| 9 | 🚨 perf | toutes pages | `Cache-Control: no-store` partout (pas de cache edge) |
| 10 | ⚠️ sec | RLS `pronostics` | Policy avec valeurs obsolètes `PREMIUM`/`VIP` |
| 11 | ⚠️ sec | [`middleware.ts:44`](../middleware.ts#L44) | Vérif `/admin` ne contrôle pas le rôle ADMIN |
| 12 | ⚠️ data | DB courses | 14/745 (1,9 %) courses des 14j ont une arrivée |
| 13 | ⚠️ data | DB tables | `chevaux`, `jockeys`, `entraineurs` vides (schémas créés) |
| 14 | ⚠️ SEO | [`app/sitemap.ts:36`](../app/sitemap.ts#L36) | `.limit(50)` arbitraire sur pronostics, pas de courses dans sitemap |
| 15 | ⚠️ tech | repo | 189 occurrences `: any` ou `as any` |
| 16 | ⚠️ tech | repo | 0 tests |
| 17 | ⚠️ tech | repo | Pas de Sentry / observabilité |
| 18 | ⚠️ perf | [`app/(public)/courses/page.tsx`](../app/(public)/courses/page.tsx) | Pas de pagination, 538 KB HTML |
| 19 | ⚠️ perf | toutes pages | 88 `<img>` sur `/courses` au lieu de `next/image` |
| 20 | ⚠️ tech | [`vercel.json`](../vercel.json) | 27 crons Vercel mais site sur Cloudflare (dette double déploiement) |
| 21 | ⚠️ tech | [`next.config.js`](../next.config.js) | `images.domains` deprecated (warning au build) |
| 22 | ℹ️ SEO | toutes pages | Pas de hreflang |
| 23 | ℹ️ SEO | `/courses/[id]` | URL UUID au lieu de slug |
| 24 | ℹ️ UX | site | Pas de bandeau cookies (RGPD) |
| 25 | ℹ️ UX | site | Pas de bandeau jeu responsable |
| 26 | ℹ️ légal | repo | CGU/Privacy en `noindex` (OK) mais à vérifier contenu |

---

## C. PRs prêtes à ouvrir (titre + description courte)

### PR « security/rotate-supabase-service-role » 🚨 P0

**Titre** : `chore(security): redact service_role key from .env.local.example + add gitleaks pre-commit`

**Description** :
- Remplace la clé service_role dans `.env.local.example` par un placeholder.
- Ajoute `husky` + `gitleaks` en pre-commit.
- Ajoute `.gitleaks.toml` pour la config.
- Note dans le README : « Si tu suis ce setup, rotate la clé Supabase avant le premier push ».

**Prérequis manuel** : rotation de la clé dans Supabase Dashboard avant le merge, mise à jour env Cloudflare/Vercel.

---

### PR « fix/cinetpay-webhook-hardening » 🚨 P0

**Titre** : `fix(payments): CinetPay webhook signature + idempotence + structured logging`

**Description** :
- Vérification HMAC SHA-256 sur le body avec `CINETPAY_API_KEY` comme secret.
- Nouvelle table `webhook_events(provider, event_id, processed_at)` avec UNIQUE constraint.
- Si `event_id` existe déjà : retour 200 idempotent.
- Logging structuré (pas de `console.log` brut, vers Sentry).
- Test E2E ajouté avec Playwright + CinetPay sandbox.

---

### PR « feat/seo-courses-indexable » 🚀 ROI ★★★★★

**Titre** : `feat(seo): index race detail pages with slug URLs and SportsEvent schema`

**Description** :
- Retire `robots: { index: false }` de `app/(public)/courses/[id]/page.tsx`.
- Refactor URL : `/courses/[id]` → `/courses/[date]/[hippo-slug]/[ref]`. Garde `[id]` en alias avec 301.
- Ajoute schema `SportsEvent` + `BreadcrumbList`.
- Ajoute les courses des 30j passés + 7j futurs au sitemap.
- Update test E2E.

---

### PR « feat/edge-cache-public-pages » ⭐ quick win

**Titre** : `perf(cache): enable Cloudflare edge cache on public pages`

**Description** :
- Remplace `export const dynamic = "force-dynamic"` par `export const revalidate = 60` sur `/courses`, `/pronostics`, `/blog/*`.
- Ajoute `Cache-Control: public, s-maxage=60, stale-while-revalidate=300` via `next.config.js` `headers()`.
- Garde `no-store` sur `/api/*`, `/admin/*`, `/espace-membre`, `/(auth)/*`.
- Test : vérifier que TTFB devient <100 ms sur 2e visite.

---

### PR « feat/sentry-monitoring » 🛡️ P0

**Titre** : `feat(monitoring): integrate Sentry for Next + Cloudflare Workers + cron alerting`

**Description** :
- `npx @sentry/wizard@latest -i nextjs`.
- Configuration Cloudflare Workers via `@sentry/cloudflare`.
- Wrappe les `catch` des libs critiques (`lib/geny.ts`, `lib/pmu-api.ts`, webhooks).
- Edge Function ou cron Slack : ping si `cron_logs.status='failure'` deux fois consécutivement sur même cron.

---

### PR « feat/seo-programmatic-pages » 🚀 ROI ★★★★

**Titre** : `feat(seo): programmatic pages — programme/quinte-plus/arrivees by date`

**Description** :
- Crée 3 nouvelles routes :
  - `/programme/[date]` : liste courses du jour (template proche de `/courses`).
  - `/quinte-plus/[date]` : focus course Quinté+ avec analyse pronostic.
  - `/arrivees/[date]` : récap arrivées + rapports du jour.
- Ajoute au sitemap (1 095 URLs/an).
- Schema `SportsEvent` + `ItemList`.

---

### PR « fix/profiles-default-role » 🛡️ P1

**Titre** : `fix(db): correct profiles.role default value`

**Description** :
- Migration `ALTER TABLE profiles ALTER COLUMN role SET DEFAULT 'USER';`.
- Migration : remplacer le check par un type ENUM `user_role`.

---

### PR « fix/rls-pronostics-policy » 🛡️ P1

**Titre** : `fix(security): align pronostics RLS policy with current subscription levels`

**Description** :
- DROP / CREATE policy `Premium pronostics for subscribers` avec valeurs `STARTER`, `PRO`, `ELITE`.
- Test SQL : créer 4 utilisateurs (gratuit, starter, pro, elite) + vérifier visibilité de pronostics de chaque niveau.

---

### PR « feat/etl-entites-from-partants » 🚀 ROI ★★★★

**Titre** : `feat(data): cron ETL to populate chevaux/jockeys/entraineurs from partants`

**Description** :
- Nouveau cron `/api/cron/peupler-entites` (quotidien, 3h Paris).
- Upsert depuis `partants` : `nom_cheval` → `chevaux`, `jockey` → `jockeys`, `entraineur` → `entraineurs`.
- Génère slug propre (slugify + dedupe).
- Migration `ALTER TABLE chevaux/jockeys/entraineurs ADD COLUMN slug TEXT UNIQUE`.
- Préparation pour les pages `/chevaux/[slug]` etc. (PR ultérieure).

---

### PR « cleanup/remove-stale-deploy-workflow » (issue précédente)

**Titre** : `chore(ci): remove stale GitHub Actions deploy workflow`

**Description** :
- Supprime `.github/workflows/deploy.yml` (obsolète depuis migration vers Cloudflare Workers Builds).
- Le déploiement est maintenant géré par Cloudflare directement sur push vers main.

---

## D. Comment me redonner du contexte

Si on revient sur l'audit dans une autre session :
- Lire d'abord `audit/README.md`.
- Pour un chantier précis, lire le fichier d'axe correspondant.
- Vérifier l'état actuel des constats : ils ont peut-être bougé. La Roadmap M1 doit être faite avant tout.
- Garde sous le coude : repo public, projet Supabase `cpzjjnmszbyizeqhgrat`, prod Cloudflare `elite-turf.fr`.

## E. Limites de l'audit

- Pas d'accès **Google Search Console / GA4 / Cloudflare Analytics** : les chiffres de trafic et conversions sont des hypothèses raisonnées, pas des mesures.
- **Lighthouse synthétique non mesuré** (quota PSI épuisé) : recommandation de mesurer avec `npx lighthouse https://www.elite-turf.fr/ --view`.
- **Pas de tests utilisateurs** réels : les recommandations UX sont heuristiques.
- **Pas d'audit financier détaillé** (CAC/LTV/churn par cohorte) : à approfondir une fois ≥3 mois de données stables.
- **Concurrents** : analyse rapide via robots.txt et sitemap. Une analyse SimilarWeb détaillée serait plus précise.
