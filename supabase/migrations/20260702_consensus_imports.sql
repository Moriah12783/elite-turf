-- Traçabilité des tentatives d'analyse/ingestion de blocs consensus (Lot 1, contrat v2.4).
-- TOUTE tentative est journalisée, réussie ou non — piste d'audit de l'incident 01/07.
-- source : 'manuel' (collage admin) | 'api' (ingestion pipeline, Lot 2).

CREATE TABLE IF NOT EXISTS public.consensus_imports (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date_course       date,
  course_id         uuid REFERENCES public.courses(id),
  raw_block         text NOT NULL,
  raw_hash          text NOT NULL,
  source            text NOT NULL CHECK (source IN ('manuel', 'api')),
  validation_report jsonb NOT NULL,
  created_by        uuid,
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- RLS service-role uniquement — policy explicite (convention du repo, cf.
-- webhook_events / cron_logs) : échec BRUYANT si un chemin non-service la requête.
ALTER TABLE public.consensus_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "consensus_imports_service_only"
  ON public.consensus_imports
  FOR ALL
  USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_consensus_imports_date ON public.consensus_imports(date_course);
CREATE INDEX IF NOT EXISTS idx_consensus_imports_created ON public.consensus_imports(created_at);
