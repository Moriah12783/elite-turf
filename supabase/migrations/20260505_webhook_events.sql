-- Webhook events log : audit + idempotence DB-level pour tous les webhooks de paiement
-- (Paystack aujourd'hui, extensible Stripe / CinetPay si réactivés)
--
-- Permet de :
--  - Garantir qu'un même event_id n'est jamais traité deux fois (UNIQUE constraint)
--  - Auditer l'historique des webhooks reçus (debug en cas de paiement perdu)
--  - Détecter les délivrances ratées en croisant avec transactions.statut

CREATE TABLE IF NOT EXISTS public.webhook_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider        TEXT NOT NULL CHECK (provider IN ('paystack', 'stripe', 'cinetpay')),
  event_id        TEXT NOT NULL,        -- reference Paystack, event id Stripe, cpm_trans_id CinetPay
  event_type      TEXT,                  -- charge.success, payment_intent.succeeded, etc.
  raw_body        JSONB,                 -- payload complet (debug)
  signature_ok    BOOLEAN NOT NULL DEFAULT FALSE,
  processed_at    TIMESTAMPTZ,           -- null si pas encore traité (avant idempotence check)
  error           TEXT,                  -- message d'erreur si traitement KO
  received_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Idempotence : un même event_id par provider ne peut être traité qu'une fois
  CONSTRAINT webhook_events_unique_event UNIQUE (provider, event_id)
);

-- Index pour les requêtes de monitoring (« webhooks reçus aujourd'hui ? »)
CREATE INDEX IF NOT EXISTS idx_webhook_events_received_at
  ON public.webhook_events (received_at DESC);

-- Index pour le debug par référence (« où est passé le paiement X ? »)
CREATE INDEX IF NOT EXISTS idx_webhook_events_event_id
  ON public.webhook_events (event_id);

-- RLS : service_role uniquement (pas d'accès public, c'est un log interne)
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "webhook_events_service_only"
  ON public.webhook_events
  FOR ALL
  USING (auth.role() = 'service_role');

COMMENT ON TABLE public.webhook_events IS
  'Audit log de tous les webhooks de paiement reçus. UNIQUE(provider, event_id) garantit l''idempotence DB-level.';
