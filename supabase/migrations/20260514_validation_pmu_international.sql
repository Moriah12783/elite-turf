-- ============================================================
-- 20260514_validation_pmu_international.sql
--
-- Multi-Agents IA Elite-Turf — 3e palier de validation Afrique.
-- Conforme cahier des charges §4 amendé (décision PO 2026-05-14).
--
-- 🎯 OBJECTIF
--   Ajouter le statut `VALIDATION_PMU_INTERNATIONAL` à la liste des
--   validation_status acceptés dans la table ai_pronostic_drafts.
--
--   Ce 3e palier reconnaît qu'une course PMU France peut être validée
--   Afrique (jouable côté abonnés africains francophones) si elle remplit
--   AU MOINS UN des critères de redistribution internationale :
--     A. Pari premium     : QUINTE_PLUS / QUARTE / TIERCE
--     B. Co-localisation  : autre course du même meeting (hippodrome, R)
--                           est VALIDATION_LONACI_DIRECTE
--     C. Réunion 1 (R1)   : numero_reunion = 1 (réunion vedette du jour)
--
--   Logique d'évaluation côté code :
--     lib/ai-pronostics/source-crawlers/index.ts (evaluatePmuInternational)
--
-- 🚦 IMPACT PRODUCTION
--   - Pas de breaking change. Les 2 paliers existants (LONACI directe,
--     Afrique corroborée) gardent leur sémantique.
--   - Les drafts existants ne sont PAS modifiés (UPDATE n'est pas
--     déclenché par ALTER TABLE).
--   - Le pipeline ia-pronostics-v2 va commencer à générer des drafts
--     PMU_INTERNATIONAL dès la prochaine exécution (~3-6 drafts/jour
--     supplémentaires attendus selon les estimations).
--
-- 🔁 ROLLBACK
--   ALTER TABLE public.ai_pronostic_drafts
--     DROP CONSTRAINT IF EXISTS ai_pronostic_drafts_validation_status_check;
--   ALTER TABLE public.ai_pronostic_drafts
--     ADD CONSTRAINT ai_pronostic_drafts_validation_status_check
--     CHECK (validation_status IN (
--       'VALIDATION_LONACI_DIRECTE',
--       'VALIDATION_AFRIQUE_CORROBOREE',
--       'AFRIQUE_NON_VALIDEE_EXCLUSION',
--       'PROGRAMME_MAIS_DISPO_AFRIQUE_INCERTAINE',
--       'AFRIQUE_INCONNUE_FALLBACK_FR'
--     ));
--   (Penser à supprimer manuellement les rows avec
--    validation_status = 'VALIDATION_PMU_INTERNATIONAL' AVANT d'exécuter
--    le rollback, sinon la nouvelle contrainte échouera à appliquer.)
-- ============================================================

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Drop l'ancienne check constraint (nom auto-généré par Postgres)
-- ─────────────────────────────────────────────────────────────────────────

-- Postgres nomme automatiquement les CHECK constraints
-- `<table>_<column>_check`. Pour robustesse, on utilise un DO block qui
-- trouve la contrainte par son définition réelle (au cas où elle aurait
-- été renommée manuellement).
DO $$
DECLARE
  c_name TEXT;
BEGIN
  SELECT con.conname INTO c_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
  WHERE nsp.nspname = 'public'
    AND rel.relname = 'ai_pronostic_drafts'
    AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) LIKE '%VALIDATION_LONACI_DIRECTE%'
    AND pg_get_constraintdef(con.oid) NOT LIKE '%VALIDATION_PMU_INTERNATIONAL%'
  LIMIT 1;

  IF c_name IS NOT NULL THEN
    EXECUTE format(
      'ALTER TABLE public.ai_pronostic_drafts DROP CONSTRAINT %I',
      c_name
    );
    RAISE NOTICE 'Dropped existing check constraint %I', c_name;
  ELSE
    RAISE NOTICE 'Aucune contrainte VALIDATION_LONACI_DIRECTE trouvée (déjà migrée ou table neuve) — skip drop';
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Recréer la contrainte avec le nouveau palier
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE public.ai_pronostic_drafts
  ADD CONSTRAINT ai_pronostic_drafts_validation_status_check
  CHECK (validation_status IN (
    -- Paliers de validation Afrique acceptables pour publication :
    'VALIDATION_LONACI_DIRECTE',         -- 🟢 LONACI confirme directement (CI ~90% audience)
    'VALIDATION_AFRIQUE_CORROBOREE',     -- 🟡 Autre opérateur africain confirme (LONASE/LONAB/PMUC/...)
    'VALIDATION_PMU_INTERNATIONAL',      -- 🔵 PMU France + redistribution probable (cf code collector)
    -- États transitoires / d'exclusion (drafts non publiés) :
    'AFRIQUE_NON_VALIDEE_EXCLUSION',
    'PROGRAMME_MAIS_DISPO_AFRIQUE_INCERTAINE',
    'AFRIQUE_INCONNUE_FALLBACK_FR'
  ));

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Commentaire mis à jour
-- ─────────────────────────────────────────────────────────────────────────

COMMENT ON COLUMN public.ai_pronostic_drafts.validation_status IS
  'Statut de validation Afrique. Cahier §4 (amendé 2026-05-14). Seuls '
  'VALIDATION_LONACI_DIRECTE, VALIDATION_AFRIQUE_CORROBOREE et '
  'VALIDATION_PMU_INTERNATIONAL permettent une publication '
  'FREE/STARTER/PRO/ELITE. Le 3e palier reconnaît les courses PMU France '
  'redistribuées par les opérateurs nationaux africains (critères : pari '
  'premium Quinté+/Quarté+/Tiercé+, co-localisation LONACI, ou Réunion 1).';
