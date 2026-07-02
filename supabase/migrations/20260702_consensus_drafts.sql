-- Brouillons de consensus reçus par l'API d'ingestion (Lot 2, contrat v2.4).
-- Le pipeline POST /api/v1/ingest/consensus dépose ici ; l'admin relit puis
-- publie via l'atelier existant. RIEN ne se publie sans action humaine.
--
-- Idempotence : (date_course, reunion_course, run_type) est unique — un nouveau
-- POST du même run REMPLACE le brouillon non traité (upsert), jamais de doublon.

CREATE TABLE IF NOT EXISTS public.consensus_drafts (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date_course       date NOT NULL,
  reunion_course    text NOT NULL,                    -- RxCx
  hippodrome        text,
  nb_partants       integer,
  course_id         uuid REFERENCES public.courses(id), -- null = orphelin à rattacher
  run_type          text NOT NULL CHECK (run_type IN ('matin', 'filet_j1', 'sentinelle')),
  contract_version  text,
  type_pari         text NOT NULL DEFAULT 'QUINTE_PLUS',
  nb_sources        integer NOT NULL,
  nb_sources_brut   integer,
  echantillon_reduit boolean NOT NULL DEFAULT false,
  citations         jsonb NOT NULL,                   -- [{numero,citations,bases}]
  commentaires      jsonb,                            -- { elite:{...}, pro:{...} }
  validation_report jsonb NOT NULL,
  raw_hash          text NOT NULL,
  status            text NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft', 'reviewed', 'rejected', 'published')),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT consensus_drafts_idempotency UNIQUE (date_course, reunion_course, run_type)
);

-- RLS service-role uniquement (policy explicite, convention du repo — échec
-- bruyant si un chemin non-service la requête).
ALTER TABLE public.consensus_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "consensus_drafts_service_only"
  ON public.consensus_drafts
  FOR ALL
  USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_consensus_drafts_status ON public.consensus_drafts(status, date_course);
CREATE INDEX IF NOT EXISTS idx_consensus_drafts_date ON public.consensus_drafts(date_course);
