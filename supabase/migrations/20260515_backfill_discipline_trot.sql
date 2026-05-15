-- ────────────────────────────────────────────────────────────────────────────
-- Migration : Backfill discipline pour hippodromes 100% mono-discipline
-- Date      : 2026-05-15 (après PR Mouvement 2 fix TROT)
-- Contexte  : `lib/sync/geny-programme.ts` insérait toutes les nouvelles
--             courses avec `categorie='PLAT'` en dur (la page programme
--             Geny n'expose pas la discipline). Résultat : 34 courses
--             Vincennes étiquetées PLAT alors que Vincennes est ~100% TROT.
--
-- Ce backfill est SÉLECTIF : on ne corrige que les hippodromes que la
-- connaissance turf valide comme 100% mono-discipline (Vincennes, Cabourg,
-- Auteuil, etc.). Les hippodromes alternants (Vichy, Strasbourg, Toulouse,
-- Compiègne) sont laissés intacts — ils seront corrigés au cas par cas par
-- `enrichir-partants` à son prochain tick (qui lit la discipline du HTML
-- partants Geny via la nouvelle `parseDisciplineFromHtml`).
-- ────────────────────────────────────────────────────────────────────────────

-- NB : ce backfill a déjà été appliqué via Supabase MCP le 2026-05-15.
-- Le fichier est commit pour l'historique git uniquement (audit trail).
-- Idempotent : la WHERE `b.new_cat <> b.old` rend une 2e exécution no-op.

WITH backfill AS (
  SELECT c.id, c.categorie AS old,
    CASE
      WHEN h.nom IN ('Vincennes','Paris-Vincennes','Cabourg','Enghien','Enghien-Soisy',
                     'Le Croisé-Laroche','Wolvega','Mons','Kortrijk',
                     'Cordemais','Argentan','Cherbourg','Saint-Brieuc','Saint Brieuc',
                     'Laval','Le Mont-Saint-Michel','Cholet','La Capelle',
                     'Maure-de-Bretagne','Cavaillon','Oraison','Beaumont-de-Lomagne',
                     'Châtelaillon-La Rochelle','Châteaubriant','Chateaubriant',
                     'Vire','Le Lion-d&#039;Angers') THEN 'TROT'
      WHEN h.nom = 'Auteuil' THEN 'OBSTACLE'
    END AS new_cat
  FROM public.courses c
  JOIN public.hippodromes h ON h.id = c.hippodrome_id
)
UPDATE public.courses
SET categorie = b.new_cat,
    updated_at = NOW()
FROM backfill b
WHERE public.courses.id = b.id
  AND b.new_cat IS NOT NULL
  AND b.new_cat <> b.old;
