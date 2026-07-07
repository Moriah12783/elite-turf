-- ============================================================================
-- 20260707_partants_cote_source.sql
--
-- Traçabilité de la SOURCE de chaque cote de partant (audit).
-- Depuis PR #267, le CSV public PMU (IP Google) est la source PRIORITAIRE des
-- cotes. On veut désormais savoir, cote par cote, d'où elle vient :
--   'pmu'          → cote issue du CSV PMU officiel (resolvePmuCote)
--   'lonaci'       → cote de repli (LONACI / Geny / autre non-PMU)
--   'indisponible' → aucune cote (NULL : non-partant ou cote pas encore ouverte)
--
-- Colonne nullable (les partants existants restent NULL = source inconnue) et
-- écrite par les 3 chemins d'enrichissement (cron GitHub Actions, backfill
-- admin, bouton « Enrichir PMU »). Additif et non destructif.
-- ============================================================================

ALTER TABLE public.partants
  ADD COLUMN IF NOT EXISTS cote_source TEXT;

COMMENT ON COLUMN public.partants.cote_source IS
  'Audit de la provenance de la cote : pmu (CSV officiel) | lonaci (repli LONACI/Geny/autre) | indisponible (cote NULL). NULL = enrichi avant la traçabilité.';
