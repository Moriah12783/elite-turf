/**
 * /admin/test-paiement — page INTERNE (admin only, gating via app/(admin)/admin/layout.tsx).
 *
 * Objectif : lancer un VRAI paiement de test à petit montant (Stripe 1 € / Paystack
 * 1 XOF) pour prouver la chaîne succès → abonnement (table `abonnements` jamais
 * écrite à ce jour). Les boutons appellent directement les endpoints de checkout
 * avec les plans `test` / `test-paystack` — donc indépendants du flag
 * PAYSTACK_AVAILABLE (qui affiche le Mobile Money en « bientôt » côté public).
 *
 * ⚠️ Page temporaire : à SUPPRIMER après validation du test.
 */

import { createClient } from "@/lib/supabase/server";
import TestPaiementClient from "./TestPaiementClient";

export const dynamic = "force-dynamic";

export default async function AdminTestPaiementPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  // Le layout admin a déjà vérifié l'auth + le rôle ADMIN ; user est présent ici.
  return (
    <TestPaiementClient
      userId={user?.id ?? ""}
      userEmail={user?.email ?? ""}
    />
  );
}
