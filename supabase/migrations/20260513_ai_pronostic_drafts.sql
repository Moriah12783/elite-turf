-- ============================================================
-- 20260513_ai_pronostic_drafts.sql
--
-- Multi-Agents IA Elite-Turf — Session 2 / migration 3 sur 3.
-- Conforme cahier des charges §23 (Table ai_pronostic_drafts).
--
-- Crée la table `public.ai_pronostic_drafts` où le Director stocke
-- chaque pronostic généré PAR LES AGENTS IA, en attente de review
-- humaine via /admin/pronostics/ai-review (Session 5).
--
-- 🚨 RÈGLE CRITIQUE :
--   AUCUN draft n'est publié automatiquement. Stéphane review et
--   décide via human_review.decision = 'PUBLISHED' avant que le
--   contenu n'apparaisse côté public (pas de FK vers pronostics).
--
-- Architecture des colonnes :
--   - Colonnes scalaires    : indexables, requêtables, score Afrique etc.
--   - Colonnes JSONB       : payloads complets des 6 agents (audit trail)
--   - Colonne human_review : décision admin + timestamp + commentaire
--
-- IMPACT PRODUCTION : zéro. Table isolée. L'ancien cron continue de
-- générer dans `pronostics` (publication directe), ce nouveau flux
-- attend Sessions 3-5 pour être activé.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ai_pronostic_drafts (
  id                            UUID         DEFAULT gen_random_uuid() PRIMARY KEY,

  -- ── Identité ─────────────────────────────────────────────────────────
  draft_date                    DATE         NOT NULL,
  access_level                  TEXT         NOT NULL
    CHECK (access_level IN ('FREE', 'STARTER', 'PRO', 'ELITE')),
  course_id                     UUID         NOT NULL
    REFERENCES public.courses(id) ON DELETE CASCADE,

  -- ── Validation Afrique (cahier §4) ──────────────────────────────────
  validation_status             TEXT         NOT NULL
    CHECK (validation_status IN (
      'VALIDATION_LONACI_DIRECTE',
      'VALIDATION_AFRIQUE_CORROBOREE',
      'AFRIQUE_NON_VALIDEE_EXCLUSION',
      'PROGRAMME_MAIS_DISPO_AFRIQUE_INCERTAINE',
      'AFRIQUE_INCONNUE_FALLBACK_FR'
    )),
  validation_badge              TEXT         NOT NULL,

  -- ── Scores (0-100, NULL si pas encore calculé) ──────────────────────
  africa_course_score           INTEGER
    CHECK (africa_course_score IS NULL OR africa_course_score BETWEEN 0 AND 100),
  source_confidence_score       INTEGER
    CHECK (source_confidence_score IS NULL OR source_confidence_score BETWEEN 0 AND 100),
  selection_confidence_score    INTEGER
    CHECK (selection_confidence_score IS NULL OR selection_confidence_score BETWEEN 0 AND 100),
  quality_score                 INTEGER
    CHECK (quality_score IS NULL OR quality_score BETWEEN 0 AND 100),

  -- ── Statut pipeline (ValidatorStatus de types.ts) ───────────────────
  status                        TEXT         NOT NULL
    CHECK (status IN (
      'APPROVED_FOR_ADMIN_REVIEW',
      'NEEDS_CORRECTION',
      'NEEDS_HUMAN_REVIEW',
      'REJECTED'
    )),

  -- ── Contenu rédigé ───────────────────────────────────────────────────
  title                         TEXT,
  subscriber_content            JSONB,                       -- AnalyseWriterResult.subscriber_content
  selection                     JSONB,                       -- SelectionBuilderResult.selected_runners
  risks                         JSONB        DEFAULT '[]'::jsonb,

  -- ── Audit IA — payloads complets des 6 agents ───────────────────────
  source_evidence               JSONB        DEFAULT '[]'::jsonb,
  validator_report              JSONB,                       -- QualityValidatorResult complet
  agent_logs                    JSONB        DEFAULT '{}'::jsonb,  -- { CourseSelector, FieldAnalyzer, ... }

  -- ── Review humaine ──────────────────────────────────────────────────
  human_review                  JSONB        NOT NULL DEFAULT jsonb_build_object(
    'edited_by',      null,
    'edited_at',      null,
    'decision',       'PENDING',
    'human_comment',  null
  ),

  -- ── Timestamps ──────────────────────────────────────────────────────
  created_at                    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at                    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  -- 1 seul draft par (date, niveau, course) — sécurise rejeu cron
  CONSTRAINT ai_pronostic_drafts_unique_per_slot
    UNIQUE (draft_date, access_level, course_id)
);

