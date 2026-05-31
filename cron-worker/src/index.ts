/**
 * cron-worker/src/index.ts
 *
 * Worker Cloudflare dédié aux Cron Triggers d'Elite Turf.
 *
 * ── Pourquoi ce worker existe ──────────────────────────────────────────
 *
 * L'app Next.js principale (`elite-turf`) est générée par OpenNext qui ne
 * supporte pas nativement le `scheduled()` event handler. Plutôt que de
 * modifier l'output OpenNext (fragile car regénéré à chaque build), on
 * crée un mini-Worker dédié qui :
 *
 *   1. Reçoit les Cron Triggers natifs Cloudflare (configurés dans
 *      wrangler.toml)
 *   2. Lookup le path API correspondant via CRON_MAP
 *   3. Fait un HTTP fetch vers l'app principale avec Authorization Bearer
 *   4. Log le résultat (success / error / duration)
 *
 * Avant : vercel.json était la source de vérité des crons. Mais Cloudflare
 * IGNORE vercel.json → aucun cron ne tournait via Cloudflare. Les crons
 * étaient soit silencieusement KO, soit déclenchés par une source externe
 * non documentée.
 *
 * Maintenant : Cron Triggers Cloudflare natifs, observable dans le
 * dashboard, fiabilité 99.9% Cloudflare SLA, gratuit jusqu'à 100/worker.
 */

// ── Types Cloudflare Workers (déclarés inline pour éviter une dépendance
//    externe sur @cloudflare/workers-types qui n'est pas installée dans
//    le package principal. Wrangler injecte les vrais types au build) ──
interface ScheduledEvent {
  cron: string;
  scheduledTime: number;
  type: "scheduled";
}
interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

interface Env {
  /** URL de l'app principale (ex: "https://www.elite-turf.fr") */
  APP_URL: string;
  /** Secret partagé avec les routes /api/cron/* pour authentification */
  CRON_SECRET: string;
}

/**
 * Mapping cron pattern → path API à déclencher.
 *
 * **DOIT rester synchronisé avec [triggers].crons dans wrangler.toml** :
 * chaque cron pattern listé dans wrangler.toml doit avoir une entrée ici.
 *
 * Plusieurs cron patterns peuvent pointer vers le même endpoint (ex:
 * `enrichir-partants` est appelé 4 fois par jour à des horaires différents).
 */
const CRON_MAP: Record<string, string> = {
  // ── IA Pronostics & contenus ──────────────────────────────────────
  //
  // Système Multi-Agents (cahier §13-17) — depuis 2026-05-14
  //
  // Bascule legacy → Multi-Agents (PR du 2026-05-14, décision PO) :
  // les anciens endpoints /api/cron/ia-pronostics (45 5 * * *) et
  // /api/cron/ia-auto-publish (0 7 * * *) ne sont plus planifiés. Le
  // code reste en place dans app/api/cron/ au cas où on veuille les
  // ré-activer (debug, fallback), mais Cloudflare ne les déclenche
  // plus automatiquement.
  //
  // Décalage horaire 2026-05-15 (post-incident "1 seul draft/jour") :
  // Anciens schedules "30 2 * * *" + "0 3 * * *" (~05:00 Paris été)
  // tournaient AVANT le scrape Geny+PMU (premier passage 09:27 UTC).
  // → partants_bdd=0 pour 80% des courses → SelectionBuilder vide →
  // director.ts faisait `continue` → 0-2 drafts/jour au lieu de 5-6.
  //
  // Nouveau séquencement :
  //   "30 5 * * *" → enrichir-partants matinal (07:30 Paris été)
  //   "15 6 * * *" → source-evidence-collector (08:15 Paris été)
  //   "45 6 * * *" → ia-pronostics-v2 (08:45 Paris été)
  // Pour le marché Afrique francophone (Abidjan UTC+0) : 06:45 UTC =
  // 06:45 Abidjan = matinal idéal pour les abonnés CI/SN/BF/etc.
  "15 6 * * *":   "/api/cron/source-evidence-collector",
  "45 6 * * *":   "/api/cron/ia-pronostics-v2",
  "0 19 * * *":   "/api/cron/ia-rapport-soir",
  "45 9 * * *":   "/api/cron/pronostic-gratuit",
  "30 9 * * *":   "/api/cron/ia-auto-publish-v2",  // filet sécurité premium : publie les brouillons du jour SI l'admin est absent (règle "jour entier")

  // ── Sync programme + partants ─────────────────────────────────────
  "41 7 * * *":   "/api/cron/lonaci-sync",
  "37 11 * * *":  "/api/cron/lonaci-sync",
  "30 5 * * *":   "/api/cron/enrichir-partants",   // matinal — AVANT pipeline IA
  "47 11 * * *":  "/api/cron/enrichir-partants",
  "13 13 * * *":  "/api/cron/enrichir-partants",
  "13 15 * * *":  "/api/cron/enrichir-partants",
  "43 17 * * *":  "/api/cron/pmu-demain",

  // ── Sync arrivées (toutes les heures 13h-19h UTC) ─────────────────
  "11 13 * * *":  "/api/cron/geny-arrivees",
  "11 14 * * *":  "/api/cron/geny-arrivees",
  "11 15 * * *":  "/api/cron/geny-arrivees",
  "11 16 * * *":  "/api/cron/geny-arrivees",
  "11 17 * * *":  "/api/cron/geny-arrivees",
  "11 18 * * *":  "/api/cron/geny-arrivees",
  "11 19 * * *":  "/api/cron/geny-arrivees",

  // ── Sync résultats (post-courses) ─────────────────────────────────
  "23 6 * * *":   "/api/admin/sync-resultats",
  "17 19 * * *":  "/api/admin/sync-resultats",
  "17 20 * * *":  "/api/admin/sync-resultats",
  "17 21 * * *":  "/api/admin/sync-resultats",
  "17 22 * * *":  "/api/admin/sync-resultats",
  "37 20 * * *":  "/api/admin/rapport-journalier",

  // ── Abonnements & paiements ───────────────────────────────────────
  "7 1 * * *":    "/api/cron/expire-abonnements",
  "13 9 * * *":   "/api/cron/rappel-expiration",
  "*/15 * * * *": "/api/cron/paystack-recovery",

  // ── Monitoring & SEO ──────────────────────────────────────────────
  "*/30 * * * *": "/api/cron/health-alerter",
  "45 3 * * *":   "/api/cron/seo-etl",

  // ── Notifications utilisateurs ────────────────────────────────────
  "23 * * * *":   "/api/cron/welcome-emails",
  "0 6 * * *":    "/api/cron/daily-push",
  "0 17 * * *":   "/api/cron/daily-push",
};

