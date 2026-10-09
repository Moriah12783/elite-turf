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
--      trois tables. Aucun \s ni \d (la base est en ICU : \d y reconnaît
--      « ٣ », pas JavaScript) : espaces exotiques ramenés à l'espace simple,
--      chiffres écrits [0-9].
--   2. Trois colonnes ORDINAIRES sur `partants`, tenues à jour par un
--      déclencheur BEFORE INSERT OR UPDATE, puis remplies une fois par UPDATE.
--      Pas de colonnes générées : leur ajout réécrit la table sous verrou
--      exclusif (lectures comprises) pendant le calcul des clés, mesuré à 34 s
--      sur 127 317 lignes. Ici l'ajout est instantané et l'UPDATE ne bloque
--      aucune lecture (seulement l'écriture des lignes concernées).
--   3. Une colonne `cle` (unique) sur chevaux / jockeys / entraineurs,
--      remplie par l'ETL (lib/sync/seo-etl.ts).
--   4. Table `acteurs_alias` : ancien slug → clé, remplie par l'ETL, pour
--      rediriger (308) les fiches fusionnées (« c-demuro-56-5 » → « c-demuro »).
--
-- Application : À LA MAIN (SQL Editor ou MCP Supabase), entre 21 h et 23 h UTC
-- (décision D4 de Steph : hors synchros). Ordre de mise en service :
--   migration → vérification de parité (scripts/verif-cles-acteurs-cli.ts)
--   → premier passage réel de l'ETL (CLI, avec forcer_suppressions)
--   → seulement ensuite fusion et déploiement du code.
-- Le code de la branche lit `cle` et les colonnes de clés : déployé avant la
-- migration, les fiches seraient en 404 ; avant l'ETL, sans stats ni liens.
-- L'ancien code en production, lui, ignore ces colonnes.
-- ─────────────────────────────────────────────────────────────────────────

-- Ne jamais faire la queue derrière une longue requête en bloquant tout le monde.
SET lock_timeout = '5s';

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
      lower(regexp_replace(normalize(t, NFD), '[\u0300-\u036F]', '', 'g')),
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
    SELECT regexp_replace(regexp_replace(
      regexp_replace(t, '[\t\n\v\f\r\u0085\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]', ' ', 'g'),
      ' +[0-9]+([.,][0-9]+)? *$', ''), ' *\(S\) *$', '') AS base
  ), p AS (
    SELECT substring(base FROM '\(([^()]*)\) *$') AS suffixe,
           regexp_replace(base, ' *\([^()]*\) *$', '') AS coeur
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

-- ─── ÉTAPE 2 : clés sur partants ─────────────────────────────────────────
ALTER TABLE public.partants
  ADD COLUMN IF NOT EXISTS cheval_cle     text,
  ADD COLUMN IF NOT EXISTS jockey_cle     text,
  ADD COLUMN IF NOT EXISTS entraineur_cle text;

COMMENT ON COLUMN public.partants.cheval_cle IS 'slug_acteur(nom_cheval), tenu par le déclencheur partants_cles_acteurs.';
COMMENT ON COLUMN public.partants.jockey_cle IS 'cle_personne(jockey), tenu par le déclencheur partants_cles_acteurs.';
COMMENT ON COLUMN public.partants.entraineur_cle IS 'cle_personne(entraineur), tenu par le déclencheur partants_cles_acteurs.';

-- Recalculées à chaque écriture : aucun écrivain n'a à les connaître, et une
-- valeur posée à la main est écrasée.
CREATE OR REPLACE FUNCTION public.partants_cles_acteurs()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.cheval_cle     := public.slug_acteur(NEW.nom_cheval);
  NEW.jockey_cle     := public.cle_personne(NEW.jockey);
  NEW.entraineur_cle := public.cle_personne(NEW.entraineur);
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS partants_cles_acteurs ON public.partants;
CREATE TRIGGER partants_cles_acteurs
  BEFORE INSERT OR UPDATE ON public.partants
  FOR EACH ROW EXECUTE FUNCTION public.partants_cles_acteurs();

-- Remplissage initial (~35 s mesurées, lectures non bloquées). Le déclencheur
-- recalcule les trois clés de chaque ligne touchée.
UPDATE public.partants SET cheval_cle = NULL WHERE cheval_cle IS NULL;

CREATE INDEX IF NOT EXISTS idx_partants_cheval_cle     ON public.partants (cheval_cle)     WHERE cheval_cle     IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_partants_jockey_cle     ON public.partants (jockey_cle)     WHERE jockey_cle     IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_partants_entraineur_cle ON public.partants (entraineur_cle) WHERE entraineur_cle IS NOT NULL;

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
-- 2. Parité TypeScript ↔ SQL sur toutes les lignes :
--    node --env-file=.env.local <bundle de scripts/verif-cles-acteurs-cli.ts>
--
-- ─── Retour arrière ──────────────────────────────────────────────────────
-- DROP TABLE public.acteurs_alias;
-- ALTER TABLE public.chevaux DROP COLUMN cle; (idem jockeys, entraineurs)
-- DROP TRIGGER partants_cles_acteurs ON public.partants;
-- DROP FUNCTION public.partants_cles_acteurs();
-- ALTER TABLE public.partants DROP COLUMN cheval_cle, DROP COLUMN jockey_cle, DROP COLUMN entraineur_cle;
-- DROP FUNCTION public.cle_personne(text); DROP FUNCTION public.slug_acteur(text);
