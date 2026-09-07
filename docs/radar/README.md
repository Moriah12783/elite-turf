# Radar Elite Predictive — journal des chantiers (Axes 2 & 3 du Plan Value Radar)

Projet Supabase **Radar** : `kkwfaxxyzttooqhdglgk` (≠ Elite Turf prod `cpzjjnmszbyizeqhgrat`).
Les migrations de ce dossier sont appliquées **à la main** via MCP `apply_migration`
(nom de migration indiqué en tête de fichier) et versionnées ici pour traçabilité.

| Date | Fichier | Migration Supabase | Objet |
|---|---|---|---|
| 07/09/2026 | `migrations/20260907_01_journal_edition_soir.sql` | `journal_edition_soir` | Chantier B — scellé du soir (`journal_predictions.edition`, `fn_journal_seal` à cote résolue) |
| 07/09/2026 | `migrations/20260907_02_journal_value_picks.sql` | `journal_value_picks` | Axe 2 — `journal_value_picks` (INSERT-ONLY), `fn_value_seal`, `v_value_picks_juges`, cron `value-seal`, clé `preregistration_value_picks` |
| 07/09/2026 | `briefs/04-brief-claude-code-tableau-de-bord-calibration.md` (§ Chantier 1) | `calibration_hebdo_fn` | Axe 1 — `fn_calibration_tranches(p_debut, p_fin)` : agrégats seuls (n ≥ 30, plage ≤ 400 j), `grant execute to anon`, appelée en `/rest/v1/rpc` avec la clé **publiable** (aucune clé service ne quitte Supabase) |
| 07/09/2026 | `../../supabase/migrations/20260908_calibration_hebdo.sql` | `calibration_hebdo` (projet **prod** `cpzjjnmszbyizeqhgrat`) | Axe 1 — table write-once du site + amorçage manuel de la semaine 31/08–06/09 (12 lignes, valeurs exactes de la fonction) |
| 07/09/2026 | `turf-engine/radar-turf-engine-verrou-fraicheur.patch` | — (dépôt **Radar Turf Engine**, ex-`turf-engine`) | Chantier A — verrou de fraîcheur + porte de diffusion `can_publish` |

## Invariants vérifiés le 07/09/2026 (avant / après migrations)

- `journal_predictions` : 15 956 lignes, toutes `edition = 'MATIN'` ; `max(id)` = 113 182 ; **inchangé** après migration.
- Réplication du verdict v4_t252 restreinte à `edition = 'MATIN'`, jugées ≤ 06/09, règle stricte « course avec arrivée » : **t = 3,124 · n = 12 342 · gain moyen +0,000705** (identique au verdict).
- `fn_journal_seal()` appelée à 10h20 UTC : 0 insertion (25/25 courses du jour déjà scellées, lundi sans réunion du soir).
- `journal_value_picks` : `has_table_privilege('anon', …, 'insert') = false`, RLS activée, séquence sans droit, vue `security_invoker = on`, job `value-seal` actif (`*/10 * * * *`).

## Consigne auditeur 9h20 (à intégrer dans la tâche planifiée Cowork « Audit quotidien Radar »)

Ajouter au rapport quotidien, **marqué « observation, fenêtre en cours »** :

```sql
-- 1. Couverture du journal de la veille PAR ÉDITION
select jp.edition, count(distinct (jp.num_reunion, jp.num_course)) as courses_scellees
from journal_predictions jp where jp.date_course = current_date - 1 group by 1;
select count(*) as courses_jugees from arrivees where date_course = current_date - 1;

-- 2. Cohérence des lignes SOIR (cote_au_scelle ≈ snapshot contemporain du scellé)
select jp.num_reunion, jp.num_course, jp.num_pmu, jp.cote_au_scelle, jp.scelle_a,
       (select cs.cote from cotes_snapshots cs
         where cs.date_course = jp.date_course and cs.num_reunion = jp.num_reunion
           and cs.num_course = jp.num_course and cs.num_pmu = jp.num_pmu
           and cs.captured_at <= jp.scelle_a order by cs.captured_at desc limit 1) as snapshot_avant_scelle
from journal_predictions jp
where jp.date_course = current_date - 1 and jp.edition = 'SOIR' limit 20;

-- 3. Métrique v4_t252 : TOUJOURS sur edition = 'MATIN' (ne jamais mélanger)

-- 4. Value picks (observation uniquement, échéance ≥ 21 jours ET ≥ 400 jugés par règle)
select regle, count(*) as scelles_veille from journal_value_picks
where date_course = current_date - 1 group by 1;
select regle, count(*) as n, round(100*avg(gagnant),1) as pct_gagnant,
       round(100*avg(gain_cote_finale),1) as roi_finale_pct,
       round((avg(gain_cote_finale)/nullif(stddev_samp(gain_cote_finale)/sqrt(count(*)),0))::numeric,2) as t_finale,
       round(100*avg(gain_cote_t15),1) as roi_t15_pct
from v_value_picks_juges group by regle order by regle;
select count(*) as picks_apres_depart from journal_value_picks where minutes_avant_depart <= 0;   -- attendu 0
select count(*) as snapshots_perimes from journal_value_picks where snapshot_captured_at < scelle_a - interval '15 minutes'; -- attendu 0
select count(*) as steam_hors_r1 from journal_value_picks s where s.regle = 'R1_STEAM'
  and not exists (select 1 from journal_value_picks r where r.regle = 'R1_EV10_C5_20'
    and (r.date_course, r.num_reunion, r.num_course, r.num_pmu) = (s.date_course, s.num_reunion, s.num_course, s.num_pmu)); -- attendu 0
select jobname, status, start_time from cron.job_run_details d join cron.job j using (jobid)
where j.jobname = 'value-seal' and d.start_time > now() - interval '24 hours' and d.status <> 'succeeded';   -- attendu vide

-- 5. Verrou de fraîcheur (Radar Turf Engine, logs GitHub Actions) : compter les GATE_REFUSED
--    avant l'ouverture des cotes, puis vérifier que les verrous suivants portent odds_real = true.
```

Après 4 semaines de lignes `SOIR` : calibration séparée (annoncé / réel par tranche de cote) avant toute utilisation produit.
