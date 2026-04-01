-- Ajoute la colonne date_expiration_abonnement au profil si elle n'existe pas.
-- Permet à l'API /api/admin/paiements/valider de mettre à jour l'expiration.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS date_expiration_abonnement DATE;
