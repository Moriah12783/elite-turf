-- ============================================================================
-- Radar Elite Predictive (Supabase kkwfaxxyzttooqhdglgk) — Axe 2
-- journal_value_picks : picks « value » scellés à ~T-15 avec la cote du moment
-- (INSERT-ONLY), jugés aux cotes finales par jointure (vue), jamais en écrivant
-- le résultat. Règles figées dans fn_value_seal (toute modification = nouvelle
-- regle, jamais une réécriture).
--
-- Écart assumé par rapport au brief (cohérence avec le Chantier B appliqué
-- juste avant) : seules les lignes journal_predictions.edition = 'MATIN'
-- alimentent les picks — le pré-enregistrement parle explicitement de la
-- p_win « scellée à 07h35 » et de la « cote du matin » (règle STEAM) ; les
-- lignes SOIR (scellées ~1-2 h avant départ) n'ont pas cette sémantique et
-- restent hors périmètre jusqu'à leur calibration séparée.
--
-- Idempotente. Appliquée via MCP apply_migration (nom : journal_value_picks).
-- ============================================================================

-- 1. Table INSERT-ONLY
create table if not exists public.journal_value_picks (
  id                   bigserial primary key,
  scelle_a             timestamptz not null default now(),
  date_course          date        not null,
  num_reunion          int         not null,
  num_course           int         not null,
  num_pmu              int         not null,
  nom                  text,
  modele               text        not null,
  regle                text        not null,   -- 'R1_EV10_C5_20' | 'R1_STEAM'
  p_win                numeric     not null,   -- p_win scellée à 07h35 (journal_predictions, edition MATIN)
  cote_scelle_matin    numeric,                -- cote_au_scelle du journal (07h35)
  cote_t15             numeric     not null,   -- dernier snapshot au moment du scellé value
  snapshot_captured_at timestamptz not null,
  minutes_avant_depart numeric,
  ev_t15               numeric     not null,   -- p_win * cote_t15 - 1
  variation_pct        numeric,                -- 100 * (cote_t15 - cote_scelle_matin) / cote_scelle_matin
  constraint journal_value_picks_unique unique (date_course, num_reunion, num_course, num_pmu, regle)
);
comment on table public.journal_value_picks is
  'Picks value scellés à ~T-15 (cote du moment), INSERT-ONLY, jugés aux cotes finales par la vue v_value_picks_juges. Règles figées dans fn_value_seal. Pré-enregistrement : project_memory.preregistration_value_picks.';

alter table public.journal_value_picks enable row level security;
revoke insert, update, delete, truncate, references, trigger on public.journal_value_picks from anon, authenticated;
revoke all on sequence public.journal_value_picks_id_seq from anon, authenticated;
grant select on public.journal_value_picks to anon, authenticated;
create index if not exists journal_value_picks_date_idx on public.journal_value_picks (date_course);

