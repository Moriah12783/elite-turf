# 🏇 ELITE TURF — Feuille de Route vers la Référence Mondiale
> Document confidentiel · Mis à jour le 24 mars 2026 · Co-piloté avec Claude AI

---

## 🎯 OBJECTIF FINAL

| Pilier | Cible |
|--------|-------|
| ⚡ Vitesse | Chargement < 2s sur mobile 3G en Côte d'Ivoire |
| ✅ Confiance | Taux de réussite prouvé + témoignages réels avec gains en FCFA |
| 📋 Contenu | Pronostics publiés chaque matin avant 8h00, 7j/7 |
| 💳 Paiement | Mobile Money fluide en < 3 clics — Orange, MTN, Wave |
| 🔍 SEO | 1er sur Google pour "pronostic turf Côte d'Ivoire" |
| 👥 Communauté | Espace membres actif + newsletter hebdomadaire + notifications |

---

## PHASE A — Expérience Visuelle Premium · Semaine 1 ✅ EN COURS

### ✅ Hero Parfait
- Image cheval plein écran, effet parallax au scroll
- Overlay noir 55%, badge animé "Pronostics disponibles"
- Cascade d'animations d'entrée (badge → titre → CTA → stats)

### ✅ Ticker Résultats
- Bandeau doré défilant sous la navbar avec arrivées en temps réel
- R1 Abidjan, R2 Vincennes... pause au survol

### ✅ Pronostic Vedette (Carte VEDETTE DU JOUR)
- Grande carte premium avec badge doré
- Nom cheval, hippodrome, cote, analyse courte, bouton CTA

### ✅ Logo Unifié
- Composant `LogoEliteTurf` partagé (Navbar, Footer, Auth, Admin)
- 🐎 + ELITE/TURF dégradé or sur toutes les pages

---

## PHASE B — Fonctionnalités Cœur de Métier · Semaine 2 ✅ EN COURS

### ✅ Page Pronostics (`/pronostics`) — TERMINÉ
### ✅ Page Courses (`/courses`) — TERMINÉ
### ✅ Page Résultats (`/performances`) — TERMINÉ

### 📋 Courses du Jour (page `/courses`)
- Tableau complet : hippodrome, heure, distance, partants, cotes
- Filtres par hippodrome et type de course (Plat / Trot / Obstacle)
- Données live depuis Supabase (remplacer mock data)

### 📋 Page Pronostics (`/pronostics`)
- Système Gratuit vs Premium bien visible
- Paywall visuel clair avec blur + bouton débloquer
- Filtres par hippodrome, type de pari, date
- Pagination ou infinite scroll

### 📋 Page Résultats (`/performances`)
- Historique des arrivées avec taux de réussite prouvé
- Statistiques par type de pari (Tiercé / Quarté+ / Quinté+)
- Graphique ROI mensuel (Chart.js ou Recharts)
- Export PDF des performances

---

## PHASE C — Conversion & Monétisation · Semaine 3

### 💳 Page Abonnements (`/abonnements`)
- Plans tarifaires : Starter 5 000 XOF / Pro 15 000 XOF / Elite 35 000 XOF
- Intégration CinetPay (Orange Money + MTN MoMo + Wave)
- Tableau comparatif des fonctionnalités par plan
- FAQ paiement Mobile Money intégrée

### 👤 Espace Membre (`/espace-membre`)
- Mon compte : historique pronostics consultés
- Abonnement actif + date d'expiration + renouvellement
- Favoris (courses et chevaux suivis)
- Notifications personnalisées

### ⭐ Témoignages Réels
- Section "Ils ont gagné avec Elite Turf"
- 3+ témoignages avec gains réels en FCFA et photos
- Système de collecte automatique (formulaire post-gain)

---

## PHASE D — Autorité & SEO · Semaine 4

### ✍️ Blog Hippique (`/blog`)
- Articles SEO ciblés Côte d'Ivoire : "pronostic turf Abidjan"
- Actualités courses, guides paris pour débutants
- 2 articles/semaine minimum pour indexation rapide

### 🔍 SEO Technique
- Meta tags dynamiques par page (Next.js `generateMetadata`)
- Sitemap XML auto-généré (`/sitemap.xml`)
- Open Graph optimisé pour partage WhatsApp (image 1200×630)
- Google Business Profile "Pronostics Hippiques Abidjan"
- robots.txt optimisé + Schema.org pour rich snippets

### 🚀 Mise en Ligne Production
- Déploiement Vercel + domaine `eliteturf.ci` ou `eliteturf.com`
- SSL automatique Vercel
- Optimisation images (next/image + WebP)
- Score Lighthouse > 90 mobile

---

## PHASE E — Croissance & Expansion · Mois 2
> *Suggestions Claude AI — à valider*

### 📱 Application Mobile Native
- React Native (Expo) — code partagé avec le web
- Push notifications iOS/Android (pronostic du matin à 7h30)
- Mode hors-ligne pour consultation sans data
- Deep links depuis WhatsApp

### 🌍 Expansion Géographique
- Couverture Sénégal (Dakar), Mali (Bamako), Burkina Faso, Cameroun
- Pages SEO locales par pays : "pronostic turf Dakar"
- Partenariats avec bookmakers locaux
- Multi-devise : XOF / XAF / GNF

