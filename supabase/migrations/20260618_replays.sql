-- Replays officiels curés (section « Le Direct »)
--
-- On NE rediffuse RIEN : on stocke seulement l'ID d'une vidéo YouTube OFFICIELLE
-- (Equidia / France Galop / Le Trot / PMU) que l'admin colle à la main, puis on
-- l'affiche via l'embed YouTube standard (autorisé). Aucune vidéo n'est hébergée.

CREATE TABLE IF NOT EXISTS replays (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  date_course date        NOT NULL,
  titre       text        NOT NULL,
  youtube_id  text        NOT NULL,           -- ID vidéo YouTube (11 caractères)
  hippodrome  text,
  ordre       integer     NOT NULL DEFAULT 0,
  cree_le     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_replays_date ON replays (date_course DESC);

-- Lecture publique (ce sont des replays officiels = contenu public) ; écriture
-- uniquement via la service_role (admin), qui bypasse RLS.
ALTER TABLE replays ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "replays_public_read" ON replays;
CREATE POLICY "replays_public_read" ON replays FOR SELECT USING (true);
