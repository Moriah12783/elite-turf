-- ─────────────────────────────────────────────────────────────────────────
-- Migration : rangs officiels de l'arrivée (ex æquo / dead heat)
-- Date      : 2026-10-08
-- Auteur    : Claude Code (audit ex æquo du 08/10/2026)
--
-- Contexte :
-- L'arrivée est stockée à plat (`arrivees.ordre_arrivee`,
-- `courses.arrivee_officielle`) et la position dans la liste servait de rang.
-- Le PMU classe les ex æquo au même rang : Prix de Versailles, Quinté+ du
-- 08/10/2026, `[[1],[5],[8],[4],[15,16],[10]]` → 15 et 16 sont 5es tous les
-- deux (le PMU paie 1-5-8-4-15 ET 1-5-8-4-16). À plat, le 16 passait 6e.
-- Mesure PMU sur un an : 1,7 % des courses françaises ont un ex æquo,
-- ~5 Quinté+ par an en ont un à cheval sur la 5e place.
--
-- Stratégie :
--   1. Une colonne de RANGS parallèle à l'arrivée, sur les deux tables :
--      [1,5,8,4,15,16,10] ↔ [1,2,3,4,5,5,7]. NULL = ordre strict (98 % des
--      courses, tout l'historique) : aucun lecteur existant n'est touché.
--   2. Un garde-fou BEFORE sur chaque table : des rangs incohérents avec
--      l'arrivée, ou devenus périmés (arrivée réécrite sans ses rangs, ex.
--      saisie admin), repassent à NULL. Un rang douteux ne bloque JAMAIS
--      l'écriture d'une arrivée : on retombe sur l'ordre strict.
--   3. Le déclencheur arrivees → courses recopie aussi les rangs.
--
-- Application : À LA MAIN (SQL Editor ou MCP Supabase), AVANT le déploiement
-- du code qui écrit ces colonnes. Sans les colonnes, ce code verrait ses
-- écritures d'arrivées refusées.
-- ─────────────────────────────────────────────────────────────────────────

-- ─── ÉTAPE 1 : colonnes ──────────────────────────────────────────────────
ALTER TABLE arrivees ADD COLUMN IF NOT EXISTS rangs         INTEGER[];
ALTER TABLE courses  ADD COLUMN IF NOT EXISTS arrivee_rangs INTEGER[];

COMMENT ON COLUMN arrivees.rangs IS
  'Rang officiel PMU de chaque cheval de ordre_arrivee ([1,2,3,4,5,5,7] : deux 5es ex aequo). NULL = ordre strict.';
COMMENT ON COLUMN courses.arrivee_rangs IS
  'Rang officiel PMU de chaque cheval de arrivee_officielle (cf. arrivees.rangs). NULL = ordre strict.';

-- ─── ÉTAPE 2 : cohérence (miroir de rangsValides, lib/courses/rangs.ts) ──
-- Le premier rang vaut 1 ; chaque rang suivant reprend celui d'avant (ex
-- æquo) ou vaut sa position (5, 5, 7). Même longueur que l'arrivée.
CREATE OR REPLACE FUNCTION rangs_arrivee_coherents(ordre INTEGER[], rangs INTEGER[])
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  n INTEGER := COALESCE(ARRAY_LENGTH(ordre, 1), 0);
BEGIN
  IF rangs IS NULL THEN RETURN TRUE; END IF;
  IF n = 0 OR COALESCE(ARRAY_LENGTH(rangs, 1), 0) <> n THEN RETURN FALSE; END IF;
  IF rangs[1] IS DISTINCT FROM 1 THEN RETURN FALSE; END IF;
  FOR i IN 2..n LOOP
    IF rangs[i] IS NULL OR (rangs[i] <> rangs[i - 1] AND rangs[i] <> i) THEN
      RETURN FALSE;
    END IF;
  END LOOP;
  RETURN TRUE;
END;
$$;