### 📊 Données & Analytics
- Dashboard admin avec métriques temps réel (users actifs, revenus, taux conversion)
- A/B testing sur les pages de conversion
- Heatmaps (Hotjar) pour optimiser l'UX
- Funnel d'analyse : visiteur → inscrit → abonné payant

---

## PHASE F — Intelligence & Automatisation · Mois 3
> *Suggestions Claude AI — à valider*

### 🤖 Scraping & API Temps Réel
- Make.com + Apify : scraping PMU/PMH chaque matin automatique
- Import automatique courses + cotes + partants dans Supabase
- Alertes si scraping échoue (notification admin WhatsApp)
- Backup API secondaire (zeturf.fr, equidia.fr)

### 🧠 Algorithme de Scoring
- Score automatique par cheval (forme récente, jockey, terrain, distance)
- Suggestion IA de sélection basée sur historique 5 ans
- Indicateur de valeur : cote bookmaker vs probabilité réelle
- "Confiance" algorithmique visible sur chaque pronostic

### 🔔 Notifications Intelligentes
- Email automatique : pronostic du jour à 7h00 (Mailchimp/Resend)
- WhatsApp Business API : message direct aux abonnés actifs
- SMS via Africa's Talking pour zones à faible internet
- Rappel 30min avant chaque course avec pronostic

---

## PHASE G — Communauté & Fidélisation · Mois 4
> *Suggestions Claude AI — à valider*

### 👥 Espace Communautaire
- Forum turfistes (discussions par course, tips entre membres)
- Classement mensuel des meilleurs pronostiqueurs membres
- Badges et récompenses (niveau Bronze → Or → Platine)
- Système de parrainage : 1 filleul = 1 mois offert

### 📬 Marketing Automatisé
- Newsletter hebdomadaire "Le Bilan Elite Turf" (résultats semaine)
- Séquence email onboarding : J0 → J3 → J7 → J14 → J30
- Campagnes SMS pour les grands rendez-vous (Prix de l'Arc, etc.)
- Retargeting Facebook/Instagram pour visiteurs non-convertis

### 🏆 Programme de Fidélité
- Points Elite pour chaque mois d'abonnement
- Réductions progressives (6 mois = -10%, 12 mois = -20%)
- Accès VIP : appel hebdomadaire avec l'expert hippique
- Goodies Elite Turf pour top abonnés (casquette, polo)

---

## PHASE H — Référence Mondiale · Mois 5-6
> *Suggestions Claude AI — vision long terme*

### 🌐 Plateforme Multi-Pays
- Interface en Anglais pour diaspora UK/USA/Canada
- Couverture hippodromes : Angleterre, UAE, Australie, Hong Kong
- Partenariats officiels avec hippodromes africains
- Présence presse : Africa24, RFI, médias hippiques

### 🔗 API & Partenariats
- API Elite Turf publique (pour partenaires revendeurs)
- Intégration dans apps de paris légales en Côte d'Ivoire
- White-label pour autres marchés (Ghana, Nigeria)
- Affiliation avec PMU France et bookmakers légaux

### 📜 Légitimité & Autorité
- Enregistrement officiel ARJEL/ARCEP équivalent CI
- Certifications : taux de réussite audité par tiers indépendant
- Page "Qui sommes-nous" avec photos équipe + parcours
- Mentions presse et témoignages de personnalités hippiques

---

## 📊 KPIs de Succès par Phase

| Phase | KPI Principal | Cible |
|-------|--------------|-------|
| A | Score Lighthouse Mobile | > 85 |
| B | Taux inscription visiteur | > 8% |
| C | Taux conversion gratuit → payant | > 15% |
| D | Position Google "pronostic turf CI" | Top 3 |
| E | Téléchargements app mobile | 1 000+ |
| F | Taux d'ouverture notifications | > 40% |
| G | NPS (Net Promoter Score) | > 60 |
| H | Revenus mensuels récurrents | > 500K XOF |

---

## 🛠️ Stack Technique Actuelle

```
Frontend    Next.js 14 (App Router) + TypeScript + Tailwind CSS
Backend     Supabase (PostgreSQL + Auth + RLS + Storage)
Déploiement Vercel (subdomain → eliteturf.ci)
Paiements   CinetPay (Orange Money + MTN MoMo + Wave)
Scraping    Make.com + Apify (Phase F)
Email       Resend (Phase F)
Analytics   Vercel Analytics + Hotjar (Phase E)
Mobile      React Native / Expo (Phase E)
```

---

## ✅ Avancement Global

- [x] **PHASE A** — Expérience visuelle (Hero parallax, Ticker, Vedette, Logo unifié)
- [ ] **PHASE B** — Fonctionnalités cœur (Courses live, Pronostics, Résultats)
- [ ] **PHASE C** — Monétisation (CinetPay, Espace membre, Témoignages)
- [ ] **PHASE D** — SEO & Mise en ligne production
- [ ] **PHASE E** — App mobile + expansion géographique
- [ ] **PHASE F** — IA + Scraping automatisé
- [ ] **PHASE G** — Communauté + Marketing automation
- [ ] **PHASE H** — Référence mondiale

---

*Elite Turf — Document confidentiel — Co-piloté avec Claude AI*
*"La passion du turf, l'excellence du pronostic"*
