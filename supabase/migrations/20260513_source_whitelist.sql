-- ============================================================
-- 20260513_source_whitelist.sql
--
-- Multi-Agents IA Elite-Turf — Session 2 / migration 1 sur 3.
-- Conforme cahier des charges §21 (Table whitelist interne).
--
-- Crée la table `public.source_whitelist` qui catalogue toutes les
-- sources autorisées (et interdites) pour la validation Afrique des
-- courses PMU. Sans cette table, les agents IA ne peuvent pas opérer.
--
-- 🚨 RÈGLE ABSOLUE :
--   Une course ne peut être validée Afrique QUE si elle est confirmée
--   par une source dont can_validate_africa_availability = true.
--
-- Tiers (cf lib/ai-pronostics/types.ts) :
--   - PRIMARY                          : source officielle forte (LONACI, PMU.fr, SOREC…)
--   - DISCIPLINE_OFFICIAL              : confirme une discipline (LeTROT, France Galop)
--   - AFRICA_CORROBORATION             : opérateur national Afrique (LONASE, LONAB, PMUC…)
--   - PRIMARY_OR_AFRICA_CORROBORATION  : double rôle (SOREC pour le Maroc)
--   - SECONDARY                        : enrichissement uniquement (Geny, Turf-FR)
--   - FORBIDDEN                        : rejet automatique (Telegram, forums)
--
-- IMPACT PRODUCTION : zéro. Nouvelle table isolée, aucune lecture par
-- les chemins de l'application actuelle. Les agents IA (qui la liront)
-- sont encore désactivés (cf cron ia-pronostics-v2 → stub).
--
-- Idempotent : CREATE TABLE IF NOT EXISTS + INSERT … ON CONFLICT DO NOTHING.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.source_whitelist (
  id                                UUID         DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Identité de la source
  name                              TEXT         NOT NULL,
  domain                            TEXT         NOT NULL,
  country                           TEXT,                                  -- ISO-2 (CI, FR, MA, SN…)

  -- Classification (alignée sur SourceTier / SourceRole de types.ts)
  source_tier                       TEXT         NOT NULL
    CHECK (source_tier IN (
      'PRIMARY',
      'DISCIPLINE_OFFICIAL',
      'AFRICA_CORROBORATION',
      'SECONDARY',
      'INTERNAL_WHITELIST',
      'FORBIDDEN'
    )),
  source_role                       TEXT         NOT NULL,

  -- Drapeaux de capacité
  is_official                       BOOLEAN      NOT NULL DEFAULT false,
  is_africa_operator                BOOLEAN      NOT NULL DEFAULT false,
  can_validate_africa_availability  BOOLEAN      NOT NULL DEFAULT false,
  can_confirm_discipline            BOOLEAN      NOT NULL DEFAULT false,
  can_enrich_analysis               BOOLEAN      NOT NULL DEFAULT false,
  is_forbidden                      BOOLEAN      NOT NULL DEFAULT false,
  enabled                           BOOLEAN      NOT NULL DEFAULT true,

  -- Métadonnées
  notes                             TEXT,
  last_verified_at                  TIMESTAMPTZ,
  created_at                        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at                        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  -- Une seule entrée par domaine (clé naturelle)
  CONSTRAINT source_whitelist_domain_unique UNIQUE (domain)
);

-- ─────────────────────────────────────────────────────────────────────────
-- Index — patterns de requête prévus par les agents
-- ─────────────────────────────────────────────────────────────────────────

-- Recherche rapide par tier + statut activé (utilisé par CourseSelector)
CREATE INDEX IF NOT EXISTS idx_source_whitelist_tier_enabled
  ON public.source_whitelist (source_tier, enabled)
  WHERE enabled = true;

-- Récupération des validateurs Afrique (utilisé pour valider une course)
CREATE INDEX IF NOT EXISTS idx_source_whitelist_africa_validator
  ON public.source_whitelist (can_validate_africa_availability)
  WHERE enabled = true AND can_validate_africa_availability = true;

