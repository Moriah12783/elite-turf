-- 004 — Désabonnement des leads (drip de bienvenue)
-- Colonne opt-out : le cron lead-sequence saute les leads désabonnés, et le
-- lien « Ne plus recevoir » des emails pose ce timestamp. Rejouable.
ALTER TABLE leads ADD COLUMN IF NOT EXISTS unsubscribed_at TIMESTAMPTZ;
