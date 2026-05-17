-- ─────────────────────────────────────────────────────────────────────────
-- Migration : Sync définitif arrivees → courses
-- Date      : 2026-05-17
-- Auteur    : Claude Code (fix incident "Course pas encore disputée")
--
-- Contexte :
-- 96 courses desync detectees sur 30 jours (statut=PROGRAMME en table courses
-- mais arrivee deja saisie en table arrivees). Cause probable : le cron
-- geny-arrivees fait 2 upserts separes (courses + arrivees) sans gestion
-- d'erreur sur le premier, donc parfois courses n'est pas update mais
-- arrivees l'est.
--
-- Le user voit alors dans /admin/arrivees "Course pas encore disputee
-- (statut=PROGRAMME)" alors qu'elle a deja eu lieu et que son arrivee est
-- en BDD. Le pre-remplissage Geny est bloque par le garde-fou statut=TERMINE.
--
-- Strategie :
--   1. Backfill : UPDATE courses pour les 96 courses desync (source de
--      verite = table arrivees)
--   2. Trigger AFTER INSERT/UPDATE sur arrivees → sync automatique pour
--      eviter la regression a l'avenir, quel que soit le caller (API admin,
--      cron, manual SQL, futur tooling)
-- ─────────────────────────────────────────────────────────────────────────

-- ─── ÉTAPE 1 : Backfill des courses desync ───────────────────────────────
UPDATE courses c
SET
  arrivee_officielle = a.ordre_arrivee,
  statut             = 'TERMINE',
  updated_at         = NOW()
FROM arrivees a
WHERE a.course_id = c.id
  AND (c.arrivee_officielle IS NULL OR c.statut != 'TERMINE')
  AND a.ordre_arrivee IS NOT NULL
  AND ARRAY_LENGTH(a.ordre_arrivee, 1) >= 3;

-- ─── ÉTAPE 2 : Fonction trigger de sync ──────────────────────────────────
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
      statut             = 'TERMINE',
      updated_at         = NOW()
    WHERE id = NEW.course_id
      -- Update seulement si difference (evite no-op + cascade triggers)
      AND (
        arrivee_officielle IS DISTINCT FROM NEW.ordre_arrivee
        OR statut != 'TERMINE'
      );
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION sync_arrivee_to_course() IS
  'Sync auto arrivees.ordre_arrivee -> courses.arrivee_officielle + statut=TERMINE.
   Evite la desync historique (96 courses concernees au 17/05/2026).';

-- ─── ÉTAPE 3 : Attach le trigger ─────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_sync_arrivee_to_course ON arrivees;

CREATE TRIGGER trg_sync_arrivee_to_course
AFTER INSERT OR UPDATE OF ordre_arrivee ON arrivees
FOR EACH ROW
EXECUTE FUNCTION sync_arrivee_to_course();

-- ─── ÉTAPE 4 : Audit final ───────────────────────────────────────────────
DO $$
DECLARE
  desync_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO desync_count
  FROM courses c
  JOIN arrivees a ON a.course_id = c.id
  WHERE (c.arrivee_officielle IS NULL OR c.statut != 'TERMINE')
    AND a.ordre_arrivee IS NOT NULL
    AND ARRAY_LENGTH(a.ordre_arrivee, 1) >= 3;

  IF desync_count > 0 THEN
    RAISE EXCEPTION 'Backfill incomplet : % courses encore desync', desync_count;
  END IF;

  RAISE NOTICE 'Sync arrivees->courses OK : 0 desync restant';
END $$;