-- Récupération des confirmateurs de discipline
CREATE INDEX IF NOT EXISTS idx_source_whitelist_discipline_confirmer
  ON public.source_whitelist (can_confirm_discipline)
  WHERE enabled = true AND can_confirm_discipline = true;

-- ─────────────────────────────────────────────────────────────────────────
-- Trigger updated_at
-- ─────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.touch_source_whitelist_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_source_whitelist_updated_at ON public.source_whitelist;
CREATE TRIGGER trg_source_whitelist_updated_at
  BEFORE UPDATE ON public.source_whitelist
  FOR EACH ROW EXECUTE FUNCTION public.touch_source_whitelist_updated_at();

-- ─────────────────────────────────────────────────────────────────────────
-- RLS — whitelist lisible (pas de donnée sensible), écriture service_role
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE public.source_whitelist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "source_whitelist_read_all"  ON public.source_whitelist;
DROP POLICY IF EXISTS "source_whitelist_write_svc" ON public.source_whitelist;

-- Lecture : tous les rôles authentifiés (et anon) — la liste n'est pas sensible
CREATE POLICY "source_whitelist_read_all"
  ON public.source_whitelist FOR SELECT
  USING (true);

-- Écriture : service_role uniquement (jamais depuis l'app)
CREATE POLICY "source_whitelist_write_svc"
  ON public.source_whitelist FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ─────────────────────────────────────────────────────────────────────────
-- Commentaires (auto-documentation pour le dashboard Supabase)
-- ─────────────────────────────────────────────────────────────────────────

COMMENT ON TABLE  public.source_whitelist IS
  'Cahier §21 — Whitelist des sources autorisées pour la validation Afrique. '
  'Lue par les agents IA (CourseSelector, QualityValidator) à chaque run.';

COMMENT ON COLUMN public.source_whitelist.source_tier IS
  'PRIMARY | DISCIPLINE_OFFICIAL | AFRICA_CORROBORATION | SECONDARY | INTERNAL_WHITELIST | FORBIDDEN. '
  'NB: le cahier §21 mentionne PRIMARY_OR_AFRICA_CORROBORATION pour SOREC — '
  'sémantique portée par les flags can_validate_africa_availability + can_confirm_discipline.';

COMMENT ON COLUMN public.source_whitelist.can_validate_africa_availability IS
  'Si true, cette source peut SEULE (si PRIMARY) ou avec corroboration valider la dispo Afrique d''une course.';

COMMENT ON COLUMN public.source_whitelist.is_forbidden IS
  'Si true, toute course référencée par cette source est REJETÉE automatiquement (cahier §5.4).';

-- ============================================================
-- SEED — 17 entrées cohérentes avec lib/ai-pronostics/sources.ts
-- ============================================================

INSERT INTO public.source_whitelist (
  name, domain, country, source_tier, source_role,
  is_official, is_africa_operator,
  can_validate_africa_availability, can_confirm_discipline, can_enrich_analysis,
  is_forbidden, enabled, notes
) VALUES
  -- ── PRIMAIRES (validation forte) ─────────────────────────────────────
  ('LONACI', 'pmu.lonacionline.ci', 'CI',
   'PRIMARY', 'AFRICA_AVAILABILITY',
   true, true,
   true, false, false,
   false, true,
   'Source primaire de validation Afrique directe. Côte d''Ivoire (≈90% audience).'),

  ('lonaci.ci', 'lonaci.ci', 'CI',
   'PRIMARY', 'AFRICA_AVAILABILITY',
   true, true,
   true, false, false,
   false, true,
   'Domaine institutionnel LONACI (Côte d''Ivoire).'),

  ('PMU.fr', 'pmu.fr', 'FR',
   'PRIMARY', 'CENTRAL_PROGRAM',
   true, false,
   false, true, true,
   false, true,
   'Programme central PMU France. Confirme la course mais NE valide PAS la dispo Afrique.'),

  -- ── DISCIPLINES OFFICIELLES ──────────────────────────────────────────
  ('LeTROT', 'letrot.com', 'FR',
   'DISCIPLINE_OFFICIAL', 'DISCIPLINE_CONFIRMATION',
   true, false,
   false, true, true,
   false, true,
   'Confirme TROT_ATTELE et TROT_MONTE.'),

  ('France Galop', 'france-galop.com', 'FR',
   'DISCIPLINE_OFFICIAL', 'DISCIPLINE_CONFIRMATION',
   true, false,
   false, true, true,
   false, true,
   'Confirme PLAT, HAIES, STEEPLE.'),

  -- ── MAROC (double rôle : courses + Afrique) ──────────────────────────
  ('SOREC', 'sorec.ma', 'MA',
   'PRIMARY', 'MAROC_COURSES_AND_AVAILABILITY',
   true, true,
   true, true, true,
   false, true,
   'Source officielle Maroc — courses ET validation Afrique pour le Maroc.'),

  ('e-SOREC', 'e-sorec.ma', 'MA',
   'PRIMARY', 'MAROC_COURSES_AND_AVAILABILITY',
   true, true,
   true, true, true,
   false, true,
   'Plateforme paris en ligne SOREC.'),

  -- ── CORROBORATION AFRIQUE (opérateurs nationaux) ─────────────────────
  ('LONASE', 'lonase.bet', 'SN',
   'AFRICA_CORROBORATION', 'AFRICA_AVAILABILITY',
   true, true,
   true, false, false,
   false, true,
   'Loterie Nationale Sénégalaise.'),

  ('LONAB', 'lonab.bf', 'BF',
   'AFRICA_CORROBORATION', 'AFRICA_AVAILABILITY',
   true, true,
   true, false, false,
   false, true,
   'PMU''B Burkina Faso.'),

  ('PMUB', 'pmub.bj', 'BJ',
   'AFRICA_CORROBORATION', 'AFRICA_AVAILABILITY',
   true, true,
   true, false, false,
   false, true,
   'PMU Bénin / Loterie Nationale du Bénin.'),

  ('PMUC', 'pmuc.cm', 'CM',
   'AFRICA_CORROBORATION', 'AFRICA_AVAILABILITY',
   true, true,
   true, false, false,
   false, true,
   'PMU Cameroun.'),

  ('PMUG', 'pmug.ga', 'GA',
   'AFRICA_CORROBORATION', 'AFRICA_AVAILABILITY',
   true, true,
   true, false, false,
   false, true,
   'PMU Gabon.'),

  ('PMU Mali', 'pmu.ml', 'ML',
   'AFRICA_CORROBORATION', 'AFRICA_AVAILABILITY',
   true, true,
   true, false, false,
   false, true,
   'PMU Mali officiel.'),

  -- ── SECONDAIRES (enrichissement uniquement) ──────────────────────────
  ('Geny', 'geny.com', 'FR',
   'SECONDARY', 'DATA_ENRICHMENT',
   false, false,
   false, false, true,
   false, true,
   'Site non-officiel mais bon scraper musique/cotes. NE VALIDE PAS Afrique seul.'),

  ('Genybet', 'genybet.fr', 'FR',
   'SECONDARY', 'DATA_ENRICHMENT',
   false, false,
   false, false, true,
   false, true,
   'Bookmaker en ligne, secondaire.'),

  ('Geny Courses', 'geny-courses.com', 'FR',
   'SECONDARY', 'DATA_ENRICHMENT',
   false, false,
   false, false, true,
   false, true,
   'Sous-domaine éditorial Geny.'),

  ('Turf-FR', 'turf-fr.com', 'FR',
   'SECONDARY', 'DATA_ENRICHMENT',
   false, false,
   false, false, true,
   false, true,
   'Données enrichissement secondaires.')

ON CONFLICT (domain) DO NOTHING;
