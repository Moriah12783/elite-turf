-- ============================================================
-- 20260507_arrivees_rapports_pmu.sql
--
-- Étend la table arrivees pour stocker l'intégralité des rapports PMU.
-- Les colonnes existantes (rapport_quinte, rapport_quarte, rapport_tierce)
-- ne stockaient que le rapport "dans l'ordre" pour 1€. C'est insuffisant —
-- les vrais sites turf affichent TOUS les rapports : DSO/DSRE, Bonus, Couplé,
-- Trio, Simple G/P, 2sur4, etc.
--
-- Choix : JSONB pour flexibilité (les types de paris varient selon le pari
-- programmé, ex pas de Quinté+ sur les courses provinciales).
-- ============================================================

-- Nouvelle colonne JSONB pour les rapports complets
ALTER TABLE public.arrivees
  ADD COLUMN IF NOT EXISTS rapports_pmu JSONB;

-- Index GIN pour requêtes rapides sur clés JSON (ex : rapports_pmu->'tierce')
CREATE INDEX IF NOT EXISTS idx_arrivees_rapports_pmu_gin
  ON public.arrivees USING GIN (rapports_pmu);

-- Champ optionnel pour stocker le commentaire d'arrivée Geny (récit course)
ALTER TABLE public.arrivees
  ADD COLUMN IF NOT EXISTS commentaire TEXT;

COMMENT ON COLUMN public.arrivees.rapports_pmu IS
'Tous les rapports PMU au format JSON. Structure :
{
  "tierce":         { "ordre": 4500, "desordre": 1200 },
  "quarte_plus":    { "ordre": 12000, "desordre": 3000, "bonus": 800 },
  "quinte_plus":    { "ordre": 85000, "desordre": 15000, "bonus4": 1500, "bonus3": 200 },
  "couple_gagnant": 250,
  "couple_place":   [12, 18, 25],
  "trio":           80,
  "simple_gagnant": 32,
  "simple_place":   [15, 24, 38],
  "deux_sur_quatre": 18,
  "multi":          { "en_4": 5000, "en_5": 1000, "en_6": 200, "en_7": 50 }
}
Les rapports sont en centimes d''euro pour mise unitaire 1€ (ex: 4500 = 45,00€).';

COMMENT ON COLUMN public.arrivees.commentaire IS
'Commentaire d''arrivée extrait de Geny (récit course, optionnel).';
