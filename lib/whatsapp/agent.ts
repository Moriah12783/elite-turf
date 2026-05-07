/**
 * lib/whatsapp/agent.ts
 *
 * Orchestrateur LLM de l'agent WhatsApp Elite Turf.
 *
 * Choix techniques :
 *  - Modèle par défaut : claude-haiku-4-5 — meilleur français du marché
 *    pour le rapport qualité/coût (~5x moins cher que Sonnet 4.5),
 *    suffisant pour les FAQ et la qualification de leads.
 *  - SDK : aucun. Appel direct via fetch() à l'Anthropic Messages API,
 *    pour rester compatible Cloudflare Workers sans poser de Node deps
 *    (le SDK officiel marche aussi mais on ajoute zéro surface d'attaque).
 *  - Historique : on passe les 10 derniers échanges (max 5000 tokens)
 *    pour donner le contexte. Le system prompt est passé à part — il
 *    bénéficie du prompt caching Anthropic (90% off sur les hits).
 *
 * Variables d'environnement requises côté serveur :
 *  - ANTHROPIC_API_KEY
 *  - WHATSAPP_LLM_MODEL (optionnel, défaut "claude-haiku-4-5")
 */

import { buildSystemPrompt } from "./system-prompt";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const DEFAULT_MODEL     = "claude-haiku-4-5";
const MAX_OUTPUT_TOKENS = 600;          // ~450 mots — large pour réponses WA
const HISTORY_DEPTH     = 10;           // 5 échanges in/out

export interface ChatMessage {
  role:    "user" | "assistant";
  content: string;
}

interface InvokeAgentArgs {
  /** Message qu'on vient de recevoir de l'utilisateur. */
  userMessage:    string;
  /** Historique conversationnel récent (10 derniers, in+out alternés). */
  history?:       ChatMessage[];
  /** Profil DB de l'utilisateur (si reconnu via numéro). */
  userProfile?:   {
    prenom?:        string | null;
    niveau_acces?:  "GRATUIT" | "STARTER" | "PRO" | "ELITE" | null;
    abonnement_actif?: boolean;
  } | null;
  /** ISO date du jour, défaut aujourd'hui. */
  todayISO?:      string;
}

export interface AgentReply {
  /** Réponse à envoyer à l'utilisateur (marqueurs déjà strippés). */
  reply:        string;
  /** Intent détecté par le LLM. */
  intent:       "FAQ" | "VENTE" | "SUPPORT" | "PRONOSTIC" | "AUTRE";
  /** Si présent, raison d'escalade vers humain. */
  escalateReason?: string;
  /** Métadonnées coût (pour log/budget). */
  inputTokens:  number;
  outputTokens: number;
  costUsd:      number;
  model:        string;
}

/**
 * Appelle Claude pour générer la réponse de l'agent.
 * Throw uniquement sur erreur fatale (env manquante, API down). Le webhook
 * gérera le throw avec un fallback texte.
 */
