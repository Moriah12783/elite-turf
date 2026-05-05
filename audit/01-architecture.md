# 01 — Architecture & code

## Stack actuelle (état des lieux)

| Couche | Tech | Note |
|---|---|---|
| Framework | Next.js 14.2.5 (App Router) | OK, mais 14.2.5 a une [vulnérabilité de sécurité](https://nextjs.org/blog/security-update-2025-12-11) — bumper en 14.2.x patché |
| Runtime prod | Cloudflare Workers via OpenNext 1.14 | OK depuis fix infra de la PR #1 |
| Auth + DB | Supabase (Postgres + RLS + auth-js) | OK |
| Email | Resend | OK |
| Paiement | Stripe + CinetPay (mobile money CI) | Stripe OK, CinetPay défaillant (cf. axe 4) |
| Notifications push | OneSignal | OK |
| Analytics | Vercel Analytics + Speed Insights + GTM + Microsoft Clarity | Trop d'outils, choix à clarifier |
| Crons | Vercel Cron (27 jobs) | Vercel reste branché en // de Cloudflare (dette : double déploiement) |
| Tests | **0** | 🚨 critique |
| Observabilité | **Aucune** (pas de Sentry/Logflare/etc.) | 🚨 critique |

## Découpage du repo

```
app/
  (admin)/        → 18 pages admin
  (auth)/         → connexion, inscription, mot-de-passe
  (public)/       → 17 pages publiques
  api/            → 53 routes API (53 fichiers route.ts)
components/       → 42 fichiers
lib/              → 28 fichiers (geny, pmu, lonaci, supabase, email, ingest, sync...)
supabase/migrations/ → 9 migrations
workers/pmu-proxy/ → Cloudflare Worker bypass IP PMU
scripts/          → 3 scripts utilitaires
```

**Bilan** : structure propre, claire. Bonne séparation `(admin)` / `(auth)` / `(public)`. Le `lib/` a des libs métier bien isolées (geny, pmu, lonaci). RAS sur le découpage.

## Constats critiques

### 1. Type safety dégradée — 189 occurrences `any`

```bash
grep -rE "as any|: any" --include="*.ts" --include="*.tsx" app/ lib/ components/ | wc -l
# → 189
```

**Risque** : runtime crashes silencieux, refactor difficile, IntelliSense cassé. Vu en exemple : [`app/(public)/courses/[id]/page.tsx:92`](../app/(public)/courses/[id]/page.tsx#L92) `const c = course as any;` puis `c.partants`, `c.hippodrome` traités comme `any`. Un changement de schéma DB ne pète aucune erreur de compilation.

**Action** : générer les types Supabase et les utiliser partout :
```bash
npx supabase gen types typescript --project-id cpzjjnmszbyizeqhgrat > types/supabase.ts
```
Puis remplacer `any` par les types générés. Estimer 1–2 jours pour purger les ~50 spots les plus critiques.

### 2. Aucun test (zéro)

```bash
find . -name "*.test.*" -o -name "*.spec.*" | grep -v node_modules
# → vide
```

**Risque** : la fix Geny qu'on a faite aurait pu casser le rendu des courses TROT (structure différente du HTML) sans qu'on s'en aperçoive avant prod. Aucun test = peur de refactor, dette qui grossit, régressions.

**Action minimale** :
- **Vitest** + 5–10 tests sur les libs critiques : `lib/geny.ts` (parser), `lib/pmu-api.ts`, `lib/promo.ts`, `lib/sync/*`.
- **Playwright** + 3 tests E2E : signup → paiement sandbox → accès pronostic premium.
- CI : run sur GitHub Actions à chaque PR.
- Effort initial : 2 jours. Maintenance : ~30 min par PR.

### 3. Observabilité absente

```bash
grep -lE "@sentry|Sentry\." lib/ app/ components/
# → vide
```

61 `console.error` répartis dans le code. Sur Cloudflare Workers, ces logs partent dans `wrangler tail` mais pas archivés. Le bug Geny qu'on a fix est resté caché parce que personne ne lit les logs.

**Action** :
- `npm install @sentry/nextjs` + `npx @sentry/wizard@latest -i nextjs` (≤1 h).
- Configurer Sentry pour Cloudflare Workers ([guide officiel](https://docs.sentry.io/platforms/javascript/guides/cloudflare/)).
- Ajouter `Sentry.captureException` dans tous les `catch` des libs et webhooks.
- Edge function de monitoring sur `cron_logs.status = 'failure'` → notification Slack/email.

### 4. Dette : double déploiement Vercel + Cloudflare

[`vercel.json`](../vercel.json) contient 27 cron jobs. Le site live est sur Cloudflare. Donc :
- Soit Vercel est encore déployé en parallèle (= double maintenance, double secrets, possibles incohérences).
- Soit les crons Vercel ne tournent plus (= 27 jobs morts, mais c'est invisible).

**Action** : décision binaire :
1. **Migrer les crons sur Cloudflare Cron Triggers** (propre, mais plus complexe : [`wrangler.toml`](../wrangler.toml) + Worker dédié).
2. **Garder Vercel uniquement pour les crons** (web sur Cloudflare). Documenter clairement ce setup hybride.

Recommandation : option 2 court terme (1 h), option 1 dans 3 mois quand le projet sera stabilisé.

### 5. Webhooks : pas d'idempotence

[`app/api/paiement/webhook/route.ts`](../app/api/paiement/webhook/route.ts) — appelé par CinetPay pour notifier paiements. Si CinetPay envoie le webhook 2× (cas standard sur leur infra), la transaction risque d'être traitée 2× → 2 abonnements créés.

**Action** : table `webhook_events(provider, event_id, processed_at)` avec UNIQUE sur `(provider, event_id)` — INSERT en first guard ; si conflict, ignorer.

## Crons : couverture & santé

Données du `cron_logs` sur 14 jours :

| Cron | Total | Succès | Échecs | Skips | Avg ms | Verdict |
|---|---:|---:|---:|---:|---:|---|
| `pmu-sync` | 39 | 1 | **38** | 0 | 8 948 | 🚨 97 % d'échec |
| `pmu-demain` | 15 | 1 | **14** | 0 | 7 496 | 🚨 93 % d'échec |
| `geny-arrivees` | 94 | 86 | 8 | 0 | 10 864 | OK |
| `lonaci-sync` | 30 | 28 | 2 | 0 | 7 320 | OK |
| `ia-pronostics` | 13 | 2 | 1 | 10 | 2 720 | ⚠️ 10 skips suspects |
| `ia-rapport-soir` | 13 | 13 | 0 | 0 | 8 034 | OK |
| `ia-auto-publish` | 12 | 0 | 0 | **12** | 892 | ⚠️ jamais exécuté (skip systématique) |
| `pronostic-gratuit` | 13 | 0 | 0 | **13** | 993 | ⚠️ jamais exécuté |
| `resultats-pronostics` | 57 | 57 | 0 | 0 | 3 467 | OK |

**Action urgente** : enquête sur `pmu-sync`, `pmu-demain`, `ia-auto-publish`, `pronostic-gratuit`. Voir [08 — Data & IA](./08-data-ia.md).

## Recommandations

| # | Reco | Effort | Priorité |
|---|---|---|---|
| 1 | Bumper Next 14.2.5 → 14.2.x patché (CVE) | 2 h | P0 |
| 2 | Setup Sentry + alerting cron_logs | 1 j | P0 |
| 3 | Générer types Supabase, remplacer 50 `any` critiques | 2 j | P1 |
| 4 | Vitest + 10 tests libs + 3 E2E Playwright | 2 j | P1 |
| 5 | Idempotence webhooks (table `webhook_events`) | 4 h | P0 (cf axe 7) |
| 6 | Décider Vercel vs Cloudflare pour crons | 4 h | P2 |
| 7 | Pre-commit `gitleaks` (cf axe 7) | 30 min | P0 |
