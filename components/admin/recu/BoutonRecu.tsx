"use client";

/**
 * Bouton « Reçu JPG » d'un paiement Orange Money / Wave : lit le reçu en base
 * (GET /api/admin/paiements/recu), le dessine dans le navigateur et le
 * télécharge. L'admin l'envoie ensuite lui-même à l'abonné sur WhatsApp :
 * rien n'est envoyé automatiquement.
 *
 * Utilisé après « Confirmer l'activation » (ActiverMobileMoney) et dans la
 * colonne Action de /admin/paiements (`compact`).
 */
import { useState } from "react";
import { Download, Loader2, AlertTriangle } from "lucide-react";
import type { Recu } from "@/lib/paiement/recu-mobile-money";
import { dessinerRecu, telechargerJpg } from "./dessinerRecu";

export default function BoutonRecu({ reference, compact = false }: { reference: string; compact?: boolean }) {
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState("");

  async function telecharger() {
    setOccupe(true);
    setErreur("");
    try {
      const res = await fetch(`/api/admin/paiements/recu?reference=${encodeURIComponent(reference)}`, {
        cache: "no-store",
      });
      const json = (await res.json().catch(() => ({}))) as { recu?: Recu; error?: string };
      if (!res.ok || !json.recu) throw new Error(json.error || `Reçu indisponible (erreur ${res.status}).`);
      telechargerJpg(await dessinerRecu(json.recu), json.recu.nomFichier);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Reçu indisponible.");
    } finally {
      setOccupe(false);
    }
  }

  const classes = compact
    ? "inline-flex items-center gap-1 px-3 py-1.5 bg-gold-faint hover:bg-gold-primary/20 border border-gold-primary/30 text-gold-light text-xs font-semibold rounded-lg transition-colors whitespace-nowrap disabled:opacity-60"
    : "inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gold-primary hover:bg-gold-dark text-bg-primary text-sm font-bold transition-colors disabled:opacity-60";
  const icone = compact ? "w-3 h-3" : "w-4 h-4";

  return (
    <div className="flex flex-col gap-1 items-start">
      <button
        type="button"
        onClick={telecharger}
        disabled={occupe}
        className={classes}
        title="Télécharger le reçu en JPG, à envoyer à l'abonné sur WhatsApp"
      >
        {occupe ? (
          <Loader2 className={`${icone} animate-spin`} aria-hidden="true" />
        ) : (
          <Download className={icone} aria-hidden="true" />
        )}
        {compact ? "Reçu JPG" : "Télécharger le reçu (JPG)"}
      </button>
      {erreur && (
        <p className="flex items-start gap-1 text-status-loss text-xs max-w-[260px]" role="alert">
          <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" aria-hidden="true" />
          {erreur}
        </p>
      )}
    </div>
  );
}
