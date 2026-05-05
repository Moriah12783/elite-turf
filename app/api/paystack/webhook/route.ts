import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createServiceClient } from "@/lib/supabase/server";
import {
  activateSubscriptionFromPaystack,
  type PaystackPayment,
} from "@/lib/paystack/activate";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ status: "ok", service: "elite-turf-paystack-webhook" });
}

export async function POST(req: NextRequest) {
  const body = await req.text();

  // ── 1) Vérification signature HMAC SHA-512 ──────────────────────────────
  const secret = process.env.PAYSTACK_SECRET_KEY;
  const signature = req.headers.get("x-paystack-signature") ?? "";

  let signatureOk = false;
  if (secret) {
    const expected = crypto
      .createHmac("sha512", secret)
      .update(body)
      .digest("hex");
    // Constant-time comparison — protège contre timing attacks
    try {
      signatureOk =
        signature.length === expected.length &&
        crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    } catch {
      signatureOk = false;
    }
  }

  // ── 2) Parser JSON (toujours, même si signature KO, pour pouvoir auditer) ──
  let event: { event?: string; data?: PaystackPayment } = {};
  try {
    event = JSON.parse(body);
  } catch {
    // body non-JSON : on log un event_id générique
  }

  const eventType = event?.event ?? "unknown";
  const data = event?.data ?? null;
  // event_id : on utilise la reference Paystack (unique par transaction)
  // Fallback timestamp+random si pas de reference (ex : signature KO)
  const eventId = data?.reference ?? `unknown-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const supabase = createServiceClient();

  // ── 3) Audit + idempotence DB-level via webhook_events ───────────────────
  // INSERT first ; si UNIQUE conflict (provider, event_id) → on l'a déjà reçu
  const { error: insertErr } = await supabase
    .from("webhook_events")
    .insert({
      provider:     "paystack",
      event_id:     eventId,
      event_type:   eventType,
      raw_body:     event,
      signature_ok: signatureOk,
    });

  // Conflict = déjà reçu → on retourne 200 sans rien faire (idempotent)
  if (insertErr && insertErr.code === "23505") {
    return NextResponse.json({ received: true, idempotent: true });
  }
  if (insertErr) {
    console.error("[Paystack webhook] Insert webhook_events échoué:", insertErr.message);
    // On continue quand même — ne pas perdre un paiement à cause d'un log
  }

  // ── 4) Refus si signature invalide ───────────────────────────────────────
  if (!signatureOk) {
    console.warn("[Paystack webhook] Signature invalide");
    await supabase
      .from("webhook_events")
      .update({ processed_at: new Date().toISOString(), error: "Invalid signature" })
      .eq("provider", "paystack")
      .eq("event_id", eventId);
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // ── 5) Seul charge.success déclenche l'activation ────────────────────────
  if (eventType !== "charge.success" || !data) {
    await supabase
      .from("webhook_events")
      .update({ processed_at: new Date().toISOString() })
      .eq("provider", "paystack")
      .eq("event_id", eventId);
    return NextResponse.json({ received: true });
  }

  // ── 6) Activation via le helper partagé ──────────────────────────────────
  try {
    const result = await activateSubscriptionFromPaystack(data);
    await supabase
      .from("webhook_events")
      .update({
        processed_at: new Date().toISOString(),
        error: result.ok ? null : result.reason,
      })
      .eq("provider", "paystack")
      .eq("event_id", eventId);

    if (!result.ok) {
      console.warn("[Paystack webhook] Activation refusée:", result.reason);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Paystack webhook] Activation exception:", msg);
    await supabase
      .from("webhook_events")
      .update({ processed_at: new Date().toISOString(), error: msg })
      .eq("provider", "paystack")
      .eq("event_id", eventId);
    // 200 quand même pour que Paystack n'enqueue pas l'event
  }

  return NextResponse.json({ received: true });
}
