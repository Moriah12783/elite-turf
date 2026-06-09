-- ============================================================================
-- 20260609_sms_sequence.sql
--
-- Phase 2 SMS : token de désinscription 1-clic (/stop?t=<token>).
-- Nécessaire car avec un Sender ID alphanumérique (EliteTurf), le « STOP par
-- réponse» ne fonctionne plus (canal sortant uniquement). On fournit donc un
-- lien de désinscription opaque par profil.
-- Additif et non destructif.
-- ============================================================================

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS sms_unsub_token TEXT;

-- Backfill des profils existants (token 16 hex = 64 bits, suffisant)
UPDATE public.profiles
SET sms_unsub_token = substr(replace(uuid_generate_v4()::text, '-', ''), 1, 16)
WHERE sms_unsub_token IS NULL;

-- Génération auto pour les nouveaux profils : le trigger handle_new_user ne
-- liste pas cette colonne dans son INSERT → le DEFAULT s'applique.
ALTER TABLE public.profiles
  ALTER COLUMN sms_unsub_token
  SET DEFAULT substr(replace(uuid_generate_v4()::text, '-', ''), 1, 16);

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_sms_unsub_token
  ON public.profiles (sms_unsub_token);

COMMENT ON COLUMN public.profiles.sms_unsub_token IS 'Token opaque pour le lien de désinscription SMS 1-clic /stop?t=<token>.';
