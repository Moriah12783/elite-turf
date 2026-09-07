-- Tableau de bord de calibration hebdomadaire (Axe 1 du Plan Value Radar).
--
-- Chaque lundi 09h40 UTC, le cron /api/cron/calibration-hebdo copie ici les
-- AGRÉGATS renvoyés par la fonction fn_calibration_tranches du projet Radar
-- (Supabase kkwfaxxyzttooqhdglgk, appelée en /rest/v1/rpc avec la clé
-- publiable : aucune clé service du laboratoire ne quitte Supabase).
--
-- WRITE-ONCE : une ligne par (semaine, périmètre, tranche), jamais réécrite —
-- une semaine publiée reste telle quelle, bonne ou mauvaise (règle « aucune
-- donnée inventée », audits Sprint 1 & 1.5). Insertion en ignoreDuplicates.
--
-- RLS activée SANS policy = deny-all : lecture via le client de service en
-- SSR uniquement (lib/calibration/get-calibration.ts), jamais via la clé anon.
--
-- Appliquée à la main (MCP apply_migration `calibration_hebdo`) le 07/09/2026.

CREATE TABLE IF NOT EXISTS public.calibration_hebdo (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  semaine        date NOT NULL,                       -- lundi ISO de la semaine mesurée
  perimetre      text NOT NULL CHECK (perimetre IN ('SEMAINE','CUMUL')),
  tranche        text NOT NULL,                       -- '<2','2-3','3-5','5-10','10-20','20+'
  n              integer NOT NULL,
  annonce_pct    numeric NOT NULL,                    -- 100 × moyenne(p_win)
  reel_pct       numeric NOT NULL,                    -- 100 × taux de victoire réel
  marche_pct     numeric NOT NULL,                    -- 100 × moyenne(proba implicite cote du matin)
  gain_brier     numeric NOT NULL,                    -- moyenne((y−p_mkt)² − (y−p_win)²)
  modele         text NOT NULL DEFAULT 'v4-labels',
  edition        text NOT NULL DEFAULT 'MATIN',
  source_projet  text NOT NULL DEFAULT 'kkwfaxxyzttooqhdglgk',
  calcule_le     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT calibration_hebdo_write_once UNIQUE (semaine, perimetre, tranche)
);

COMMENT ON TABLE public.calibration_hebdo IS
  'Calibration hebdomadaire du moteur Radar (annoncé / réel / marché par tranche de cote), write-once, copiée chaque lundi depuis fn_calibration_tranches (projet Radar). Page publique /calibration.';

CREATE INDEX IF NOT EXISTS calibration_hebdo_semaine_idx ON public.calibration_hebdo (semaine DESC);

ALTER TABLE public.calibration_hebdo ENABLE ROW LEVEL SECURITY;
