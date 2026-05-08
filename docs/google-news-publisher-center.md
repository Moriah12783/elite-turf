# Soumission Elite Turf à Google News — Guide pas à pas

**Date du guide** : mai 2026
**Contexte** : ce document accompagne la PR `feat/google-news-foundation` qui pose
toute la fondation technique nécessaire (sitemap-news.xml, NewsArticle JSON-LD,
robots.txt, audit policy gambling).

Une fois cette PR mergée et déployée, suivez les étapes ci-dessous pour soumettre
Elite Turf à Google News Publisher Center. **Délai typique de review Google : 2-6
semaines.**

---

## 1. Prérequis (vérifier avant de soumettre)

### a. Côté technique (automatique post-merge)
- [x] HTTPS configuré (déjà en place)
- [x] Sitemap principal accessible : `https://www.elite-turf.fr/sitemap.xml`
- [x] **Sitemap News dédié** : `https://www.elite-turf.fr/sitemap-news.xml` (nouveau)
- [x] **NewsArticle JSON-LD** sur `/arrivees/[date]` et `/quinte-plus/[date]` (nouveau)
- [x] Article JSON-LD sur les pages blog statiques (existant)
- [x] BreadcrumbList JSON-LD partout (existant)
- [x] robots.txt référence les 2 sitemaps (mis à jour)
- [x] Pages cœur (méthodologie, à propos, mentions légales, CGU, confidentialité) accessibles

### b. Côté policy (vérification manuelle annuelle)
- [x] Aucun lien vers opérateur de paris (PMU.fr, Betclic, ZEbet, Unibet…)
- [x] Disclaimer "Jeu Responsable" visible avec numéro Joueurs Info Service
- [x] Aucun bouton "Parier maintenant" / "Misez X€"
- [x] Positionnement éditorial clair : "service d'analyse et de conseil", non opérateur

### c. Côté éditorial
- [ ] Au moins 30 articles publiés (Top semaine, Bilan mensuel, Decouvrir hippodrome,
      blog, arrivées du jour archivées)
- [ ] Au moins **1 nouvel article tous les 1-2 jours** sur la durée (régularité)
- [ ] Auteur identifiable : ajouter une page `/equipe` ou `/auteurs` avec bio
      éditoriale Yapi Landry Stéphane (recommandé pour 2-3 mois de présence avant
      review, pas bloquant)

---

## 2. Création du compte Publisher Center

### 2.1. Aller sur le dashboard
- URL : <https://publishercenter.google.com>
- Connectez-vous avec le compte Google qui possède le site (`contact@elite-turf.fr`
  ou `steph2008.yapi@gmail.com`)

### 2.2. Add publication
Cliquez **+ Add publication**, puis renseignez :

| Champ | Valeur |
|---|---|
| **Publication name** | `Elite Turf` |
| **Primary website URL** | `https://www.elite-turf.fr` |
| **Country/region** | Côte d'Ivoire (ou France selon le pays légal d'enregistrement à terme) |
| **Primary language** | Français |
| **Logo** | Upload `https://www.elite-turf.fr/images/logo.png` (cheval doré sur fond clair, format carré 512×512 minimum) |

### 2.3. Vérification de propriété du domaine
Google demande de vérifier que vous possédez bien `elite-turf.fr` :

