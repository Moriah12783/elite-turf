-- ============================================================
-- Migration : Correction des liens Geny (URL dynamiques)
-- Date      : 2026-03-28
--
-- Reconstruit les liens lien_geny pour tous les pronostics
-- en se basant sur date_course / numero_reunion / numero_course
-- Format : https://www.geny.com/resultats-pmu/YYYYMMDDrRRcCC
-- ============================================================

UPDATE pronostics p
SET lien_geny = (
  SELECT
    'https://www.geny.com/resultats-pmu/' ||
    REPLACE(c.date_course::text, '-', '') ||
    'r' || LPAD(c.numero_reunion::text, 2, '0') ||
    'c' || LPAD(c.numero_course::text, 2, '0')
  FROM courses c
  WHERE c.id = p.course_id
  LIMIT 1
)
WHERE p.course_id IS NOT NULL;

-- Vérification : afficher les 10 premiers liens générés
SELECT
  p.id,
  c.date_course,
  c.numero_reunion,
  c.numero_course,
  p.lien_geny
FROM pronostics p
JOIN courses c ON c.id = p.course_id
ORDER BY c.date_course DESC
LIMIT 10;
