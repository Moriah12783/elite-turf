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
  /**
   * GitHub fine-grained PAT (repo elite-turf, permission Actions: Read & write)
   * pour déclencher les workflows via l'API. Posé une fois via :
   *   wrangler secret put GH_DISPATCH_TOKEN --config cron-worker/wrangler.toml
   */
  GH_DISPATCH_TOKEN: string;
}

/** Repo GitHub cible pour les workflow_dispatch. */
const GH_REPO = "Moriah12783/elite-turf";

/**
 * Crons qui DÉCLENCHENT un workflow GitHub Actions (au lieu d'appeler une route
 * Next). Pourquoi : Geny bloque l'IP du Worker Cloudflare (HTTP 403) → le
 * scraping de cotes tourne sur GitHub Actions (IP propre). Mais les runs
 * *planifiés* GitHub sont retardés (~90 min) → on les fait déclencher ICI par
 * le cron Cloudflare (ponctuel) via l'API : le run démarre en quelques secondes.
 *
 * Ces patterns DOIVENT être dans [triggers].crons (wrangler.toml) et NE PAS
 * être dans CRON_MAP (sinon double déclenchement).
 */
const GH_DISPATCH_MAP: Record<string, string> = {
  "30 5 * * *":  "enrich-cotes.yml",  // matin (À L'HEURE, avant pipeline IA)
  "47 11 * * *": "enrich-cotes.yml",  // midi  (À L'HEURE)
  // Après-midi : couvert par le `schedule` GitHub (filet), PAS par dispatch
  // (cf. enrich-cotes.yml) → évite les runs en double + sert de secours.

  // ── Sync programme + arrivées (déplacés ici le 2026-06-23) ──────────
  // Geny renvoie 403 à l'IP du Worker Cloudflare → ces syncs tournent sur
  // GitHub Actions (IP Azure propre), déclenchés À L'HEURE par ce Worker.
  "10 5 * * *":   "pmu-sync.yml",     // programme du JOUR (avant pipeline IA)
  "0 20 * * *":   "pmu-demain.yml",   // programme J+1 (veille au soir)
  "11 13 * * *":  "geny-arrivees.yml",
  "11 14 * * *":  "geny-arrivees.yml",
  "11 15 * * *":  "geny-arrivees.yml",
  "11 16 * * *":  "geny-arrivees.yml",
  "11 17 * * *":  "geny-arrivees.yml",
  "11 18 * * *":  "geny-arrivees.yml",
  "11 19 * * *":  "geny-arrivees.yml",
};

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
  "30 8 * * *":   "/api/cron/morning-safety-net",  // filet : rattrape si le pipeline 06:45 a vu 0 course (pmu-demain KO la veille)
  "0 19 * * *":   "/api/cron/ia-rapport-soir",
  "45 9 * * *":   "/api/cron/pronostic-gratuit",
  "30 9 * * *":   "/api/cron/ia-auto-publish-v2",  // filet sécurité premium : publie les brouillons du jour SI l'admin est absent (règle "jour entier")

  // ── Sync programme + partants ─────────────────────────────────────
  "41 7 * * *":   "/api/cron/lonaci-sync",
  "37 11 * * *":  "/api/cron/lonaci-sync",
  // enrichir-partants (cotes) → déplacé vers GH_DISPATCH_MAP : Geny est 403
  // depuis l'IP du Worker, le scraping tourne sur GitHub Actions (IP propre),
  // déclenché À L'HEURE par ce Worker (crons "30 5", "47 11", "13 13", "13 15").
  // pmu-sync (programme jour), pmu-demain (programme J+1) et geny-arrivees
  // (×7, 13h-19h) → DÉPLACÉS vers GH_DISPATCH_MAP le 2026-06-23 : Geny renvoie
  // 403 à l'IP du Worker → ces syncs tournent désormais sur GitHub Actions
  // (IP propre), déclenchés À L'HEURE par ce Worker.

  // ── Sync résultats (post-courses) ─────────────────────────────────
  "23 6 * * *":   "/api/admin/sync-resultats",
  "17 19 * * *":  "/api/admin/sync-resultats",
  "17 20 * * *":  "/api/admin/sync-resultats",
  "17 21 * * *":  "/api/admin/sync-resultats",
  "17 22 * * *":  "/api/admin/sync-resultats",
  "37 20 * * *":  "/api/admin/rapport-journalier",

  // ── Propagation dividendes (rapport_gagnant) ──────────────────────
  // Après le dernier sync-resultats du soir (22:17 UTC), ce cron propage
  // les dividendes PMU (arrivees.rapports_pmu) → pronostics.rapport_gagnant.
  // Sans lui, le dividende restait null même pour les gagnants → le ROI
  // et les gains affichés étaient faux (cf. PR #151). La route a une
  // fenêtre 90j par défaut + skip ceux déjà remplis : le 1er passage
  // rattrape tout le backlog, les suivants restent à jour. Self-healing
  // via fenêtre glissante (un gagnant résulté tardivement est rempli au
  // plus tard le lendemain soir).
  "40 22 * * *":  "/api/admin/backfill-rapport-gagnant",

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
  "30 10 * * *":  "/api/cron/sms-sequence",
  // lead-sequence (drip email leads J2/J5) : DESACTIVE volontairement (voir wrangler.toml).
  // Reactivation = decommenter ici + dans [triggers].crons, apres migrations 003+004 + go explicite.
  //   "33 9 * * *":   "/api/cron/lead-sequence",
  //   "33 16 * * *":  "/api/cron/lead-sequence",
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
    const start = Date.now();

    // 1. Cron qui déclenche un workflow GitHub (scraping cotes sur IP propre) ?
    const workflow = GH_DISPATCH_MAP[event.cron];
    if (workflow) {
      ctx.waitUntil(dispatchGithubWorkflow(workflow, env, event.cron, start));
      return;
    }

    // 2. Sinon, cron classique → fetch de la route Next.
    const path = CRON_MAP[event.cron];
    if (!path) {
      console.error(`[cron] Pattern inconnu : "${event.cron}". Vérifie CRON_MAP / GH_DISPATCH_MAP.`);
      return;
    }

    const url = `${env.APP_URL}${path}`;
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

    // Test manuel d'un dispatch GitHub : GET /?dispatch=enrich-cotes.yml
    const dispatch = url.searchParams.get("dispatch");
    if (dispatch) {
      const result = await dispatchGithubWorkflow(dispatch, env, "manual", Date.now());
      return Response.json(result);
    }

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

