-- 20261002_selection_photos.sql
--
-- Photo de la « Sélection stats » prise entre 15 et 5 minutes avant chaque
-- départ (cron /api/cron/photo-selection, toutes les 5 min). Le bilan de la
-- sélection gratuite, et la comparaison du pronostic payant au marché de la
-- même heure, se calculent sur ces photos, JAMAIS sur des cotes relevées après
-- coup : 77 % des cotes PMU en base datent d'après le départ (constat du
-- 02/10/2026).
--
-- Lecture et écriture côté serveur uniquement (RLS active, aucune policy).

CREATE TABLE IF NOT EXISTS public.selection_photos (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id     uuid        NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  -- Version de l'algorithme de sélection photographié (v2 = classement par la cote PMU).
  version       text        NOT NULL DEFAULT 'v2',
  prise_le      timestamptz NOT NULL DEFAULT now(),
  depart_prevu  timestamptz,
  -- Sélection telle qu'affichée au visiteur, dans l'ordre.
  numeros       integer[]   NOT NULL,
  -- Marché complet au moment de la photo : { "numéro": cote }.
  cotes_marche  jsonb       NOT NULL,
  -- « csv » : cotes du moment (CSV PMU de l'Apps Script) ; « base » : cotes en base.
  source_cotes  text        NOT NULL CHECK (source_cotes IN ('csv', 'base')),
  nb_partants   integer     NOT NULL,
  UNIQUE (course_id, version)
);

CREATE INDEX IF NOT EXISTS selection_photos_prise_le_idx ON public.selection_photos (prise_le DESC);

ALTER TABLE public.selection_photos ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.selection_photos IS
  'Photo de la Sélection stats 15 à 5 min avant le départ (cron photo-selection). Base du bilan honnête de la sélection gratuite et de la comparaison payant / marché à la même heure.';
