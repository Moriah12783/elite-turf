-- ─────────────────────────────────────────────────────────────────────────
-- Migration : Cleanup des acteurs pollués (poids confondus avec noms)
-- Date      : 2026-05-14
-- Contexte  : Le scraper Geny avait un bug de mapping colonnes (PLAT vs TROT)
--             du 4 au 13 mai 2026. ~34 % des partants ingérés sur cette
--             période ont reçu un poids handicap (ex "57", "56,5") dans la
--             colonne jockey ou entraineur. Conséquences :
--               - partants : 1 192 jockey_numerique + 167 entraineur_numerique
--               - jockeys  : 105 entrées polluées sur 1 178 (9 %)
--               - entraineurs : 236 entrées polluées sur 1 387 (17 %)
--
--             Le bug a été corrigé le 14/05 (mapping dynamique du <thead>
--             dans lib/geny.ts) + garde-fou défensif looksLikeNumeric()
--             ajouté dans cette PR. Cette migration nettoie l'existant.
--
-- Stratégie :
--   1. partants : on UPDATE (jockey/entraineur → NULL) plutôt que DELETE
--      car les autres champs (cote, musique, nom_cheval) restent valides.
--   2. jockeys / entraineurs : on DELETE les entrées 100 % numériques
--      (impossible que ce soient de vrais noms). Les FK sont nominales
--      (par nom, pas par UUID) donc pas de cascade orpheline.
--   3. On exécute en transaction pour idempotence.
-- ─────────────────────────────────────────────────────────────────────────

BEGIN;

-- 1. partants : nettoyer les champs pollués (jockey 100 % numérique)
--    On récupère le poids dans poids_kg si vide ET nombre dans plage [30,100]
UPDATE partants
SET
  poids_kg = COALESCE(
    poids_kg,
    CASE
      WHEN jockey ~ '^-?[0-9]+([,.][0-9]+)?$'
        AND REPLACE(jockey, ',', '.')::numeric BETWEEN 30 AND 100
      THEN REPLACE(jockey, ',', '.')::numeric
      ELSE NULL
    END
  ),
  jockey = NULL
WHERE jockey ~ '^-?[0-9]+([,.][0-9]+)?$';

-- 2. partants : nettoyer les entraineurs numériques (pas de récupération
--    possible, aucun layout Geny ne met un nombre dans cette colonne)
UPDATE partants
SET entraineur = NULL
WHERE entraineur ~ '^-?[0-9]+([,.][0-9]+)?$';

-- 3. partants : nettoyer les valeurs "-" sentinelles (déjà en NULL conceptuel)
UPDATE partants SET jockey     = NULL WHERE jockey     = '-';
UPDATE partants SET entraineur = NULL WHERE entraineur = '-';

-- 4. Tables référentielles : supprimer les entrées 100 % numériques
DELETE FROM jockeys
WHERE nom ~ '^-?[0-9]+([,.][0-9]+)?$'
   OR nom = '-'
   OR LENGTH(TRIM(nom)) <= 1;

DELETE FROM entraineurs
WHERE nom ~ '^-?[0-9]+([,.][0-9]+)?$'
   OR nom = '-'
   OR LENGTH(TRIM(nom)) <= 1;

-- 5. Audit log : compter ce qui reste après cleanup pour QA
DO $$
DECLARE
  jockey_remaining   INTEGER;
  entr_remaining     INTEGER;
  partants_jockey    INTEGER;
  partants_entr      INTEGER;
BEGIN
  SELECT COUNT(*) INTO jockey_remaining FROM jockeys
    WHERE nom ~ '^-?[0-9]+([,.][0-9]+)?$';
  SELECT COUNT(*) INTO entr_remaining FROM entraineurs
    WHERE nom ~ '^-?[0-9]+([,.][0-9]+)?$';
  SELECT COUNT(*) INTO partants_jockey FROM partants
    WHERE jockey ~ '^-?[0-9]+([,.][0-9]+)?$';
  SELECT COUNT(*) INTO partants_entr FROM partants
    WHERE entraineur ~ '^-?[0-9]+([,.][0-9]+)?$';

  IF jockey_remaining > 0 OR entr_remaining > 0
     OR partants_jockey > 0 OR partants_entr > 0 THEN
    RAISE EXCEPTION 'Cleanup incomplet — jockey:% entr:% partants_j:% partants_e:%',
      jockey_remaining, entr_remaining, partants_jockey, partants_entr;
  END IF;

  RAISE NOTICE 'Cleanup acteurs OK : 0 nom numerique restant';
END $$;

COMMIT;