**Méthode TXT DNS** (recommandée — propre et permanent) :
1. Google fournit un TXT record du type `google-site-verification=ABC123…`
2. Connectez-vous à votre **registrar DNS** (Cloudflare en l'occurrence)
3. Settings → DNS → Add record → Type **TXT**, Name `@`, Content `<la valeur Google>`
4. Save → attendez 5-10 min → revenez sur Google → cliquez **Verify**

**Méthode meta tag** (plus simple si vous éditez le code) :
1. Google fournit un meta tag `<meta name="google-site-verification" content="…">`
2. Ajoutez-le dans `app/layout.tsx` dans le `<head>` (Next.js Metadata API
   accepte `verification.google: "<le code>"`)
3. Déployez → cliquez **Verify** côté Google

---

## 3. Configuration des Sections

Dans Publisher Center, créez les **sections éditoriales** qui apparaîtront comme
catégories dans Google News :

| Section name | Source URL | Section type |
|---|---|---|
| Quinté+ du jour | `https://www.elite-turf.fr/quinte-plus` | Web feed |
| Programme PMU | `https://www.elite-turf.fr/courses` | Web feed |
| Arrivées et rapports | `https://www.elite-turf.fr/arrivees` | Web feed |
| Bilan mensuel | `https://www.elite-turf.fr/blog?cat=bilan-mensuel` | Web feed |
| Top semaine | `https://www.elite-turf.fr/blog?cat=top-semaine` | Web feed |
| Hippodromes | `https://www.elite-turf.fr/blog?cat=hippodrome` | Web feed |

> **Note** : pour des sections plus précises, on pourra plus tard exposer un fil
> RSS dédié par catégorie. Pour démarrer, le `sitemap-news.xml` central suffit.

---

## 4. Détails additionnels à remplir

### 4.1. Branding
- **Square logo** : `https://www.elite-turf.fr/images/logo.png` (512×512+, fond clair)
- **Rectangular logo** : générer une version 1200×60 du logo + nom (peut être
  fait sous Canva en 5 min)

### 4.2. Contact info
- **Email de contact éditorial** : `contact@elite-turf.fr`
- **Site web** : `https://www.elite-turf.fr`
- **À propos** : `https://www.elite-turf.fr/a-propos`

### 4.3. Distribution
- **Allow Google News to use my content?** → ✅ Yes
- **Discover (Google's personalized feed)?** → ✅ Yes (gros plus pour le trafic mobile Android)

---

## 5. Soumission et review

Cliquez **Submit** en haut à droite de la fiche.

### Status possibles
- **In review** : Google audite (durée typique 2-6 semaines)
- **Approved** : 🎉 Elite Turf apparaît dans Google News + Top Stories carousel
- **Needs work** : Google détaille les ajustements à faire (suivre les liens
  fournis, corriger, re-soumettre)
- **Not approved** : Google rejette pour cause de policy (rare si on a fait
  l'audit gambling correctement)

### Pendant la review
- Continuer de publier des articles régulièrement (Google scrute la fréquence)
- Ne pas modifier majoritairement la fiche pendant la review (ça reset le timer)
- Surveiller `publishercenter.google.com` une fois par semaine pour les questions

---

## 6. Une fois approuvé — bonnes pratiques

### Pour rester dans Google News
1. **Publier 1-2+ articles éditoriaux par jour** (la régularité prime sur le volume)
2. **Maintenir le sitemap-news.xml propre** (uniquement contenu < 48h, articles
   réels)
3. **Mettre à jour `dateModified` quand un article est enrichi** (ex : ajouter
   l'arrivée à un article d'analyse pré-course)
4. **Ne pas dériver vers du gambling promo** (rester éditorial, pas de "joue 10€
   tu gagnes 100€" même implicite)
5. **Ajouter `<author>` avec une vraie personne** dès que possible (Yapi Landry
   Stéphane comme rédacteur en chef)

### Métriques à suivre
- **Search Console** > Performance > **Source** : sélectionner "Google News" pour
  voir le trafic spécifique
- **Plausible / Analytics** : segmenter le trafic par référent
  (`news.google.com`, `news.google.com/topstories`)
- **Discover** : un onglet dédié dans Search Console donne les impressions/clics

### Volume attendu après 4-6 semaines d'indexation
- 100-500 visiteurs/jour additionnels en démarrage
- Pic possible ×3-5 sur jours de grand Quinté+ (dimanche, jours fériés)
- **Asymptote raisonnable** sur 6 mois : 1000-3000 visiteurs/jour via Google News

---

## 7. Ressources officielles

- [Google News Publisher Help](https://support.google.com/news/publisher-center)
- [Article structured data guidelines](https://developers.google.com/search/docs/appearance/structured-data/article)
- [News sitemap protocol](https://developers.google.com/search/docs/crawling-indexing/sitemaps/news-sitemap)
- [Google News content policies](https://support.google.com/news/publisher-center/answer/6204050)

---

## 8. Outil de validation rapide

Une fois la PR mergée, vérifier que tout est correct :

```bash
# Sitemap News valide ?
curl https://www.elite-turf.fr/sitemap-news.xml | head -30

# JSON-LD NewsArticle présent sur arrivées ?
curl -s https://www.elite-turf.fr/arrivees/2026-05-08 \
  | grep -A 5 '"@type":"NewsArticle"' | head -20

# robots.txt référence les 2 sitemaps ?
curl https://www.elite-turf.fr/robots.txt
```

Côté Google, utiliser :
- [Rich Results Test](https://search.google.com/test/rich-results) — pour valider
  les structured data sur une URL donnée
- [URL Inspection](https://search.google.com/search-console) — Search Console,
  pour voir comment Google voit nos pages