-- 2. Fonction de scellé (fenêtre identique à fn_statut_marche : départ entre now()+8 et now()+23 min)
create or replace function public.fn_value_seal()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare n int := 0; n2 int := 0; v text;
begin
  select version into v from ml_model_weights where id = 1;
  if v is null then raise exception 'Aucun modèle actif'; end if;

  with cibles as (
    select c.date_course, c.num_reunion, c.num_course, c.heure_depart
    from courses c
    where c.date_course = current_date
      and not coalesce(c.annulee, false)
      and coalesce(c.statut, '') not ilike '%ANNUL%'
      and c.heure_depart between now() + interval '8 minutes' and now() + interval '23 minutes'
  ),
  cand as (
    select jp.date_course, jp.num_reunion, jp.num_course, jp.num_pmu, jp.nom,
           jp.p_win, jp.cote_au_scelle, jp.modele, ci.heure_depart
    from journal_predictions jp
    join cibles ci using (date_course, num_reunion, num_course)
    join participants pa using (date_course, num_reunion, num_course, num_pmu)
    where jp.modele = v and jp.p_win is not null and pa.statut = 'PARTANT'
      and jp.edition = 'MATIN'
  ),
  mesure as (
    select cd.*, sn.cote as cote_t15, sn.captured_at as snapshot_captured_at,
           extract(epoch from (cd.heure_depart - sn.captured_at)) / 60.0 as minutes_avant_depart
    from cand cd
    join lateral (
      select cs.cote, cs.captured_at from cotes_snapshots cs
      where cs.date_course = cd.date_course and cs.num_reunion = cd.num_reunion
        and cs.num_course = cd.num_course and cs.num_pmu = cd.num_pmu
        and cs.captured_at >= now() - interval '15 minutes'   -- garde de fraîcheur : pas de cote périmée
      order by cs.captured_at desc limit 1
    ) sn on true
    where sn.cote is not null and sn.cote > 1
  ),
  calc as (
    select m.*, (m.p_win * m.cote_t15 - 1) as ev_t15,
           case when m.cote_au_scelle > 0 then round(100 * (m.cote_t15 - m.cote_au_scelle) / m.cote_au_scelle, 1) end as variation_pct
    from mesure m
  )
  -- Règle 1 : value au moment du scellé, zone jouable 5–20
  insert into journal_value_picks
    (date_course, num_reunion, num_course, num_pmu, nom, modele, regle, p_win,
     cote_scelle_matin, cote_t15, snapshot_captured_at, minutes_avant_depart, ev_t15, variation_pct)
  select date_course, num_reunion, num_course, num_pmu, nom, modele, 'R1_EV10_C5_20', p_win,
         cote_au_scelle, cote_t15, snapshot_captured_at, round(minutes_avant_depart::numeric, 1), round(ev_t15::numeric, 4), variation_pct
  from calc
  where cote_t15 between 5 and 20 and ev_t15 >= 0.10
  on conflict do nothing;
  get diagnostics n = row_count;

  -- Règle 1-STEAM (hypothèse H1) : même value, ET le marché a resserré la cote depuis le matin (≤ 85 %)
  with cibles as (
    select c.date_course, c.num_reunion, c.num_course, c.heure_depart
    from courses c
    where c.date_course = current_date
      and not coalesce(c.annulee, false)
      and coalesce(c.statut, '') not ilike '%ANNUL%'
      and c.heure_depart between now() + interval '8 minutes' and now() + interval '23 minutes'
  ),
  cand as (
    select jp.date_course, jp.num_reunion, jp.num_course, jp.num_pmu, jp.nom,
           jp.p_win, jp.cote_au_scelle, jp.modele, ci.heure_depart
    from journal_predictions jp
    join cibles ci using (date_course, num_reunion, num_course)
    join participants pa using (date_course, num_reunion, num_course, num_pmu)
    where jp.modele = v and jp.p_win is not null and pa.statut = 'PARTANT' and jp.cote_au_scelle > 0
      and jp.edition = 'MATIN'
  ),
  mesure as (
    select cd.*, sn.cote as cote_t15, sn.captured_at as snapshot_captured_at,
           extract(epoch from (cd.heure_depart - sn.captured_at)) / 60.0 as minutes_avant_depart
    from cand cd
    join lateral (
      select cs.cote, cs.captured_at from cotes_snapshots cs
      where cs.date_course = cd.date_course and cs.num_reunion = cd.num_reunion
        and cs.num_course = cd.num_course and cs.num_pmu = cd.num_pmu
        and cs.captured_at >= now() - interval '15 minutes'
      order by cs.captured_at desc limit 1
    ) sn on true
    where sn.cote is not null and sn.cote > 1
  )
  insert into journal_value_picks
    (date_course, num_reunion, num_course, num_pmu, nom, modele, regle, p_win,
     cote_scelle_matin, cote_t15, snapshot_captured_at, minutes_avant_depart, ev_t15, variation_pct)
  select date_course, num_reunion, num_course, num_pmu, nom, modele, 'R1_STEAM', p_win,
         cote_au_scelle, cote_t15, snapshot_captured_at, round(minutes_avant_depart::numeric, 1),
         round((p_win * cote_t15 - 1)::numeric, 4), round(100 * (cote_t15 - cote_au_scelle) / cote_au_scelle, 1)
  from mesure
  where cote_t15 between 5 and 20
    and (p_win * cote_t15 - 1) >= 0.10
    and cote_t15 <= cote_au_scelle * 0.85
  on conflict do nothing;
  get diagnostics n2 = row_count;

  return n + n2;
