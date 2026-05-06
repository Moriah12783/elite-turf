/**
 * instrumentation.ts — Hook officiel Next 14 pour init Sentry.
 *
 * Next charge ce module à l'init du serveur (RSC + Edge). On délègue le bon
 * fichier de config selon le runtime — c'est le pattern recommandé Sentry.
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}
