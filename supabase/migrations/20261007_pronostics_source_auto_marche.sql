-- Brouillons automatiques du Quinté+ (spec docs/superpowers/specs/2026-10-07-brouillons-quinte-design.md, §8).
-- Nouvelle origine AUTO-MARCHE : les brouillons préparés à T-90 se mesurent à part.
-- À appliquer À LA MAIN après le merge (MCP Supabase), puis vérifier :
--   select pg_get_constraintdef(oid) from pg_constraint where conname = 'pronostics_source_check';
ALTER TABLE public.pronostics DROP CONSTRAINT IF EXISTS pronostics_source_check;
ALTER TABLE public.pronostics ADD CONSTRAINT pronostics_source_check
  CHECK (source = ANY (ARRAY['ADMIN'::text, 'MVP'::text, 'ia-cron'::text, 'AI-MULTI-AGENT'::text, 'AUTO-MARCHE'::text]));
