/**
 * app/global-error.tsx — Boundary d'erreur globale (Next 14 App Router).
 *
 * Capturé : crashes RSC catastrophiques (root layout error, fatal crash dans
 * _app, etc.). Sentry les remonte automatiquement via le hook here.
 *
 * Note : c'est le DERNIER recours. Les autres erreurs RSC sont capturées par
 * les error.tsx dans chaque segment de route, ou par Sentry server-side.
 */

"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="fr">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "40px 20px", textAlign: "center" }}>
        <h1 style={{ fontSize: 28, marginBottom: 12 }}>Une erreur s&apos;est produite</h1>
        <p style={{ color: "#666", marginBottom: 24 }}>
          Notre équipe a été automatiquement alertée. Réessayez dans quelques instants.
        </p>
        <a
          href="/"
          style={{
            display: "inline-block",
            padding: "10px 20px",
            background: "#C9A84C",
            color: "#0D0D14",
            textDecoration: "none",
            borderRadius: 8,
            fontWeight: 700,
          }}
        >
          Retour à l&apos;accueil
        </a>
      </body>
    </html>
  );
}
