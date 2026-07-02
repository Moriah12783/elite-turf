/**
 * Authentification de l'API d'ingestion (Lot 2).
 *   1. Bearer : Authorization: Bearer <ELITE_INGEST_KEY>  (obligatoire)
 *   2. Signature : X-Signature: HMAC-SHA256(rawBody, ELITE_INGEST_SECRET) hex
 *      — obligatoire SI ELITE_INGEST_SECRET est configuré (recommandé).
 *
 * Aucune fuite d'information : 401 (auth absente/mauvaise) vs 403 (signature
 * mauvaise) sans détail. Comparaisons à TEMPS CONSTANT (anti-timing-attack).
 */

export interface IngestAuthResult {
  ok: boolean;
  status?: 401 | 403;
  reason?: string;
}

/** Comparaison à temps constant de deux chaînes (ES5-safe, pas de dépendance Node). */
function timingSafeEqualStr(a: string, b: string): boolean {
  // Longueurs différentes : on compare quand même une longueur fixe pour ne pas
  // révéler la différence par le temps, puis on renvoie false.
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

async function hmacSha256Hex(secret: string, body: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  const u8 = new Uint8Array(sig);
  let hex = "";
  for (let i = 0; i < u8.length; i++) hex += (u8[i] < 16 ? "0" : "") + u8[i].toString(16);
  return hex;
}

/**
 * Vérifie l'auth d'une requête d'ingestion.
 * @param authHeader   valeur brute de l'en-tête Authorization
 * @param signature    valeur brute de X-Signature (peut être null)
 * @param rawBody      corps brut EXACT (pour le HMAC ; doit être identique à ce qui a été signé)
 */
export async function verifyIngestAuth(
  authHeader: string | null,
  signature: string | null,
  rawBody: string,
): Promise<IngestAuthResult> {
  const key = process.env.ELITE_INGEST_KEY;
  if (!key) {
    // Secret non configuré côté serveur → refuse tout (fail-closed), jamais ouvert.
    return { ok: false, status: 401, reason: "ingestion non configurée" };
  }

  const expected = "Bearer " + key;
  if (!authHeader || !timingSafeEqualStr(authHeader, expected)) {
    return { ok: false, status: 401 };
  }

  const secret = process.env.ELITE_INGEST_SECRET;
  if (secret) {
    // Signature obligatoire dès qu'un secret est posé.
    if (!signature) return { ok: false, status: 403 };
    const expectedSig = await hmacSha256Hex(secret, rawBody);
    if (!timingSafeEqualStr(signature.trim().toLowerCase(), expectedSig)) {
      return { ok: false, status: 403 };
    }
  }

  return { ok: true };
}
