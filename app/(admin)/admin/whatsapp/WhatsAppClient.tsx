/**
 * WhatsAppClient — UI master-detail des conversations WhatsApp.
 *
 * Layout :
 *   - Sidebar gauche  : liste des conversations (1 par contact)
 *   - Pane droite     : thread de la conv sélectionnée
 *   - Composer bas    : champ de saisie + bouton envoyer (mode MANUAL)
 *
 * Quand on clique sur une conversation :
 *   1. Fetch des messages via /api/admin/whatsapp/[id]/messages
 *   2. Marquage des messages INBOUND comme lus
 *   3. Affichage du thread
 *
 * Quand on envoie un message :
 *   POST /api/admin/whatsapp/reply { conversation_id, body }
 *   → l'API appelle sendText() puis insert dans whatsapp_messages
 */

"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Send, Loader2, CheckCircle2, XCircle, AlertCircle,
  User, MessageCircle, Check, CheckCheck,
} from "lucide-react";
import type { WaConversationListItem, WaMessageItem } from "./page";

interface Props {
  conversations:         WaConversationListItem[];
  initialMessages:       WaMessageItem[];
  initialConversationId: string | null;
}

const COUNTRY_FLAGS: Record<string, string> = {
  FR: "🇫🇷", BE: "🇧🇪", CH: "🇨🇭", US: "🇺🇸",
  MA: "🇲🇦", DZ: "🇩🇿", TN: "🇹🇳",
  SN: "🇸🇳", MR: "🇲🇷", ML: "🇲🇱", GN: "🇬🇳",
  CI: "🇨🇮", BF: "🇧🇫", NE: "🇳🇪", TG: "🇹🇬", BJ: "🇧🇯",
  CM: "🇨🇲", GA: "🇬🇦", CG: "🇨🇬", CD: "🇨🇩", TD: "🇹🇩",
  RE: "🇷🇪", HT: "🇭🇹", MG: "🇲🇬",
};

