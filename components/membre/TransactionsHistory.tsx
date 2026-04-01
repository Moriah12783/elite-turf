"use client";

import { useState, useEffect } from "react";
import { CreditCard, CheckCircle2, XCircle, Clock, RefreshCw, Receipt } from "lucide-react";

interface Transaction {
  id: string;
  montant_fcfa: number | null;
  montant_eur: number | null;
  statut: "SUCCES" | "ECHEC" | "EN_ATTENTE" | "ANNULE";
  date_transaction: string;
  methode_paiement: string | null;
  reference: string | null;
  plan_id: string | null;
}

const STATUT_CONFIG = {
  SUCCES:      { label: "Succès",     icon: CheckCircle2, classes: "text-status-win bg-status-win/10 border-status-win/20" },
  ECHEC:       { label: "Échec",      icon: XCircle,      classes: "text-status-loss bg-status-loss/10 border-status-loss/20" },
  EN_ATTENTE:  { label: "En attente", icon: Clock,        classes: "text-status-pending bg-status-pending/10 border-status-pending/20" },
  ANNULE:      { label: "Annulé",     icon: XCircle,      classes: "text-text-muted bg-bg-elevated border-border" },
};

const METHODE_LABELS: Record<string, string> = {
  MOBILE_MONEY:  "Mobile Money",
  ORANGE_MONEY:  "Orange Money",
  MTN_MONEY:     "MTN Mobile Money",
  WAVE:          "Wave",
  MOOV_MONEY:    "Moov Money",
  CARTE_BANCAIRE:"Carte bancaire",
  VIREMENT:      "Virement",
};

export default function TransactionsHistory() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/membre/transactions")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setTransactions(d.transactions ?? []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="card-base p-6 flex items-center justify-center gap-3">
        <RefreshCw className="w-5 h-5 text-gold-primary animate-spin" />
        <p className="text-text-muted text-sm">Chargement de l&apos;historique…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card-base p-6 text-center">
        <XCircle className="w-6 h-6 text-status-loss mx-auto mb-2" />
        <p className="text-text-muted text-sm">{error}</p>
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="card-base p-8 text-center">
        <Receipt className="w-10 h-10 text-text-muted mx-auto mb-3" />
        <p className="text-text-secondary text-sm font-medium mb-1">Aucune transaction</p>
        <p className="text-text-muted text-xs">
          Vos paiements apparaîtront ici après votre premier abonnement.
        </p>
      </div>
    );
  }

  return (
    <div className="card-base overflow-hidden">
      <div className="p-4 border-b border-border flex items-center gap-2">
        <CreditCard className="w-4 h-4 text-gold-primary" />
        <h3 className="font-serif font-semibold text-text-primary text-sm">
          Historique des paiements
        </h3>
        <span className="ml-auto text-text-muted text-xs">{transactions.length} transaction{transactions.length > 1 ? "s" : ""}</span>
      </div>

      <div className="divide-y divide-border/30">
        {transactions.map((t) => {
          const cfg = STATUT_CONFIG[t.statut] ?? STATUT_CONFIG.EN_ATTENTE;
          const StatutIcon = cfg.icon;
          const montantEur = t.montant_eur ?? (t.montant_fcfa ? Math.round(t.montant_fcfa / 655.957) : null);
          const montantFcfa = t.montant_fcfa;
          const methodeLabel = t.methode_paiement ? (METHODE_LABELS[t.methode_paiement] ?? t.methode_paiement) : "—";

          return (
            <div key={t.id} className="flex items-center gap-4 px-4 py-3 hover:bg-bg-hover transition-colors">
              {/* Icône statut */}
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 border ${cfg.classes}`}>
                <StatutIcon className="w-4 h-4" />
              </div>

              {/* Détails */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-text-primary font-semibold text-sm">
                    {methodeLabel}
                  </p>
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${cfg.classes}`}>
                    {cfg.label}
                  </span>
                </div>
                <p className="text-text-muted text-xs mt-0.5">
                  {new Date(t.date_transaction).toLocaleDateString("fr-FR", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  {t.reference && (
                    <span className="ml-2 font-mono text-[10px] text-text-muted">
                      #{t.reference.slice(-8).toUpperCase()}
                    </span>
                  )}
                </p>
              </div>

              {/* Montant */}
              <div className="text-right flex-shrink-0">
                {montantEur !== null && (
                  <p className={`font-bold text-sm ${t.statut === "SUCCES" ? "text-status-win" : "text-text-muted"}`}>
                    {montantEur.toLocaleString("fr-FR")} €
                  </p>
                )}
                {montantFcfa !== null && (
                  <p className="text-text-muted text-xs">
                    {montantFcfa.toLocaleString("fr-FR")} FCFA
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="px-4 py-3 border-t border-border/30 bg-bg-elevated/30">
        <p className="text-text-muted text-xs">
          Pour tout litige ou remboursement, contactez-nous sur{" "}
          <a href="https://wa.me/+33644686720" className="text-gold-light hover:underline" target="_blank" rel="noopener noreferrer">
            WhatsApp
          </a>
        </p>
      </div>
    </div>
  );
}
