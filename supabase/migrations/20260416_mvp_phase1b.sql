-- ============================================================
-- Phase 1B — Support ingestion MVP dans la table pronostics
-- Date : 2026-04-16
-- ============================================================

-- 1. course_id nullable : les pronostics MVP n'ont pas encore de course liée
--    (Phase 2 établira le lien course quand l'endpoint /course sera ouvert)
ALTER TABLE public.pronostics
  ALTER COLUMN course_id DROP NOT NULL;

-- 2. auteur_id nullable : les pronostics MVP n'ont pas d'auteur humain
ALTER TABLE public.pronostics
  ALTER COLUMN auteur_id DROP NOT NULL;

-- 3. Colonnes d'intégration MVP
ALTER TABLE public.pronostics
  ADD COLUMN IF NOT EXISTS external_id      TEXT,
  ADD COLUMN IF NOT EXISTS race_external_id TEXT,
  ADD COLUMN IF NOT EXISTS source           TEXT CHECK (source IN ('ADMIN', 'MVP'));

-- 4. Contrainte UNIQUE partielle sur external_id (clé d'idempotence)
--    Partielle : n'affecte pas les pronostics ADMIN existants (external_id NULL)
CREATE UNIQUE INDEX IF NOT EXISTS idx_pronostics_external_id_unique
  ON public.pronostics (external_id)
  WHERE external_id IS NOT NULL;

-- 5. Index lookup rapide par source
CREATE INDEX IF NOT EXISTS idx_pronostics_source
  ON public.pronostics (source)
  WHERE source IS NOT NULL;

-- 6. Trace d'audit dans ingestion_events
INSERT INTO public.ingestion_events (
  object_type, request_id, source, status, message, dry_run, received_at
) VALUES (
  'pronostic',
  'migration-phase-1b',
  'MVP',
  'success',
  'Migration Phase 1B appliquée : course_id/auteur_id nullable, external_id/race_external_id/source ajoutés',
  false,
  now()
);