export default function WhatsAppClient({
  conversations,
  initialMessages,
  initialConversationId,
}: Props) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(initialConversationId);
  const [messages, setMessages] = useState<WaMessageItem[]>(initialMessages);
  const [composerValue, setComposerValue] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isFetching, setIsFetching] = useState(false);
  const threadEndRef = useRef<HTMLDivElement | null>(null);

  const selected = conversations.find((c) => c.id === selectedId) ?? null;

  // Auto-scroll vers le dernier message quand le thread change
  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  async function selectConversation(id: string) {
    if (id === selectedId) return;
    setSelectedId(id);
    setIsFetching(true);
    setSendError(null);
    setSendSuccess(false);
    try {
      const res = await fetch(`/api/admin/whatsapp/${id}/messages`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages ?? []);
      }
      // Marque les INBOUND comme lus
      fetch(`/api/admin/whatsapp/${id}/mark-read`, { method: "POST" }).catch(() => {});
    } finally {
      setIsFetching(false);
    }
  }

  async function handleSend() {
    if (!selectedId || !composerValue.trim() || isPending) return;
    setSendError(null);
    setSendSuccess(false);

    const body = composerValue.trim();
    const res = await fetch("/api/admin/whatsapp/reply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversation_id: selectedId, body }),
    });
    const data = await res.json();

    if (!res.ok || !data.ok) {
      setSendError(data.error ?? "Erreur d'envoi");
      return;
    }

    // Optimistic update : ajouter le message envoyé localement
    const newMsg: WaMessageItem = {
      id:              data.message_id ?? `tmp-${Date.now()}`,
      conversation_id: selectedId,
      wa_message_id:   data.wa_message_id ?? null,
      direction:       "OUTBOUND",
      type:            "text",
      text_body:       body,
      media_caption:   null,
      status:          "sent",
      error_message:   null,
      replied_via:     "MANUAL",
      received_at:     new Date().toISOString(),
      meta_timestamp:  null,
    };
    setMessages((prev) => [...prev, newMsg]);
    setComposerValue("");
    setSendSuccess(true);

    // Refresh la liste pour mettre à jour last_outbound_at + tri
    startTransition(() => router.refresh());

    // Hide success après 3s
    setTimeout(() => setSendSuccess(false), 3000);
  }

  return (
    <div className="grid lg:grid-cols-[360px_1fr] gap-5 h-[calc(100vh-260px)]">
      {/* ── Sidebar liste ─────────────────────────────────────────────── */}
      <aside className="bg-bg-card border border-border rounded-xl overflow-hidden flex flex-col">
        <div className="p-3 border-b border-border bg-bg-page">
          <div className="text-xs uppercase tracking-wider text-text-secondary">
            Conversations ({conversations.length})
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversations.map((conv) => (
            <ConversationItem
              key={conv.id}
              conv={conv}
              selected={conv.id === selectedId}
              onClick={() => selectConversation(conv.id)}
            />
          ))}
        </div>
      </aside>

      {/* ── Thread + Composer ─────────────────────────────────────────── */}
      <main className="bg-bg-card border border-border rounded-xl overflow-hidden flex flex-col">
        {!selected ? (
          <div className="flex-1 flex items-center justify-center text-text-secondary">
            Sélectionne une conversation à gauche
          </div>
        ) : (
          <>
            {/* Header thread */}
            <div className="p-3 border-b border-border bg-bg-page flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-elite-gold/20 flex items-center justify-center text-elite-gold">
                <User className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-text-primary truncate">
                  {selected.contact_name || `+${selected.wa_id}`}
                </div>
                <div className="text-xs text-text-secondary">
                  {selected.phone_country && (
                    <span>{COUNTRY_FLAGS[selected.phone_country] ?? ""} {selected.phone_country} · </span>
                  )}
                  +{formatPhone(selected.wa_id)}
                </div>
              </div>
              <div className="text-xs text-text-secondary">
                {selected.message_count} message{selected.message_count > 1 ? "s" : ""}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-bg-page/30">
              {isFetching ? (
                <div className="text-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto text-elite-gold" />
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center text-text-secondary py-8">
                  Aucun message dans cette conversation.
                </div>
              ) : (
                messages.map((m) => <MessageBubble key={m.id} msg={m} />)
              )}
              <div ref={threadEndRef} />
            </div>

            {/* Composer */}
            <div className="border-t border-border p-3 bg-bg-card">
              {sendError && (
                <div className="mb-2 p-2 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg text-sm flex items-start gap-2">
                  <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{sendError}</span>
                </div>
              )}
              {sendSuccess && (
                <div className="mb-2 p-2 bg-green-500/10 border border-green-500/30 text-green-400 rounded-lg text-sm flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" /> Message envoyé !
                </div>
              )}

              {/* ⚠️ Window 24h warning */}
              {selected.last_inbound_at &&
               Date.now() - new Date(selected.last_inbound_at).getTime() > 24 * 60 * 60 * 1000 && (
                <div className="mb-2 p-2 bg-orange-500/10 border border-orange-500/30 text-orange-400 rounded-lg text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>
                    Dernier message du client il y a plus de 24h. Hors fenêtre WhatsApp :
                    seuls les <strong>templates approuvés</strong> peuvent être envoyés. Les messages texte risquent d'échouer.
                  </span>
                </div>
              )}

              <div className="flex gap-2 items-end">
                <textarea
                  value={composerValue}
                  onChange={(e) => setComposerValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  rows={2}
                  placeholder="Tape ta réponse… (Entrée pour envoyer, Maj+Entrée pour saut de ligne)"
                  className="flex-1 bg-bg-page border border-border rounded-lg p-3 text-sm text-text-primary placeholder-text-secondary resize-none"
                />
                <button
                  onClick={handleSend}
                  disabled={isPending || !composerValue.trim()}
                  className="px-4 py-3 bg-elite-gold hover:bg-elite-gold/90 disabled:opacity-50 disabled:cursor-not-allowed text-bg-page font-semibold rounded-lg flex items-center gap-2"
                >
                  {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Envoyer
                </button>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────

function ConversationItem({
  conv, selected, onClick,
}: {
  conv:     WaConversationListItem;
  selected: boolean;
  onClick:  () => void;
}) {
  const flag = conv.phone_country ? (COUNTRY_FLAGS[conv.phone_country] ?? "") : "";
  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 border-b border-border/40 transition-colors ${
        selected ? "bg-elite-gold/10 border-l-4 border-l-elite-gold" : "hover:bg-bg-page"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-text-primary truncate">
            {flag && <span className="mr-1">{flag}</span>}
            {conv.contact_name || `+${formatPhone(conv.wa_id)}`}
          </div>
          {!conv.contact_name && (
            <div className="text-xs text-text-secondary truncate">
              +{formatPhone(conv.wa_id)}
            </div>
          )}
          <div className="text-xs text-text-secondary mt-1">
            {relativeTime(conv.last_message_at)} · {conv.message_count} msg
          </div>
        </div>
        {conv.unread_count > 0 && (
          <span className="bg-green-500 text-white text-xs px-1.5 py-0.5 rounded-full font-bold">
            {conv.unread_count}
          </span>
        )}
      </div>
    </button>
  );
}

function MessageBubble({ msg }: { msg: WaMessageItem }) {
  const isOutbound = msg.direction === "OUTBOUND";
  return (
    <div className={`flex ${isOutbound ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[80%] p-3 rounded-lg ${
        isOutbound
          ? "bg-elite-gold/20 border border-elite-gold/30 text-text-primary"
          : "bg-bg-card border border-border text-text-primary"
      }`}>
        {msg.text_body ? (
          <div className="text-sm whitespace-pre-wrap break-words">{msg.text_body}</div>
        ) : (
          <div className="text-sm italic text-text-secondary">
            [{msg.type}] {msg.media_caption ?? "—"}
          </div>
        )}
        <div className="text-xs text-text-secondary mt-1 flex items-center gap-1.5 justify-end">
          {new Date(msg.received_at).toLocaleString("fr-FR", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })}
          {isOutbound && msg.status && <StatusIndicator status={msg.status} />}
          {msg.replied_via && msg.replied_via !== "MANUAL" && (
            <span className="text-xs px-1 rounded bg-blue-500/10 text-blue-400 border border-blue-500/30">
              {msg.replied_via}
            </span>
          )}
        </div>
        {msg.error_message && (
          <div className="text-xs text-red-400 mt-1">⚠️ {msg.error_message}</div>
        )}
      </div>
    </div>
  );
}

function StatusIndicator({ status }: { status: string }) {
  if (status === "sent")      return <Check className="w-3 h-3 text-text-secondary" />;
  if (status === "delivered") return <CheckCheck className="w-3 h-3 text-text-secondary" />;
  if (status === "read")      return <CheckCheck className="w-3 h-3 text-blue-400" />;
  if (status === "failed")    return <XCircle className="w-3 h-3 text-red-400" />;
  if (status === "queued")    return <Loader2 className="w-3 h-3 animate-spin text-text-secondary" />;
  return null;
}

// ─────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────

function formatPhone(wa_id: string): string {
  // Format E.164 sans + : "33612345678" → "33 6 12 34 56 78"
  if (!wa_id) return "";
  if (wa_id.startsWith("33") && wa_id.length === 11) {
    return `33 ${wa_id.substring(2, 3)} ${wa_id.substring(3, 5)} ${wa_id.substring(5, 7)} ${wa_id.substring(7, 9)} ${wa_id.substring(9, 11)}`;
  }
  return wa_id;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1)   return "à l'instant";
  if (min < 60)  return `${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24)    return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7)     return `${d}j`;
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
}