-- ─────────────────────────────────────────────────────────────────────────
-- Index — patterns de lecture admin + cron
-- ─────────────────────────────────────────────────────────────────────────

-- Vue admin principale : drafts du jour groupés par niveau
CREATE INDEX IF NOT EXISTS idx_ai_pronostic_drafts_date_level
  ON public.ai_pronostic_drafts (draft_date DESC, access_level);

-- Drafts en attente de review (page /admin/pronostics/ai-review)
CREATE INDEX IF NOT EXISTS idx_ai_pronostic_drafts_pending_review
  ON public.ai_pronostic_drafts (draft_date DESC)
  WHERE status IN ('APPROVED_FOR_ADMIN_REVIEW', 'NEEDS_HUMAN_REVIEW');

-- Drafts rejetés (audit / monitoring qualité IA)
CREATE INDEX IF NOT EXISTS idx_ai_pronostic_drafts_rejected
  ON public.ai_pronostic_drafts (draft_date DESC)
  WHERE status = 'REJECTED';

-- Recherche par course (utile pour le cron : déjà généré ?)
CREATE INDEX IF NOT EXISTS idx_ai_pronostic_drafts_course
  ON public.ai_pronostic_drafts (course_id);

-- ─────────────────────────────────────────────────────────────────────────
-- Trigger updated_at
-- ─────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.touch_ai_pronostic_drafts_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ai_pronostic_drafts_updated_at ON public.ai_pronostic_drafts;
CREATE TRIGGER trg_ai_pronostic_drafts_updated_at
  BEFORE UPDATE ON public.ai_pronostic_drafts
  FOR EACH ROW EXECUTE FUNCTION public.touch_ai_pronostic_drafts_updated_at();

-- ─────────────────────────────────────────────────────────────────────────
-- RLS — service_role uniquement pour l'instant.
-- La page /admin/pronostics/ai-review utilisera le service_role server-side.
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE public.ai_pronostic_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_pronostic_drafts_svc" ON public.ai_pronostic_drafts;

CREATE POLICY "ai_pronostic_drafts_svc"
  ON public.ai_pronostic_drafts FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ─────────────────────────────────────────────────────────────────────────
-- Commentaires
-- ─────────────────────────────────────────────────────────────────────────

COMMENT ON TABLE  public.ai_pronostic_drafts IS
  'Cahier §23 — Drafts générés par les Multi-Agents IA, en attente de review humaine. '
  'AUCUN draft n''est publié automatiquement (cf colonne human_review).';

COMMENT ON COLUMN public.ai_pronostic_drafts.validation_status IS
  'Statut de validation Afrique. Cahier §4. Seuls VALIDATION_LONACI_DIRECTE '
  'et VALIDATION_AFRIQUE_CORROBOREE permettent une publication FREE/STARTER/PRO/ELITE.';

COMMENT ON COLUMN public.ai_pronostic_drafts.human_review IS
  'Décision admin : {"edited_by": uuid|null, "edited_at": iso|null, '
  '"decision": "PENDING"|"PUBLISHED"|"REJECTED", "human_comment": string|null}';

COMMENT ON COLUMN public.ai_pronostic_drafts.agent_logs IS
  'Payloads complets des 6 agents pour audit/debug : '
  '{ "CourseSelector": {...}, "FieldAnalyzer": {...}, "SelectionBuilder": {...}, '
  '"AnalyseWriter": {...}, "QualityValidator": {...} }';

COMMENT ON COLUMN public.ai_pronostic_drafts.access_level IS
  'FREE (6 chevaux) | STARTER (8) | PRO (8) | ELITE (6, anti-cannibalisation vs FREE).';
