/**
 * GET /api/cron/paystack-recovery
 *
 * Cron de défense en profondeur : récupère les transactions Paystack
 * EN_ATTENTE depuis plus de 10 minutes, en interrogeant directement l'API
 * Paystack `/transaction/verify/:reference`. Si le statut Paystack est
 * `success` → on active l'abonnement comme l'aurait fait le webhook.
 *
 * Utilité : si le webhook Paystack n'a jamais été reçu (URL mal configurée,
 * panne réseau, retries Paystack épuisés), on rattrape ici. Cap à 1 SUCCES =
 * ~1 user qui ne perd pas son abonnement après avoir payé.
 *
 * Schedule : toutes les 15 minutes.
 *
 * Sécurité : token Bearer CRON_SECRET (idem autres crons Vercel).
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import {
  fetchPaystackTransaction,
  activateSubscriptionFromPaystack,
} from "@/lib/paystack/activate";

export const dynamic    = "force-dynamic";
export const maxDuration = 60;

const CRON_SECRET = process.env.CRON_SECRET || "";

// On scan les transactions EN_ATTENTE entre 10 min et 7 jours d'ancienneté.
// Au-delà : abandon (peu probable que Paystack reset un statut après 7j).
const MIN_AGE_MIN = 10;
const MAX_AGE_DAYS = 7;

export async function GET(req: NextRequest) {
  // Auth cron
  const auth = req.headers.get("authorization") || "";
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const now = new Date();
  const minAgeIso = new Date(now.getTime() - MIN_AGE_MIN * 60 * 1000).toISOString();
  const maxAgeIso = new Date(now.getTime() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000).toISOString();

  // Récupérer les transactions Paystack EN_ATTENTE dans la fenêtre [10min, 7j]
  const { data: pending, error } = await supabase
    .from("transactions")
    .select("id, reference_operateur, date_transaction, metadata")
    .eq("statut", "EN_ATTENTE")
    .lte("date_transaction", minAgeIso)
    .gte("date_transaction", maxAgeIso)
    .like("reference_operateur", "ET-PS-%") // convention initiation Paystack
    .limit(50);

  if (error) {
    console.error("[paystack-recovery] Query error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!pending || pending.length === 0) {
    return NextResponse.json({ ok: true, message: "Aucune transaction à récupérer", checked: 0 });
  }

  const results: Array<{
    reference: string;
    paystack_status?: string;
    action: "activated" | "already_activated" | "marked_failed" | "still_pending" | "error";
    detail?: string;
  }> = [];

  for (const tx of pending) {
    const reference = tx.reference_operateur as string;

    try {
      const payment = await fetchPaystackTransaction(reference);

      if (!payment) {
        results.push({ reference, action: "error", detail: "fetch failed" });
        continue;
      }

      if (payment.status === "success") {
        const outcome = await activateSubscriptionFromPaystack(payment);
        if (outcome.ok && outcome.alreadyActivated) {
          results.push({ reference, paystack_status: payment.status, action: "already_activated" });
        } else if (outcome.ok) {
          results.push({ reference, paystack_status: payment.status, action: "activated" });
        } else {
          results.push({ reference, paystack_status: payment.status, action: "error", detail: outcome.reason });
        }
      } else if (payment.status === "failed" || payment.status === "abandoned") {
        // Marquer la transaction comme échouée pour ne plus la re-poller
        await supabase
          .from("transactions")
          .update({ statut: "ECHEC" })
          .eq("reference_operateur", reference);
        results.push({ reference, paystack_status: payment.status, action: "marked_failed" });
      } else {
        // pending, ongoing, queued, etc. — on retentera au prochain cron
        results.push({ reference, paystack_status: payment.status, action: "still_pending" });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({ reference, action: "error", detail: msg });
    }

    // Pause courte pour ne pas saturer l'API Paystack
    await new Promise((r) => setTimeout(r, 200));
  }

  const counts = {
    activated:          results.filter(r => r.action === "activated").length,
    already_activated:  results.filter(r => r.action === "already_activated").length,
    marked_failed:      results.filter(r => r.action === "marked_failed").length,
    still_pending:      results.filter(r => r.action === "still_pending").length,
    error:              results.filter(r => r.action === "error").length,
  };

  console.log(
    `[paystack-recovery] checked=${pending.length} activated=${counts.activated} ` +
    `already=${counts.already_activated} failed=${counts.marked_failed} ` +
    `pending=${counts.still_pending} error=${counts.error}`,
  );

  return NextResponse.json({
    ok: true,
    checked: pending.length,
    counts,
    details: results,
  });
}

export async function POST(req: NextRequest) {
  return GET(req);
}
