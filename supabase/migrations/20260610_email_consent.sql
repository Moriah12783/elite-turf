-- ============================================================================
-- 20260610_email_consent.sql
--
-- Consentement EMAIL (audit Sprint 1.5, Lot 4 — séquence de réactivation).
-- profiles n'avait aucun opt-out email : on ajoute le flag, et la page /stop
-- (lien 1-clic, token sms_unsub_token réutilisé) désinscrit désormais des
-- DEUX canaux marketing (SMS + email). Les emails transactionnels (confirmation
-- de paiement, etc.) ne sont pas concernés.
-- Additif et non destructif.
-- ============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email_opted_out     BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS email_opted_out_at  TIMESTAMPTZ;

COMMENT ON COLUMN public.profiles.email_opted_out IS 'TRUE si désinscrit des emails marketing (via /stop?t=<sms_unsub_token>). Ne bloque pas les emails transactionnels.';
