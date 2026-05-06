-- ============================================================================
-- 20260507_email_sent_log.sql
--
-- Table de log des emails envoyés (welcome series, win-back, etc.).
-- Permet l'idempotence du cron : on n'envoie jamais 2 fois le même type
-- d'email au même utilisateur.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.email_sent_log (
    id          UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID         REFERENCES auth.users(id) ON DELETE CASCADE,
    -- Pour les leads non-inscrits, on utilise email seul (user_id NULL)
    email       TEXT         NOT NULL,
    type        TEXT         NOT NULL, -- "WELCOME_J1", "WELCOME_J3", "WELCOME_J7", "WINBACK_J7", etc.
    sent_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    -- Resend message ID si dispo (pour traçabilité)
    message_id  TEXT,
    -- Status: SENT / FAILED / OPENED (si webhook Resend configuré)
    status      TEXT         NOT NULL DEFAULT 'SENT',
    error       TEXT,
    UNIQUE (user_id, type),
    -- Cas leads sans user_id : unicité par email + type
    UNIQUE (email, type)
);

CREATE INDEX IF NOT EXISTS idx_email_sent_log_user_type ON public.email_sent_log (user_id, type);
CREATE INDEX IF NOT EXISTS idx_email_sent_log_email_type ON public.email_sent_log (email, type);
CREATE INDEX IF NOT EXISTS idx_email_sent_log_sent_at ON public.email_sent_log (sent_at DESC);

-- RLS : lecture/écriture service_role uniquement (pas d'API publique)
ALTER TABLE public.email_sent_log ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.email_sent_log IS 'Log des emails transactionnels envoyés via Resend. Idempotence garantie par UNIQUE (user_id, type).';
