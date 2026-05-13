-- ============================================================
-- 20260513_whatsapp_conversations.sql
--
-- Tables pour l'intégration WhatsApp Business — Phase A "logging only".
--
-- 🎯 ROADMAP (cf. plan FDE WhatsApp Business 13 mai 2026) :
--
--   Phase A — LOGGING : on reçoit tous les messages clients via webhook
--                       Meta, on les stocke ici. Stéphane répond toujours
--                       à la main via WhatsApp Web — mais maintenant avec
--                       un dashboard structuré côté Elite Turf.
--
--   Phase B — CO-PILOTE : Claude pré-rédige une réponse pour chaque
--                         message reçu. Stéphane valide/édite/envoie
--                         depuis /admin/whatsapp.
--
--   Phase C — AUTO TIER 1 : réponses auto pour cas simples (FAQ),
--                           escalation pour le reste.
--
--   Phase D — AUTO FULL : tier 1 + actions (créer compte, envoyer lien
--                         d'abo, etc.).
--
-- 📦 MODÈLE
--
--   `whatsapp_conversations` (1 par contact) :
--      - clé naturelle = wa_id (= numéro de téléphone E.164 sans le "+")
--      - profil_id éventuel si on a matché avec un user Elite Turf
--      - dernière activité, statut (open/closed), tags (lead/abonné/spam/etc.)
--      - assigned_to (admin qui traite, NULL = bot/non assigné)
--
--   `whatsapp_messages` (N par conversation) :
--      - direction = INBOUND (du client vers nous) / OUTBOUND (de nous)
--      - type = text / image / audio / video / document / template / interactive
--      - wa_message_id (ID Meta, unique pour idempotence webhook)
--      - status (sent/delivered/read/failed) pour OUTBOUND
--      - error_code/error_message si Meta retourne une erreur
--      - replied_via = MANUAL/COPILOT/AUTO_TIER1/AUTO_FULL (pour OUTBOUND)
--
-- 🛡️ RLS : service_role uniquement (les routes server-side ont accès,
--          jamais le browser).
-- ============================================================

-- ─────────────────────────────────────────────────────────────────────────
-- TABLE: whatsapp_conversations
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.whatsapp_conversations (
  id                 UUID         DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Identité contact
  wa_id              TEXT         NOT NULL UNIQUE,        -- "33612345678" (E.164 sans +)
  contact_name       TEXT,                                -- nom WhatsApp public si fourni
  phone_country      TEXT,                                -- "FR", "CI", "MA"... auto-détecté

  -- Lien profil Elite Turf si match (NULL = visiteur anonyme)
  profile_id         UUID         REFERENCES public.profiles(id) ON DELETE SET NULL,

  -- Statut conversation
  status             TEXT         NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN', 'CLOSED', 'SPAM', 'ARCHIVED')),

  -- Routage humain
  assigned_to        UUID         REFERENCES public.profiles(id) ON DELETE SET NULL,

  -- Métriques
  last_message_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  last_inbound_at    TIMESTAMPTZ,                          -- dernier msg client (pour SLA)
  last_outbound_at   TIMESTAMPTZ,                          -- dernier msg nous
  unread_count       INTEGER      NOT NULL DEFAULT 0,
  message_count      INTEGER      NOT NULL DEFAULT 0,

  -- Tags libres (lead/abonné/réclamation/etc.)
  tags               TEXT[]       NOT NULL DEFAULT '{}',

  -- Notes admin (visible uniquement par Stéphane)
  admin_notes        TEXT,

  -- Timestamps
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Index : lookup par wa_id (le plus fréquent — chaque webhook)
CREATE INDEX IF NOT EXISTS idx_wa_conv_wa_id
  ON public.whatsapp_conversations (wa_id);

-- Index : tri par dernière activité (vue admin)
CREATE INDEX IF NOT EXISTS idx_wa_conv_last_message
  ON public.whatsapp_conversations (last_message_at DESC)
  WHERE status = 'OPEN';

-- Index : matching profil
CREATE INDEX IF NOT EXISTS idx_wa_conv_profile
  ON public.whatsapp_conversations (profile_id)
  WHERE profile_id IS NOT NULL;

-- Index GIN sur tags (recherche "où sont mes leads ?")
CREATE INDEX IF NOT EXISTS idx_wa_conv_tags
  ON public.whatsapp_conversations USING GIN (tags);

-- ─────────────────────────────────────────────────────────────────────────
-- TABLE: whatsapp_messages
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
  id                 UUID         DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Lien conversation
  conversation_id    UUID         NOT NULL
    REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,

  -- Identité Meta (pour idempotence + correlation)
  wa_message_id      TEXT         UNIQUE,                  -- "wamid.HBgM..."
  wa_id_contact      TEXT         NOT NULL,                -- redondant avec conv pour requêtes rapides

  -- Direction
  direction          TEXT         NOT NULL
    CHECK (direction IN ('INBOUND', 'OUTBOUND')),

  -- Type de message (cf API WhatsApp Cloud)
  type               TEXT         NOT NULL DEFAULT 'text'
    CHECK (type IN (
      'text', 'image', 'audio', 'video', 'document', 'sticker', 'location',
      'contacts', 'template', 'interactive', 'reaction', 'button', 'unknown'
    )),

  -- Contenu
  text_body          TEXT,                                  -- pour type=text
  media_id           TEXT,                                  -- ID Meta du média si type=image/audio/...
  media_mime_type    TEXT,
  media_url          TEXT,                                  -- URL temporaire Meta (à hydrater au fetch)
  media_caption      TEXT,
  template_name      TEXT,                                  -- si type=template (OUTBOUND)

  -- Payload brut (pour debug + cas non gérés)
  raw_payload        JSONB,

  -- Status (OUTBOUND uniquement)
  status             TEXT
    CHECK (status IS NULL OR status IN ('queued', 'sent', 'delivered', 'read', 'failed')),
  error_code         INTEGER,
  error_message      TEXT,

  -- Mode de réponse (OUTBOUND uniquement) — pour analytics Phase B/C/D
  replied_via        TEXT
    CHECK (replied_via IS NULL OR replied_via IN (
      'MANUAL', 'COPILOT', 'AUTO_TIER1', 'AUTO_FULL', 'TEMPLATE_BROADCAST'
    )),

  -- Timing
  meta_timestamp     TIMESTAMPTZ,                           -- timestamp Meta du message
  received_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),   -- quand notre webhook l'a reçu
  sent_at            TIMESTAMPTZ,                           -- pour OUTBOUND, quand on a appelé l'API
  delivered_at       TIMESTAMPTZ,
  read_at            TIMESTAMPTZ
);

