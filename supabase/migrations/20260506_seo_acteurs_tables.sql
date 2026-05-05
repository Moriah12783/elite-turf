-- ============================================================================
-- 20260506_seo_acteurs_tables.sql
--
-- Tables d'acteurs (chevaux/jockeys/entraineurs) pour pages SEO programmatiques.
--
-- Stratégie : tables de référence légères avec slug pré-calculé. partants reste
-- inchangé (pas de FK pour ne pas réécrire pmu-sync/geny-sync). Les routes SEO
-- joignent partants via partants.{nom_cheval,jockey,entraineur}.
--
-- Indexes critiques sur partants (texte) pour perfs :
--   /chevaux/[slug] → SELECT * FROM partants WHERE nom_cheval = X
-- Sans index : seq scan sur 12k+ rows déjà en DB. Avec index : ~1ms.
-- ============================================================================

-- ── Tables référentielles ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.chevaux (
    id          UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    nom         TEXT         NOT NULL,
    slug        TEXT         NOT NULL UNIQUE,
    -- Stats agrégées (mises à jour par ETL/trigger). NULL = pas encore calculé.
    nb_courses          INTEGER,
    nb_victoires        INTEGER,
    nb_places           INTEGER,        -- top 3
    derniere_course_at  DATE,
    -- Dernières observations (pour fiche)
    age         SMALLINT,
    sexe        TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.jockeys (
    id          UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    nom         TEXT         NOT NULL,
    slug        TEXT         NOT NULL UNIQUE,
    nb_courses          INTEGER,
    nb_victoires        INTEGER,
    nb_places           INTEGER,
    derniere_course_at  DATE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.entraineurs (
    id          UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    nom         TEXT         NOT NULL,
    slug        TEXT         NOT NULL UNIQUE,
    nb_courses          INTEGER,
    nb_victoires        INTEGER,
    nb_places           INTEGER,
    derniere_course_at  DATE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes sur les colonnes texte de partants (perf critiques) ───────────
-- Ces index transforment les pages /chevaux/[slug], /jockeys/[slug],
-- /entraineurs/[slug] de "seq scan complet" → "index lookup ~1ms".
CREATE INDEX IF NOT EXISTS idx_partants_nom_cheval ON public.partants (nom_cheval) WHERE nom_cheval IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_partants_jockey     ON public.partants (jockey)     WHERE jockey     IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_partants_entraineur ON public.partants (entraineur) WHERE entraineur IS NOT NULL;

-- Index courses pour join performant date_course → arrivee_officielle
CREATE INDEX IF NOT EXISTS idx_courses_date_termine ON public.courses (date_course DESC) WHERE statut = 'TERMINE';

-- ── Index slug (lookups SEO) ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_chevaux_slug    ON public.chevaux    (slug);
CREATE INDEX IF NOT EXISTS idx_jockeys_slug    ON public.jockeys    (slug);
CREATE INDEX IF NOT EXISTS idx_entraineurs_slug ON public.entraineurs (slug);

-- Index pour tri par activité (pages index "top 50 jockeys")
CREATE INDEX IF NOT EXISTS idx_chevaux_derniere    ON public.chevaux    (derniere_course_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_jockeys_derniere    ON public.jockeys    (derniere_course_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_entraineurs_derniere ON public.entraineurs (derniere_course_at DESC NULLS LAST);

-- ── RLS : lecture publique (SEO), écriture service_role uniquement ──────
ALTER TABLE public.chevaux     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jockeys     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entraineurs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Chevaux are public"     ON public.chevaux     FOR SELECT USING (true);
CREATE POLICY "Jockeys are public"     ON public.jockeys     FOR SELECT USING (true);
CREATE POLICY "Entraineurs are public" ON public.entraineurs FOR SELECT USING (true);

-- ── Updated_at trigger ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER chevaux_updated_at      BEFORE UPDATE ON public.chevaux      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER jockeys_updated_at      BEFORE UPDATE ON public.jockeys      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER entraineurs_updated_at  BEFORE UPDATE ON public.entraineurs  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── COMMENT pour intent ──────────────────────────────────────────────────
COMMENT ON TABLE public.chevaux     IS 'Chevaux référencés (SEO). Slug unique pour /chevaux/[slug]. Stats agrégées par ETL.';
COMMENT ON TABLE public.jockeys     IS 'Jockeys référencés (SEO). Slug unique pour /jockeys/[slug]. Stats agrégées par ETL.';
COMMENT ON TABLE public.entraineurs IS 'Entraîneurs référencés (SEO). Slug unique pour /entraineurs/[slug]. Stats agrégées par ETL.';
