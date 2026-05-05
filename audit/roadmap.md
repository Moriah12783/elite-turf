# Roadmap 3 mois — sprints de 2 semaines

**Hypothèses** : 1 dev senior fullstack à 100 %, 1 designer/marketer à 50 %, ~10 j ouvrés/sprint.
**Légende** : 🚨 critique · ⭐ quick win · 🚀 levier trafic majeur · 🛡️ sécurité/fiabilité

---

## Sprint 1 — Fondations sécurité & fiabilité (semaines 1-2)

**Objectif** : éteindre les incendies. Aucune nouvelle fonctionnalité, juste rendre le site sain.

| Tâche | Effort | Owner | Dépendances |
|---|---|---|---|
| 🚨 Rotation `service_role` Supabase + redaction `.env.local.example` | 0,5 j | dev | — |
| 🚨 Pre-commit `gitleaks` + scan repo complet | 0,5 j | dev | — |
| 🚨 Webhook CinetPay : HMAC + idempotence + table `webhook_events` | 1 j | dev | — |
| 🚨 Test end-to-end paiement CinetPay sandbox + Stripe sandbox | 0,5 j | dev | webhook fix |
| 🚨 Reprocesser les 9 transactions EN_ATTENTE manuellement | 0,5 j | dev + ops | webhook fix |
| 🛡️ Sentry setup (Next + Cloudflare Workers) | 1 j | dev | — |
| 🛡️ Alerting cron_logs (echec 2× consec → Slack/email) | 0,5 j | dev | Sentry |
| 🛡️ Fix default `role = 'USER'` dans `profiles` | 0,25 j | dev | — |
| 🛡️ Refaire RLS pronostics avec valeurs ELITE/PRO/STARTER | 0,5 j | dev | — |
| 🛡️ Vérification rôle ADMIN dans middleware | 0,25 j | dev | — |
| 🛡️ Bumper Next 14.2.5 → 14.2.x patché (CVE) | 0,25 j | dev | — |
| ⭐ Activer cache edge sur pages publiques (`s-maxage=60`) | 0,25 j | dev | — |
| 🛡️ Audit cron `geny-arrivees` + fix parser + backfill 30j | 1 j | dev | — |
| 🛡️ Audit cron `pmu-sync`/`pmu-demain` (97% échec) + fix | 1 j | dev | — |
| 🛡️ Documentation `docs/runbook.md` (rotation, déploiement, alertes) | 0,5 j | dev | — |
| **Buffer** | 1,5 j | | |

**Livrables fin sprint 1** :
- Aucune clé exposée publiquement.
- Funnel paiement testé et fonctionnel end-to-end.
- Sentry actif avec premiers événements remontés.
- Cache edge activé → TTFB <100 ms.
- Crons critiques tous green ou alertes actives.

---

## Sprint 2 — Quick wins SEO + UX conversion (semaines 3-4)

**Objectif** : récupérer les 1 824 courses dans Google + améliorer la conversion.

| Tâche | Effort | Owner | Dépendances |
|---|---|---|---|
| 🚀 Retirer `noindex` fiches course + ajout schema `SportsEvent` | 0,5 j | dev | — |
| 🚀 URL slugifiées pour `/courses/[date]/[hippo]/[ref]` (vs UUID) | 1 j | dev | — |
| 🚀 Sitemap programmatique (courses 30j passées + 7j futures + hippodromes) | 1 j | dev | — |
| 🚀 Soumettre nouveau sitemap à Search Console | 0,1 j | marketer | — |
| 🚀 Pages `/programme/[date]` et `/quinte-plus/[date]` et `/arrivees/[date]` | 2 j | dev | — |
| ⭐ Cron peuplement `chevaux`, `jockeys`, `entraineurs` depuis `partants` | 1 j | dev | — |
| 🚀 Pages `/hippodromes/[slug]` (106 URLs immédiates) | 1 j | dev | — |
| 🚀 Pages `/jockeys/[slug]` et `/chevaux/[slug]` (template) | 2 j | dev | cron peuplement |
| ⭐ Welcome email series J0 / J1 / J3 / J7 | 1,5 j | dev + marketer | — |
| ⭐ Page checkout dédiée par plan (vs `/abonnements`) | 1 j | dev + designer | — |
| ⭐ Trial 7 jours gratuit sur PRO | 1 j | dev | webhook ok |
| ⭐ Push « ton pronostic Quinté+ du jour est prêt » à 7h | 0,5 j | dev | OneSignal |

**Livrables fin sprint 2** :
- Sitemap : 40 → ≥1 000 URLs.
- Toutes les fiches course indexables avec schema riche.
- Funnel conversion premium amélioré (trial + checkout dédié).
- Welcome series déployée.

---

## Sprint 3 — Croissance organique + rétention (semaines 5-6)

**Objectif** : remplir le top of funnel par contenu, fidéliser les abonnés.

