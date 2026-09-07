-- ============================================================================
-- Radar Elite Predictive (Supabase kkwfaxxyzttooqhdglgk) — Chantier B
-- « Scellé du soir » : fn_journal_seal utilise la dernière cote snapshot
-- (≤ 60 min) quand participants.cote_reference manque, et marque les lignes
-- ainsi scellées edition = 'SOIR'. Aucune réécriture de ligne existante.
--
-- Diagnostic (04–07/09) : couverture du journal 53–80 % les jours à réunions
-- du soir, parce que courses_pretes exigeait ≥ 90 % de cote_reference alors
-- que cotes_snapshots couvrait ces courses dès 16h30.
--
-- Idempotente. Appliquée via MCP apply_migration (nom : journal_edition_soir).
-- ============================================================================

-- 1. Colonne d'édition : les 15 956 lignes existantes deviennent 'MATIN' (exact).
alter table public.journal_predictions
  add column if not exists edition text not null default 'MATIN';

comment on column public.journal_predictions.edition is
  'MATIN = scellée avec ≥ 90 % de cote_reference PMU (édition du matin, seule base de la métrique v4_t252) ; SOIR = scellée avec la dernière cote snapshot (≤ 60 min) faute de cote de référence (réunions du soir). Jamais réécrit.';

-- 2. Scellé avec cote résolue
create or replace function public.fn_journal_seal()
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare n int; w float8[]; b float8; v text;
begin
  select weights, bias, version into w, b, v from ml_model_weights where id = 1;
  if w is null then raise exception 'Aucun modèle entraîné'; end if;

  with part_resolue as (
    -- Cote résolue : cote de référence PMU du matin, sinon dernier snapshot
    -- du cheval capturé il y a ≤ 60 min (réunions du soir). Jamais périmé.
    select p.date_course, p.num_reunion, p.num_course, p.num_pmu, p.nom,
           p.cote_reference,
           coalesce(p.cote_reference, sn.cote) as cote_resolue,
           p.musique, p.driver, p.entraineur, p.gains_carriere, p.nombre_courses
    from courses c
    join participants p using (date_course, num_reunion, num_course)
    left join lateral (
      select cs.cote from cotes_snapshots cs
      where cs.date_course = p.date_course and cs.num_reunion = p.num_reunion
        and cs.num_course = p.num_course and cs.num_pmu = p.num_pmu
        and cs.cote > 1
        and cs.captured_at >= now() - interval '60 minutes'
      order by cs.captured_at desc limit 1
    ) sn on true
    where c.date_course between current_date and current_date + 1
      and c.heure_depart > now() + interval '5 minutes'
      and p.statut = 'PARTANT'
  ),
  courses_pretes as (
    select date_course, num_reunion, num_course,
           case when count(*) filter (where cote_reference is not null) >= 0.90 * count(*)
                then 'MATIN' else 'SOIR' end as edition
    from part_resolue
    group by 1, 2, 3
    having count(*) filter (where cote_resolue is not null) >= 0.90 * count(*)
  ),
  cible as (
    select pr.date_course, pr.num_reunion, pr.num_course, pr.num_pmu, pr.nom,
           pr.cote_resolue as cote,   -- ⚠️ cote résolue : celle du modèle
           cp.edition,
           pr.musique, pr.driver, pr.entraineur, pr.gains_carriere, pr.nombre_courses
    from part_resolue pr
    join courses_pretes cp using (date_course, num_reunion, num_course)
  ),
  feat as (
    select b2.*,
      coalesce(m.forme3, 7.5) as forme3, coalesce(m.tendance, 0) as tendance,
      coalesce(d.w::numeric / nullif(d.n, 0), 0) as drv_wr,
      coalesce(e.w::numeric / nullif(e.n, 0), 0) as ent_wr,
      coalesce(case when b2.nombre_courses > 0
                    then b2.gains_carriere::numeric / b2.nombre_courses end, 0) as gpc
    from cible b2
    cross join lateral (select fn_musique_places(b2.musique) as arr) t
    cross join lateral (
      select (select avg(v2) from unnest(t.arr[1:3]) v2) as forme3,
             case when array_length(t.arr, 1) >= 4 then
               (select avg(v2) from unnest(t.arr[4:6]) v2)
               - (select avg(v2) from unnest(t.arr[1:3]) v2) end as tendance) m
    cross join lateral (
      select count(*) as n, count(*) filter (where x.ordre_arrivee = 1) as w
      from participants x where x.driver = b2.driver and x.statut = 'PARTANT'
        and x.date_course >= b2.date_course - 90 and x.date_course < b2.date_course) d
    cross join lateral (
      select count(*) as n, count(*) filter (where x.ordre_arrivee = 1) as w
      from participants x where x.entraineur = b2.entraineur and x.statut = 'PARTANT'
        and x.date_course >= b2.date_course - 90 and x.date_course < b2.date_course) e
  ),
  sc as (
    select f.*, count(*) over wr as nb_part,
      (1 - percent_rank() over wf)::float8 as s_forme,
      (percent_rank() over wt)::float8 as s_tend,
      (percent_rank() over wd)::float8 as s_drv,
      (percent_rank() over we)::float8 as s_ent,
      (percent_rank() over wg)::float8 as s_classe,
      case when cote > 0 then ((1.0/cote) / nullif(sum(case when cote > 0 then 1.0/cote end) over wr, 0))::float8 end as pm
    from feat f
    window wr as (partition by date_course, num_reunion, num_course),
           wf as (partition by date_course, num_reunion, num_course order by forme3),
           wt as (partition by date_course, num_reunion, num_course order by tendance),
           wd as (partition by date_course, num_reunion, num_course order by drv_wr),
           we as (partition by date_course, num_reunion, num_course order by ent_wr),
           wg as (partition by date_course, num_reunion, num_course order by gpc)
  ),
  scored as (
    select sc.*, coalesce(pm, 1.0/nb_part)::float8 as p_market_f,
      1.0/(1.0 + exp(-(b + fdot(w, array[
        s_forme, s_tend, s_drv, s_ent, s_classe,
        coalesce(pm, 1.0/nb_part)::float8,
        ln(greatest(coalesce(pm, 1.0/nb_part), 0.001))::float8,
        case when pm is null then 1.0 else 0.0 end::float8])))) as p_raw,
      exp(4.0 * (w[1]*s_forme + w[2]*s_tend + w[3]*s_drv + w[4]*s_ent + w[5]*s_classe)) as force_fond
    from sc
  ),
  pw as (
    select s.*, (p_raw / sum(p_raw) over wr)::float8 as p,
      (force_fond / sum(force_fond) over wr)::float8 as p_fond,
      rank() over (partition by date_course, num_reunion, num_course
                   order by p_raw desc, cote asc nulls last) as rang
    from scored s window wr as (partition by date_course, num_reunion, num_course)
  ),
  h2 as (select a.date_course, a.num_reunion, a.num_course, a.num_pmu,
           sum(x.p * a.p / greatest(1 - x.p, 0.001)) as p2
         from pw a join pw x using (date_course, num_reunion, num_course)
         where x.num_pmu <> a.num_pmu group by 1,2,3,4),
  h3 as (select a.date_course, a.num_reunion, a.num_course, a.num_pmu,
           sum(x.p * (y.p / greatest(1 - x.p, 0.001)) * (a.p / greatest(1 - x.p - y.p, 0.001))) as p3
         from pw a join pw x using (date_course, num_reunion, num_course)
              join pw y using (date_course, num_reunion, num_course)
         where x.num_pmu <> a.num_pmu and y.num_pmu <> a.num_pmu and y.num_pmu <> x.num_pmu
         group by 1,2,3,4)
  insert into journal_predictions
    (date_course, num_reunion, num_course, num_pmu, nom, cote_au_scelle,
     note, rang_note, p_engine, p_market, p_win, p_top2, p_top3, modele, edition)
  select v2.date_course, v2.num_reunion, v2.num_course, v2.num_pmu, v2.nom, v2.cote,
         round((100 * v2.p)::numeric, 1), v2.rang,
         round(v2.p_fond::numeric, 4), round(v2.p_market_f::numeric, 4),
         round(v2.p::numeric, 4),
         round(least(1, v2.p + h2.p2)::numeric, 4),
         round(least(1, v2.p + h2.p2 + h3.p3)::numeric, 4), v, v2.edition
  from pw v2
  join h2 using (date_course, num_reunion, num_course, num_pmu)
  join h3 using (date_course, num_reunion, num_course, num_pmu)
  on conflict (date_course, num_reunion, num_course, num_pmu) do nothing;
  get diagnostics n = row_count;
  return n;