end $$;

revoke execute on function public.fn_value_seal() from public, anon, authenticated;

-- 3. Vue de jugement (lecture seule, jamais d'écriture du résultat)
create or replace view public.v_value_picks_juges
with (security_invoker = on) as
select v.*,
       pa.ordre_arrivee, pa.cote_direct,
       case when pa.ordre_arrivee = 1 then 1 else 0 end as gagnant,
       case when pa.ordre_arrivee = 1 then coalesce(pa.cote_direct, v.cote_t15) - 1 else -1 end as gain_cote_finale,
       case when pa.ordre_arrivee = 1 then v.cote_t15 - 1 else -1 end as gain_cote_t15
from public.journal_value_picks v
join public.participants pa using (date_course, num_reunion, num_course, num_pmu)
where exists (select 1 from public.arrivees a
              where a.date_course = v.date_course and a.num_reunion = v.num_reunion and a.num_course = v.num_course);

-- 4. Cron (même cadence que statut-marche-h15)
select cron.schedule('value-seal', '*/10 * * * *', 'select fn_value_seal()');

-- 5. Pré-enregistrement dédié (clé gelée ; ne jamais la modifier)
insert into public.project_memory (key, content)
values ('preregistration_value_picks',
'# PRÉ-ENREGISTREMENT — edge réalisable (journal_value_picks), scellé le 07/09/2026
HYPOTHÈSES : H0 (R1_EV10_C5_20) — la value naïve mesurée à ~T-15 n''est PAS rentable aux cotes finales (attendu ≈ −11 % sur données pré-fenêtre) ; H1 (R1_STEAM) — la value confirmée par un resserrement du marché depuis le matin (cote_t15 ≤ 0,85 × cote du matin) a un rendement positif aux cotes finales.
PÉRIMÈTRE : partants de journal_predictions avec modele = modèle actif (v4-labels) ET edition = ''MATIN'' (p_win scellée à 07h35 face aux cotes de référence du matin). Les lignes edition = ''SOIR'' (scellé du soir, Chantier B) sont exclues : leur cote_au_scelle n''est pas une cote du matin, la règle STEAM n''y a pas de sens.
RÈGLES FIGÉES (fn_value_seal) : fenêtre départ ∈ [now+8 min, now+23 min] (identique à fn_statut_marche) ; snapshot ≤ 15 min ; cote_t15 ∈ [5, 20] ; EV = p_win × cote_t15 − 1 ≥ 0,10 ; STEAM : cote_t15 ≤ 0,85 × cote_au_scelle.
MÉTRIQUE : par règle, ROI flat aux cotes finales = moyenne de gain_cote_finale sur v_value_picks_juges ; t = moyenne / (écart-type / √n). Référence secondaire : ROI aux cotes T-15 (non réalisable, pour mesurer l''érosion).
FENÊTRE : à partir du 07/09/2026, ≥ 21 jours ET ≥ 400 picks jugés pour la règle évaluée. Aucune lecture décisionnelle avant.
CRITÈRE GO (par règle) : ROI aux cotes finales > 0 avec t ≥ 2. Sinon : règle rejetée, on itère (H2 features) — jamais en modifiant la règle rejetée.
INTERDITS : aucune modification de fn_value_seal ; nouvelle hypothèse = nouvelle regle ; aucune exposition publique ni argent réel avant GO ET décision explicite de Steph.')
on conflict (key) do nothing;
