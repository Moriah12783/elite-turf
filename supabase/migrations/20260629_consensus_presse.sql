-- Consensus de la presse — saisie admin (signal interne pour la synthèse Elite/Pro).
-- Stocke la table de citations par cheval (input) + le résultat calculé (snapshot).
-- RLS service-role only (écriture via createServiceClient après auth admin).
CREATE TABLE IF NOT EXISTS consensus_presse (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date_course date,
  hippodrome  text,
  course      text,
  type_pari   text,
  nb_partants integer,
  nb_sources  integer NOT NULL DEFAULT 0,
  partants    jsonb NOT NULL,   -- [{ numero, citations, bases?, cote? }]
  resultat    jsonb,            -- snapshot { elite, pro, topCites }
  created_at  timestamptz DEFAULT now(),
  created_by  uuid
);
ALTER TABLE consensus_presse ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_consensus_presse_date ON consensus_presse (date_course DESC);
