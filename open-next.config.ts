import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";
import { withRegionalCache } from "@opennextjs/cloudflare/overrides/incremental-cache/regional-cache";
import memoryQueue from "@opennextjs/cloudflare/overrides/queue/memory-queue";

/**
 * Cache des pages ISR (brief SEO du 01/10/2026, B3).
 *
 * Avant : `defineCloudflareConfig()` sans argument = cache « dummy » d'OpenNext.
 * AUCUNE page n'était jamais mise en cache ; les `revalidate` du code restaient
 * sans effet, chaque visite refaisait le rendu complet.
 *
 * - incrementalCache : pages stockées dans R2 (liaison NEXT_INC_CACHE_R2_BUCKET,
 *   cf. wrangler.toml), avec une copie locale d'une minute par datacenter
 *   (« short-lived ») pour les visites rapprochées.
 * - queue : régénération en arrière-plan. Une page périmée est servie telle
 *   quelle pendant qu'elle se régénère (liaison WORKER_SELF_REFERENCE).
 * - pas de tagCache : revalidatePath()/revalidateTag() restent sans effet,
 *   comme aujourd'hui. La fraîcheur repose sur le délai ISR et sur l'appel de
 *   « / » toutes les 5 min par elite-turf-crons.
 * - pas d'`enableCacheInterception` : OpenNext 1.14 n'intercepte pas « / »
 *   (le chemin devient "" une fois la barre finale retirée). L'accueil est
 *   servi depuis R2 par Next, sans rendu — vérifié en aperçu local.
 *
 * Périmètre réel : la page d'accueil (force-static) et quelques adresses déjà
 * statiques sans données du jour (icônes, connexion, inscription, llms.txt).
 * Les autres pages publiques restent rendues à chaque visite : le pied de page
 * lit la session.
 */
export default defineCloudflareConfig({
  incrementalCache: withRegionalCache(r2IncrementalCache, { mode: "short-lived" }),
  queue: memoryQueue,
});
