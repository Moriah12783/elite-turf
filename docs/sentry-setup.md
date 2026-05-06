# Sentry Setup — elite-turf.fr

Configuration Sentry pour error tracking + performance monitoring sur le site.

## 1. Créer le projet Sentry

1. Va sur https://sentry.io → Projects → Create Project
2. Platform : **Next.js**
3. Project name : `elite-turf`
4. Team : ta team par défaut
5. Cliquer **Create Project**

Sentry te donne :
- **DSN** : `https://abc...@o123.ingest.sentry.io/456` (public, OK à embarquer en build)
- **ORG slug** : `tsalach-ventures` ou similaire (visible dans l'URL Sentry)
- **PROJECT slug** : `elite-turf`

## 2. Créer un Auth Token (pour upload sourcemaps en build)

1. Sentry → Settings → Auth Tokens → **Create New Token**
2. Permissions à cocher :
   - `project:releases` (création de releases + upload sourcemaps)
   - `org:read`
3. Copier le token (visible 1 seule fois) → **gardé secret**

## 3. Ajouter les variables Cloudflare Workers

⚠️ Cloudflare a **3 endroits différents** pour les variables. Pour Sentry il faut les mettre dans **les 2** :

### A. Build variables and secrets (build-time, embedded dans le bundle)

Dashboard Cloudflare → Workers & Pages → ton projet → Settings → **Build variables and secrets**

| Nom | Valeur | Type |
|---|---|---|
| `NEXT_PUBLIC_SENTRY_DSN` | `https://abc...@o123.ingest.sentry.io/456` | Variable |
| `SENTRY_DSN` | identique au DSN ci-dessus | Variable |
| `SENTRY_ORG` | `tsalach-ventures` | Variable |
| `SENTRY_PROJECT` | `elite-turf` | Variable |
| `SENTRY_AUTH_TOKEN` | `sntryu_...` | **Secret** |

### B. Variables and secrets (runtime, accessible aux Workers)

Dashboard Cloudflare → Workers & Pages → ton projet → Settings → **Variables and secrets**

| Nom | Valeur | Type |
|---|---|---|
| `NEXT_PUBLIC_SENTRY_DSN` | identique | Variable |
| `SENTRY_DSN` | identique | Variable |

> **Pourquoi double** : `NEXT_PUBLIC_SENTRY_DSN` doit être en **build-time** pour être embarqué dans le bundle JS client. `SENTRY_DSN` doit être en **runtime** pour le serveur. On met les deux dans les deux sections par sécurité.

### C. Re-déclencher un build

Une fois les variables ajoutées, fais un push commit trivial (genre modifier `next.config.js` build-trigger timestamp) pour que Cloudflare re-build avec les nouvelles vars.

## 4. Vérifier que ça marche

### Test client (browser)

1. Ouvre https://www.elite-turf.fr en navigateur
2. F12 → Console → exécute :
   ```js
   throw new Error("Test Sentry client " + Date.now());
   ```
3. Va sur sentry.io → ton projet → Issues
4. L'erreur doit apparaître dans les ~30 secondes

### Test serveur (RSC)

1. Visite une route inexistante du genre `/api/test-sentry-fail`
2. Ou attends qu'une vraie erreur prod arrive (le cron `health-alerter` les remonte aussi)

## 5. Désactiver temporairement

Pour couper Sentry sans désinstaller :
- Dashboard Cloudflare → Build variables → **supprimer** `NEXT_PUBLIC_SENTRY_DSN` + `SENTRY_DSN`
- Re-build

Le code détecte l'absence de DSN et no-op silencieusement (aucune erreur, aucun coût).

## 6. Free tier limites (Sentry Developer plan)

- 5 000 erreurs/mois
- 10 000 transactions/mois
- 1 utilisateur

Pour elite-turf au démarrage c'est largement suffisant. À surveiller via Sentry → Stats.

## 7. Architecture du logger

Le logger custom (`lib/observability/logger.ts`) délègue maintenant à 3 destinations :

```
logger.error(scope, err, ctx)
  ├── console.error structuré → Cloudflare Workers Observability
  ├── Sentry.captureException → sentry.io (rich tracking)
  └── Slack webhook → SLACK_WEBHOOK_ALERTES (alerte humaine)
```

Si Sentry n'est pas configuré, captureException no-op silencieusement. Pas de breaking change.
