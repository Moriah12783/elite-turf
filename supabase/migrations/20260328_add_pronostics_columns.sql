-- ============================================================
-- Ajout des colonnes manquantes dans la table pronostics
-- Date : 2026-03-28
-- ============================================================

-- Arrivée réelle (numéros dans l'ordre d'arrivée officielle)
ALTER TABLE public.pronostics
  ADD COLUMN IF NOT EXISTS arrivee_reelle INTEGER[];

-- Rapport gagnant (ex: 45.30 pour un Quinté+)
ALTER TABLE public.pronostics
  ADD COLUMN IF NOT EXISTS rapport_gagnant DECIMAL(8,2);

-- Lien Geny (optionnel, on génère dynamiquement maintenant)
ALTER TABLE public.pronostics
  ADD COLUMN IF NOT EXISTS lien_geny TEXT;
