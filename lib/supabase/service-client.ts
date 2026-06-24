import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Client admin Supabase (bypass RLS) SANS dépendance Next (`next/headers`).
 *
 * Extrait de `lib/supabase/server.ts` pour être importable depuis un contexte
 * Node PUR : les scripts CLI bundlés par esbuild et exécutés sur GitHub Actions.
 * `lib/supabase/server.ts` importe `next/headers` en tête (pour `createClient`),
 * donc l'importer depuis un CLI Node casserait le runtime. Ce module-ci est
 * volontairement minimal et sans aucun import Next.
 *
 * Contexte (2026-06-23) : les syncs Geny (arrivées, programme) ont été déplacés
 * sur GitHub Actions car Geny renvoie HTTP 403 à l'IP du Worker Cloudflare.
 * `runGenyArriveesSync` / `runGenyProgrammeSync` importent `createServiceClient`
 * DEPUIS CE MODULE pour rester bundlables en Node. La version Next d'origine
 * reste dans `server.ts` pour les autres appelants (Server Components, routes).
 *
 * Env : `NEXT_PUBLIC_SUPABASE_URL` (Worker Cloudflare) ou `SUPABASE_URL`
 * (GitHub Actions) + `SUPABASE_SERVICE_ROLE_KEY`.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "createServiceClient: NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquant",
    );
  }
  return createSupabaseClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: {
      fetch: (input: RequestInfo | URL, init: RequestInit = {}) =>
        fetch(input, { ...init, cache: "no-store" }),
    },
  });
}
