-- ============================================================
-- 20260513_pronostics_source_add_ai_multi_agent.sql
--
-- Étend la contrainte CHECK `pronostics_source_check` pour autoriser
-- la valeur 'AI-MULTI-AGENT' utilisée par le pipeline Multi-Agents IA
-- (publication depuis /admin/pronostics/ai-review, cf Session 5/6).
--
-- Contrainte avant :
--   CHECK (source IN ('ADMIN', 'MVP', 'ia-cron'))
--
-- Contrainte après :
--   CHECK (source IN ('ADMIN', 'MVP', 'ia-cron', 'AI-MULTI-AGENT'))
--
-- Pourquoi distinguer 'ia-cron' et 'AI-MULTI-AGENT' :
--   - 'ia-cron'        : ancien cron monolithique (/api/cron/ia-pronostics)
--                        qui publiait directement dans `pronostics` (1 LLM).
--   - 'AI-MULTI-AGENT' : nouveau pipeline 6 agents (CourseSelector +
--                        FieldAnalyzer + SelectionBuilder + AnalyseWriter
--                        + QualityValidator + NotificationBuilder).
--                        Publications passent toujours par review humaine
--                        via /admin/pronostics/ai-review (jamais auto).
--
-- Permet de filtrer/auditer côté reporting :
--   SELECT source, COUNT(*) FROM pronostics GROUP BY source;
--
-- Idempotent : DROP + ADD CONSTRAINT, rejouable sans risque.
-- ============================================================

ALTER TABLE public.pronostics DROP CONSTRAINT IF EXISTS pronostics_source_check;

ALTER TABLE public.pronostics
  ADD CONSTRAINT pronostics_source_check
    CHECK (source = ANY (ARRAY[
      'ADMIN'::text,
      'MVP'::text,
      'ia-cron'::text,
      'AI-MULTI-AGENT'::text
    ]));

COMMENT ON CONSTRAINT pronostics_source_check ON public.pronostics IS
  'Source autorisée : ADMIN (UI/bulk), MVP (legacy seed), ia-cron '
  '(ancien cron monolithique), AI-MULTI-AGENT (nouveau pipeline 6 agents '
  'avec review humaine via /admin/pronostics/ai-review).';
