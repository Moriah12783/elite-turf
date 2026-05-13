/**
 * /admin/whatsapp
 *
 * Dashboard de gestion des conversations WhatsApp Elite Turf.
 *
 * 🎯 Phase A — Mode logging :
 *   - Liste de toutes les conversations (1 par contact)
 *   - Détail d'une conversation (historique complet, INBOUND + OUTBOUND)
 *   - Possibilité de répondre manuellement (via API admin/whatsapp/reply)
 *
 * 🛡️ Auth : protégée par middleware admin (cookie session + rôle ADMIN)
 *
 * 📦 Architecture :
 *   - page.tsx (server)       : charge conversations + messages dernière conv
 *   - WhatsAppClient.tsx       : UI master-detail (liste / thread / composer)
 *   - /api/admin/whatsapp/reply: POST reply manuel (mode MANUAL)
 *   - /api/admin/whatsapp/[id]/messages: GET messages d'une conversation
 *   - /api/admin/whatsapp/[id]/mark-read: POST marque les inbound comme lus
 */

import { createServiceClient } from "@/lib/supabase/server";
import Link from "next/link";
import { ArrowLeft, MessageCircle } from "lucide-react";
import WhatsAppClient from "./WhatsAppClient";

export const metadata = { title: "WhatsApp Business — Admin" };
export const dynamic  = "force-dynamic";

export interface WaConversationListItem {
  id:               string;
  wa_id:            string;
  contact_name:     string | null;
  phone_country:    string | null;
  status:           "OPEN" | "CLOSED" | "SPAM" | "ARCHIVED";
  last_message_at:  string;
  last_inbound_at:  string | null;
  last_outbound_at: string | null;
  unread_count:     number;
  message_count:    number;
  tags:             string[];
  admin_notes:      string | null;
}

export interface WaMessageItem {
  id:              string;
  conversation_id: string;
  wa_message_id:   string | null;
  direction:       "INBOUND" | "OUTBOUND";
  type:            string;
  text_body:       string | null;
  media_caption:   string | null;
  status:          string | null;
  error_message:   string | null;
  replied_via:     string | null;
  received_at:     string;
  meta_timestamp:  string | null;
}

export default async function AdminWhatsAppPage() {
  const supabase = createServiceClient();

  // Charge toutes les conversations triées par dernière activité
  const { data: rawConversations } = await supabase
    .from("whatsapp_conversations")
    .select("id, wa_id, contact_name, phone_country, status, last_message_at, last_inbound_at, last_outbound_at, unread_count, message_count, tags, admin_notes")
    .order("last_message_at", { ascending: false })
    .limit(200);

  const conversations: WaConversationListItem[] = (rawConversations ?? []) as WaConversationListItem[];

  // Pré-charge les messages de la 1ère conversation (la plus récente)
  let initialMessages: WaMessageItem[] = [];
  if (conversations.length > 0) {
    const { data: rawMessages } = await supabase
      .from("whatsapp_messages")
      .select("id, conversation_id, wa_message_id, direction, type, text_body, media_caption, status, error_message, replied_via, received_at, meta_timestamp")
      .eq("conversation_id", conversations[0].id)
      .order("received_at", { ascending: true })
      .limit(200);
    initialMessages = (rawMessages ?? []) as WaMessageItem[];
  }

  // Stats récap
  const stats = {
    total_conversations: conversations.length,
    total_unread:        conversations.reduce((s, c) => s + (c.unread_count ?? 0), 0),
    inbound_24h:         conversations.filter((c) =>
                            c.last_inbound_at &&
                            Date.now() - new Date(c.last_inbound_at).getTime() < 24 * 60 * 60 * 1000
                         ).length,
    open_count:          conversations.filter((c) => c.status === "OPEN").length,
  };

  return (
    <div className="min-h-screen bg-bg-page p-4 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary mb-3"
          >
            <ArrowLeft className="w-4 h-4" /> Retour Admin
          </Link>

          <div className="flex items-center gap-3 mb-2">
            <MessageCircle className="w-8 h-8 text-green-500" />
            <h1 className="text-2xl lg:text-3xl font-bold text-text-primary">
              WhatsApp Business — Conversations
            </h1>
          </div>
          <p className="text-text-secondary text-sm max-w-2xl">
            Tous les messages reçus via le numéro <strong>+33 6 44 69 68 06</strong>.
            Mode <strong>logging</strong> : tu réponds manuellement, le système
            historise tout.
          </p>

          {/* Stats récap */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-5">
            <StatCard label="Conversations"   value={stats.total_conversations} tone="neutral" />
            <StatCard label="Non lus"          value={stats.total_unread}        tone={stats.total_unread > 0 ? "danger" : "neutral"} />
            <StatCard label="Reçus 24h"        value={stats.inbound_24h}         tone="info"    />
            <StatCard label="Ouvertes"         value={stats.open_count}          tone="success" />
          </div>
        </div>

        {conversations.length === 0 ? (
          <EmptyState />
        ) : (
          <WhatsAppClient
            conversations={conversations}
            initialMessages={initialMessages}
            initialConversationId={conversations[0]?.id ?? null}
          />
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Sous-composants serveur
// ─────────────────────────────────────────────────────────────────────────

function StatCard({
  label, value, tone,
}: {
  label: string;
  value: number;
  tone:  "neutral" | "success" | "warning" | "danger" | "info";
}) {
  const toneClasses = {
    neutral: "border-border       text-text-primary",
    success: "border-green-500/40 text-green-400",
    warning: "border-orange-500/40 text-orange-400",
    danger:  "border-red-500/40   text-red-400",
    info:    "border-blue-500/40  text-blue-400",
  }[tone];

  return (
    <div className={`bg-bg-card border ${toneClasses} rounded-xl p-3`}>
      <div className="text-xs text-text-secondary">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="bg-bg-card border border-border rounded-xl p-10 text-center">
      <MessageCircle className="w-12 h-12 mx-auto text-text-secondary mb-4" />
      <h2 className="text-xl font-semibold text-text-primary mb-2">
        Aucune conversation pour le moment
      </h2>
      <p className="text-text-secondary text-sm max-w-md mx-auto">
        Dès qu'un client t'écrira sur WhatsApp Business
        (+33 6 44 69 68 06), sa conversation apparaîtra ici.
        Vérifie aussi que le webhook Meta pointe bien sur{" "}
        <code className="bg-bg-page px-1 rounded">
          https://www.elite-turf.fr/api/webhooks/whatsapp
        </code>
      </p>
    </div>
  );
}
