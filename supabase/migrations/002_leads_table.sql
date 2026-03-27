-- Table leads : capture d'emails via le guide gratuit
CREATE TABLE IF NOT EXISTS leads (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  prenom      TEXT        NOT NULL,
  email       TEXT        NOT NULL,
  source      TEXT        NOT NULL DEFAULT 'guide-gratuit',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour éviter les doublons et accélérer les recherches
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_source ON leads(source);

-- RLS : seul le service role (admin) peut lire les leads
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only" ON leads
  FOR ALL USING (auth.role() = 'service_role');
