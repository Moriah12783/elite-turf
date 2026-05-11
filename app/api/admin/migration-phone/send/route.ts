/**
 * POST /api/admin/migration-phone/send
 *
 * Envoie un email de rappel aux utilisateurs qui n'ont pas complété leur
 * téléphone (inscrits avant la V2 du flow inscription du 10 mai 2026).
 *
 * Auth : Authorization: Bearer ${CRON_SECRET} OU session admin (cookie).
 *
 * Body (tous optionnels) :
 *   {
 *     "dryRun":      true,             // ne PAS envoyer, juste retourner la liste cible
 *     "onlyUserIds": ["uuid", ...],    // limiter à certains users (debug)
 *     "skipSentLog": false             // ignorer l'idempotence email_sent_log (force re-send)
 *   }
 *
 * Idempotence : log dans email_sent_log avec type = 'MIGRATION_PHONE'.
 * Une fois envoyé à un user, l'endpoint le skip aux runs suivants (sauf si
 * `skipSentLog: true`).
 *
 * Rate-limit : utilise sendEmailBatch (5/sec par défaut, safe pour Resend Pro).
 *
 * Use case : Stéphane relance manuellement 1× après V2 inscription pour
 * récupérer les anciens comptes bloqués au middleware /completer-profil.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendEmailBatch, type BulkEmailRequest } from "@/lib/email";
import { requireAdminAuth } from "@/lib/auth/checkAdminAuth";
import { templateRappelTelephone } from "@/lib/email/templates/rappel-telephone";

export const dynamic     = "force-dynamic";
export const maxDuration = 60;

const EMAIL_TYPE = "MIGRATION_PHONE";

interface BodyInput {
  dryRun?:      boolean;
  onlyUserIds?: string[];
  skipSentLog?: boolean;
}

interface TargetUser {
  id:                string;
  email:             string;
  nom_complet:       string | null;
  statut_abonnement: string | null;
  phone:             string | null;
}

/** Détecte un phone "valide" (au moins 8 chiffres). Aligné middleware.ts. */
function isPhoneValid(phone: string | null | undefined): boolean {
  if (!phone) return false;
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 8;
}

/** Statut abonnement normalisé pour le template (default GRATUIT). */
function normalizeStatut(s: string | null): "GRATUIT" | "STARTER" | "PRO" | "ELITE" {
  if (s === "STARTER" || s === "PRO" || s === "ELITE") return s;
  return "GRATUIT";
}

export async function POST(req: NextRequest) {
  // 🔒 Auth admin obligatoire
  const authError = await requireAdminAuth(req);
  if (authError) return authError;

  // Parse body
  let body: BodyInput = {};
  try {
    body = await req.json();
  } catch {
    // Body vide accepté : tous les defaults
  }
  const dryRun      = body.dryRun ?? false;
  const skipSentLog = body.skipSentLog ?? false;
  const onlyUserIds = Array.isArray(body.onlyUserIds) ? body.onlyUserIds : null;

  const supabase = createServiceClient();

  // 1. Récupérer tous les profiles avec leur email + phone
  let query = supabase
    .from("profiles")
    .select("id, email, nom_complet, statut_abonnement, phone");

  if (onlyUserIds && onlyUserIds.length > 0) {
    query = query.in("id", onlyUserIds);
  }

  const { data: allProfiles, error: errProfiles } = await query;
  if (errProfiles) {
    return NextResponse.json({ error: `Query profiles: ${errProfiles.message}` }, { status: 500 });
  }

  // 2. Filtrer : email valide + phone invalide
  const candidates: TargetUser[] = (allProfiles ?? [])
    .filter((p) => p.email && p.email.includes("@"))
    .filter((p) => !isPhoneValid(p.phone))
    .map((p) => ({
      id:                p.id,
      email:             p.email,
      nom_complet:       p.nom_complet,
      statut_abonnement: p.statut_abonnement,
      phone:             p.phone,
    }));

  // 3. Idempotence : exclure ceux qui ont déjà reçu l'email (sauf skipSentLog)
  let alreadySent = new Set<string>();
  if (!skipSentLog && candidates.length > 0) {
    const { data: existing } = await supabase
      .from("email_sent_log")
      .select("user_id")
      .eq("type", EMAIL_TYPE)
      .eq("status", "SENT")
      .in("user_id", candidates.map((c) => c.id));
    alreadySent = new Set((existing ?? []).map((e) => e.user_id));
  }

  const toSend = candidates.filter((c) => !alreadySent.has(c.id));

  // 4. Dry-run : juste retourner ce qui SERAIT envoyé
  if (dryRun) {
    return NextResponse.json({
      dryRun:           true,
      total_candidates: candidates.length,
      already_sent:     alreadySent.size,
      to_send:          toSend.length,
      preview: toSend.slice(0, 10).map((u) => ({
        email:             u.email,
        nom_complet:       u.nom_complet,
        statut_abonnement: u.statut_abonnement,
      })),
    });
  }

  if (toSend.length === 0) {
    return NextResponse.json({
      ok:               true,
      total_candidates: candidates.length,
      already_sent:     alreadySent.size,
      sent:             0,
      message:          "Aucun email à envoyer (tous déjà notifiés ou aucun candidat).",
    });
  }

  // 5. Préparer payloads + send batch
  const payloads: BulkEmailRequest[] = toSend.map((u) => {
    const { subject, html } = templateRappelTelephone({
      nomComplet:       u.nom_complet ?? "Champion",
      email:            u.email,
      statutAbonnement: normalizeStatut(u.statut_abonnement),
    });
    return {
      to:      u.email,
      subject,
      html,
      meta:    { user_id: u.id, statut: u.statut_abonnement },
    };
  });

  const result = await sendEmailBatch(payloads);

  // 6. Log dans email_sent_log pour idempotence (best-effort, non bloquant)
  if (result.sent > 0) {
    const logs = result.details
      .filter((d) => d.ok)
      .map((d) => ({
        user_id: (d.meta?.user_id as string) ?? null,
        email:   d.email,
        type:    EMAIL_TYPE,
        status:  "SENT" as const,
      }))
      .filter((l) => l.user_id !== null);

    if (logs.length > 0) {
      const { error: logErr } = await supabase.from("email_sent_log").insert(logs);
      if (logErr) {
        console.warn(`[migration-phone] email_sent_log insert failed: ${logErr.message}`);
      }
    }
  }

  return NextResponse.json({
    ok:               result.failed === 0,
    total_candidates: candidates.length,
    already_sent:     alreadySent.size,
    sent:             result.sent,
    failed:           result.failed,
    duration_ms:      result.duration_ms,
    failures: result.details
      .filter((d) => !d.ok)
      .map((d) => ({ email: d.email, error: d.error })),
  });
}
