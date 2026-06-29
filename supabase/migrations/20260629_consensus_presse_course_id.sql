-- Lie un consensus de presse à une course du programme (clé manquante).
-- Permet d'afficher la justification consensus sur /pronostics/[id] et,
-- en Phase 2, de nourrir la pipeline avec les citations par course.

ALTER TABLE public.consensus_presse
  ADD COLUMN IF NOT EXISTS course_id uuid REFERENCES public.courses(id);

CREATE INDEX IF NOT EXISTS idx_consensus_presse_course_id
  ON public.consensus_presse(course_id);
