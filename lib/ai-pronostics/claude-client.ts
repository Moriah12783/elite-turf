/**
 * lib/ai-pronostics/claude-client.ts
 *
 * Wrapper minimal autour de l'API Anthropic pour les agents IA Elite Turf.
 * Reprend la logique existante de `app/api/cron/ia-pronostics/route.ts` mais
 * la centralise pour réutilisation par les 5 agents multi-agents.
 *
 * Pourquoi pas le SDK officiel `@anthropic-ai/sdk` :
 *   - +500KB bundle (Cloudflare Workers = 1MB limit Free)
 *   - On a juste besoin d'1 endpoint /messages
 *   - fetch natif suffit, plus léger
 */

import type { ClaudeModel } from "./types";
import { CLAUDE_MODELS } from "./types";

/**
 * Lit la clé API à chaque appel (pas à l'import time).
 *
 * Pourquoi : si un script CLI charge `.env.local` à l'exécution
 * (cf scripts/backtest-ia-pipeline.ts), les `import` sont déjà hoistés
 * AVANT que process.env soit peuplé. Lire la clé à chaque appel résout
 * ce piège ESM. Aucun impact perf (lecture process.env = O(1)).
 *
 * Bonus en prod : permet de rotate la clé Anthropic sans redéploiement
 * (next call relit la nouvelle valeur).
 */
function getAnthropicKey(): string {
  return process.env.ANTHROPIC_API_KEY || "";
}

export interface ClaudeCallOptions {
  model:         ClaudeModel;
  systemPrompt:  string;
  userPrompt:    string;
  /** max_tokens — défaut 1500 pour analyses, augmenter pour gros JSONs */
  maxTokens?:    number;
  /** Force le retour à être un JSON parseable (extrait via regex après) */
  expectJson?:   boolean;
}

export interface ClaudeCallResult<T = string> {
  text:           string;
  /** Si expectJson=true, contient l'objet parsé */
  parsed?:        T;
  tokens_input:   number;
  tokens_output:  number;
  model_used:     ClaudeModel;
}

/**
 * Appelle Claude avec retry exponentiel sur 429/503.
 * Retourne le texte brut + un parsed JSON si demandé.
 *
 * @throws Error si l'appel échoue après les retries OU si expectJson=true
 *   et que le JSON est non parseable.
 */
export async function callClaude<T = unknown>(
  opts: ClaudeCallOptions,
): Promise<ClaudeCallResult<T>> {
  const apiKey = getAnthropicKey();
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY manquante dans l'environnement");
  }

  const maxTokens = opts.maxTokens ?? 1500;
  const maxRetries = 3;
  let attempt = 0;
  let lastError: unknown;

  while (attempt < maxRetries) {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method:  "POST",
        headers: {
          "x-api-key":         apiKey,
          "anthropic-version": "2023-06-01",
          "content-type":      "application/json",
        },
        body: JSON.stringify({
          model:      opts.model,
          max_tokens: maxTokens,
          system:     opts.systemPrompt,
          messages:   [{ role: "user", content: opts.userPrompt }],
        }),
      });

      // Retry sur 429 (rate limit) ou 503 (overloaded)
      if (res.status === 429 || res.status === 503) {
        const wait = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
        await new Promise((r) => setTimeout(r, wait));
        attempt++;
        continue;
      }

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Claude API ${res.status}: ${err.slice(0, 200)}`);
      }

      const data = await res.json();
      const text = data?.content?.[0]?.text ?? "";
      const usage = data?.usage ?? {};

      const result: ClaudeCallResult<T> = {
        text,
        tokens_input:  usage.input_tokens  ?? 0,
        tokens_output: usage.output_tokens ?? 0,
        model_used:    opts.model,
      };

      if (opts.expectJson) {
        // Extraire le JSON même si Claude ajoute du préambule/markdown
        const match = text.match(/\{[\s\S]*\}/);
        if (!match) {
          throw new Error(`Réponse Claude non JSON parseable: ${text.slice(0, 300)}`);
        }
        try {
          result.parsed = JSON.parse(match[0]) as T;
        } catch (err) {
          throw new Error(`JSON.parse failed: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      return result;

    } catch (err) {
      lastError = err;
      attempt++;
      if (attempt >= maxRetries) break;
      // Wait avant retry (1s, 2s, 4s)
      await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000));
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("callClaude: retry exhausted");
}

// Re-export pour facilité d'usage par les agents
export { CLAUDE_MODELS };
