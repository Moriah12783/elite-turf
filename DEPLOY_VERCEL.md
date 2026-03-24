# 🚀 D3 — Déploiement Vercel · Elite Turf

Guide complet pas à pas pour mettre en production sur **eliteturf.fr**.

---

## 0. Pré-requis

| Outil | Commande de vérification |
|-------|--------------------------|
| Node.js ≥ 18 | `node -v` |
| Git initialisé | `git status` |
| Compte Vercel | https://vercel.com/signup |
| Vercel CLI | `npm i -g vercel` |

---

## 1. Générer l'image Open Graph

```bash
# Installer la dépendance (une seule fois)
npm install canvas

# Générer public/og-image.jpg (1200×630)
node scripts/generate-og-image.js

# Vérifier
ls public/og-image.jpg
```

> **Alternative sans canvas** : Utilise Figma/Canva pour créer une image 1200×630px
> avec le fond `#0D0D14` et le texte doré `#C9A84C`, puis exporte en JPEG sous `public/og-image.jpg`.

---

## 2. Dernier build local de validation

```bash
cd C:\Users\HP\elite-turf

# Nettoyer le cache
rmdir /s /q .next

# Build de production
npm run build
```

✅ Le build doit se terminer sans erreur. Toutes les routes doivent apparaître.

---

## 3. Pousser le code sur GitHub

```bash
# Si pas encore de dépôt distant
git remote add origin https://github.com/TON_USERNAME/elite-turf.git

# Commit + push
git add -A
git commit -m "feat: Phase D complete — blog, SEO, sandbox paiement, espace membre"
git push -u origin main
```

---

## 4. Déployer sur Vercel

### Option A — Via CLI (recommandé)

```bash
# Connexion Vercel
vercel login

# Premier déploiement (depuis le dossier du projet)
cd C:\Users\HP\elite-turf
vercel

# Répondre aux questions :
# ? Set up and deploy "elite-turf"? → Y
# ? Which scope? → (ton compte)
# ? Link to existing project? → N
# ? Project name? → elite-turf
# ? In which directory is your code located? → ./
# ? Want to modify settings? → N

# Déploiement de production
vercel --prod
```

### Option B — Via interface web

1. Aller sur https://vercel.com/new
2. **Import Git Repository** → connecter GitHub → sélectionner `elite-turf`
3. Framework Preset : **Next.js** (auto-détecté)
4. Build Command : `npm run build` (par défaut)
5. Output Directory : `.next` (par défaut)
6. ⚠️ **Ne pas encore cliquer Deploy** → aller à l'étape 5 (variables d'env) d'abord

---

## 5. Variables d'environnement Vercel

Dans le dashboard Vercel → **Settings → Environment Variables**, ajouter **chaque variable** :

### 🔵 Supabase

| Variable | Valeur | Env |
|----------|--------|-----|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://cpzjjnmszbyizeqhgrat.supabase.co` | All |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | *(clé anon de ton projet Supabase)* | All |
| `SUPABASE_SERVICE_ROLE_KEY` | *(clé service_role — JAMAIS exposée côté client)* | All |

### 💳 CinetPay (Mobile Money)

| Variable | Valeur | Env |
|----------|--------|-----|
| `CINETPAY_API_KEY` | *(clé API CinetPay production)* | Production |
| `CINETPAY_SITE_ID` | *(Site ID CinetPay production)* | Production |

> En Preview/Development, laisser vide → mode sandbox automatique.

### 💬 WhatsApp & Contact

| Variable | Valeur | Env |
|----------|--------|-----|
| `NEXT_PUBLIC_WHATSAPP` | `+33XXXXXXXXX` | All |

### 📧 Resend (emails transactionnels)

| Variable | Valeur | Env |
|----------|--------|-----|
| `RESEND_API_KEY` | *(clé Resend)* | All |

### 🔔 OneSignal (push notifications — optionnel)

| Variable | Valeur | Env |
|----------|--------|-----|
| `NEXT_PUBLIC_ONESIGNAL_APP_ID` | *(App ID OneSignal)* | All |
| `ONESIGNAL_REST_API_KEY` | *(REST API Key OneSignal)* | All |

### 🌐 App URL (CRITIQUE)

| Variable | Valeur | Env |
|----------|--------|-----|
| `NEXT_PUBLIC_APP_URL` | `https://eliteturf.fr` | Production |
| `NEXT_PUBLIC_APP_URL` | `https://elite-turf-git-main-TON_USERNAME.vercel.app` | Preview |
| `NEXT_PUBLIC_APP_NAME` | `Elite Turf` | All |

> ⚠️ `NEXT_PUBLIC_APP_URL` est utilisé pour : sitemap.xml, robots.txt, Open Graph, CinetPay return URLs.
> En production il DOIT être `https://eliteturf.fr` (sans slash final).

---

## 6. Configuration du domaine eliteturf.fr

