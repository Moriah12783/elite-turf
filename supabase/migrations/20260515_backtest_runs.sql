-- ────────────────────────────────────────────────────────────────────────────
-- Migration : backtest_runs — Audit des runs de backtest du pipeline IA
-- Date      : 2026-05-15
-- Contexte  : Mouvement 2 du chantier "qualité pronostics IA" décidé par PO
--             le 2026-05-15. Mesure la performance prédictive du pipeline
--             Multi-Agents sur les courses passées dont on connaît l'arrivée,
--             pour calibrer les seuils MIN_*_SCORE et identifier où l'IA
--             apporte réellement un edge vs un joueur naïf "favoris cote".
-- ────────────────────────────────────────────────────────────────────────────

-- Table principale : un run = un agrégat (date d'exécution, échantillon, métriques)
CREATE TABLE IF NOT EXISTS public.backtest_runs (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_label                 TEXT        NOT NULL,                 -- ex: "deterministic-2026-05-15-v1"
  run_mode                  TEXT        NOT NULL CHECK (run_mode IN ('DETERMINISTIC', 'WITH_LLM', 'NAIVE_FAVORIS', 'NAIVE_RANDOM')),
  date_min                  DATE,                                  -- borne inf des courses échantillonnées
  date_max                  DATE,                                  -- borne sup
  nb_courses_target         INT  NOT NULL,                         -- nb visé
  nb_courses_done           INT  NOT NULL DEFAULT 0,
  nb_courses_skipped        INT  NOT NULL DEFAULT 0,               -- pas d'arrivée, pas de partants, etc.
  errors                    JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Agrégats globaux (calculés en fin de run)
  hits_top5_mean            NUMERIC,
  hits_top5_median          NUMERIC,
  pct_5sur5                 NUMERIC,
  pct_4plus_sur5            NUMERIC,
  pct_3plus_sur5            NUMERIC,
  pct_zero_hit              NUMERIC,
  precision_mean            NUMERIC,                                -- hits_top5 / taille_selection
  -- Métadonnées d'exécution
  started_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at              TIMESTAMPTZ,
  duration_ms               INT,
  notes                     TEXT
);

CREATE INDEX IF NOT EXISTS idx_backtest_runs_run_label ON public.backtest_runs(run_label);
CREATE INDEX IF NOT EXISTS idx_backtest_runs_mode      ON public.backtest_runs(run_mode);

COMMENT ON TABLE  public.backtest_runs IS 'Mouvement 2 — Cahier qualité IA. Audit des runs de backtest du pipeline Multi-Agents sur courses passées. Voir scripts/backtest-ia-pipeline.ts.';
COMMENT ON COLUMN public.backtest_runs.run_mode IS 'DETERMINISTIC (scoring §11.4 sans LLM, gratuit), WITH_LLM (pipeline complet, $$), NAIVE_FAVORIS (top-N favoris cote), NAIVE_RANDOM (tirage aléatoire).';
COMMENT ON COLUMN public.backtest_runs.hits_top5_mean IS 'Nombre moyen de chevaux de la sélection présents dans les 5 premiers de l''arrivée réelle. Métrique clé.';

-- Table détaillée : un essai = un (run × course)
CREATE TABLE IF NOT EXISTS public.backtest_attempts (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id                    UUID NOT NULL REFERENCES public.backtest_runs(id) ON DELETE CASCADE,
  course_id                 UUID NOT NULL REFERENCES public.courses(id),
  access_level              TEXT NOT NULL CHECK (access_level IN ('FREE', 'STARTER', 'PRO', 'ELITE')),
  -- Sortie du pipeline (sélection de chevaux par numéro de partant)
  selected_numeros          INT[] NOT NULL DEFAULT '{}',
  selection_confidence      INT,                                    -- 0-100, depuis SelectionBuilder
  -- Vérité terrain
  arrivee_top5              INT[],                                  -- 5 premiers de l'arrivée
  hits_top5                 INT,                                    -- nb chevaux sél dans top 5
  hits_top3                 INT,                                    -- nb chevaux sél dans top 3
  is_5sur5                  BOOLEAN,
  is_4plus_sur5             BOOLEAN,
  -- Métadonnées
  field_data_completeness   INT,
  field_quality_score       INT,
  notes                     TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_backtest_attempts_run     ON public.backtest_attempts(run_id);
CREATE INDEX IF NOT EXISTS idx_backtest_attempts_course  ON public.backtest_attempts(course_id);
CREATE INDEX IF NOT EXISTS idx_backtest_attempts_hits    ON public.backtest_attempts(hits_top5);

COMMENT ON TABLE public.backtest_attempts IS 'Détail course-par-course des runs de backtest. Permet l''analyse fine (par discipline, par hippodrome, par niveau).';

-- RLS : tables admin uniquement (pas d'exposition publique)
ALTER TABLE public.backtest_runs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backtest_attempts ENABLE ROW LEVEL SECURITY;

-- Aucune policy publique : seul le service_role peut lire/écrire (analyses admin).