end $function$;

comment on function public.fn_journal_seal() is
  'Scellé horaire du journal (INSERT-ONLY). Cote du modèle = coalesce(cote_reference, dernier snapshot ≤ 60 min). edition = MATIN si ≥ 90 % de cote_reference, sinon SOIR. Une course scellée n''est jamais re-scellée (on conflict do nothing).';

-- 3. Note annexe au pré-enregistrement gelé (la clé preregistration_v4_t252 n'est PAS modifiée)
insert into public.project_memory (key, content)
values ('preregistration_v4_t252_note_edition_soir',
'# NOTE ANNEXE — édition du soir (ajoutée le 07/09/2026, clé preregistration_v4_t252 inchangée)

Depuis le 07/09/2026, fn_journal_seal scelle aussi les réunions du soir avec la dernière cote snapshot (≤ 60 min) quand cote_reference manque. Ces lignes portent journal_predictions.edition = ''SOIR''.

La métrique v4_t252 (et toute réplication du verdict du 07/09 : t = 3,124, n = 12 342 au 06/09) reste calculée sur edition = ''MATIN'' UNIQUEMENT : c''est ce qu''elle a toujours mesuré (probabilités scellées face aux cotes de référence du matin). Toute requête de calibration / Brier vs marché doit filtrer edition = ''MATIN'' sauf mention explicite.

Les lignes SOIR font l''objet d''une calibration séparée (annoncé / réel par tranche) après ≥ 4 semaines d''accumulation, avant toute utilisation produit. L''auditeur 9h20 reporte la couverture par édition.')
on conflict (key) do nothing;
