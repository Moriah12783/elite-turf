-- ============================================================================
-- 20260610_testimonials.sql
--
-- Témoignages RÉELS d'abonnés (audit Sprint 1.5, Lot 3).
-- Les anciens témoignages codés en dur (inventés) ont été supprimés du site ;
-- cette table accueille les vrais retours, collectés via WhatsApp (CTA
-- « Partager mon expérience ») puis saisis et modérés dans /admin/temoignages.
--
-- Affichage public : UNIQUEMENT statut='approved' (la section home reste
-- masquée tant qu'il n'existe aucun témoignage approuvé), toujours accompagné
-- du disclaimer « résultats individuels, non garantis ».
--
-- 🛡️ RLS : service_role uniquement (lecture publique via SSR service client).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.testimonials (
    id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Identité affichée (prénom + initiale recommandés, jamais le nom complet)
    nom_affiche   TEXT         NOT NULL,
    ville         TEXT,
    pays          TEXT,

    -- Contexte abonnement
    pack          TEXT         CHECK (pack IN ('Starter', 'Pro', 'Elite')),

    -- Contenu
    texte         TEXT         NOT NULL,
    note          SMALLINT     CHECK (note BETWEEN 1 AND 5),
    preuve_url    TEXT,        -- capture/lien de vérification (interne, non affiché)

    -- Provenance + modération
    source        TEXT         NOT NULL DEFAULT 'whatsapp'
                  CHECK (source IN ('whatsapp', 'formulaire', 'email')),
    statut        TEXT         NOT NULL DEFAULT 'pending'
                  CHECK (statut IN ('pending', 'approved', 'rejected')),

    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    approved_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_testimonials_statut
  ON public.testimonials (statut, created_at DESC);

-- RLS : aucune policy publique → seules les requêtes service_role passent.
ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.testimonials IS 'Témoignages réels d''abonnés, modérés (pending/approved/rejected). Affichage public = approved uniquement, avec disclaimer.';
