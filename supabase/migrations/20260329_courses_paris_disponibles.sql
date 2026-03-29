-- ============================================================
-- Ajout colonne paris_disponibles dans courses
-- Date : 2026-03-29
--
-- Stocke les types de paris PMU disponibles sur cette course
-- ex: {"TIERCE","QUARTE_PLUS","QUINTE_PLUS"}
-- Permet d'identifier les courses jouables depuis l'Afrique
-- (LONACI, LONASE, PMU-CI, PMU Maroc, etc.)
-- ============================================================

ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS paris_disponibles TEXT[] DEFAULT '{}';

-- Index pour filtrer rapidement les courses "jouables en Afrique"
CREATE INDEX IF NOT EXISTS idx_courses_paris_disponibles
  ON public.courses USING GIN (paris_disponibles);