/**
 * Timeout maximum d'un HTTP fetch vers l'app principale.
 * Doit être inférieur à la limite CPU du Worker (30s) pour permettre le
 * logging final même en cas de timeout.
 */
const FETCH_TIMEOUT_MS = 25_000;

export default {
  /**
   * Handler des Cron Triggers Cloudflare.
   * Appelé automatiquement par Cloudflare au moment configuré dans
   * wrangler.toml `[triggers].crons`.
   */
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    const path = CRON_MAP[event.cron];
    if (!path) {
      console.error(`[cron] Pattern inconnu : "${event.cron}". Vérifie CRON_MAP.`);
      return;
    }

    const url = `${env.APP_URL}${path}`;
    const start = Date.now();

    // ctx.waitUntil garantit que la promesse termine même si scheduled()
    // retourne en attendant. Important pour les logs.
    ctx.waitUntil(triggerEndpoint(url, env, event.cron, start));
  },

  /**
   * Endpoint HTTP optionnel : permet de déclencher manuellement un cron
   * pour debug. Authentifié par le même CRON_SECRET.
   *
   * Usage : GET https://elite-turf-crons.workers.dev/?path=/api/cron/geny-arrivees
   * Headers: Authorization: Bearer <CRON_SECRET>
   */
  async fetch(request: Request, env: Env): Promise<Response> {
    const auth = request.headers.get("authorization") || "";
    if (auth !== `Bearer ${env.CRON_SECRET}`) {
      return new Response("Unauthorized", { status: 401 });
    }

    const url = new URL(request.url);
    const path = url.searchParams.get("path");
    if (!path) {
      return Response.json({
        message: "Cron worker actif. Usage: ?path=/api/cron/<endpoint>",
        knownCrons: Object.values(CRON_MAP).filter((v, i, a) => a.indexOf(v) === i),
      });
    }

    const targetUrl = `${env.APP_URL}${path}`;
    const start = Date.now();
    const result = await triggerEndpoint(targetUrl, env, "manual", start);
    return Response.json(result);
  },
};

/**
 * Fait le HTTP fetch vers l'app principale avec auth Bearer + logs.
 */
async function triggerEndpoint(
  url: string,
  env: Env,
  cronPattern: string,
  start: number,
): Promise<{ ok: boolean; status: number; duration: number; error?: string }> {
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "Authorization":   `Bearer ${env.CRON_SECRET}`,
        "X-Cron-Trigger":  cronPattern,
        "User-Agent":      "elite-turf-crons (Cloudflare Worker)",
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    const duration = Date.now() - start;
    if (res.ok) {
      console.log(
        `[cron OK] ${cronPattern} → ${url} → HTTP ${res.status} (${duration}ms)`,
      );
      return { ok: true, status: res.status, duration };
    }

    // Erreur HTTP : on log un extrait du body pour debug
    const body = await res.text().catch(() => "");
    const excerpt = body.slice(0, 300);
    console.error(
      `[cron FAIL] ${cronPattern} → ${url} → HTTP ${res.status} (${duration}ms) ${excerpt}`,
    );
    return { ok: false, status: res.status, duration, error: excerpt };
  } catch (err) {
    const duration = Date.now() - start;
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      `[cron ERROR] ${cronPattern} → ${url} → ${message} (${duration}ms)`,
    );
    return { ok: false, status: 0, duration, error: message };
  }
}
