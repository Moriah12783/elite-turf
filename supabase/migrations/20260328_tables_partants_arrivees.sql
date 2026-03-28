-- ============================================================
-- Tables : partants & arrivees PMU (données Geny)
-- Date   : 2026-03-28
-- ============================================================

-- Table partants (chaque partant d'une course)
CREATE TABLE IF NOT EXISTS partants (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id     UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  numero        INTEGER NOT NULL,
  nom_cheval    TEXT NOT NULL,
  jockey        TEXT,
  entraineur    TEXT,
  cote          DECIMAL(6,2),
  musique       TEXT,          -- ex : "1p 2p 4a 1p" (dernières courses)
  poids_kg      DECIMAL(4,1),
  deferre       BOOLEAN DEFAULT false,
  non_partant   BOOLEAN DEFAULT false,
  scraped_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE (course_id, numero)
);

-- Table arrivees (résultats officiels)
CREATE TABLE IF NOT EXISTS arrivees (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id       UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  ordre_arrivee   INTEGER[] NOT NULL,  -- [3, 7, 11, 2, 9]
  rapport_quinte  DECIMAL(8,2),        -- rapport Quinté+
  rapport_quarte  DECIMAL(8,2),        -- rapport Quarté+
  rapport_tierce  DECIMAL(8,2),        -- rapport Tiercé
  horodatage      TIMESTAMPTZ DEFAULT now(),
  UNIQUE (course_id)
);

-- Index pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_partants_course_id  ON partants(course_id);
CREATE INDEX IF NOT EXISTS idx_arrivees_course_id  ON arrivees(course_id);
CREATE INDEX IF NOT EXISTS idx_partants_numero      ON partants(course_id, numero);

-- RLS : lecture publique, écriture service only
ALTER TABLE partants  ENABLE ROW LEVEL SECURITY;
ALTER TABLE arrivees  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "partants_select_all"  ON partants  FOR SELECT USING (true);
CREATE POLICY "arrivees_select_all"  ON arrivees  FOR SELECT USING (true);
CREATE POLICY "partants_service_all" ON partants  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "arrivees_service_all" ON arrivees  FOR ALL USING (auth.role() = 'service_role');