export async function invokeAgent(args: InvokeAgentArgs): Promise<AgentReply> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY manquante. Config Cloudflare Workers → Settings → Secrets.",
    );
  }
  const model = process.env.WHATSAPP_LLM_MODEL || DEFAULT_MODEL;

  const systemPrompt = buildSystemPrompt({
    userProfile:    args.userProfile ?? null,
    todayISO:       args.todayISO,
    isFirstMessage: !args.history?.length,
  });

  // Historique tronqué + ajout du nouveau message user
  const history = (args.history ?? []).slice(-HISTORY_DEPTH);
  const messages = [
    ...history,
    { role: "user" as const, content: args.userMessage },
  ];

  const res = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "x-api-key":         apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
      "content-type":      "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: MAX_OUTPUT_TOKENS,
      // Le system prompt est gros (~3kb avec la KB) — on le marque pour
      // bénéficier du prompt caching Anthropic. Hits coûtent 10% du prix
      // d'une write. Sur 100 conv/jour avec ~80% hit rate, économie
      // mensuelle estimée : ~70%.
      system: [
        {
          type: "text",
          text: systemPrompt,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Anthropic API HTTP ${res.status}: ${errText.slice(0, 500)}`);
  }

  const data = await res.json() as {
    content: Array<{ type: string; text: string }>;
    usage: {
      input_tokens:  number;
      output_tokens: number;
      cache_read_input_tokens?:    number;
      cache_creation_input_tokens?: number;
    };
    model: string;
  };

  const rawText = data.content
    .filter((c) => c.type === "text")
    .map((c) => c.text)
    .join("\n")
    .trim();

  const parsed = parseAgentOutput(rawText);

  return {
    ...parsed,
    inputTokens:  data.usage.input_tokens,
    outputTokens: data.usage.output_tokens,
    costUsd:      estimateCostUsd(model, data.usage),
    model:        data.model,
  };
}

/**
 * Parse la sortie LLM : extrait les marqueurs [INTENT:] et [ESCALATE:],
 * retire-les du corps de la réponse, retourne séparément.
 */
function parseAgentOutput(raw: string): {
  reply:           string;
  intent:          AgentReply["intent"];
  escalateReason?: string;
} {
  let reply = raw;
  let intent: AgentReply["intent"] = "AUTRE";
  let escalateReason: string | undefined;

  // [INTENT: FAQ] (insensible à la casse, peut être en plusieurs lignes)
  const intentMatch = raw.match(/\[INTENT:\s*([A-Z_]+)\s*\]/i);
  if (intentMatch) {
    const v = intentMatch[1].toUpperCase();
    if (["FAQ", "VENTE", "SUPPORT", "PRONOSTIC", "AUTRE"].includes(v)) {
      intent = v as AgentReply["intent"];
    }
    reply = reply.replace(intentMatch[0], "");
  }

  // [ESCALATE: raison]
  const escMatch = raw.match(/\[ESCALATE:\s*([^\]]+)\]/i);
  if (escMatch) {
    escalateReason = escMatch[1].trim();
    reply = reply.replace(escMatch[0], "");
  }

  // Nettoie les retours ligne en trop laissés par les marqueurs supprimés
  reply = reply.replace(/\n{3,}/g, "\n\n").trim();

  return { reply, intent, escalateReason };
}

/**
 * Estimation coût USD selon le modèle et l'usage. Tarifs au 2026-05.
 * On bascule sur cache_read si présent (10% du prix input standard).
 */
function estimateCostUsd(
  model: string,
  usage: {
    input_tokens:  number;
    output_tokens: number;
    cache_read_input_tokens?:     number;
    cache_creation_input_tokens?: number;
  },
): number {
  // Tarifs USD per 1M tokens (prix Anthropic 2026)
  const PRICING: Record<string, { in: number; out: number; cacheWrite: number; cacheRead: number }> = {
    "claude-haiku-4-5":   { in: 1.0,  out: 5.0,  cacheWrite: 1.25, cacheRead: 0.10 },
    "claude-sonnet-4-5":  { in: 3.0,  out: 15.0, cacheWrite: 3.75, cacheRead: 0.30 },
    "claude-opus-4-5":    { in: 15.0, out: 75.0, cacheWrite: 18.75, cacheRead: 1.50 },
  };
  // Match par préfixe (le modèle exact peut être "claude-haiku-4-5-20251015" etc.)
  const key = Object.keys(PRICING).find((k) => model.startsWith(k))
    ?? "claude-haiku-4-5";
  const p = PRICING[key];

  const cacheRead   = usage.cache_read_input_tokens     ?? 0;
  const cacheWrite  = usage.cache_creation_input_tokens ?? 0;
  const standardIn  = usage.input_tokens - cacheRead - cacheWrite;

  const cost =
    (standardIn * p.in + cacheWrite * p.cacheWrite + cacheRead * p.cacheRead) / 1_000_000
    + (usage.output_tokens * p.out) / 1_000_000;

  return Math.round(cost * 1_000_000) / 1_000_000; // 6 décimales
}
