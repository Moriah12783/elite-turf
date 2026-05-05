# 08 — Data & IA

## Volumes en DB

```
profiles      : 22
hippodromes   : 106
courses       : 1 824
partants      : 392 (était 278 avant le backfill Geny d'aujourd'hui)
arrivees      : 3
pronostics    : 98
chevaux       : 0
jockeys       : 0
entraineurs   : 0
notifications : 2
leads         : 25
transactions  : 14
abonnements   : 0  (lien transaction→abonnement pas matérialisé)
cron_logs     : 287
ingestion_events: 19
```

## 🚨 Trous massifs dans les données

### 1. `arrivees` quasi vide

**3 lignes** seulement dans la table `arrivees`. Or il y a 1 824 courses, dont une grosse partie devrait être TERMINE avec arrivée connue.

Cron `geny-arrivees` tourne 7×/jour mais probablement n'écrit pas dans la table `arrivees` ; il écrit dans `courses.arrivee_officielle` (array d'int) directement.

**État réel** :
```sql
SELECT COUNT(*) FROM courses WHERE arrivee_officielle IS NOT NULL AND date_course >= CURRENT_DATE - INTERVAL '14 days';
-- → 14 sur 728 courses sur 14 jours
```

Donc 98 % des courses des 14 derniers jours **n'ont pas d'arrivée connue**. Énorme trou. Cause probable : le cron `geny-arrivees` parse la page Geny mais la structure HTML a aussi changé (comme on l'a vu pour les partants).

**Action** :
- Audit du parser dans [`lib/sync/geny-arrivees.ts`](../lib/sync/geny-arrivees.ts) — probablement obsolète comme l'était [`lib/geny.ts`](../lib/geny.ts).
- Backfill one-shot : script qui re-scrape les arrivées sur les 30 derniers jours.
- Alerting : si `arrivees_aujourdhui_attendues - arrivees_aujourdhui_reelles > 5` à 22h Paris → alerte Slack.

### 2. Crons morts

Vu en axe 1 :
- `pmu-sync` : 38/39 échecs (97 %)
- `pmu-demain` : 14/15 échecs (93 %)
- `pronostic-gratuit` : 13/13 SKIP (jamais exécuté)
- `ia-auto-publish` : 12/12 SKIP

Le `pronostic-gratuit` qui ne tourne pas signifie probablement **aucun pronostic gratuit publié quotidiennement**. C'est un anti-SEO et anti-conversion (pas de raison de revenir le lendemain pour les visiteurs gratuits).

**Action** : ouvrir chaque cron, lire les logs, fix.

### 3. Tables `chevaux`, `jockeys`, `entraineurs` vides

Schémas créés en 2026, jamais peuplés. Or les colonnes `partants.jockey`, `partants.entraineur`, `partants.nom_cheval` sont remplies. Il manque juste l'ETL qui dédoublonne et upsert.

C'est aussi un **bloqueur SEO majeur** (cf axe 5 — pages programmatiques `/chevaux/[slug]`, `/jockeys/[slug]`).

**Action** : cron quotidien (6h UTC) qui :
```sql
INSERT INTO jockeys (nom_complet, slug)
SELECT DISTINCT jockey, slugify(jockey) FROM partants WHERE jockey IS NOT NULL
ON CONFLICT (slug) DO NOTHING;
-- idem chevaux, entraineurs
```

## Pronostics IA

Crons `ia-pronostics`, `ia-auto-publish`, `ia-rapport-soir` indiquent un système d'IA qui génère des pronostics.

**Audit du code** : [`app/api/cron/ia-pronostics/route.ts`](../app/api/cron/ia-pronostics/route.ts) (à examiner).

**Questions critiques** :
- Quel modèle ? OpenAI ? Anthropic ?
- Quelles features en input ? (cotes, musique, jockey, etc.)
- Quel ROI réel mesuré sur les pronostics IA vs ceux d'un humain ?
- Transparence : sur les pages pronostic, indique-t-on « pronostic généré par IA » vs « par expert » ?

**Risque éthique/légal** : présenter une IA comme un « expert » est trompeur ; en France et UE, la **loi DSA** et l'AI Act réglementent l'utilisation d'IA dans les contenus à enjeu financier.

**Action** :
- Page `/methodologie` qui explique le mix humain + IA.
- Tag clair sur chaque pronostic : `auteur_id` (humain) vs `source = 'ia-cron'`.
- Tracking ROI séparé : IA vs humain, pour ne pas survendre.

## Performances (page `/performances`)

Code à auditer : [`app/(public)/performances/page.tsx`](../app/(public)/performances/page.tsx). Cette page est cruciale pour la confiance et la conversion.

**Bonnes pratiques attendues** :
- ROI cumulé public et vérifiable (pas que des % marketing).
- Détail par type de pari (Quinté+, Quarté+, Tiercé).
- Détail par mois.
- Possibilité de download CSV (transparence).
- Schema.org `Dataset` (SEO).

## Historique consultable

Quand un utilisateur consulte `/courses/[id]` d'une course passée, la fiche montre-t-elle :
- L'arrivée réelle ?
- Le pronostic Elite Turf qui a été publié ?
- Le ROI réel sur ce pronostic ?

Vu dans le code [`app/(public)/courses/[id]/page.tsx`](../app/(public)/courses/[id]/page.tsx) : oui, partiellement (arrivée officielle affichée). Mais pas de comparaison « ce qu'on disait vs ce qui s'est passé ».

**Action** : ajouter sur les fiches course passées un widget « Notre pronostic vs l'arrivée » :
- ✅ Quinté+ : 12-7-4 — gagné !
- ❌ Notre Tiercé 8-3-9 : raté.

C'est un puissant outil de preuve sociale (un user qui voit qu'on publie nos échecs aussi → confiance).

