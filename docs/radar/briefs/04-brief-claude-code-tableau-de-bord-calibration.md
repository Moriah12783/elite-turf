# Brief Claude Code — Tableau de bord de calibration hebdomadaire (Axe 1 du Plan Value Radar)

**Deux dépôts, un seul flux de données** : Radar (Supabase `kkwfaxxyzttooqhdglgk`, journal scellé) → site elite-turf.fr (Supabase prod `cpzjjnmszbyizeqhgrat`, page publique). Aucun accès public au projet Radar : le site ne lit que des **agrégats**, copiés chez lui, write-once.

**Contexte gelé** : verdict du 07/09 « signal maintenu » (t = 3,124, n = 12 342, `edition = 'MATIN'`). L'article publié annonce ce tableau de bord « dès sa mise en ligne » : c'est la pièce manquante de l'Axe 1 (vendre la preuve, pas les paris). Aucun chiffre marketing, aucune promesse de ROI : uniquement probabilité annoncée / réalité / marché, par tranche de cote, sur la semaine écoulée et depuis le début du journal.

## Règles absolues

1. **Aucune lecture publique des lignes du projet Radar.** RLS deny-all y reste en place (0 policy). La seule porte est une fonction `security definer` qui ne renvoie que des agrégats (jamais une ligne de partant), exposée par `grant execute … to anon` et appelée en `POST /rest/v1/rpc/fn_calibration_tranches` avec la **clé publiable** du projet Radar. **Correction de sécurité (Steph, 07/09) : aucune clé service (`service_role`) du laboratoire ne quitte Supabase**, ni en secret Cloudflare ni dans le dépôt : une clé service donnerait au site un accès total au journal. La clé publiable est publique par conception ; ce qu'elle autorise est borné par la fonction (agrégats, ≥ 30 partants par tranche, plage de dates bornée).
2. **Écriture write-once côté site** : une ligne par (semaine ISO, tranche, périmètre), jamais réécrite. Une semaine publiée reste telle quelle, bonne ou mauvaise.
3. **Édition `MATIN` uniquement** (règle de la clé `preregistration_v4_t252_note_edition_soir`). Le périmètre `SOIR` n'entre pas dans le tableau avant sa calibration séparée (≥ 4 semaines).
4. **Jamais de fetch client** pour la page : SSR + prop, repli chiffré depuis la dernière semaine disponible (règle 3 du CLAUDE.md). Aucune valeur inventée : si aucune ligne, la page dit « en cours de constitution » avec la date du prochain calcul.
5. Paiement et pipeline de pronostics intouchés.

## Définitions (figées dans la fonction)