/**
 * Déclenche un workflow GitHub Actions via l'API (workflow_dispatch).
 * api.github.com n'est PAS bloqué par Geny → le scraping de cotes tourne sur
 * GitHub (IP propre), mais démarre À L'HEURE (déclenché par ce cron ponctuel,
 * contrairement aux runs planifiés GitHub retardés de ~90 min).
 * Succès attendu = HTTP 204 No Content.
 */
async function dispatchGithubWorkflow(
  workflow: string,
  env: Env,
  cronPattern: string,
  start: number,
): Promise<{ ok: boolean; status: number; duration: number; error?: string }> {
  const url = `https://api.github.com/repos/${GH_REPO}/actions/workflows/${workflow}/dispatches`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization":        `Bearer ${env.GH_DISPATCH_TOKEN}`,
        "Accept":               "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent":           "elite-turf-crons (Cloudflare Worker)",
      },
      body: JSON.stringify({ ref: "main" }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    const duration = Date.now() - start;
    if (res.status === 204) {
      console.log(`[gh-dispatch OK] ${cronPattern} → ${workflow} (${duration}ms)`);
      return { ok: true, status: 204, duration };
    }
    const body = await res.text().catch(() => "");
    console.error(
      `[gh-dispatch FAIL] ${cronPattern} → ${workflow} → HTTP ${res.status} ${body.slice(0, 200)}`,
    );
    return { ok: false, status: res.status, duration, error: body.slice(0, 200) };
  } catch (err) {
    const duration = Date.now() - start;
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[gh-dispatch ERROR] ${cronPattern} → ${workflow} → ${message} (${duration}ms)`);
    return { ok: false, status: 0, duration, error: message };
  }
}