-- Index : tous les messages d'une conversation, ordre chronologique
CREATE INDEX IF NOT EXISTS idx_wa_msg_conv_time
  ON public.whatsapp_messages (conversation_id, received_at DESC);

-- Index : recherche par wa_message_id (idempotence webhook)
CREATE INDEX IF NOT EXISTS idx_wa_msg_meta_id
  ON public.whatsapp_messages (wa_message_id)
  WHERE wa_message_id IS NOT NULL;

-- Index : messages INBOUND non lus
CREATE INDEX IF NOT EXISTS idx_wa_msg_inbound_unread
  ON public.whatsapp_messages (conversation_id, received_at DESC)
  WHERE direction = 'INBOUND' AND read_at IS NULL;

-- ─────────────────────────────────────────────────────────────────────────
-- Triggers : maintenance auto des compteurs sur whatsapp_conversations
-- ─────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.touch_wa_conversation_on_message()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.whatsapp_conversations
  SET
    last_message_at  = NEW.received_at,
    last_inbound_at  = CASE WHEN NEW.direction = 'INBOUND'  THEN NEW.received_at ELSE last_inbound_at  END,
    last_outbound_at = CASE WHEN NEW.direction = 'OUTBOUND' THEN NEW.received_at ELSE last_outbound_at END,
    message_count    = message_count + 1,
    unread_count     = CASE WHEN NEW.direction = 'INBOUND' THEN unread_count + 1 ELSE unread_count END,
    updated_at       = NOW()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_wa_msg_touch_conv ON public.whatsapp_messages;
CREATE TRIGGER trg_wa_msg_touch_conv
  AFTER INSERT ON public.whatsapp_messages
  FOR EACH ROW EXECUTE FUNCTION public.touch_wa_conversation_on_message();

-- Trigger updated_at sur conversations
CREATE OR REPLACE FUNCTION public.touch_wa_conversation_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_wa_conv_updated_at ON public.whatsapp_conversations;
CREATE TRIGGER trg_wa_conv_updated_at
  BEFORE UPDATE ON public.whatsapp_conversations
  FOR EACH ROW EXECUTE FUNCTION public.touch_wa_conversation_updated_at();

-- ─────────────────────────────────────────────────────────────────────────
-- RLS — service_role uniquement (lecture admin via service client)
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages      ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wa_conv_svc" ON public.whatsapp_conversations;
DROP POLICY IF EXISTS "wa_msg_svc"  ON public.whatsapp_messages;

CREATE POLICY "wa_conv_svc"
  ON public.whatsapp_conversations FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "wa_msg_svc"
  ON public.whatsapp_messages FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ─────────────────────────────────────────────────────────────────────────
-- Commentaires (auto-doc Supabase Dashboard)
-- ─────────────────────────────────────────────────────────────────────────

COMMENT ON TABLE public.whatsapp_conversations IS
  'Thread WhatsApp Business — 1 par contact (wa_id). Phase A WhatsApp Business intégration Elite Turf, mai 2026.';

COMMENT ON TABLE public.whatsapp_messages IS
  'Messages individuels échangés via WhatsApp. INBOUND = du client vers nous (capté par webhook Meta). OUTBOUND = envoyé via API Cloud.';

COMMENT ON COLUMN public.whatsapp_messages.replied_via IS
  'Origine de la réponse OUTBOUND : MANUAL (Stéphane via dashboard) / COPILOT (Stéphane valide une suggestion Claude) / AUTO_TIER1 (FAQ auto) / AUTO_FULL (réponse complète auto) / TEMPLATE_BROADCAST (envoi en masse).';

COMMENT ON COLUMN public.whatsapp_conversations.wa_id IS
  'Identifiant WhatsApp du contact — numéro E.164 sans le préfixe + (ex: "33612345678" pour +33 6 12 34 56 78). Clé naturelle pour matcher les webhooks.';