- **Partant jugé** : ligne `journal_predictions` (`modele = 'v4-labels'`, `edition = 'MATIN'`) dont la course a une ligne `arrivees`.
- **Semaine ISO** : `date_trunc('week', date_course)` (lundi → dimanche), semaine complète uniquement : calcul le **lundi 09h40 UTC** pour la semaine précédente (après `capture-arrivees-veille` 08h30 et l'auditeur 09h20).
- **Tranches de cote** (sur `cote_au_scelle`) : `<2`, `2-3`, `3-5`, `5-10`, `10-20`, `20+` — les mêmes que le protocole de validation Phase 1.
- Par tranche : `n`, `annonce_pct` = 100·moy(p_win), `reel_pct` = 100·moy(y), `marche_pct` = 100·moy(p_mkt) avec `p_mkt = coalesce(p_market, 1/cote_au_scelle)`, `gain_brier` = moy((y−p_mkt)² − (y−p_win)²).
- Deux périmètres par calcul : `SEMAINE` (la semaine écoulée) et `CUMUL` (depuis le 22/07, jusqu'au dimanche inclus). Le cumul est **re-scellé chaque semaine** comme nouvelle ligne (clé = semaine), jamais mis à jour.

### Valeurs de référence (cumul au 07/09/2026, calculées sur la base réelle)

| tranche | n | annoncé % | réel % | marché % | gain Brier |
|---|---:|---:|---:|---:|---:|
| <2 | 179 | 46,8 | 46,4 | 53,1 | +0,002263 |
| 2-3 | 383 | 32,1 | 29,0 | 34,4 | +0,000003 |
| 3-5 | 979 | 21,4 | 21,0 | 21,7 | +0,000768 |
| 5-10 | 2 743 | 12,1 | 13,4 | 11,7 | +0,001689 |
| 10-20 | 3 942 | 6,4 | 6,2 | 6,3 | +0,000475 |
| 20+ | 4 116 | 2,7 | 2,5 | 2,6 | +0,000252 |

La première ligne `CUMUL` produite doit redonner ces valeurs (à la marge des courses jugées entre-temps).

## Chantier 1 — Radar : fonction d'agrégation (migration `calibration_hebdo_fn`)

```sql
create or replace function public.fn_calibration_tranches(p_debut date, p_fin date)
returns table (tranche text, n bigint, annonce_pct numeric, reel_pct numeric, marche_pct numeric, gain_brier numeric)
language sql security definer set search_path to 'public' stable as $$
  with j as (
    select jp.p_win, jp.cote_au_scelle,
           case when pa.ordre_arrivee = 1 then 1 else 0 end as y,
           coalesce(jp.p_market, 1/nullif(jp.cote_au_scelle,0)) as p_mkt
    from journal_predictions jp
    join participants pa using (date_course, num_reunion, num_course, num_pmu)
    where jp.modele = 'v4-labels' and jp.edition = 'MATIN'
      and jp.date_course between p_debut and p_fin
      and exists (select 1 from arrivees a where a.date_course = jp.date_course
                  and a.num_reunion = jp.num_reunion and a.num_course = jp.num_course)
  )
  select case when cote_au_scelle < 2 then '<2' when cote_au_scelle < 3 then '2-3' when cote_au_scelle < 5 then '3-5'
              when cote_au_scelle < 10 then '5-10' when cote_au_scelle < 20 then '10-20' else '20+' end,
         count(*), round(100*avg(p_win),1), round(100*avg(y),1), round(100*avg(p_mkt),1),
         round(avg((y-p_mkt)^2 - (y-p_win)^2)::numeric, 6)
  from j group by 1 order by 1;
$$;
revoke execute on function public.fn_calibration_tranches(date, date) from public, authenticated;
grant execute on function public.fn_calibration_tranches(date, date) to anon;
-- Appel : POST {RADAR_URL}/rest/v1/rpc/fn_calibration_tranches avec apikey = clé PUBLIABLE du projet Radar.
-- Garde-fous dans la fonction : plage ≤ 400 jours, tranche renvoyée seulement si n ≥ 30 (aucune ré-identification possible).
```

Aucune table, aucune policy, aucun droit `anon`. Test : `select * from fn_calibration_tranches('2026-07-22', '2026-09-06')` redonne le tableau de référence.

## Chantier 2 — Site : table write-once (migration `supabase/migrations/20260908_calibration_hebdo.sql`, appliquée à la main)

```sql
create table if not exists public.calibration_hebdo (
  id             uuid primary key default gen_random_uuid(),
  semaine        date not null,                       -- lundi ISO de la semaine mesurée
  perimetre      text not null check (perimetre in ('SEMAINE','CUMUL')),
  tranche        text not null,
  n              integer not null,
  annonce_pct    numeric not null,
  reel_pct       numeric not null,
  marche_pct     numeric not null,
  gain_brier     numeric not null,
  modele         text not null default 'v4-labels',
  edition        text not null default 'MATIN',
  source_projet  text not null default 'kkwfaxxyzttooqhdglgk',
  calcule_le     timestamptz not null default now(),
  constraint calibration_hebdo_write_once unique (semaine, perimetre, tranche)
);
alter table public.calibration_hebdo enable row level security;   -- deny-all : lecture via service client SSR uniquement
```

## Chantier 3 — Site : cron + page

1. **`lib/calibration/sync-calibration.ts`** : `runCalibrationSync(semaine?)` — calcule le lundi précédent, appelle `fn_calibration_tranches` sur Radar en `fetch` direct sur `/rest/v1/rpc` avec `RADAR_SUPABASE_URL` + `RADAR_SUPABASE_ANON_KEY` (clé publiable, variable non secrète, valeurs par défaut dans le code), deux appels (SEMAINE, CUMUL depuis 2026-07-22), insère avec `ignoreDuplicates: true` (write-once). Retourne `{semaine, inseres, ignores}`. Si Radar renvoie 0 tranche pour SEMAINE → aucune insertion, log `CALIBRATION_VIDE` (pas de ligne fausse).
2. **`app/api/cron/calibration-hebdo/route.ts`** : même gabarit que `seo-etl` (Bearer `CRON_SECRET`, `logCronStart`).
3. **`cron-worker`** : trigger `40 9 * * 1` → `/api/cron/calibration-hebdo` (ajout dans `wrangler.toml` + `CRON_MAP`, redéploiement auto).
4. **`lib/calibration/get-calibration.ts`** : `getCalibration()` (SSR, service client prod) → dernière semaine disponible + cumul associé + liste des semaines publiées ; repli `null` géré par la page (jamais « … »).
5. **Page `app/(public)/calibration/page.tsx`** (`revalidate = 3600`) : titre « Calibration du moteur : annoncé contre réel », méthode en 5 lignes (pré-enregistrement, Brier, édition du matin), tableau semaine + tableau cumul, colonne « écart au marché » signée, bandeau obligatoire : *« Ceci mesure la justesse de nos probabilités face aux cotes du matin, pas un rendement de mise. Le pari mutuel paie aux cotes finales. »* Lien vers l'article du test et `/methodologie`. Historique : sélecteur de semaine en liens statiques (`/calibration?semaine=2026-09-07`), pas de JS de fetch.
6. **Maillage** : lien depuis l'article `test-pre-enregistre-moteur-probabilites-resultat` (remplacer « il sera annoncé ici dès sa mise en ligne » par le lien), depuis `/methodologie` et le footer « Transparence ».
7. **Sitemap** : ajouter `/calibration` dans `app/sitemap.ts`.

## Auditeur

Le lundi, l'auditeur 9h20 rapporte la semaine à sceller ; à 09h40 le cron la scelle ; le mardi, l'auditeur vérifie `calibration_hebdo` (6 tranches × 2 périmètres insérées, `calcule_le` du lundi) et signale toute semaine manquante — **sans jamais recalculer une semaine déjà scellée**.

## Acceptation

- [ ] `fn_calibration_tranches` : aucun droit `anon`/`authenticated` ; `select * from fn_calibration_tranches('2026-07-22','2026-09-06')` = tableau de référence.
- [ ] Première exécution du cron (lundi 14/09 09h40 UTC) : 12 lignes pour `semaine = 2026-09-07` ; seconde exécution forcée → 0 inséré, 12 ignorés.
- [ ] `/calibration` rendue en SSR avec les 12 lignes ; en base vide, message « en cours de constitution » et aucun « … ».
- [ ] Aucune clé service Radar nulle part (`grep -ri service_role lib/calibration` vide) ; seule la clé publiable est utilisée.
- [ ] `tsc` + `build` verts ; vitest sur `lib/calibration/*.test.ts` (calcul de la semaine ISO, write-once, repli vide).
- [ ] Article et méthodologie liés vers `/calibration`.

## Ordre recommandé

1. Chantier 1 (Radar, 5 min, test de la fonction sur le tableau de référence).
2. Chantier 2 + 3 sur une branche du site, gate tsc + build, validation humaine.
3. Aucun secret à poser : URL et clé publiable Radar sont des valeurs publiques, portées par le code avec surcharge possible par variables d'environnement.
4. Premier scellé le lundi 14/09 ; mise à jour de l'article après la première semaine publiée.
