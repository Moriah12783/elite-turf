import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { checkCinetPayTransaction } from "@/lib/cinetpay/client";
import {
  activateSubscriptionFromCinetPay,
  markCinetPayTransactionFailed,
} from "@/lib/cinetpay/activate";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ status: "ok", service: "elite-turf-cinetpay-webhook" });
}

/**
 * Notify CinetPay. CinetPay POSTe (x-www-form-urlencoded) `cpm_trans_id`.
 * SÉCURITÉ CinetPay = on ne fait JAMAIS confiance au payload : on RE-VÉRIFIE
 * systématiquement l'état réel via /v2/payment/check avant d'activer.
 * Idempotent via webhook_events (provider, event_id).
 */
export async function POST(req: NextRequest) {
  // ── 1) Récupérer le transaction_id quel que soit le content-type ──────────
  let transactionId = "";
  try {
    const ct = req.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      const j = await req.json();
      transactionId = String(j?.cpm_trans_id || j?.transaction_id || "");
    } else {
      const form = await req.formData();
      transactionId = String(form.get("cpm_trans_id") || form.get("transaction_id") || "");
    }
  } catch {
    // body illisible — on ignore proprement
  }

  if (!transactionId) {
    return NextResponse.json({ received: true, ignored: "no transaction_id" });
  }

  const supabase = createServiceClient();
  const eventId = `cinetpay-${transactionId}`;

  // ── 2) Idempotence (provider, event_id) ───────────────────────────────────
  const { error: insErr } = await supabase.from("webhook_events").insert({
    provider: "cinetpay",
    event_id: eventId,
    event_type: "notify",
    raw_body: { transactionId },
    signature_ok: true, // pas de signature CinetPay : la vérité = le /check ci-dessous
  });
  if (insErr && insErr.code === "23505") {
    return NextResponse.json({ received: true, idempotent: true });
  }

  // ── 3) RE-VÉRIFICATION via /check (source de vérité) ──────────────────────
  const check = await checkCinetPayTransaction(transactionId);
  if (!check) {
    await supabase
      .from("webhook_events")
      .update({ processed_at: new Date().toISOString(), error: "check CinetPay échoué" })
      .eq("provider", "cinetpay")
      .eq("event_id", eventId);
    return NextResponse.json({ received: true });
  }

  // ── 4) Activation / échec selon le statut réel ────────────────────────────
  try {
    let resultError: string | null = null;

    if (check.status === "ACCEPTED") {
      const result = await activateSubscriptionFromCinetPay(transactionId, check);
      resultError = result.ok ? null : result.reason;
    } else if (check.status === "REFUSED") {
      await markCinetPayTransactionFailed(transactionId, check);
    }
    // PENDING / WAITING_FOR_CUSTOMER → on laisse EN_ATTENTE ; le cron recovery re-checkera.

    await supabase
      .from("webhook_events")
      .update({ processed_at: new Date().toISOString(), error: resultError })
      .eq("provider", "cinetpay")
      .eq("event_id", eventId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[cinetpay webhook] Activation exception:", msg);
    await supabase
      .from("webhook_events")
      .update({ processed_at: new Date().toISOString(), error: msg })
      .eq("provider", "cinetpay")
      .eq("event_id", eventId);
  }

  return NextResponse.json({ received: true });
}
