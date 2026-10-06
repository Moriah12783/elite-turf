/**
 * Historique des paiements de l'espace membre (+ formule affichée dans la
 * carte « Votre plan »).
 *
 * Réparé le 06/10/2026 : l'ancienne route /api/membre/transactions lisait des
 * colonnes qui n'existent pas (methode_paiement, reference, plan_id) → erreur
 * 500 pour TOUS les membres, message SQL brut affiché dans la page. L'historique
 * est désormais chargé côté serveur (CLAUDE.md, règle 3 : jamais de fetch
 * client pour l'affichage).
 *
 * Colonnes réelles de `transactions` (base de production, vérifiées le
 * 06/10/2026) : methode, reference_operateur, montant_fcfa, montant_devise,
 * devise, statut, metadata, date_transaction.
 *
 * Seuls les paiements PASSÉS (SUCCES) et les remboursements sont montrés : une
 * tentative abandonnée ou refusée (EN_ATTENTE, ECHEC) n'est pas un paiement et
 * inquiéterait l'abonné. L'admin les voit dans Admin → Paiements.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { PLAN_CONFIG } from "@/types";
import { FX_RATES } from "@/lib/geo/countries";

export const STATUTS_AFFICHES = ["SUCCES", "REMBOURSE"];

export interface TransactionBrute {
  id: string;
  montant_fcfa: number | null;
  montant_devise: number | string | null;
  devise: string | null;
  methode: string | null;
  statut: string;
  reference_operateur: string | null;
  metadata: Record<string, unknown> | null;
  date_transaction: string;
}

export interface LignePaiement {
  id: string;
  date: string;
  formule: string | null;
  moyen: string;
  montant: string;
  statut: "Payé" | "Remboursé";
  reference: string | null;
}

/** Libellés des valeurs admises par transactions.methode. */
const MOYENS: Record<string, string> = {
  STRIPE: "Carte bancaire",
  ORANGE_MONEY: "Orange Money",
  WAVE: "Wave",
  MTN_MOMO: "MTN Mobile Money",
  WESTERN_UNION: "Western Union",
  PAYPAL: "PayPal",
};

/** Formule payée : `metadata.plan_id` (carte, Paystack) ou `metadata.formule` (activation admin). */
function formuleDe(metadata: Record<string, unknown> | null): string | null {
  const brut = metadata?.plan_id ?? metadata?.formule;
  const plan = typeof brut === "string" ? PLAN_CONFIG.find((p) => p.id === brut) : undefined;
  return plan ? `Pack ${plan.nom}` : null;
}

/** Euros pour un paiement en euros (montant en devise s'il est enregistré), sinon francs CFA. */
function montantDe(t: TransactionBrute): string {
  if (t.devise === "EUR") {
    const eur =
      t.montant_devise != null
        ? Number(t.montant_devise)
        : t.montant_fcfa != null
          ? Math.round((t.montant_fcfa / FX_RATES.XOF) * 100) / 100
          : null;
    return eur != null && !isNaN(eur) ? `${eur.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} €` : "—";
  }
  return t.montant_fcfa != null ? `${t.montant_fcfa.toLocaleString("fr-FR")} FCFA` : "—";
}

export function lignesHistorique(transactions: TransactionBrute[]): LignePaiement[] {
  return transactions.map((t) => ({
    id: t.id,
    date: t.date_transaction,
    formule: formuleDe(t.metadata),
    moyen: t.methode ? MOYENS[t.methode] ?? t.methode : "—",
    montant: montantDe(t),
    statut: t.statut === "REMBOURSE" ? "Remboursé" : "Payé",
    reference: t.reference_operateur ? t.reference_operateur.slice(-8).toUpperCase() : null,
  }));
}

/** null = lecture impossible (la page affiche un message neutre, jamais l'erreur brute). */
export async function chargerHistoriquePaiements(
  client: SupabaseClient,
  userId: string,
): Promise<LignePaiement[] | null> {
  const { data, error } = await client
    .from("transactions")
    .select("id, montant_fcfa, montant_devise, devise, methode, statut, reference_operateur, metadata, date_transaction")
    .eq("user_id", userId)
    .in("statut", STATUTS_AFFICHES)
    .order("date_transaction", { ascending: false })
    .limit(20);
  if (error) {
    console.error("[espace-membre] historique des paiements illisible :", error.message);
    return null;
  }
  return lignesHistorique((data ?? []) as TransactionBrute[]);
}

/**
 * Formule de la carte « Votre plan ». La table `plans` nomme les formules
 * Découverte / Performance / Elite (cf. lib/plans/resolve.ts), PLAN_CONFIG
 * Starter / Pro / Elite : la comparaison directe des noms ne trouvait jamais
 * Starter ni Pro (prix et alertes vides). À défaut de ligne d'abonnement, le
 * statut du profil.
 */
const ID_PAR_NOM_PLANS: Record<string, string> = { "Découverte": "starter", Performance: "pro", Elite: "elite" };
const ID_PAR_STATUT: Record<string, string> = { STARTER: "starter", PRO: "pro", ELITE: "elite" };

export function idFormuleAbonne(nomPlanTable: string | null | undefined, statut: string | null | undefined): string | null {
  return (nomPlanTable ? ID_PAR_NOM_PLANS[nomPlanTable] : undefined) ?? (statut ? ID_PAR_STATUT[statut] : undefined) ?? null;
}
