-- ============================================================
-- 20260513_course_source_evidence.sql
--
-- Multi-Agents IA Elite-Turf — Session 2 / migration 2 sur 3.
-- Conforme cahier des charges §22 (Table course_source_evidence).
--
-- Crée la table `public.course_source_evidence` qui consigne, pour
-- chaque course candidate, les preuves de validation collectées
-- auprès des sources whitelistées.
--
-- Cas d'usage :
--   - L'agent CourseSelector confronte une course aux sources de la
--     whitelist (LONACI, PMU.fr, SOREC, etc.) et INSERT une ligne par
--     source consultée avec le statut (MATCHED / PARTIAL / MISSING…).
--   - QualityValidator relit ces preuves pour décider du
--     validation_status final (VALIDATION_LONACI_DIRECTE,
--     VALIDATION_AFRIQUE_CORROBOREE, AFRIQUE_NON_VALIDEE_EXCLUSION…).
--
-- IMPACT PRODUCTION : zéro. Table isolée, jamais lue par les chemins
-- existants. Sera alimentée par les agents (encore désactivés).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.course_source_evidence (
  id                UUID         DEFAULT gen_random_uuid() PRIMARY KEY,

  -- FK course (SET NULL si la course est supprimée — on garde l'audit)
  course_id         UUID         NOT NULL
    REFERENCES public.courses(id) ON DELETE CASCADE,

  -- Identité de la source (dénormalisé volontairement — audit immuable
  -- même si la whitelist change plus tard)
  source_name       TEXT         NOT NULL,
  source_domain     TEXT,
  source_tier       TEXT         NOT NULL
    CHECK (source_tier IN (
      'PRIMARY',
      'DISCIPLINE_OFFICIAL',
      'AFRICA_CORROBORATION',
      'SECONDARY',
      'INTERNAL_WHITELIST',
      'FORBIDDEN'
    )),

  -- Rôle joué dans cette validation précise (peut différer du rôle par
  -- défaut de la whitelist selon le contexte de la course)
  validation_role   TEXT         NOT NULL,

  -- Détail des champs confirmés (libelle, hippodrome, heure_depart, etc.)
  matched_fields    JSONB        DEFAULT '{}'::jsonb,
  source_url        TEXT,

  -- Score de confiance 0-100 (heuristique de l'agent)
  confidence        INTEGER      NOT NULL DEFAULT 0
    CHECK (confidence BETWEEN 0 AND 100),

  -- Statut du croisement source ↔ course
  status            TEXT         NOT NULL
    CHECK (status IN (
      'MATCHED',
      'PARTIAL',
      'CONFLICT',
      'MISSING',
      'FORBIDDEN'
    )),

  notes             TEXT,
  checked_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────
-- Index — patterns de lecture par les agents
-- ─────────────────────────────────────────────────────────────────────────

-- Toutes les preuves d'une course (lecture par QualityValidator)
CREATE INDEX IF NOT EXISTS idx_course_source_evidence_course
  ON public.course_source_evidence (course_id, source_tier);

-- Filtrage par statut (ex : trouver toutes les courses MATCHED du jour)
CREATE INDEX IF NOT EXISTS idx_course_source_evidence_status
  ON public.course_source_evidence (status, checked_at DESC);

-- Audit par source (ex : "combien de fois LONACI a MATCHED cette semaine")
CREATE INDEX IF NOT EXISTS idx_course_source_evidence_source
  ON public.course_source_evidence (source_name, checked_at DESC);

-- Une course peut être vérifiée par la même source plusieurs fois
-- (re-check après échec) → PAS de contrainte unique sur (course_id, source_name).
-- On garde l'historique complet.

-- ─────────────────────────────────────────────────────────────────────────
-- RLS — service_role uniquement (données internes IA, audit)
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE public.course_source_evidence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "course_source_evidence_svc" ON public.course_source_evidence;

CREATE POLICY "course_source_evidence_svc"
  ON public.course_source_evidence FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ─────────────────────────────────────────────────────────────────────────
-- Commentaires
-- ─────────────────────────────────────────────────────────────────────────

COMMENT ON TABLE  public.course_source_evidence IS
  'Cahier §22 — Audit des preuves de validation par source pour chaque course. '
  'Alimenté par CourseSelector, lu par QualityValidator. Append-only.';

COMMENT ON COLUMN public.course_source_evidence.status IS
  'MATCHED (confirmé) | PARTIAL (partiel) | CONFLICT (contradiction) | MISSING (absente) | FORBIDDEN (source interdite)';

COMMENT ON COLUMN public.course_source_evidence.matched_fields IS
  'JSONB des champs confirmés par cette source. Ex : '
  '{"libelle": true, "hippodrome": true, "heure_depart": true, "nb_partants": false}';

COMMENT ON COLUMN public.course_source_evidence.confidence IS
  'Score 0-100 de confiance dans le croisement (heuristique de l''agent). '
  '≥80 = très fiable, 50-79 = à corroborer, <50 = douteux.';
