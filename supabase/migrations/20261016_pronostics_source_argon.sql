-- Brouillons du Quinté+ préparés par Argon (spec docs/superpowers/specs/2026-10-16-brouillons-argon-design.md, §10).
-- Nouvelle origine ARGON ; AUTO-MARCHE reste autorisée (anciennes lignes éventuelles).
-- À appliquer À LA MAIN après le merge (MCP Supabase), puis vérifier qu'il n'y a qu'une contrainte de source et qu'elle contient ARGON :
--   select conname, pg_get_constraintdef(oid) from pg_constraint
--   where conrelid = 'public.pronostics'::regclass and contype = 'c';
ALTER TABLE public.pronostics DROP CONSTRAINT IF EXISTS pronostics_source_check;
ALTER TABLE public.pronostics ADD CONSTRAINT pronostics_source_check
  CHECK (source = ANY (ARRAY['ADMIN'::text, 'MVP'::text, 'ia-cron'::text, 'AI-MULTI-AGENT'::text, 'AUTO-MARCHE'::text, 'ARGON'::text]));
