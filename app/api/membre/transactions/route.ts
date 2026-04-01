/**
 * GET /api/membre/transactions
 * Retourne l'historique des transactions de l'utilisateur connecté.
 */

import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const serviceClient = createServiceClient();
  const { data: transactions, error } = await serviceClient
    .from("transactions")
    .select("id, montant_fcfa, montant_eur, statut, date_transaction, methode_paiement, reference, plan_id")
    .eq("user_id", user.id)
    .order("date_transaction", { ascending: false })
    .limit(20);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ transactions: transactions ?? [] });
}