-- ─── ÉTAPE 3 : garde-fous BEFORE ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION normaliser_rangs_arrivees()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Arrivée réécrite sans ses rangs → les anciens rangs ne lui correspondent plus.
  IF TG_OP = 'UPDATE'
     AND NEW.ordre_arrivee IS DISTINCT FROM OLD.ordre_arrivee
     AND NEW.rangs IS NOT DISTINCT FROM OLD.rangs
  THEN
    NEW.rangs := NULL;
  END IF;
  IF NOT rangs_arrivee_coherents(NEW.ordre_arrivee, NEW.rangs) THEN
    RAISE WARNING 'arrivees % : rangs % incoherents avec %, ignores', NEW.course_id, NEW.rangs, NEW.ordre_arrivee;
    NEW.rangs := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION normaliser_rangs_courses()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Profondeur 1 seulement : quand c'est la synchro arrivees → courses qui
  -- écrit (profondeur 2), elle recopie des rangs déjà vérifiés côté arrivees.
  IF TG_OP = 'UPDATE'
     AND pg_trigger_depth() = 1
     AND NEW.arrivee_officielle IS DISTINCT FROM OLD.arrivee_officielle
     AND NEW.arrivee_rangs IS NOT DISTINCT FROM OLD.arrivee_rangs
  THEN
    NEW.arrivee_rangs := NULL;
  END IF;
  IF NOT rangs_arrivee_coherents(NEW.arrivee_officielle, NEW.arrivee_rangs) THEN
    RAISE WARNING 'courses % : rangs % incoherents avec %, ignores', NEW.id, NEW.arrivee_rangs, NEW.arrivee_officielle;
    NEW.arrivee_rangs := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normaliser_rangs_arrivees ON arrivees;
CREATE TRIGGER trg_normaliser_rangs_arrivees
BEFORE INSERT OR UPDATE OF ordre_arrivee, rangs ON arrivees
FOR EACH ROW
EXECUTE FUNCTION normaliser_rangs_arrivees();

DROP TRIGGER IF EXISTS trg_normaliser_rangs_courses ON courses;
CREATE TRIGGER trg_normaliser_rangs_courses
BEFORE INSERT OR UPDATE OF arrivee_officielle, arrivee_rangs ON courses
FOR EACH ROW
EXECUTE FUNCTION normaliser_rangs_courses();

-- ─── ÉTAPE 4 : la synchro arrivees → courses recopie les rangs ───────────
-- Reprise de 20260517_sync_arrivees_to_courses.sql (identique en base au
-- 08/10/2026), avec les rangs en plus.
CREATE OR REPLACE FUNCTION sync_arrivee_to_course()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Sync uniquement si on a une arrivee valide (>=3 chevaux, format ARRAY int)
  IF NEW.ordre_arrivee IS NOT NULL
     AND ARRAY_LENGTH(NEW.ordre_arrivee, 1) >= 3
  THEN
    UPDATE courses
    SET
      arrivee_officielle = NEW.ordre_arrivee,
      arrivee_rangs      = NEW.rangs,
      statut             = 'TERMINE',
      updated_at         = NOW()
    WHERE id = NEW.course_id
      -- Update seulement si difference (evite no-op + cascade triggers)
      AND (
        arrivee_officielle IS DISTINCT FROM NEW.ordre_arrivee
        OR arrivee_rangs IS DISTINCT FROM NEW.rangs
        OR statut != 'TERMINE'
      );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_arrivee_to_course ON arrivees;
CREATE TRIGGER trg_sync_arrivee_to_course
AFTER INSERT OR UPDATE OF ordre_arrivee, rangs ON arrivees
FOR EACH ROW
EXECUTE FUNCTION sync_arrivee_to_course();

-- ─── ÉTAPE 5 : contrôle ──────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT rangs_arrivee_coherents(ARRAY[1,5,8,4,15,16,10], ARRAY[1,2,3,4,5,5,7]) THEN
    RAISE EXCEPTION 'rangs_arrivee_coherents refuse le cas Versailles';
  END IF;
  IF rangs_arrivee_coherents(ARRAY[1,5,8,4,15,16,10], ARRAY[1,2,3,4,5,6,6,8]) THEN
    RAISE EXCEPTION 'rangs_arrivee_coherents accepte une longueur fausse';
  END IF;
  IF rangs_arrivee_coherents(ARRAY[3,7,2], ARRAY[1,3,3]) THEN
    RAISE EXCEPTION 'rangs_arrivee_coherents accepte un rang saute';
  END IF;
  IF EXISTS (SELECT 1 FROM arrivees WHERE rangs IS NOT NULL)
     OR EXISTS (SELECT 1 FROM courses WHERE arrivee_rangs IS NOT NULL) THEN
    RAISE NOTICE 'Des rangs existent deja (migration rejouee ?)';
  END IF;
  RAISE NOTICE 'Rangs d''arrivee : colonnes, garde-fous et synchro en place';
END $$;
