-- ============================================================================
-- Migration : indexes critiques sur chevaux/jockeys/entraineurs/hippodromes.nom
-- ============================================================================
--
-- DATE        : 2026-05-23
-- INCIDENT    : Site en lenteur extrême (jusqu'à 18 min/page) constaté le 22/05.
--               Root cause : sequential scans massifs sur chevaux (400M tuples
--               lus/jour), jockeys (56M), entraineurs (57M) → Supabase Disk IO
--               Budget épuisé (alerte mail 19/05 sur projet cpzjjnmszbyizeqhgrat).
--
-- CAUSE       : PR #120 (maillage interne fiches acteurs) a introduit le helper
--               getKnownSlugsForRows() qui fait 4 queries `.in("nom", [...])` en
--               parallèle sur chevaux/jockeys/entraineurs/hippodromes pour
--               valider les slugs avant d'émettre des <Link> internes.
--
--               Sans index sur la colonne `nom` de ces 4 tables, chaque query
--               WHERE nom IN (...) = seq scan complet. Avec 17k pages/jour
--               servies depuis le sitemap, on accumulait :
--                 - chevaux : 17 720 seq_scans × 23 402 rows = 400 M tuples lus
--                 - jockeys : 17 529 seq_scans × 3 269 rows  =  56 M
--                 - entraineurs : 17 271 × 3 372              =  57 M
--                 - hippodromes : similaire (table de réf.)
--
-- FIX         : 4 indexes B-tree sur la colonne `nom` de chaque table.
--               Effet immédiat (vérifié post-déploiement) :
--                 / (home)        : 1121 s → 0,74 s   (×1500 amélioration)
--                 /pronostics     :  180 s → 1,21 s   (×149)
--                 /courses        :  180 s → 0,95 s   (×189)
--                 /chevaux/<slug> : timeout → 0,60 s
--
-- APPLICATION : Indexes créés en direct via Supabase MCP le 23/05 (urgence
--               production). Cette migration sert de TRACE DANS LE CODE pour
--               qu'un éventuel `supabase db reset` ne les efface pas.
--               IF NOT EXISTS = idempotent, safe à rerun.
--
-- NB : CREATE INDEX CONCURRENTLY ne peut pas être en transaction. Supabase CLI
-- exécute chaque statement séparément, donc OK.
-- ============================================================================

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chevaux_nom
  ON public.chevaux (nom);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_jockeys_nom
  ON public.jockeys (nom);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_entraineurs_nom
  ON public.entraineurs (nom);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_hippodromes_nom
  ON public.hippodromes (nom);

-- Refresh stats du query planner pour qu'il utilise les nouveaux indexes
ANALYZE public.chevaux;
ANALYZE public.jockeys;
ANALYZE public.entraineurs;
ANALYZE public.hippodromes;
