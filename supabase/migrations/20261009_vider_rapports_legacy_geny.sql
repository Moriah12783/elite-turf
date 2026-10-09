-- 20261009_vider_rapports_legacy_geny.sql
--
-- ⚠️ À APPLIQUER À LA MAIN (MCP Supabase ou SQL Editor), APRÈS le merge de
-- fix/prefill-geny-sans-rapports et sur GO de Steph. Données seulement :
-- le schéma ne change pas.
--
-- Colonnes legacy arrivees.rapport_quinte / rapport_quarte / rapport_tierce :
-- elles n'étaient écrites que depuis Geny (pré-remplissage admin), dont les
-- rapports étaient faux (audit du 09/10/2026). Depuis cette branche, plus aucun
-- code ne les écrit, et rien ne les lit : ni le code, ni une vue, une fonction
-- ou un trigger en base (vérifié le 09/10/2026). Le ROI passe par
-- pronostics.rapport_gagnant, le banc de mesure par le JSON rapports_pmu.
--
-- Mesure du 09/10/2026 : 406 lignes non vides ; 404 rapports Quinté+ et 373
-- Tiercé diffèrent du rapport PMU (rapports_pmu). Dernière écriture : 28/07/2026.
--
-- Décision de Steph du 09/10/2026 : remettre à NULL, avec sauvegarde.
--
-- Triggers : trg_sync_arrivee_to_course et trg_normaliser_rangs_arrivees ne se
-- déclenchent que sur UPDATE OF ordre_arrivee, rangs → ni `courses` ni les
-- rangs ex æquo ne sont touchés.

BEGIN;

-- 1. Sauvegarde
CREATE TABLE sauvegarde.arrivees_rapports_legacy_geny_20261009 AS
SELECT id, course_id, rapport_quinte, rapport_quarte, rapport_tierce, now() AS sauvegarde_le
FROM public.arrivees
WHERE rapport_quinte IS NOT NULL
   OR rapport_quarte IS NOT NULL
   OR rapport_tierce IS NOT NULL;

-- 2. Vidage
UPDATE public.arrivees
SET rapport_quinte = NULL,
    rapport_quarte = NULL,
    rapport_tierce = NULL
WHERE rapport_quinte IS NOT NULL
   OR rapport_quarte IS NOT NULL
   OR rapport_tierce IS NOT NULL;

COMMIT;

-- 3. Vérification
--   SELECT count(*) FROM sauvegarde.arrivees_rapports_legacy_geny_20261009;  -- 406 attendu (mesure du 09/10)
--   SELECT count(*) FROM public.arrivees
--   WHERE rapport_quinte IS NOT NULL OR rapport_quarte IS NOT NULL OR rapport_tierce IS NOT NULL;  -- 0 attendu
--
-- Retour arrière :
--   UPDATE public.arrivees a
--   SET rapport_quinte = s.rapport_quinte,
--       rapport_quarte = s.rapport_quarte,
--       rapport_tierce = s.rapport_tierce
--   FROM sauvegarde.arrivees_rapports_legacy_geny_20261009 s
--   WHERE s.id = a.id;
