-- ─────────────────────────────────────────────────────────────────────────
-- Migration : clés d'identité des chevaux, jockeys et entraîneurs
-- Date      : 2026-10-09
-- Auteur    : Claude Code (audit des graphies du 09/10/2026)
--
-- Contexte :
-- `partants` garde le nom brut de chaque source : Geny (casse mixte, accents,
-- poids collé au jockey), format PMU via LONACI (MAJUSCULES, « PC.BOUDOT »,
-- « M.SEROR (S) »), saisie admin. Les fiches cherchaient leurs courses par
-- nom EXACT : 15 290 fiches chevaux privées de 36 342 courses, 1 112 fiches
-- jockeys de 14 036, 1 114 fiches entraîneurs de 12 007 (mesure du 09/10).
--
-- Stratégie :
--   1. Deux fonctions IMMUTABLE, miroir EXACT de lib/seo/cles-acteurs.ts :
--        slug_acteur(nom)  = slugify() de lib/seo/slugs.ts (clé d'un cheval)
--        cle_personne(nom) = clé d'un jockey / entraîneur
--      Vérifié le 09/10 : slug_acteur redonne les 41 015 slugs existants des
--      trois tables, et les deux fonctions donnent les mêmes clés que le
--      TypeScript sur les cas de lib/seo/cles-acteurs.test.ts.
--   2. Trois colonnes générées + index sur `partants` (la fiche cherche par
--      clé, toutes graphies confondues). Aucun écrivain n'a à les remplir.
--   3. Une colonne `cle` (unique) sur chevaux / jockeys / entraineurs,
--      remplie par l'ETL (lib/sync/seo-etl.ts). NULL tant que l'ETL n'est pas
--      repassé : aucun lecteur ne casse.
--   4. Table `acteurs_alias` : ancien slug → clé, remplie par l'ETL, pour
--      rediriger (308) les fiches fusionnées (« c-demuro-56-5 » → « c-demuro »).
--
-- Application : À LA MAIN (SQL Editor ou MCP Supabase), entre 21 h et 23 h UTC
-- (décision D4 de Steph : hors synchros), AVANT le premier passage du nouvel
-- ETL et AVANT le déploiement du code qui lit ces colonnes.
-- ⚠️ L'ajout des colonnes générées réécrit `partants` (~127 000 lignes) sous
-- verrou exclusif : quelques secondes pendant lesquelles les écritures de
-- partants attendent.
-- ─────────────────────────────────────────────────────────────────────────

-- ─── ÉTAPE 1 : fonctions de clé ──────────────────────────────────────────
-- Miroir de slugify() : NFD, retrait des accents combinants, minuscules,
-- tout le reste → « - », tirets de bord retirés. '' → NULL.
CREATE OR REPLACE FUNCTION public.slug_acteur(t text)
RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = ''
AS $$
  SELECT NULLIF(
    trim(BOTH '-' FROM regexp_replace(regexp_replace(
      lower(regexp_replace(normalize(t, NFD), '[̀-ͯ]', '', 'g')),
      '[^a-z0-9]+', '-', 'g'), '-{2,}', '-', 'g')),
    '')
$$;

-- Miroir de clePersonne() : sans le poids collé par Geny (« C. Demuro 57,5 »)
-- ni le statut PMU « (S) » ; initiales compactées (« Pc.Boudot » =
-- « P.-C. Boudot ») ; la dernière parenthèse restante (« (T) », « (G) » :
-- homonymes) est gardée, séparée par un tiret.
CREATE OR REPLACE FUNCTION public.cle_personne(t text)
RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = ''
AS $$
  WITH b AS (
    SELECT regexp_replace(regexp_replace(t, '\s+\d+([.,]\d+)?\s*$', ''), '\s*\(S\)\s*$', '') AS base
  ), p AS (
    SELECT substring(base FROM '\(([^()]*)\)\s*$') AS suffixe,
           regexp_replace(base, '\s*\([^()]*\)\s*$', '') AS coeur
    FROM b
  ), c AS (
    SELECT replace(coalesce(public.slug_acteur(coeur), ''), '-', '') AS coeur,
           public.slug_acteur(suffixe) AS suffixe
    FROM p
  )
  SELECT CASE WHEN coeur = '' THEN NULL ELSE coeur || coalesce('-' || suffixe, '') END FROM c
$$;

COMMENT ON FUNCTION public.slug_acteur(text) IS
  'Clé d''un cheval = slug de sa fiche. Miroir de slugify() (lib/seo/slugs.ts) : modifier les deux ensemble.';
COMMENT ON FUNCTION public.cle_personne(text) IS
  'Clé d''un jockey / entraîneur. Miroir de clePersonne() (lib/seo/cles-acteurs.ts) : modifier les deux ensemble.';

-- ─── ÉTAPE 2 : clés générées sur partants ────────────────────────────────
ALTER TABLE public.partants
  ADD COLUMN IF NOT EXISTS cheval_cle     text GENERATED ALWAYS AS (public.slug_acteur(nom_cheval))  STORED,
  ADD COLUMN IF NOT EXISTS jockey_cle     text GENERATED ALWAYS AS (public.cle_personne(jockey))     STORED,
  ADD COLUMN IF NOT EXISTS entraineur_cle text GENERATED ALWAYS AS (public.cle_personne(entraineur)) STORED;

CREATE INDEX IF NOT EXISTS idx_partants_cheval_cle     ON public.partants (cheval_cle)     WHERE cheval_cle     IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_partants_jockey_cle     ON public.partants (jockey_cle)     WHERE jockey_cle     IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_partants_entraineur_cle ON public.partants (entraineur_cle) WHERE entraineur_cle IS NOT NULL;

COMMENT ON COLUMN public.partants.cheval_cle IS 'slug_acteur(nom_cheval) : même cheval quelle que soit la graphie de la source.';
COMMENT ON COLUMN public.partants.jockey_cle IS 'cle_personne(jockey) : même jockey quelle que soit la graphie de la source.';
COMMENT ON COLUMN public.partants.entraineur_cle IS 'cle_personne(entraineur) : même entraîneur quelle que soit la graphie de la source.';

-- ─── ÉTAPE 3 : clé des fiches ────────────────────────────────────────────
ALTER TABLE public.chevaux     ADD COLUMN IF NOT EXISTS cle text;
ALTER TABLE public.jockeys     ADD COLUMN IF NOT EXISTS cle text;
ALTER TABLE public.entraineurs ADD COLUMN IF NOT EXISTS cle text;

CREATE UNIQUE INDEX IF NOT EXISTS chevaux_cle_key     ON public.chevaux     (cle) WHERE cle IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS jockeys_cle_key     ON public.jockeys     (cle) WHERE cle IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS entraineurs_cle_key ON public.entraineurs (cle) WHERE cle IS NOT NULL;

-- ─── ÉTAPE 4 : anciens slugs des fiches fusionnées ───────────────────────
CREATE TABLE IF NOT EXISTS public.acteurs_alias (
  type       text        NOT NULL CHECK (type IN ('chevaux', 'jockeys', 'entraineurs')),
  slug       text        NOT NULL,
  cle        text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (type, slug)
);
COMMENT ON TABLE public.acteurs_alias IS
  'Ancien slug d''une fiche acteur → clé de la fiche qui la remplace (redirection 308). Rempli par l''ETL SEO.';

ALTER TABLE public.acteurs_alias ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acteurs alias are public" ON public.acteurs_alias;
CREATE POLICY "Acteurs alias are public" ON public.acteurs_alias FOR SELECT USING (true);

-- ─── Vérifications (après application) ───────────────────────────────────
-- 1. Colonnes remplies :
--    SELECT count(*) FILTER (WHERE cheval_cle IS NULL) AS sans_cle_cheval,
--           count(DISTINCT cheval_cle) AS chevaux, count(DISTINCT jockey_cle) AS jockeys,
--           count(DISTINCT entraineur_cle) AS entraineurs
--    FROM partants;            -- calculé le 09/10 à 9 h : 0 / 33 924 / 4 570 / 4 661
-- 2. Parité TypeScript ↔ SQL sur toutes les graphies :
--    node --env-file=.env.local <bundle de scripts/verif-cles-acteurs-cli.ts>
--
-- ─── Retour arrière ──────────────────────────────────────────────────────
-- DROP TABLE public.acteurs_alias;
-- ALTER TABLE public.chevaux DROP COLUMN cle; (idem jockeys, entraineurs)
-- ALTER TABLE public.partants DROP COLUMN cheval_cle, DROP COLUMN jockey_cle, DROP COLUMN entraineur_cle;
-- DROP FUNCTION public.cle_personne(text); DROP FUNCTION public.slug_acteur(text);
