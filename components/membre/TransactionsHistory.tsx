/**
 * Historique des paiements — espace membre.
 *
 * Données chargées CÔTÉ SERVEUR par la page (lib/membre/historique-paiements.ts)
 * et passées en prop : plus de fetch client, plus d'attente ni de message
 * d'erreur SQL brut (l'ancienne route lisait des colonnes inexistantes).
 * Seuls les paiements passés et les remboursements sont listés.
 */
import { CreditCard, CheckCircle2, RotateCcw, Receipt, AlertTriangle } from "lucide-react";
import { whatsappUrl } from "@/lib/constants/whatsapp";
import type { LignePaiement } from "@/lib/membre/historique-paiements";

const STATUT_CONFIG: Record<LignePaiement["statut"], { icon: typeof CheckCircle2; classes: string }> = {
  "Payé":      { icon: CheckCircle2, classes: "text-status-win bg-status-win/10 border-status-win/20" },
  "Remboursé": { icon: RotateCcw,    classes: "text-text-muted bg-bg-elevated border-border" },
};

function dateLongue(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

export default function TransactionsHistory({ lignes }: { lignes: LignePaiement[] | null }) {
  if (lignes === null) {
    return (
      <div className="card-base p-6 text-center">
        <AlertTriangle className="w-6 h-6 text-status-partial mx-auto mb-2" aria-hidden="true" />
        <p className="text-text-secondary text-sm">L&apos;historique de vos paiements est momentanément indisponible.</p>
        <p className="text-text-muted text-xs mt-1">
          Pour toute question sur un paiement, écrivez-nous sur{" "}
          <a href={whatsappUrl()} className="text-gold-light hover:underline" target="_blank" rel="noopener noreferrer">
            WhatsApp
          </a>
          .
        </p>
      </div>
    );
  }

  if (lignes.length === 0) {
    return (
      <div className="card-base p-8 text-center">
        <Receipt className="w-10 h-10 text-text-muted mx-auto mb-3" aria-hidden="true" />
        <p className="text-text-secondary text-sm font-medium mb-1">Aucun paiement</p>
        <p className="text-text-muted text-xs">Vos paiements apparaîtront ici après votre premier abonnement.</p>
      </div>
    );
  }

  return (
    <div className="card-base overflow-hidden">
      <div className="p-4 border-b border-border flex items-center gap-2">
        <CreditCard className="w-4 h-4 text-gold-primary" aria-hidden="true" />
        <h3 className="font-serif font-semibold text-text-primary text-sm">Historique des paiements</h3>
        <span className="ml-auto text-text-muted text-xs">
          {lignes.length} paiement{lignes.length > 1 ? "s" : ""}
        </span>
      </div>

      <div className="divide-y divide-border/30">
        {lignes.map((l) => {
          const cfg = STATUT_CONFIG[l.statut];
          const Icone = cfg.icon;
          return (
            <div key={l.id} className="flex items-center gap-4 px-4 py-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 border ${cfg.classes}`}>
                <Icone className="w-4 h-4" aria-hidden="true" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-text-primary font-semibold text-sm">{l.formule ?? "Abonnement"}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${cfg.classes}`}>{l.statut}</span>
                </div>
                <p className="text-text-muted text-xs mt-0.5">
                  {dateLongue(l.date)} · {l.moyen}
                  {l.reference && <span className="ml-2 font-mono text-[10px]">#{l.reference}</span>}
                </p>
              </div>

              <p className={`flex-shrink-0 font-bold text-sm ${l.statut === "Payé" ? "text-status-win" : "text-text-muted"}`}>
                {l.montant}
              </p>
            </div>
          );
        })}
      </div>

      <div className="px-4 py-3 border-t border-border/30 bg-bg-elevated/30">
        <p className="text-text-muted text-xs">
          Pour tout litige ou remboursement, contactez-nous sur{" "}
          <a href={whatsappUrl()} className="text-gold-light hover:underline" target="_blank" rel="noopener noreferrer">
            WhatsApp
          </a>
        </p>
      </div>
    </div>
  );
}
