-- Scellement quotidien du « Radar de la presse » (write-once, 1 ligne/jour).
--
-- Le Radar (home publique) recalcule sa sélection base/value/coup à chaque
-- affichage sans l'écrire nulle part : impossible de prouver après coup ce qui
-- a été montré. Cette table fige la PREMIÈRE apparition publique du jour
-- (write-once via unique(date_course) + insertion ignore-duplicates côté code,
-- cf. lib/consensus/radar-vedette.ts).
--
-- ⚠️ Cette DDL a d'abord été appliquée directement en prod le 05/08/2026
-- (migration Supabase `radar_snapshots_scellement`, PR #304). Ce fichier la
-- VERSIONNE pour qu'une base recréée depuis les migrations soit identique à la
-- prod. IF NOT EXISTS => rejouer ce fichier sur la prod est un no-op sûr.
--
-- origine = 'live' (scellé à l'affichage) ou 'reconstitution' (historique
-- 02/07→07/08 rejoué par le moteur : vue de fin de journée).
--
-- FK courses en ON DELETE SET NULL, JAMAIS CASCADE : les fusions de courses en
-- doublon suppriment des lignes de courses — un scellement ne doit pas mourir
-- avec elles (leçon de pronostics.course_id, qui était en CASCADE).

CREATE TABLE IF NOT EXISTS public.radar_snapshots (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date_course      date NOT NULL,
  origine          text NOT NULL DEFAULT 'live' CHECK (origine IN ('live','reconstitution')),
  reunion_course   text,
  hippodrome       text,
  type_pari        text,
  nb_partants      integer,
  nb_sources       integer NOT NULL,
  course_id        uuid REFERENCES public.courses(id) ON DELETE SET NULL,
  base             integer[] NOT NULL DEFAULT '{}',
  value            integer[] NOT NULL DEFAULT '{}',
  coup             integer[] NOT NULL DEFAULT '{}',
  selection        integer[] NOT NULL DEFAULT '{}',
  non_partants     integer[] NOT NULL DEFAULT '{}',
  favori_presse    jsonb,
  favori_marche    jsonb,
  cotes_utilisees  jsonb,
  created_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT radar_snapshots_un_par_jour UNIQUE (date_course)
);

COMMENT ON TABLE public.radar_snapshots IS
  'Scellement quotidien de la selection publique du Radar de la presse (write-once, 1 ligne/jour)';

-- Deny-all : RLS active SANS policy = seul le client de service lit et écrit.
-- C'est le seul rempart contre une lecture directe par la clé anon via
-- PostgREST — ne jamais ajouter de policy de lecture publique ici.
ALTER TABLE public.radar_snapshots ENABLE ROW LEVEL SECURITY;
