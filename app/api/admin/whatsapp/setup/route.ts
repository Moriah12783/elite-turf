/**
 * GET/POST /api/admin/whatsapp/setup
 *
 * Endpoint de diagnostic + setup pour le subscription WABA ↔ App Meta.
 *
 * 🎯 RÔLE
 *   Le webhook Meta nécessite que le WABA soit explicitement abonné à
 *   l'app via /subscribed_apps. Cette étape est censée être faite
 *   automatiquement quand on clique "Vérifier et enregistrer" dans Meta
 *   Developers, mais peut échouer silencieusement.
 *
 *   Cette route permet de :
 *     - GET : interroger les apps abonnées au WABA (diagnostic)
 *     - POST ?action=subscribe : abonner explicitement l'app au WABA
 *
 * 🔐 Auth : Bearer CRON_SECRET OU session admin
 *
 * 📦 GET response :
 *   {
 *     ok: true,
 *     waba_id: "2033258540922625",
 *     subscribed_apps: [
 *       { id: "1322...", name: "Elite Turf Production", ... }
 *     ]
 *   }
 *
 * 📦 POST ?action=subscribe :
 *   { ok: true, success: true }   ← l'app est abonnée
 *
 * 📜 Doc Meta : https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth/checkAdminAuth";

export const dynamic     = "force-dynamic";
export const maxDuration = 15;

const GRAPH_API_VERSION = "v21.0";
const GRAPH_BASE_URL    = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

function getConfig(): { token: string; wabaId: string; phoneNumberId: string } {
  const token         = process.env.WHATSAPP_ACCESS_TOKEN;
  const wabaId        = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token)         throw new Error("WHATSAPP_ACCESS_TOKEN manquant");
  if (!wabaId)        throw new Error("WHATSAPP_BUSINESS_ACCOUNT_ID manquant");
  if (!phoneNumberId) throw new Error("WHATSAPP_PHONE_NUMBER_ID manquant");
  return { token, wabaId, phoneNumberId };
}

// ─────────────────────────────────────────────────────────────────────────
// GET — Diagnostic complet
// ─────────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const authError = await requireAdminAuth(req);
  if (authError) return authError;

  let config;
  try { config = getConfig(); }
  catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
  const { token, wabaId, phoneNumberId } = config;
  const headers = { Authorization: `Bearer ${token}` };

  const result: Record<string, unknown> = {
    waba_id:         wabaId,
    phone_number_id: phoneNumberId,
  };

  // 1. Liste des apps abonnées au WABA
  try {
    const res = await fetch(`${GRAPH_BASE_URL}/${wabaId}/subscribed_apps`, { headers });
    const body = await res.json();
    result.subscribed_apps = {
      http_status: res.status,
      ...body,
    };
  } catch (err) {
    result.subscribed_apps = { error: (err as Error).message };
  }

  // 2. Info sur le phone number (vérif que le token a les bonnes perms)
  try {
    const res = await fetch(`${GRAPH_BASE_URL}/${phoneNumberId}?fields=display_phone_number,verified_name,quality_rating,status`, { headers });
    const body = await res.json();
    result.phone_number_info = {
      http_status: res.status,
      ...body,
    };
  } catch (err) {
    result.phone_number_info = { error: (err as Error).message };
  }

  // 3. Info sur le WABA lui-même
  try {
    const res = await fetch(`${GRAPH_BASE_URL}/${wabaId}?fields=name,timezone_id,message_template_namespace,business_verification_status,account_review_status`, { headers });
    const body = await res.json();
    result.waba_info = {
      http_status: res.status,
      ...body,
    };
  } catch (err) {
    result.waba_info = { error: (err as Error).message };
  }

  return NextResponse.json({ ok: true, ...result });
}

// ─────────────────────────────────────────────────────────────────────────
// POST ?action=subscribe — Abonner l'app au WABA
// ─────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const authError = await requireAdminAuth(req);
  if (authError) return authError;

  const url    = new URL(req.url);
  const action = url.searchParams.get("action");

  let config;
  try { config = getConfig(); }
  catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
  const { token, wabaId } = config;
  const headers = { Authorization: `Bearer ${token}` };

  if (action === "subscribe") {
    // POST /{waba_id}/subscribed_apps
    try {
      const res = await fetch(`${GRAPH_BASE_URL}/${wabaId}/subscribed_apps`, {
        method: "POST",
        headers,
      });
      const body = await res.json();
      return NextResponse.json({
        ok:          res.ok,
        http_status: res.status,
        ...body,
      });
    } catch (err) {
      return NextResponse.json({ error: (err as Error).message }, { status: 500 });
    }
  }

  if (action === "unsubscribe") {
    try {
      const res = await fetch(`${GRAPH_BASE_URL}/${wabaId}/subscribed_apps`, {
        method: "DELETE",
        headers,
      });
      const body = await res.json();
      return NextResponse.json({
        ok:          res.ok,
        http_status: res.status,
        ...body,
      });
    } catch (err) {
      return NextResponse.json({ error: (err as Error).message }, { status: 500 });
    }
  }

  return NextResponse.json({
    error: "action requis : ?action=subscribe ou ?action=unsubscribe",
  }, { status: 400 });
}
