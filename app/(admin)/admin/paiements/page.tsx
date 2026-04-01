import { Metadata } from "next";
import { createServiceClient } from "@/lib/supabase/server";
import {
  CreditCard, CheckCircle2, XCircle, Clock3,
  TrendingUp, Download, AlertCircle,
} from "lucide-react";

export const metadata: Metadata = { title: "Paiements — Admin Elite Turf" };
export const dynamic = "force-dynamic";

const STATUT_CONFIG = {
  SUCCES:     { label: "Validé",     classes: "text-status-win bg-status-win/10 border-status-win/20",             icon: CheckCircle2 },
  EN_ATTENTE: { label: "En attente", classes: "text-status-partial bg-status-partial/10 border-status-partial/20", icon: Clock3 },
  ECHEC:      { label: "Échoué",     classes: "text-status-loss bg-status-loss/10 border-status-loss/20",          icon: XCircle },
  REMBOURSE:  { label: "Remboursé",  classes: "text-blue-400 bg-blue-400/10 border-blue-400/20",                   icon: CreditCard },
};

const METHODE_LABELS: Record<string, string> = {
  ORANGE_MONEY: "Orange Money",
  MTN_MOMO:     "MTN MoMo",
  WAVE:         "Wave",
  STRIPE:       "Carte bancaire",
  PAYPAL:       "PayPal",
};

interface Props {
  searchParams: { success?: string; error?: string; expire?: string };
}

