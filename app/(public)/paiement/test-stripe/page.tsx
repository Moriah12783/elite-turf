/**
 * /paiement/test-stripe
 *
 * Page de test Stripe à 1 € — usage interne uniquement.
 * Accessible uniquement aux utilisateurs connectés.
 * À supprimer (ou désactiver) après validation du tunnel de paiement live.
 */

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PLAN_CONFIG } from "@/types";
import PaiementButton from "@/components/abonnements/PaiementButton";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Test Stripe 1 € — Elite Turf",
  robots: { index: false, follow: false },
};

export default async function TestStripePage() {
  // Doit être connecté
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/connexion?redirect=/paiement/test-stripe");

  const testPlan = PLAN_CONFIG.find((p) => p.id === "test");
  if (!testPlan) redirect("/abonnements");

  return (
    <main className="min-h-screen flex items-center justify-center bg-bg-primary px-4">
      <div className="card-base border border-yellow-500/40 max-w-md w-full p-8 text-center space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <span className="inline-block px-3 py-1 bg-yellow-500/10 text-yellow-400 text-xs font-bold rounded-full border border-yellow-500/30 uppercase tracking-wider">
            🧪 Test interne
          </span>
          <h1 className="text-2xl font-serif font-bold text-text-primary">
            Valider le tunnel Stripe
          </h1>
          <p className="text-text-muted text-sm">
            Cette page est réservée aux tests techniques.<br />
            Elle ne sera jamais visible par les abonnés.
          </p>
        </div>

        {/* Détails du plan test */}
        <div className="bg-bg-elevated border border-border rounded-xl p-5 text-left space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-text-muted">Plan</span>
            <span className="font-semibold text-text-primary">Test technique</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-text-muted">Montant</span>
            <span className="font-bold text-green-400 text-lg">1,00 €</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-text-muted">Durée</span>
            <span className="font-semibold text-text-primary">1 jour</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-text-muted">Connecté en tant que</span>
            <span className="font-semibold text-text-primary truncate max-w-[180px]">{user.email}</span>
          </div>
        </div>

        {/* Bouton Stripe */}
        <div>
          <PaiementButton
            plan={testPlan}
            userId={user.id}
            userEmail={user.email ?? ""}
            variant="primary"
          />
        </div>

        {/* Checklist */}
        <div className="text-left space-y-2 text-xs text-text-muted border-t border-border pt-4">
          <p className="font-semibold text-text-secondary">Ce test vérifie :</p>
          <ul className="space-y-1 list-none">
            {[
              "Redirection vers la page Stripe Checkout",
              "Paiement par carte en live",
              "Réception du webhook checkout.session.completed",
              "Activation de l'abonnement en base (profiles)",
              "Enregistrement de la transaction",
              "Redirection vers /paiement/succes",
            ].map((item) => (
              <li key={item} className="flex items-start gap-1.5">
                <span className="text-yellow-400 mt-0.5">→</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </main>
  );
}
