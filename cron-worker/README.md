# Elite Turf — Cron Worker

Worker Cloudflare dédié aux **Cron Triggers natifs** d'Elite Turf.

## 🎯 Pourquoi un worker séparé ?

L'app principale (`elite-turf`) est générée par OpenNext qui ne supporte pas
nativement le `scheduled()` event handler. Plutôt que de modifier l'output
OpenNext (fragile, regénéré à chaque build), on a un mini-Worker dédié qui :

1. Reçoit les Cron Triggers Cloudflare configurés dans `wrangler.toml`
2. Lookup le path API correspondant via `CRON_MAP`
3. Fait un HTTP fetch vers l'app principale avec `Authorization: Bearer <CRON_SECRET>`
4. Log le résultat (success / error / duration) dans Cloudflare Logs

## 📜 Avant / Après

| Avant (vercel.json) | Après (Cron Worker Cloudflare) |
|---|---|
| Définition crons dans `vercel.json` | Définition dans `cron-worker/wrangler.toml` |
| **Cloudflare ignore vercel.json** → crons KO | **Cron Triggers natifs Cloudflare** → 99.9% SLA |
| Aucun log centralisé | **Cloudflare Dashboard → Logs** par cron |
| Pas d'alerte d'échec | Alertes par email + Slack possibles |

## 🚀 Déploiement (à faire UNE FOIS)

### 1. Set le secret CRON_SECRET

Le secret partagé entre le cron worker et les routes `/api/cron/*` de l'app
principale. Il doit être **identique** à celui utilisé par l'app.

```bash
# À la racine du repo
npx wrangler secret put CRON_SECRET --config cron-worker/wrangler.toml
```

Wrangler te demandera de coller la valeur du secret. Récupère-la depuis :
- Cloudflare Dashboard → Workers & Pages → `elite-turf-production` → Settings → Variables
- Ou depuis `.env.local` si tu l'as gardé en local

### 2. Deploy le worker

```bash
npx wrangler deploy --config cron-worker/wrangler.toml
```

Premier deploy : Cloudflare crée le worker `elite-turf-crons` et active les
32 cron triggers automatiquement.

### 3. Vérifier

- Cloudflare Dashboard → Workers & Pages → `elite-turf-crons`
- Onglet **Triggers** : tu dois voir les 32 cron schedules listés
- Onglet **Logs** : après quelques minutes, tu verras les premiers
  `[cron OK]` apparaître

## 🔧 Mise à jour des schedules

Pour ajouter / modifier / retirer un cron :

1. **Édite `wrangler.toml`** : ajoute/retire dans `[triggers].crons`
2. **Édite `src/index.ts`** : ajoute/retire dans `CRON_MAP`
3. **Re-deploy** :
   ```bash
   npx wrangler deploy --config cron-worker/wrangler.toml
   ```

⚠️ Les deux fichiers DOIVENT rester synchronisés. Un cron déclaré dans
`wrangler.toml` mais absent de `CRON_MAP` produira un log d'erreur
`Pattern inconnu`.

## 🧪 Tester manuellement un cron

Le worker expose aussi un handler HTTP pour debug. Auth via le même
`CRON_SECRET`.

```bash
# Récupère l'URL du cron worker (visible dans le dashboard, ex: elite-turf-crons.tonsubdomain.workers.dev)
curl -H "Authorization: Bearer $CRON_SECRET" \
  "https://elite-turf-crons.<subdomain>.workers.dev/?path=/api/cron/geny-arrivees"
```

Réponse :
```json
{
  "ok": true,
  "status": 200,
  "duration": 1234
}
```

## 📋 Liste des 32 crons migrés

| Schedule | Endpoint | Description |
|---|---|---|
| `45 5 * * *` | `/api/cron/ia-pronostics` | Génération IA pronostics nuit |
| `0 7 * * *` | `/api/cron/ia-auto-publish` | Publication IA matin |
| `0 19 * * *` | `/api/cron/ia-rapport-soir` | Rapport IA soir |
| `45 9 * * *` | `/api/cron/pronostic-gratuit` | Pronostic gratuit du jour |
| `41 7` + `37 11` | `/api/cron/lonaci-sync` | Sync programme LONACI (CI) |
| `27 9` + `47 11` + `13 13` + `13 15` | `/api/cron/enrichir-partants` | Enrichissement partants |
| `43 17 * * *` | `/api/cron/pmu-demain` | Programme du lendemain |
| `11 13-19 * * *` (×7) | `/api/cron/geny-arrivees` | Sync arrivées toutes les heures |
| `23 6` + `17 19/20/21/22 * * *` | `/api/admin/sync-resultats` | Sync résultats post-courses |
| `37 20 * * *` | `/api/admin/rapport-journalier` | Rapport journalier soir |
| `7 1 * * *` | `/api/cron/expire-abonnements` | Expiration abonnements nuit |
| `13 9 * * *` | `/api/cron/rappel-expiration` | Rappel expiration matin |
| `*/15 * * * *` | `/api/cron/paystack-recovery` | Recovery Paystack stuck |
| `*/30 * * * *` | `/api/cron/health-alerter` | Health check |
| `45 3 * * *` | `/api/cron/seo-etl` | SEO ETL nuit |
| `23 * * * *` | `/api/cron/welcome-emails` | Welcome emails horaires |
| `0 6` + `0 17 * * *` | `/api/cron/daily-push` | Push notifications |

## 🗑️ Cleanup vercel.json

Une fois le cron worker validé en prod (~24h après deploy, vérifie que
tous les crons ont bien tourné dans les Logs), tu peux supprimer la
section `crons` de `vercel.json`. Garder les `headers` qui restent utiles
pour la conformité Vercel-style même si on ne déploie plus dessus.

## 💰 Coût

- Cloudflare Workers Paid plan ($5/mois) : déjà actif
- Cron Triggers : **gratuit** jusqu'à 100/worker (on en a 32, OK)
- Logs : inclus dans le plan Paid

## 🆘 Debug si un cron ne tourne pas

1. Cloudflare Dashboard → `elite-turf-crons` → Triggers : vérifier que
   le cron est listé et "Active"
2. Dashboard → Logs : chercher le pattern dans les logs récents
3. Test manuel via l'endpoint HTTP (cf. ci-dessus)
4. Vérifier que `CRON_SECRET` est correctement set :
   ```bash
   npx wrangler secret list --config cron-worker/wrangler.toml
   ```
