-- 003 — Déduplication de la table leads + unicité de l'email (insensible à la casse)
-- Migration REJOUABLE (idempotente) : applicable plusieurs fois sans erreur.

-- 1. Garde-fou created_at NULL : sinon les comparaisons NULL du DELETE ci-dessous
--    laisseraient survivre des doublons (et feraient échouer l'index unique).
UPDATE leads SET created_at = NOW() WHERE created_at IS NULL;

-- 2. Normaliser les emails existants (minuscules + trim)
UPDATE leads SET email = lower(trim(email)) WHERE email <> lower(trim(email));

-- 3. Supprimer les doublons d'email en gardant la ligne la PLUS ANCIENNE
--    (created_at le plus petit ; départage stable par id si created_at identique)
DELETE FROM leads a
USING leads b
WHERE a.email = b.email
  AND (
    a.created_at > b.created_at
    OR (a.created_at = b.created_at AND a.id > b.id)
  );

-- 4. Index UNIQUE FONCTIONNEL sur lower(email) : insensible à la casse ET rejouable
--    (CREATE UNIQUE INDEX IF NOT EXISTS est idempotent, contrairement à
--    ALTER TABLE ADD CONSTRAINT). Protège même si un futur writer oublie de
--    normaliser l'email côté application.
CREATE UNIQUE INDEX IF NOT EXISTS leads_email_lower_unique ON leads (lower(email));

-- 5. L'ancien index non-unique devient redondant.
DROP INDEX IF EXISTS idx_leads_email;
