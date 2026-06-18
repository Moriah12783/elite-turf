-- Renouvellement automatique Stripe (opt-in)
--
-- Stocke les identifiants Stripe nécessaires pour gérer / annuler un abonnement
-- récurrent. Colonnes additives et NULLABLES → 100 % rétro-compatible avec les
-- paiements uniques existants, qui les laissent simplement à NULL.

ALTER TABLE abonnements
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS stripe_customer_id     text;

-- Lookup rapide lors des webhooks de renouvellement / annulation
-- (invoice.paid, customer.subscription.deleted → retrouver la ligne par sub id).
CREATE INDEX IF NOT EXISTS idx_abonnements_stripe_subscription_id
  ON abonnements (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

COMMENT ON COLUMN abonnements.stripe_subscription_id IS
  'ID abonnement Stripe (sub_…) si renouvellement auto activé ; NULL pour un paiement unique.';
COMMENT ON COLUMN abonnements.stripe_customer_id IS
  'ID client Stripe (cus_…) lié à l''abonnement récurrent ; NULL pour un paiement unique.';