### Dans Vercel Dashboard → Settings → Domains

```
Ajouter : eliteturf.fr
Ajouter : www.eliteturf.fr
```

### Dans le panneau DNS de ton registrar (OVH / Gandi / Namecheap…)

| Type | Nom | Valeur |
|------|-----|--------|
| `A` | `@` | `76.76.21.21` |
| `CNAME` | `www` | `cname.vercel-dns.com` |

> Propagation DNS : 15 min à 48h selon le registrar.
> Vercel génère le SSL/TLS Let's Encrypt automatiquement.

### Vérification

```bash
# Tester la résolution DNS (après propagation)
nslookup eliteturf.fr
# Doit retourner : 76.76.21.21

# Vérifier le certificat SSL
curl -I https://eliteturf.fr
# HTTP/2 200 ✅
```

---

## 7. Configuration Supabase pour la production

### Auth → URL Configuration

Dans **Supabase Dashboard → Authentication → URL Configuration** :

```
Site URL :          https://eliteturf.fr
Redirect URLs :     https://eliteturf.fr/**
                    https://www.eliteturf.fr/**
```

### CORS / RLS

Vérifier que les Row Level Security policies sont bien actives sur toutes les tables :
- `pronostics` : lecture publique pour les gratuits, service_role pour les payants
- `abonnements` : lecture par user_id uniquement
- `profiles` : lecture/écriture par owner uniquement

---

## 8. Webhook CinetPay en production

Dans le **Dashboard CinetPay** → Paramètres → Webhooks :

```
URL de notification : https://eliteturf.fr/api/paiement/webhook
URL de retour       : https://eliteturf.fr/paiement/succes
URL d'annulation    : https://eliteturf.fr/paiement/echec
```

---

## 9. Redéploiement avec les bonnes variables

Après avoir ajouté toutes les variables d'env :

```bash
# Forcer un redéploiement de production
vercel --prod

# OU depuis le dashboard : Deployments → ⋮ → Redeploy
```

---

## 10. Checklist post-déploiement ✅

### Fonctionnel

- [ ] Page d'accueil charge sans erreur (https://eliteturf.fr)
- [ ] HTTPS vert (SSL Let's Encrypt valide)
- [ ] Inscription / Connexion fonctionnelle (Supabase auth)
- [ ] Affichage des pronostics (liste publique)
- [ ] Page `/abonnements` : prix EUR affichés correctement
- [ ] Bouton de paiement → redirige vers CinetPay (mode production)
- [ ] Webhook CinetPay → abonnement activé après paiement test
- [ ] Page `/espace-membre` : protégée (redirect si non connecté)
- [ ] Ticker bar : courses PMU françaises
- [ ] Footer : adresse Paris + numéro WhatsApp

### SEO

- [ ] https://eliteturf.fr/sitemap.xml → liste les pages
- [ ] https://eliteturf.fr/robots.txt → contenu correct
- [ ] Balises Open Graph (vérifier avec https://opengraph.xyz)
- [ ] Twitter Card (vérifier avec https://cards-dev.twitter.com/validator)
- [ ] Image OG visible : `public/og-image.jpg` chargée

### Blog

- [ ] https://eliteturf.fr/blog → liste des 4 articles
- [ ] https://eliteturf.fr/blog/[slug] → article complet avec sidebar

### Performance

- [ ] Lighthouse score ≥ 90 (Performance, SEO, Best Practices)
  ```bash
  npx lighthouse https://eliteturf.fr --output html --output-path ./lighthouse-report.html
  ```
- [ ] Core Web Vitals dans Vercel Analytics (activer dans Dashboard → Analytics)

---

## 11. Commandes utiles post-déploiement

```bash
# Voir les logs en temps réel
vercel logs --follow

# Lister les déploiements
vercel ls

# Inspecter un déploiement spécifique
vercel inspect [deployment-url]

# Variables d'env actuelles sur Vercel
vercel env ls

# Promouvoir un déploiement Preview en Production
vercel promote [deployment-url]

# Rollback vers le déploiement précédent
vercel rollback
```

---

## 12. CI/CD automatique (bonus)

Une fois le repo GitHub connecté à Vercel :

- Chaque **push sur `main`** → déploiement en **production** automatique
- Chaque **pull request** → déploiement **Preview** avec URL unique

Pour protéger `main` et exiger un build réussi :

```
GitHub → Settings → Branches → Branch protection rules :
✅ Require status checks to pass (Vercel)
✅ Require pull request reviews
```

---

## 📞 Support

| Service | Lien |
|---------|------|
| Vercel Status | https://www.vercel-status.com |
| Supabase Status | https://status.supabase.com |
| CinetPay Docs | https://docs.cinetpay.com |
| Next.js Docs | https://nextjs.org/docs |

---

*Elite Turf · 75008 Paris, France · contact@eliteturf.fr*
