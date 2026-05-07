-- ============================================================
-- 20260507_whatsapp_agent.sql
--
-- Tables pour l'agent WhatsApp Cloud API d'Elite Turf.
--
-- Architecture :
--   - whatsapp_conversations : 1 ligne par numéro de téléphone unique.
--     Stocke l'état de la conversation (history compacté, profile lié, etc).
--   - whatsapp_messages      : 1 ligne par message (in / out), pour audit
--     complet et debug. JOIN sur conversation_id.
--
-- Le numéro de téléphone est l'identifiant logique : on ne connaît pas
-- forcément l'utilisateur Supabase au premier message (il peut écrire
-- avant même de s'inscrire). On résout (phone → profile_id) à la volée
-- via une lookup sur profiles.telephone si match.
--
-- Le history est stocké en JSONB compact : on garde les N derniers
-- échanges pour donner du contexte au LLM, on ne renvoie pas tout à
-- chaque appel (coût + latence).
-- ============================================================

-- ── Conversations WhatsApp ──────────────────────────────────────────
create table if not exists public.whatsapp_conversations (
  id            uuid primary key default uuid_generate_v4(),
  phone         text not null unique,             -- E.164, ex: "+33612345678"
  profile_id    uuid references public.profiles(id) on delete set null,
  history       jsonb not null default '[]',      -- [{role, content, ts}]
  -- Last seen / first seen pour l'analytique
  first_seen_at timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  -- Compteurs simples (incrémentés par triggers ou côté code)
  msg_count_in  integer not null default 0,
  msg_count_out integer not null default 0,
  -- Tag intent dominant : "FAQ", "VENTE", "SUPPORT", "PRONOSTIC", null
  intent_tag    text,
  -- Drapeau escalation : true = on a alerté l'admin, on n'auto-réplique plus
  escalated     boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_whatsapp_conv_phone           on public.whatsapp_conversations (phone);
create index if not exists idx_whatsapp_conv_profile_id      on public.whatsapp_conversations (profile_id);
create index if not exists idx_whatsapp_conv_last_seen       on public.whatsapp_conversations (last_seen_at desc);

comment on table  public.whatsapp_conversations is
  'État conversationnel WhatsApp par numéro. 1 ligne = 1 numéro unique.';
comment on column public.whatsapp_conversations.history is
  'JSONB array compact des derniers messages [{role, content, ts}], typiquement 20-50 max.';
comment on column public.whatsapp_conversations.intent_tag is
  'Intent détecté par le LLM (FAQ/VENTE/SUPPORT/PRONOSTIC) pour analytics.';
comment on column public.whatsapp_conversations.escalated is
  'true = un humain a été notifié, le bot n''auto-réplique plus jusqu''à reset manuel.';

-- ── Messages WhatsApp (audit complet) ───────────────────────────────
create table if not exists public.whatsapp_messages (
  id              uuid primary key default uuid_generate_v4(),
  conversation_id uuid not null references public.whatsapp_conversations(id) on delete cascade,
  -- direction : "in" = reçu de l'utilisateur, "out" = envoyé par le bot
  direction       text not null check (direction in ('in', 'out')),
  -- Meta WhatsApp message_id (pour idempotence + retry tracking)
  wa_message_id   text unique,
  content         text not null,
  -- type : "text", "image", "audio", "document", "interactive", "template"
  message_type    text not null default 'text',
  -- Statut Meta : "sent", "delivered", "read", "failed" (out only)
  delivery_status text,
  -- Si on a appelé le LLM pour générer ce out, on stocke métadonnées
  llm_model       text,
  llm_input_tokens  integer,
  llm_output_tokens integer,
  llm_cost_usd      numeric(10, 6),
  -- Erreur éventuelle (rate limit, content policy, etc.)
  error           text,
  created_at      timestamptz not null default now()
);

create index if not exists idx_whatsapp_msg_conv_id     on public.whatsapp_messages (conversation_id, created_at desc);
create index if not exists idx_whatsapp_msg_wa_id      on public.whatsapp_messages (wa_message_id);
create index if not exists idx_whatsapp_msg_direction   on public.whatsapp_messages (direction, created_at desc);

comment on table  public.whatsapp_messages is
  'Audit log complet des messages WhatsApp in/out. UNIQUE(wa_message_id) garantit idempotence.';

-- ── Trigger updated_at sur whatsapp_conversations ────────────────────
create or replace function public.set_updated_at_whatsapp_conv()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_whatsapp_conv_updated_at on public.whatsapp_conversations;
create trigger trg_whatsapp_conv_updated_at
  before update on public.whatsapp_conversations
  for each row execute function public.set_updated_at_whatsapp_conv();

-- ── RLS : tables admin-only (pas accessibles aux clients) ───────────
alter table public.whatsapp_conversations enable row level security;
alter table public.whatsapp_messages       enable row level security;

-- Aucune policy = tables fermées. Seul le service_role (côté serveur Next.js
-- via createServiceClient) peut lire/écrire. Les utilisateurs n'accèdent
-- jamais à ces tables directement — leurs interactions passent uniquement
-- par le webhook /api/whatsapp/webhook.
