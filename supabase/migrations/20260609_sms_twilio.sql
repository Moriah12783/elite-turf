-- ============================================================================
-- 20260609_sms_twilio.sql
--
-- SMS de bienvenue Twilio + base de la future séquence SMS / WhatsApp.
--   - profiles : opt-in SMS (pré-coché à l'inscription) + état opt-out (STOP)
--   - sms_log  : log idempotent des SMS transactionnels (modèle email_sent_log)
--
-- Additif et non destructif. La colonne `phone` existe déjà sur profiles.
-- ============================================================================

-- ── profiles : consentement notifications ──────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS sms_opt_in        BOOLEAN     NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS sms_opted_out     BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS sms_opted_out_at  TIMESTAMPTZ;

COMMENT ON COLUMN public.profiles.sms_opt_in    IS 'Consentement SMS (case pré-cochée à l''inscription). Gouverne la séquence.';
COMMENT ON COLUMN public.profiles.sms_opted_out IS 'TRUE si l''utilisateur a répondu STOP. Bloque tout envoi.';

-- ── sms_log : idempotence + traçabilité (modèle email_sent_log) ─────────────
CREATE TABLE IF NOT EXISTS public.sms_log (
    id          UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID         REFERENCES auth.users(id) ON DELETE CASCADE,
    phone       TEXT         NOT NULL,
    type        TEXT         NOT NULL,   -- 'WELCOME', 'NOTRE_SELECTION_J2', etc.
    twilio_sid  TEXT,                    -- SID Twilio ("SMxxxx") si dispo
    status      TEXT         NOT NULL DEFAULT 'PENDING', -- PENDING / SENT / FAILED
    error       TEXT,
    sent_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, type)               -- 1 SMS de chaque type par utilisateur
);

CREATE INDEX IF NOT EXISTS idx_sms_log_user_type ON public.sms_log (user_id, type);
CREATE INDEX IF NOT EXISTS idx_sms_log_phone     ON public.sms_log (phone);
CREATE INDEX IF NOT EXISTS idx_sms_log_sent_at   ON public.sms_log (sent_at DESC);

-- RLS : service_role uniquement (aucune API publique)
ALTER TABLE public.sms_log ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.sms_log IS 'Log des SMS transactionnels via Twilio. Idempotence garantie par UNIQUE (user_id, type).';
