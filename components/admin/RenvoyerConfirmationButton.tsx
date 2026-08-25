"use client";

import { useState } from "react";
import { Mail, Loader2, Check, AlertTriangle } from "lucide-react";

/**
 * Bouton « ✉ Confirmation » de /admin/utilisateurs.
 *
 * Appelle POST /api/admin/renvoyer-confirmation pour (r)envoyer l'e-mail de
 * confirmation d'abonnement — indispensable pour les activations Mobile Money,
 * qui se font à la main en base et ne déclenchent donc aucun e-mail.
 *
 * Composant CLIENT plutôt que <form> + redirect (le pattern des autres boutons
 * admin) pour une raison précise : la route REFUSE (409) d'envoyer à un profil
 * non activé. Ce refus est une information utile, il doit s'afficher là où on a
 * cliqué — un redirect l'aurait noyé dans un paramètre d'URL.
 *
 * Envoie un vrai e-mail à un vrai client : double confirmation avant l'appel.
 */
export default function RenvoyerConfirmationButton({
  email,
  nom,
}: {
  email: string;
  nom: string;
}) {
  const [etat, setEtat] = useState<"repos" | "confirme" | "envoi" | "ok" | "erreur">("repos");
  const [message, setMessage] = useState("");

  async function envoyer() {
    setEtat("envoi");
    setMessage("");
    try {
      const res = await fetch("/api/admin/renvoyer-confirmation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setEtat("erreur");
        setMessage(data.error || `Échec (HTTP ${res.status})`);
        return;
      }
      setEtat("ok");
      setMessage(`${data.palier} · jusqu'au ${data.expire_le}`);
    } catch {
      setEtat("erreur");
      setMessage("Erreur réseau");
    }
  }

  if (etat === "ok") {
    return (
      <span className="inline-flex items-center gap-1.5 text-status-win text-xs font-semibold" title={message}>
        <Check className="w-3.5 h-3.5" /> Envoyé
      </span>
    );
  }

  if (etat === "erreur") {
    return (
      <span className="inline-flex items-start gap-1.5 text-status-loss text-xs max-w-[220px]">
        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
        <span className="leading-snug">{message}</span>
      </span>
    );
  }

  if (etat === "envoi") {
    return (
      <span className="inline-flex items-center gap-1.5 text-text-muted text-xs">
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Envoi…
      </span>
    );
  }

  // Garde-fou : un clic distrait sur la mauvaise ligne enverrait un e-mail à
  // un client. On demande une confirmation explicite, avec le nom sous les yeux.
  if (etat === "confirme") {
    return (
      <span className="inline-flex items-center gap-2 text-xs">
        <span className="text-text-secondary">Envoyer à {nom} ?</span>
        <button
          onClick={envoyer}
          className="px-2 py-1 rounded-md bg-gold-primary text-bg-primary font-bold hover:bg-gold-dark transition-colors"
        >
          Oui
        </button>
        <button
          onClick={() => setEtat("repos")}
          className="px-2 py-1 rounded-md border border-border text-text-muted hover:text-text-secondary transition-colors"
        >
          Non
        </button>
      </span>
    );
  }

  return (
    <button
      onClick={() => setEtat("confirme")}
      title="Renvoyer l'e-mail de confirmation d'abonnement"
      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border text-text-secondary text-xs font-medium hover:text-gold-light hover:border-gold-primary/40 transition-colors"
    >
      <Mail className="w-3.5 h-3.5" /> Confirmation
    </button>
  );
}
