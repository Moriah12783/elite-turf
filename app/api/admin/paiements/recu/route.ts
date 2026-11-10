import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { construireRecu, MESSAGES_REFUS } from "@/lib/paiement/recu-mobile-money";

export const dynamic = "force-dynamic";

const PAS_DE_CACHE = { "Cache-Control": "no-store" };

/**
 * GET /api/admin/paiements/recu?reference=ET-MM-…
 *
 * Données du reçu d'un paiement Orange Money / Wave (demande de Steph du
 * 10/11/2026), lues en base : le navigateur de l'admin dessine le JPG
 * (components/admin/recu/) et l'admin l'envoie lui-même sur WhatsApp. Ne
 * modifie rien, n'envoie rien. Règles : lib/paiement/recu-mobile-money.ts.
 *
 * Session admin seule (pas de CRON_SECRET) : la réponse contient le nom et le
 * téléphone de l'abonné.
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401, headers: PAS_DE_CACHE });

  const admin = createServiceClient();
  const { data: adminProfile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (!adminProfile || adminProfile.role !== "ADMIN") {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403, headers: PAS_DE_CACHE });
  }

  const reference = (req.nextUrl.searchParams.get("reference") ?? "").trim();
  if (!reference) {
    return NextResponse.json({ error: "Référence du paiement manquante." }, { status: 400, headers: PAS_DE_CACHE });
  }

  const { data: tx, error: errTx } = await admin
    .from("transactions")
    .select(
      "reference_operateur, statut, methode, montant_fcfa, date_transaction, metadata, abonnement_id, user:user_id(nom_complet, phone, email)",
    )
    .eq("reference_operateur", reference)
    .maybeSingle();
  if (errTx) {
    return NextResponse.json({ error: `Lecture du paiement impossible : ${errTx.message}` }, { status: 500, headers: PAS_DE_CACHE });
  }
  if (!tx) {
    return NextResponse.json({ error: `Aucun paiement avec la référence ${reference}.` }, { status: 404, headers: PAS_DE_CACHE });
  }

  // Ligne `abonnements` lue à part : transactions et abonnements se référencent
  // dans les deux sens (abonnement_id / transaction_id), l'embarquement serait ambigu.
  let abonnement: { dateDebut: string; dateFin: string } | null = null;
  if (tx.abonnement_id) {
    const { data: abo, error: errAbo } = await admin
      .from("abonnements")
      .select("date_debut, date_fin")
      .eq("id", tx.abonnement_id)
      .maybeSingle();
    if (errAbo) {
      return NextResponse.json(
        { error: `Lecture de l'abonnement impossible : ${errAbo.message}` },
        { status: 500, headers: PAS_DE_CACHE },
      );
    }
    if (abo?.date_debut && abo?.date_fin) abonnement = { dateDebut: abo.date_debut, dateFin: abo.date_fin };
  }

  const abonne = (tx.user ?? {}) as { nom_complet?: string | null; phone?: string | null; email?: string | null };
  const recu = construireRecu({
    reference: tx.reference_operateur,
    statut: tx.statut,
    methode: tx.methode,
    montantFcfa: tx.montant_fcfa,
    dateTransaction: tx.date_transaction,
    metadata: (tx.metadata ?? null) as Record<string, unknown> | null,
    abonnement,
    abonne: { nom: abonne.nom_complet ?? null, telephone: abonne.phone ?? null, email: abonne.email ?? null },
  });
  if ("erreur" in recu) {
    return NextResponse.json({ error: MESSAGES_REFUS[recu.erreur] }, { status: 422, headers: PAS_DE_CACHE });
  }
  return NextResponse.json({ recu }, { headers: PAS_DE_CACHE });
}
