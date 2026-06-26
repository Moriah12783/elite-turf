-- ============================================================================
-- Migration : colonne `plan_de_jeu` (jsonb) sur public.pronostics
-- ----------------------------------------------------------------------------
-- Contexte : refonte du modèle de pronostic — Phase 1 « plan de jeu Elite »
--   Spec : docs/superpowers/specs/2026-06-26-pronostic-model-design.md
--   Code : lib/ai-pronostics/elite-plan.ts (type ElitePlanDeJeu)
--
-- But : stocker le plan de jeu ELITE STRUCTURÉ (banker, bet_strategy,
--   value_picks, quinte_plan) afin de l'afficher en BLOC dédié sur la fiche
--   pronostic, au lieu du texte actuellement injecté dans `analyse_texte`.
--
-- Sûreté :
--   - Idempotent (`add column if not exists`) → ré-exécutable sans risque.
--   - Colonne NULLABLE, défaut NULL → aucune ligne existante impactée.
--   - Aucun changement de RLS nécessaire (la policy de lecture publique de
--     `pronostics` est au niveau LIGNE → la nouvelle colonne est lue avec la
--     ligne, comme `analyse_texte`).
--
-- Où l'exécuter : Supabase → SQL Editor (projet elite-turf) → coller → Run.
-- ============================================================================

alter table public.pronostics
  add column if not exists plan_de_jeu jsonb;

comment on column public.pronostics.plan_de_jeu is
  'Plan de jeu ELITE structuré (ElitePlanDeJeu) : banker {number,name,justification}, '
  'bet_strategy {type_pari, champ_reduit[], mise_unites[] en UNITES jamais EUR}, '
  'value_picks[], quinte_plan {base[],champ[],strategie}. NULL pour les autres '
  'niveaux. Cf lib/ai-pronostics/elite-plan.ts (refonte 2026-06-26).';

-- ============================================================================
-- Vérification (optionnelle, après Run) :
--   select column_name, data_type
--   from information_schema.columns
--   where table_schema = 'public' and table_name = 'pronostics'
--     and column_name = 'plan_de_jeu';
--   -- attendu : plan_de_jeu | jsonb
-- ============================================================================