| Tâche | Effort | Owner | Dépendances |
|---|---|---|---|
| 🚀 Sitemap-news.xml + Google News submission | 0,5 j | dev | — |
| 🚀 Page `/methodologie` (E-E-A-T) | 0,5 j | marketer | — |
| 🚀 Page `/equipe` ou `/auteurs` avec photos + CV signés | 1 j | marketer + designer | — |
| 🚀 Schema `Person` lié aux articles + `dateModified` | 0,5 j | dev | — |
| 🚀 Lancement YouTube : 1 vidéo/jour pronostic Quinté+ | 1 j/sem | marketer | — |
| 🚀 Lancement WhatsApp Channel + bot d'alerte pronostic | 1 j | dev + marketer | — |
| ⭐ Page `/espace-membre/mon-roi` (gamif ROI) | 1,5 j | dev + designer | — |
| ⭐ Pipeline win-back churn (J7 / J14 / J21) | 1 j | dev | Sentry pour tracker |
| ⭐ Auto-upsell PRO → ELITE sur clics bloqués | 1 j | dev | — |
| 🛡️ Vitest + 10 tests sur libs critiques (geny, pmu, sync) | 2 j | dev | — |
| 🛡️ Playwright + 3 tests E2E (signup, paiement, paywall) | 1 j | dev | — |
| 🛡️ CI GitHub Actions tests + lint sur PR | 0,5 j | dev | — |

**Livrables fin sprint 3** :
- 1ère croissance trafic mesurable (>5 K vis/mois target).
- Tests automatisés actifs.
- YouTube et WhatsApp Channel running.

---

## Sprint 4 — Différenciation Afrique (semaines 7-8)

**Objectif** : poser le positionnement géographique unique.

| Tâche | Effort | Owner |
|---|---|---|
| 🚀 Pages `/cote-d-ivoire`, `/senegal`, `/mali`, `/cameroun` (contenu localisé) | 3 j | marketer + dev |
| 🚀 Tarification XOF/XAF native (3 000 / 5 000 / 10 000 FCFA) | 1 j | dev |
| 🚀 Programme parrainage MVP (code par user, +1 mois si filleul abonne) | 2 j | dev |
| 🚀 Bouton sticky WhatsApp Direct Chat | 0,5 j | dev |
| ⭐ Notifications push résultat 19h (« on a touché le 4-9-12 ») | 0,5 j | dev |
| ⭐ Hero : ROI cumulé live (depuis `pronostics.gains_theoriques`) | 1 j | dev |
| 🛡️ Bannière cookies + footer jeu responsable | 0,5 j | dev + legal |
| 🛡️ Page `/jeu-responsable` indexable | 0,5 j | marketer |
| 🛡️ Mécanisme droit à l'oubli (RGPD) dans `/espace-membre` | 1 j | dev |

---

## Sprint 5 — Outils interactifs viraux (semaines 9-10)

**Objectif** : créer des outils partageables qui amènent du trafic organique long terme.

| Tâche | Effort | Owner |
|---|---|---|
| 🚀 Pari builder interactif (cf [09 — différenciation](./09-differenciation.md) point D) | 4 j | dev + designer |
| 🚀 Simulateur Quinté+ : « combien tu aurais gagné si... » | 2 j | dev |
| 🚀 Calculateur de gains (input cotes + mise → rapport) | 1 j | dev |
| ⭐ Widget « Notre pronostic vs arrivée » fiches course passées | 1 j | dev |
| ⭐ Vente unitaire « Quinté+ du jour » à 9,90 € | 2 j | dev + marketer |
| ⭐ Communauté Discord ELITE (lancement) | 1 j | marketer |

---

## Sprint 6 — Acquisition payante & partenariats (semaines 11-12)

**Objectif** : accélérer la croissance avec ads et partnerships une fois les fondations stables.

| Tâche | Effort | Owner |
|---|---|---|
| 🚀 Google Ads search CI/Sénégal/Cameroun (budget 500 €/mois MVP) | 1 sem setup | marketer |
| 🚀 Meta Ads retargeting leads + lookalike | 1 sem setup | marketer |
| 🚀 Recherche/contact 5 influenceurs YouTube turf (sponsoring) | running | marketer |
| 🚀 Approche partenariat LONACI / médias CI | running | marketer + dirigeant |
| ⭐ Newsletter hebdomadaire « ta semaine en chiffres » | 1 j | dev + marketer |
| ⭐ Système de badges + classement utilisateurs | 2 j | dev + designer |
| ⭐ Audit CAC/LTV/marges après 3 mois de data | 1 j | dirigeant |

---

## KPIs à tracker à chaque fin de sprint

| KPI | Mesure | Objectif M3 |
|---|---|---|
| Vis. organiques / mois | GA4 | 10 000 |
| Pages indexées | Search Console | 5 000+ |
| Position moyenne « pronostic Quinté+ » | GSC | <15 |
| Leads / mois | DB `leads` | 200 |
| Inscriptions / mois | DB `profiles` (delta) | 100 |
| Tx conversion lead → abonné | calcul | ≥10 % |
| Abonnés actifs | DB `profiles` filtré | 30 |
| MRR | DB `transactions` SUCCES × prix plan | 1 800 € |
| Churn rate mensuel | calcul | <15 % |
| TTFB médian pages publiques | Cloudflare Analytics | <300 ms |
| Cron success rate | DB `cron_logs` | >95 % |
| % courses du jour avec partants à 12h Paris | DB requête | >90 % |
| Sentry errors / 1 K requests | Sentry | <1 |
