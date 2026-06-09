"use client";

import { useState } from "react";
import { Mail } from "lucide-react";

/**
 * Bouton admin « Notifier les abonnés » pour un pronostic DÉJÀ publié.
 *
 * Réutilise la route existante POST /api/admin/pronostics/notifier (auth par
 * session admin via cookie — envoyé automatiquement par le fetch same-origin).
 * Comme l'envoi est une action de MASSE (email réel à tous les abonnés
 * éligibles), on demande une confirmation explicite avant d'appeler la route.
 *
 * Ciblage côté route selon niveau_acces :
 *   ELITE → Elite · PRO → Starter+Pro+Elite · STARTER/GRATUIT → tous les actifs.
 */
export default function NotifierButton({
  pronosticId,
  niveau,
  publie,
}: {
  pronosticId: string;
  niveau: string;
  publie: boolean;
}) {
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [sent, setSent] = useState<number | null>(null);

  // On ne notifie que pour un pronostic publié (sinon rien à annoncer).
  if (!publie) return null;

  const cible =
    niveau === "ELITE"
      ? "abonnés Elite"
      : niveau === "PRO"
      ? "abonnés Starter + Pro + Elite"
      : "tous les abonnés actifs";

  async function notifier() {
    if (state === "sending") return;
    const ok = window.confirm(
      `Envoyer l'email « nouveau pronostic » à : ${cible} ?\n\n` +
        "C'est un envoi réel et il ne peut pas être annulé.",
    );
    if (!ok) return;

    setState("sending");
    try {
      const res = await fetch("/api/admin/pronostics/notifier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pronosticId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setState("error");
        return;
      }
      setSent(typeof data.sent === "number" ? data.sent : 0);
      setState("done");
    } catch {
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <span className="inline-flex items-center gap-1 text-status-win text-xs font-medium">
        ✓ {sent} email{(sent ?? 0) > 1 ? "s" : ""} envoyé{(sent ?? 0) > 1 ? "s" : ""}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={notifier}
      disabled={state === "sending"}
      title={`Envoyer l'email aux ${cible}`}
      className="inline-flex items-center gap-1 text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors disabled:opacity-50"
    >
      <Mail className="w-3.5 h-3.5" />
      {state === "sending" ? "Envoi…" : state === "error" ? "Réessayer" : "Notifier"}
    </button>
  );
}
