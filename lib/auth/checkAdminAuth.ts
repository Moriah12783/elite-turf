/**
 * lib/auth/checkAdminAuth.ts
 *
 * Helpers centralisés pour vérifier l'auth des endpoints /api/admin/*.
 *
 * Avant : chaque endpoint admin réimplémentait son propre check Bearer +
 * cookie session. Résultat :
 *   - 5 endpoints avec le bon pattern (Bearer OR cookie ADMIN)
 *   - 3 endpoints SANS aucune vérification (force-sync, sync-resultats,
 *     pronostics/[id]) → trou de sécurité critique
 *
 * Ce helper unifie l'auth : 1 ligne par route handler, behavior cohérent.
 *
 * Pattern d'usage :
 *
 *   import { requireAdminAuth } from "@/lib/auth/checkAdminAuth";
 *
 *   export async function POST(req: NextRequest) {
 *     const authError = await requireAdminAuth(req);
 *     if (authError) return authError;
 *     // ... handler protégé
 *   }
 *
 * Deux modes d'authentification acceptés (OR logique) :
 *   (a) Authorization: Bearer ${CRON_SECRET}  — scripts curl/cron
 *   (b) Cookie session Supabase + role = 'ADMIN' dans profiles — UI admin
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

const CRON_SECRET = process.env.CRON_SECRET || "";

/**
 * Vérifie l'auth d'une route admin. Retourne null si OK, ou une NextResponse
 * d'erreur (401/403) si l'auth échoue. Le handler appelant DOIT vérifier
 * le retour et le retourner directement si non-null :
 *
 *   const authError = await requireAdminAuth(req);
 *   if (authError) return authError;
 *
 * Performance : court-circuite sur Bearer (pas de query DB). Si pas de
 * Bearer, fait 1 query Supabase pour récupérer le rôle.
 */
export async function requireAdminAuth(req: NextRequest): Promise<NextResponse | null> {
  // ── (a) Bearer CRON_SECRET — court-circuit ────────────────────────────
  const auth = req.headers.get("authorization") ?? "";
  if (CRON_SECRET && auth === `Bearer ${CRON_SECRET}`) {
    return null;
  }

  // ── (b) Cookie session Supabase + role = ADMIN ────────────────────────
  const supabaseClient = await createClient();
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const serviceClient = createServiceClient();
  const { data: profile, error } = await serviceClient
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (error || !profile || profile.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return null;
}

/**
 * Variante "Bearer-only" pour les endpoints purement automation/cron qui
 * ne devraient JAMAIS être appelés depuis une UI navigateur. Utile pour
 * éviter le coût d'1 query DB quand on sait que le caller est forcément
 * un script automatisé.
 *
 *   const authError = requireBearerOnly(req);
 *   if (authError) return authError;
 */
export function requireBearerOnly(req: NextRequest): NextResponse | null {
  const auth = req.headers.get("authorization") ?? "";
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
