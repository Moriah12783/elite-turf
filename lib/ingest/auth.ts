/**
 * lib/ingest/auth.ts
 * Vérification du secret partagé MVP_API_SECRET.
 * Utilisé par tous les endpoints /api/ingest/*.
 */

const MVP_API_SECRET = process.env.MVP_API_SECRET || "";

export interface AuthResult {
  ok: boolean;
  reason?: string;
}

/**
 * Vérifie que la requête porte un header Authorization valide.
 * Format attendu : Authorization: Bearer <MVP_API_SECRET>
 */
export function checkIngestAuth(authHeader: string | null): AuthResult {
  if (!MVP_API_SECRET) {
    return { ok: false, reason: "MVP_API_SECRET non configuré côté serveur" };
  }
  if (!authHeader) {
    return { ok: false, reason: "Header Authorization absent" };
  }
  const [scheme, token] = authHeader.split(" ");
  if (scheme !== "Bearer" || !token) {
    return { ok: false, reason: "Format Authorization invalide (Bearer <secret> attendu)" };
  }
  if (token !== MVP_API_SECRET) {
    return { ok: false, reason: "Secret invalide" };
  }
  return { ok: true };
}

/**
 * Extrait les headers de traçabilité MVP.
 */
export function extractMvpHeaders(req: Request): {
  requestId: string;
  timestamp: string | null;
} {
  return {
    requestId: req.headers.get("x-mvp-request-id") || `auto-${Date.now()}`,
    timestamp: req.headers.get("x-mvp-timestamp"),
  };
}