export default async function PaiementsPage({ searchParams }: Props) {
  const supabase = createServiceClient();
  const now      = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [{ data: transactions }, { data: monthTx }] = await Promise.all([
    supabase
      .from("transactions")
      .select(`
        id, montant_fcfa, devise, methode, statut, date_transaction, reference_operateur,
        user:user_id(email, nom_complet)
      `)
      .order("date_transaction", { ascending: false })
      .limit(100),

    supabase
      .from("transactions")
      .select("montant_fcfa, statut")
      .gte("date_transaction", firstOfMonth),
  ]);

  const txList   = transactions || [];
  const monthList = monthTx || [];

  // KPIs
  const revenusMois  = monthList.filter((t: any) => t.statut === "SUCCES").reduce((s: number, t: any) => s + (t.montant_fcfa || 0), 0);
  const enAttente    = txList.filter((t: any) => t.statut === "EN_ATTENTE").length;
  const txSucces     = txList.filter((t: any) => t.statut === "SUCCES").length;
  const revenusTotal = txList.filter((t: any) => t.statut === "SUCCES").reduce((s: number, t: any) => s + (t.montant_fcfa || 0), 0);

  const kpis = [
    { label: "Revenus ce mois",     value: `${(revenusMois  / 655.957).toFixed(0)} €`, sub: `${revenusMois.toLocaleString("fr-CI")} FCFA`,  color: "text-status-win",     border: "border-status-win/20" },
    { label: "Transactions totales",value: txList.length.toString(),                    sub: `${txSucces} validées`,                          color: "text-gold-primary",   border: "border-gold-primary/20" },
    { label: "En attente",          value: enAttente.toString(),                        sub: "à valider manuellement",                        color: "text-status-partial", border: "border-status-partial/20" },
    { label: "Revenus cumulés",     value: `${(revenusTotal / 655.957).toFixed(0)} €`, sub: "toutes périodes confondues",                    color: "text-blue-400",       border: "border-blue-400/20" },
  ];

  // Feedback URL params
  const successStatut = searchParams.success; // "VIP" | "PREMIUM"
  const errorCode     = searchParams.error;
  const expireDate    = searchParams.expire;

  const errorMessages: Record<string, string> = {
    id_manquant:           "Identifiant de transaction manquant.",
    transaction_introuvable: "Transaction introuvable en base de données.",
    deja_valide:           "Cette transaction est déjà validée.",
    erreur_transaction:    "Erreur lors de la mise à jour de la transaction.",
  };

  return (
    <div className="space-y-8">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold text-text-primary">Paiements</h1>
          <p className="text-text-secondary text-sm mt-1">Historique des transactions et revenus</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-bg-elevated border border-border text-text-secondary text-sm rounded-xl hover:border-gold-primary/40 transition-colors">
          <Download className="w-4 h-4" />
          Exporter CSV
        </button>
      </div>

      {/* ── Feedback succès ────────────────────────────────────────────────── */}
      {successStatut && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-status-win/10 border border-status-win/30">
          <CheckCircle2 className="w-5 h-5 text-status-win flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-status-win font-semibold text-sm">
              Paiement validé — Abonnement {successStatut} activé avec succès
            </p>
            {expireDate && (
              <p className="text-text-secondary text-xs mt-0.5">
                Accès jusqu'au {new Date(expireDate).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Feedback erreur ─────────────────────────────────────────────────── */}
      {errorCode && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-status-loss/10 border border-status-loss/30">
          <AlertCircle className="w-5 h-5 text-status-loss flex-shrink-0 mt-0.5" />
          <p className="text-status-loss font-semibold text-sm">
            {errorMessages[errorCode] || `Erreur : ${errorCode}`}
          </p>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k, i) => (
          <div key={i} className={`card-base p-5 border ${k.border}`}>
            <div className={`text-2xl font-bold font-serif ${k.color}`}>{k.value}</div>
            <div className="text-text-primary text-sm font-medium mt-1">{k.label}</div>
            <div className="text-text-muted text-xs mt-0.5">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="card-base overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold text-text-primary text-sm flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-gold-primary" />
            Toutes les transactions
          </h2>
          <span className="text-text-muted text-xs">{txList.length} entrées</span>
        </div>

        {txList.length === 0 ? (
          <div className="py-16 text-center">
            <CreditCard className="w-10 h-10 text-text-muted mx-auto mb-3" />
            <p className="text-text-secondary text-sm">Aucune transaction enregistrée.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-bg-elevated">
                  {["Date", "Membre", "Méthode", "Montant", "Statut", "Référence", "Action"].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 text-text-muted text-xs font-semibold uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {txList.map((tx: any) => {
                  const cfg  = STATUT_CONFIG[tx.statut as keyof typeof STATUT_CONFIG] || STATUT_CONFIG.EN_ATTENTE;
                  const Icon = cfg.icon;
                  return (
                    <tr key={tx.id} className="hover:bg-bg-hover transition-colors">
                      <td className="px-4 py-3 text-text-muted text-xs whitespace-nowrap">
                        {new Date(tx.date_transaction).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "2-digit" })}
                      </td>
                      <td className="px-4 py-3 min-w-[160px]">
                        <p className="text-text-primary text-sm font-medium truncate max-w-[180px]">
                          {(tx.user as any)?.nom_complet || "—"}
                        </p>
                        <p className="text-text-muted text-xs truncate max-w-[180px]">{(tx.user as any)?.email || ""}</p>
                      </td>
                      <td className="px-4 py-3 text-text-secondary text-sm whitespace-nowrap">
                        {METHODE_LABELS[tx.methode] || tx.methode}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-text-primary font-bold text-sm">
                          {(tx.montant_fcfa / 655.957).toFixed(2)} €
                        </span>
                        <span className="text-text-muted text-xs ml-1">
                          ({(tx.montant_fcfa || 0).toLocaleString("fr-CI")} F)
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border font-semibold ${cfg.classes}`}>
                          <Icon className="w-3 h-3" />
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-text-muted text-xs font-mono">
                        {tx.reference_operateur || "—"}
                      </td>
                      <td className="px-4 py-3">
                        {tx.statut === "EN_ATTENTE" && (
                          <form action="/api/admin/paiements/valider" method="POST">
                            <input type="hidden" name="id" value={tx.id} />
                            <button
                              type="submit"
                              className="px-3 py-1.5 bg-status-win/10 hover:bg-status-win/20 border border-status-win/30 text-status-win text-xs font-semibold rounded-lg transition-colors"
                            >
                              ✓ Valider
                            </button>
                          </form>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Info technique ───────────────────────────────────────────────────── */}
      <div className="p-4 rounded-xl bg-bg-elevated border border-border">
        <p className="text-text-muted text-xs leading-relaxed flex items-start gap-2">
          <TrendingUp className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-gold-primary" />
          Cliquer sur <strong className="text-text-secondary">✓ Valider</strong> met à jour automatiquement :
          la transaction (→ Validé), l&apos;abonnement (→ Actif) et le profil de l&apos;abonné (→ PREMIUM ou VIP)
          selon le plan souscrit.
        </p>
      </div>

    </div>
  );
}
