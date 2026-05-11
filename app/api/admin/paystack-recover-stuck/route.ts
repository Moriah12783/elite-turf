/**
 * POST /api/admin/paystack-recover-stuck
 *
 * Endpoint admin manuel : déclenche immédiatement la récupération des
 * transactions Paystack EN_ATTENTE (ignore le cron 15 min).
 *
 * Utilité : après reconfiguration du webhook Paystack, on veut rattraper
 * tout de suite les paiements perdus sans attendre le prochain tick du cron.
 *
 * Auth : utilisateur connecté avec role=ADMIN (vérifié par middleware + ici).
 *
 * Body optionnel : { reference?: string } pour ne traiter qu'une transaction
 * précise. Sans body : traite toutes les EN_ATTENTE Paystack des 30 derniers
 * jours.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAdminAuth } from "@/lib/auth/checkAdminAuth";
import {
  fetchPaystackTransaction,
  activateSubscriptionFromPaystack,
} from "@/lib/paystack/activate";

export const dynamic    = "force-dynamic";
export const maxDuration = 60;

const MAX_AGE_DAYS = 30;

export async function POST(req: NextRequest) {
  // 🔒 Auth admin : Bearer CRON_SECRET OU session admin (cookie).
  // Migré vers helper centralisé pour cohérence (avant : 18 lignes inline).
  const authError = await requireAdminAuth(req);
  if (authError) return authError;

  const adminClient = createServiceClient();

  // ── Body : reference unique optionnelle ────────────────────────────────
  let onlyReference: string | null = null;
  try {
    const body = await req.json();
    if (typeof body?.reference === "string") onlyReference = body.reference;
  } catch {
    // Pas de body : on traite toutes les EN_ATTENTE
  }

  // ── Sélection des transactions à recover ───────────────────────────────
  const minDate = new Date(Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000).toISOString();

  let query = adminClient
    .from("transactions")
    .select("id, reference_operateur, date_transaction")
    .eq("statut", "EN_ATTENTE")
    .gte("date_transaction", minDate)
    .like("reference_operateur", "ET-PS-%")
    .limit(50);

  if (onlyReference) {
    query = query.eq("reference_operateur", onlyReference);
  }

  const { data: pending, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!pending || pending.length === 0) {
    return NextResponse.json({ ok: true, message: "Aucune transaction à recover", checked: 0 });
  }

  // ── Recovery boucle ────────────────────────────────────────────────────
  const results: Array<{
    reference: string;
    paystack_status?: string;
    action: string;
    detail?: string;
  }> = [];

  for (const tx of pending) {
    const reference = tx.reference_operateur as string;
    try {
      const payment = await fetchPaystackTransaction(reference);
      if (!payment) {
        results.push({ reference, action: "fetch_failed" });
        continue;
      }

      if (payment.status === "success") {
        const outcome = await activateSubscriptionFromPaystack(payment);
        results.push({
          reference,
          paystack_status: payment.status,
          action: outcome.ok ? (outcome.alreadyActivated ? "already_activated" : "activated") : "activation_error",
          detail: outcome.ok ? undefined : outcome.reason,
        });
      } else if (payment.status === "failed" || payment.status === "abandoned") {
        await adminClient
          .from("transactions")
          .update({ statut: "ECHEC" })
          .eq("reference_operateur", reference);
        results.push({ reference, paystack_status: payment.status, action: "marked_failed" });
      } else {
        results.push({ reference, paystack_status: payment.status, action: "still_pending" });
      }
    } catch (err) {
      results.push({ reference, action: "error", detail: err instanceof Error ? err.message : String(err) });
    }

    await new Promise((r) => setTimeout(r, 200));
  }

  return NextResponse.json({
    ok: true,
    checked: pending.length,
    activated:         results.filter(r => r.action === "activated").length,
    already_activated: results.filter(r => r.action === "already_activated").length,
    marked_failed:     results.filter(r => r.action === "marked_failed").length,
    still_pending:     results.filter(r => r.action === "still_pending").length,
    errors:            results.filter(r => r.action.includes("error") || r.action.includes("fail")).length,
    details: results,
  });
}
