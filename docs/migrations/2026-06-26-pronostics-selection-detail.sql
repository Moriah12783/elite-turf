-- ============================================================================
-- Migration : colonnes `selection_detail` (jsonb) + `suggested_ticket` (text)
--             sur public.pronostics
-- ----------------------------------------------------------------------------
-- Contexte : refonte du modèle de pronostic — étape « Pro hiérarchisé visible ».
--   Spec : docs/superpowers/specs/2026-06-26-pronostic-model-design.md (§6)
--
-- But : la table `pronostics` ne stocke que `selection` (int[] = numéros). Pour
--   afficher le PRO en RÔLES (Base / Chances / Outsiders) il faut transporter
--   le rôle réel de chaque cheval (BASE/APPUI/OUTSIDER/COMPLEMENT, assigné par
--   lib/ai-pronostics/agents/selection-builder.ts → assignRole) + le ticket
--   jouable conseillé.
--
--   selection_detail = [{ number, name, role }] (ordre = mérite)
--   suggested_ticket = texte court (ex: "Quinté+ en 8 → couverture désordre")
--
-- Sûreté :
--   - Idempotent (`add column if not exists`) → ré-exécutable.
--   - Colonnes NULLABLES, défaut NULL → aucune ligne existante impactée.
--   - Aucun changement de RLS (lecture au niveau LIGNE, comme analyse_texte).
--
-- Où l'exécuter : Supabase → SQL Editor (projet elite-turf) → coller → Run.
-- ============================================================================

alter table public.pronostics
  add column if not exists selection_detail jsonb;

alter table public.pronostics
  add column if not exists suggested_ticket text;

comment on column public.pronostics.selection_detail is
  'Sélection détaillée [{number, name, role}] (role = BASE/APPUI/OUTSIDER/COMPLEMENT, '
  'cf lib/ai-pronostics/agents/selection-builder.ts). Sert à l''affichage PRO '
  'hiérarchisé (Base / Chances / Outsiders). NULL pour les pronostics legacy.';

comment on column public.pronostics.suggested_ticket is
  'Ticket jouable conseillé (texte court issu du draft IA, ex: "Quinté+ en 8 → '
  'couverture désordre"). Affiché sous la sélection PRO. NULL si absent.';

-- ============================================================================
-- Vérification (optionnelle, après Run) :
--   select column_name, data_type
--   from information_schema.columns
--   where table_schema = 'public' and table_name = 'pronostics'
--     and column_name in ('selection_detail','suggested_ticket')
--   order by column_name;
--   -- attendu : selection_detail | jsonb  /  suggested_ticket | text
-- ============================================================================
