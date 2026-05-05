# 06 — Rétention & monétisation

## Snapshot business

```
profiles total                : 22
profiles GRATUIT              : 19 (86 %)
profiles STARTER/PRO/ELITE    : 3 (14 %)
profiles EXPIRE               : 0 (mais pas encore de cohortes assez vieilles)
transactions tentées (30j)    : 9
transactions SUCCES (30j)     : 0
transactions SUCCES total     : 5
```

**Lecture** : business à très petite échelle (~3 abonnés actifs). C'est OK pour un MVP, mais on n'a aucune donnée de churn ni de cohorte.

## Cycle de vie utilisateur — manquants

### Onboarding post-inscription

Aucun onboarding interactif détecté. L'utilisateur s'inscrit, est redirigé vers… `/` probablement. Pas de tour produit, pas de checklist, pas de récompense pour avoir complété son profil.

**Action** :
- Welcome email J0 (déjà recommandé en axe 5).
- Page `/espace-membre` enrichie avec checklist : « Active tes notifs push (+1 mois si tu actives) », « Ajoute ton numéro WhatsApp (notifs critiques) », « Lis ton premier pronostic gratuit ».
- Onboarding modal in-app au premier login.

### Engagement quotidien

Pour un produit pari hippique, l'engagement est par nature quotidien. Mais si l'utilisateur n'a pas une raison de revenir chaque matin, il churn.

**Hooks à mettre en place** :
1. **Push à 7h** : « Ton pronostic Quinté+ du jour est prêt » (PRO/ELITE).
2. **Push à 19h** : « Résultat du Quinté+ : on a touché le 12-7-4. ROI cumulé semaine : +XX % » (tous).
3. **Email récapitulatif hebdomadaire** : « Ta semaine en chiffres : 5 gagnants, ROI +18 % ».

### Gamification & ROI personnel

Aucun tableau de bord utilisateur ne montre :
- Combien il aurait gagné s'il avait suivi tous les pronostics ELITE.
- Son streak (« tu suis Elite Turf depuis 47 jours »).
- Son classement parmi les abonnés.
- Badges (« Premier paiement », « 30 jours d'abonnement », « 100 pronostics suivis »).

**Action** :
- Page `/espace-membre/mon-roi` : graphique cumul gains théoriques semaine/mois/total.
- Sidebar persistante avec « ROI cumulé : +XX € (vs ta mise théorique de YY €) ».
- Système de badges visible sur le profil.

### Lutte contre le churn

Un abonné mensuel à 65 € qui ne se connecte pas pendant 7 jours → 80 % de chance de churn à la fin du mois. Aucun signal détecté pour traiter ce cas.

**Pipeline de win-back** :
- Détection : pas de connexion depuis 7 jours.
- Action : email « On t'a manqué, voici un récap des pronostics que tu as ratés ».
- 14 jours : push + email avec un pronostic ELITE en preview gratuite.
- 21 jours : offre rétention « -30 % sur ton renouvellement ».

## Monétisation — leviers ratés

### Upsell PRO → ELITE

Code montre 3 plans : STARTER, PRO, ELITE.

Pas de mécanisme automatique d'upsell. Si un utilisateur PRO consulte régulièrement les pronostics qu'il ne peut pas voir (ELITE), aucune relance.

**Action** :
- Tracker les **clics sur pronostics ELITE bloqués** par utilisateur PRO.
- Au 5e clic en 7 jours : popup « Tu as essayé d'ouvrir 5 pronostics ELITE cette semaine. Passe en ELITE pour 30 € de plus ».

### Downsell ELITE → PRO

Symétrique : un ELITE qui n'utilise pas les fonctions ELITE pendant 30 jours → proposer un downgrade PRO (25 € de moins) plutôt qu'un churn complet.

### Add-ons / cross-sell

- Vente unitaire « Quinté+ du jour » à 9,90 € pour les non-abonnés (impulse buy).
- Pack week-end (vendredi-samedi-dimanche) à 19 €.
- Coaching personnalisé 1h/mois en visio à 49 € (haute marge, faible volume).

### Remarketing

Aucun pixel Meta visible. GTM en place mais à audit (quels events tracking ?).

## Rétention par contenu

Au-delà des pronostics quotidiens, qu'est-ce qui fait revenir un user ?

**Manquants identifiés** :
- ❌ Communauté / forum / chat (Discord, WhatsApp groupe abonnés).
- ❌ Contenus exclusifs hebdomadaires (interviews, analyses long-format).
- ❌ Replays vidéo des grandes courses.
- ❌ Outils interactifs : simulateur de Quinté+, calculateur de gains, tableau de bord cotes.

## Recommandations

| # | Reco | Effort | Impact rétention/MRR |
|---|---|---|---|
| 1 | Welcome email series J0/J1/J3/J7 | 2 j | +20 % conversion lead→abonné |
| 2 | Push quotidien 7h + 19h pour abonnés | 1 j | +15 % engagement quotidien |
| 3 | Page `/espace-membre/mon-roi` (gamif ROI) | 2 j | +10 % rétention M2 |
| 4 | Pipeline win-back churn (J7/J14/J21) | 1 j | -20 % churn |
| 5 | Auto-upsell PRO → ELITE sur clics bloqués | 1 j | +5–10 % MRR |
| 6 | WhatsApp groupe abonnés ELITE | 4 h | +30 % rétention ELITE |
| 7 | Vente unitaire « Quinté+ du jour » | 2 j | +10 % CA non-abonnés |
| 8 | Système de badges + classement | 3 j | +5 % rétention |
| 9 | Newsletter hebdo « ta semaine en chiffres » | 2 j | +10 % rétention |
| 10 | Communauté Discord (pour passionnés) | 1 sem setup | +retention long terme |
