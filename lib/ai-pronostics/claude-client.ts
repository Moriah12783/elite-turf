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
  /** Timeout dur par appel (ms). Défaut 35s. Un appel plus lent est avorté. */
  timeoutMs?:    number;
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
  const timeoutMs = opts.timeoutMs ?? 35_000;

  // On distingue les erreurs TRANSITOIRES (réseau, timeout, 429/503/529 =
  // surcharge) — qui méritent un retry avec backoff — des erreurs
  // DÉTERMINISTES (4xx hors 429, JSON non parseable) qui ne se réparent pas en
  // ré-essayant à l'identique. Avant ce correctif (2026-05-31), un JSON tronqué
  // par max_tokens déclenchait 3 retries × ~30s = ~90s gaspillées puis échec
  // (incident "sous-production pipeline"). On limite le retry de parsing à 1
  // (régénération unique) et on borne chaque appel par un timeout dur.
  const MAX_TRANSIENT_RETRIES = 3;
  const MAX_PARSE_RETRIES     = 1;
  let transientAttempt = 0;
  let parseAttempt     = 0;

  const backoff = (n: number) =>
    new Promise((r) => setTimeout(r, Math.min(8_000, Math.pow(2, n) * 1000)));

  while (true) {
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
        // Borne dure par appel : un appel lent/pendu est avorté ici au lieu de
        // bloquer tout le pipeline jusqu'au kill plateforme (cf claude-client
        // n'avait AUCUN timeout avant le 2026-05-31).
        signal: AbortSignal.timeout(timeoutMs),
      });

      // Transitoire : rate limit (429) / surcharge (503/529) → retry backoff
      if (res.status === 429 || res.status === 503 || res.status === 529) {
        if (transientAttempt >= MAX_TRANSIENT_RETRIES) {
          throw new Error(`Claude API ${res.status} après ${MAX_TRANSIENT_RETRIES} retries`);
        }
        await backoff(transientAttempt++);
        continue;
      }

      // Déterministe (400/401/404…) : pas de retry, échec immédiat
      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Claude API ${res.status}: ${err.slice(0, 200)}`);
      }

      const data  = await res.json();
      const text  = data?.content?.[0]?.text ?? "";
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
        let parsed: T | undefined;
        if (match) {
          try { parsed = JSON.parse(match[0]) as T; } catch { /* → retry parsing borné */ }
        }
        if (parsed === undefined) {
          // JSON absent/tronqué (souvent max_tokens atteint). 1 régénération au
          // plus : au-delà, échec rapide — un retry à l'identique ne répare pas
          // une troncature et coûte une génération entière (~30s).
          if (parseAttempt < MAX_PARSE_RETRIES) {
            parseAttempt++;
            continue;
          }
          throw new Error(`Réponse Claude non JSON parseable (après ${MAX_PARSE_RETRIES} retry): ${text.slice(0, 200)}`);
        }
        result.parsed = parsed;
      }

      return result;

    } catch (err) {
      // Retry UNIQUEMENT sur erreurs transitoires réseau/timeout.
      const name = err instanceof Error ? err.name : "";
      const msg  = err instanceof Error ? err.message : String(err);
      const isTransient =
        name === "TimeoutError" || name === "AbortError" ||
        /fetch failed|network|ECONNRESET|ETIMEDOUT|EAI_AGAIN/i.test(msg);
      if (isTransient && transientAttempt < MAX_TRANSIENT_RETRIES) {
        await backoff(transientAttempt++);
        continue;
      }
      throw err instanceof Error ? err : new Error(String(err));
    }
  }
}

// Re-export pour facilité d'usage par les agents
export { CLAUDE_MODELS };
