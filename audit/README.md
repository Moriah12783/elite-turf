# Audit Elite Turf — Synthèse exécutive

**Date** : 2026-05-05
**Auditeur** : architecte logiciel + dev senior + growth marketer
**Périmètre** : elite-turf.fr (production Cloudflare Workers + Supabase)
**Repo** : [Moriah12783/elite-turf](https://github.com/Moriah12783/elite-turf) (public)

---

## Notes par axe (/10)

| # | Axe | Note | Justification courte |
|---|-----|:----:|----------------------|
| 1 | Architecture & code | **5** | Stack moderne mais 0 test, 189 `any`, observabilité absente, dette UX/admin |
| 2 | Performance & Core Web Vitals | **4** | TTFB 1,5–2,2 s sur pages clés, **aucun cache edge** (`no-store` partout), HTML 538 KB sur `/courses` |
| 3 | SEO technique & content | **3** | **40 URLs sitemap pour 1 824 courses**, `noindex` sur fiches courses, 0 schema SportsEvent, pas de hreflang |
| 4 | UX & conversion | **5** | Funnel propre côté UI mais **0 transactions PAYÉES sur les 30 derniers jours**, 9 EN_ATTENTE non récupérées |
| 5 | Acquisition / growth | **3** | Aucune page programmatique (chevaux/jockeys/hippodromes), 7 articles blog, 0 viralité, 25 leads/30 j |
| 6 | Rétention & monétisation | **3** | 3 abonnés actifs sur 22 inscrits, pas de séquence onboarding ni rétention |
| 7 | Sécurité & conformité | **2** | 🚨 **Clé `service_role` Supabase commit dans repo public**, RLS pronostics buggée, default `role = 'ADMIN'` cassé, webhook CinetPay sans HMAC |
| 8 | Data & IA | **4** | Cron `pmu-sync` 97 % d'échec, 14/728 courses avec arrivée, pronostics IA présents mais opacité |
| 9 | Différenciation concurrentielle | **5** | Positionnement Afrique francophone fort (atout réel), exécution éditoriale et data trop faible vs Geny/Zone-Turf |

**Note moyenne pondérée** : **3,8 / 10** — l'application existe, déploie, fonctionne — mais elle n'a aucune des fondations d'un leader (sécurité, SEO programmatique, fiabilité data, conversion).

---

## 🚨 3 chantiers CRITIQUES (priorité absolue, à faire cette semaine)

### 1. Rotation immédiate de la clé Supabase `service_role`
- **Constat** : la clé service_role réelle est dans [`.env.local.example`](../.env.local.example) (ligne 4), repo **public**, JWT décodée confirme `role: service_role`, projet `cpzjjnmszbyizeqhgrat`. Visible par n'importe quel visiteur GitHub.
- **Risque** : lecture/modification/suppression totale de la base (profils, transactions, leads, pronostics premium) — c'est l'équivalent du root SQL.
- **Action** :
  1. Supabase Dashboard → API → **Reset service_role key** (génère nouvelle clé).
  2. Mettre à jour la nouvelle clé dans Cloudflare Workers (Settings → Variables) **et** Vercel (env vars) **et** `.env.local` local.
  3. Remplacer la valeur dans `.env.local.example` par un placeholder `<your-service-role-key>`.
  4. (Optionnel) Réécrire l'historique git pour purger l'ancienne clé : `git filter-repo --replace-text` ou BFG Repo-Cleaner.
  5. Ajouter `gitleaks` ou `trufflehog` en pre-commit hook pour empêcher la récidive.
- **Effort** : 1–2 h. **Impact** : évite incident sécurité catastrophique.

### 2. Réparer le funnel de paiement (0 € encaissés en 30 jours)
- **Constat** : `transactions` table montre 9 EN_ATTENTE et 0 SUCCES sur les 30 derniers jours. Le webhook CinetPay ([`app/api/paiement/webhook/route.ts`](../app/api/paiement/webhook/route.ts)) ne vérifie pas la signature et n'a pas d'idempotence ; les paiements lancés ne se finalisent pas.
- **Risque** : zéro chiffre d'affaires malgré le trafic et les leads. Toute action growth est inutile tant que la conversion ne marche pas.
- **Action** :
  1. Tester end-to-end un paiement CinetPay sandbox + Stripe sandbox sur staging.
  2. Logger les webhooks reçus dans une table `webhook_events` (debug + idempotence).
  3. Vérifier la signature CinetPay (HMAC sur `cpm_trans_id` + `apikey`) — voir doc CinetPay.
  4. Reprocesser les 9 EN_ATTENTE manuellement si c'étaient de vrais paiements perdus.
- **Effort** : 1 jour. **Impact** : déblocage du business.

### 3. Réparer le pipeline data (cron `pmu-sync` 97 % d'échec, 14/728 courses avec arrivée)
- **Constat** : sur 14 jours, [`cron_logs`](#) montre `pmu-sync` 38 échecs / 39 exécutions ; seules 14 courses sur 728 ont une `arrivee_officielle`. Le bug Geny qu'on vient de fixer illustre le manque d'observabilité — il n'aurait jamais été détecté sans un user qui se plaint.
- **Risque** : site qui affiche des données obsolètes ou vides → perte de confiance, taux de rebond élevé, pénalité SEO (contenu pauvre).
- **Action** :
  1. Setup **Sentry** (ou Logflare/Axiom) sur Cloudflare Workers — 1 h max via `@sentry/nextjs`.
  2. Ajouter alertes Slack sur `cron_logs.status = 'failure'` (Edge Function ou cron qui watch).
  3. Diagnostiquer pmu-sync (probablement le même rate-limit 420 que pour partants). Migrer vers Geny scraping en source primaire.
  4. Backfiller les arrivées manquantes (script one-shot Geny scraping sur les 14 derniers jours).
- **Effort** : 2–3 jours. **Impact** : data fiable + alertes pour ne plus être aveugle.

---

## ⚡ 3 quick wins (≤1 jour chacun, ROI immédiat)

### A. Indexer les fiches course (gain SEO ~50–100 K visites/mois à 6 mois)
- **Constat** : [`app/(public)/courses/[id]/page.tsx:45`](../app/(public)/courses/[id]/page.tsx#L45) force `robots: { index: false }` — perte de **1 824 pages** longues-traînées (« quinté+ R2C3 Vincennes 2026-05-05 »).
- **Action** : retirer `noindex`, ajouter schema `SportsEvent` + `BreadcrumbList`, ajouter ces URLs au sitemap (par tranches de date).
- **Effort** : 4 h. **Impact** : 1 824 nouvelles URLs indexables × ~50 visites/mois en cible = potentiel 50–100 K visites/mois (réf : Geny.com et concurrents).

### B. Activer le cache edge Cloudflare sur pages publiques
- **Constat** : `Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate` sur **toutes** les pages publiques. Aucun bénéfice du CDN Cloudflare. Chaque visite frappe le Worker.
- **Action** : sur `/`, `/courses`, `/pronostics`, `/blog`, `/blog/[slug]` → `Cache-Control: public, s-maxage=60, stale-while-revalidate=300`. Garder `no-store` uniquement sur `/api/*` et pages auth/admin/membre.
- **Effort** : 2 h (modifier `vercel.json` et/ou ajouter `headers()` dans Next config).
- **Impact** : TTFB qui passe de 1,5 s à <100 ms en cache hit. Tient une charge 100× plus grande sans cost increase.

### C. Sitemap programmatique (×40 URLs immédiatement)
- **Constat** : [`app/sitemap.ts`](../app/sitemap.ts) limite à 50 pronostics + ne contient pas du tout les courses ni les hippodromes. Sitemap actuel : **40 URLs**.
- **Action** : générer dans le sitemap toutes les courses des **30 derniers + 7 prochains jours** (730 URLs), tous les hippodromes (106 URLs), tous les pronostics publiés (98 URLs). Les pages dérivées (chevaux, jockeys) viendront plus tard.
- **Effort** : 3 h. **Impact** : 900+ URLs déclarées à Google immédiatement (vs 40 actuellement).

---

## Plan global — sommaire

- [01 — Architecture & code](./01-architecture.md)
- [02 — Performance & Core Web Vitals](./02-performance.md)
- [03 — SEO technique & content](./03-seo.md)
- [04 — UX & conversion (CRO)](./04-ux-conversion.md)
- [05 — Acquisition / growth / trafic](./05-acquisition.md)
- [06 — Rétention & monétisation](./06-retention.md)
- [07 — Sécurité, conformité, légal](./07-securite-conformite.md)
- [08 — Data & IA](./08-data-ia.md)
- [09 — Différenciation concurrentielle](./09-differenciation.md)
- [Roadmap 3 mois (sprints de 2 semaines)](./roadmap.md)
- [Top 10 chantiers trafic chiffrés](./top-10-trafic.md)
- [Annexes : métriques, bugs, PRs prêtes](./annexes.md)

---

## Ce qui n'a PAS été audité

- **Données réelles GSC / GA4 / Cloudflare Analytics** : pas d'accès → recommandations basées sur l'analyse heuristique et benchmark concurrent. Si tu fournis ces données, le **Top 10 trafic** peut être chiffré beaucoup plus précisément.
- **Lighthouse synthétique précis (LCP/CLS/INP)** : quota PageSpeed Insights API épuisé pendant l'audit → mesures basiques (TTFB, taille HTML) seulement. Tu peux mesurer en local avec `npx lighthouse https://www.elite-turf.fr/ --view`.
- **Tests utilisateurs** : aucun (à ce stade c'est OK ; à prévoir après le Top 10).
- **Audit financier précis** (CAC, LTV, marges) : nécessite accès Stripe/CinetPay.