## Monitoring & alerting

[`lib/cron-logger.ts`](../lib/cron-logger.ts) existe — bon, on log. Mais :
- Pas de dashboard (le `/admin/cron-status` existe mais accessible aux admins seulement).
- Pas d'alerte automatique sur échec.
- Pas de SLA / freshness data declaration (« partants doivent être < 4h vieux »).

**Action** :
- Dashboard public `/admin/health` (ADMIN only) avec :
  - Statut des crons (last_success, last_failure, %success).
  - Freshness data (combien de courses du jour ont des partants ? avec arrivée ? avec pronostic ?).
  - Volumes (nouveaux leads/inscriptions/transactions du jour).
- Alerte Slack/email si :
  - Cron failed 2× consécutifs.
  - Freshness data < threshold (ex : <50 % des courses du jour ont des partants après 10h Paris).

## Backups & disaster recovery

À vérifier :
- Supabase : par défaut backups quotidiens conservés 7 jours (free tier) ou plus (Pro). À confirmer.
- Procédure de restauration testée ? (Probablement non.)

**Action** : tester un restore vers un projet Supabase staging, documenter la procédure dans `docs/runbook-disaster-recovery.md`.

## Recommandations

| # | Reco | Effort | Impact |
|---|---|---|---|
| 1 | Fix parser `geny-arrivees` + backfill 30j | 1 j | ★★★★ data integrity |
| 2 | Fix crons morts (pmu-sync, ia-auto-publish, pronostic-gratuit) | 2 j | ★★★★★ |
| 3 | Cron peuplement chevaux/jockeys/entraineurs | 1 j | ★★★★ (déblocage SEO) |
| 4 | Tag clair IA vs humain sur pronostics | 4 h | ★★ (légal/UX) |
| 5 | Widget « Notre pronostic vs arrivée » fiches course passées | 1 j | ★★★ (preuve sociale + SEO contenu enrichi) |
| 6 | Dashboard `/admin/health` + alerting | 2 j | ★★★★ |
| 7 | SLA freshness data documenté + alertes | 1 j | ★★★ |
| 8 | Page `/methodologie` IA + humain | 1 j | ★★ (E-E-A-T) |
| 9 | Backup restore drill | 4 h | ★★ |
| 10 | Schema `Dataset` sur `/performances` | 4 h | ★★ (SEO) |
