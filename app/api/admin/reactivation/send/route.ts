import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { sendEmailBatch } from "@/lib/email";
import { templateReactivation } from "@/lib/email/templates/reactivation";

export const dynamic = "force-dynamic";

/**
 * Réactivation des inscrits jamais confirmés (défaut de délivrabilité corrigé
 * le 2026-07-17). Sur POST : confirme leur e-mail côté admin PUIS leur envoie
 * un e-mail FR « compte activé » via Resend.
 *
 * Sécurité : réservé ADMIN. GET = dry-run (liste, aucune écriture, aucun envoi).
 * POST body { onlyEmail?: string } → limite à UNE adresse (test) avant le lot.
 * POST body { confirmer?: false } → n'active pas (envoi seul).
 */
async function isAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const adminClient = createServiceClient();
  const { data: profile } = await adminClient
    .from("profiles").select("role").eq("id", user.id).single();
  return profile?.role === "ADMIN";
}

interface Cible { id: string; email: string; prenom: string }

/** Tous les utilisateurs dont l'e-mail n'est PAS confirmé (pagination admin). */
async function collectUnconfirmed(): Promise<Cible[]> {
  const admin = createServiceClient();
  const out: Cible[] = [];
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    const users = data?.users ?? [];
    if (error || users.length === 0) break;
    for (const u of users) {
      if (!u.email_confirmed_at && u.email) {
        const nom = (u.user_metadata?.nom_complet as string | undefined) || "";
        out.push({ id: u.id, email: u.email, prenom: nom.split(" ")[0] || "Turfiste" });
      }
    }
    if (users.length < 200) break;
  }
  return out;
}

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  const cibles = await collectUnconfirmed();
  return NextResponse.json({
    mode:   "dry-run",
    total:  cibles.length,
    apercu: cibles.slice(0, 10).map((c) => ({ email: c.email, prenom: c.prenom })),
  });
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const onlyEmail = typeof body?.onlyEmail === "string" ? body.onlyEmail.toLowerCase() : null;
  const confirmer = body?.confirmer !== false; // confirme par défaut

  const admin = createServiceClient();
  let cibles = await collectUnconfirmed();
  if (onlyEmail) cibles = cibles.filter((c) => c.email.toLowerCase() === onlyEmail);
  if (cibles.length === 0) return NextResponse.json({ message: "Aucune cible", envoyes: 0 });

  // 1. Confirmer les e-mails (active les comptes).
  let confirmes = 0;
  if (confirmer) {
    for (const c of cibles) {
      const { error } = await admin.auth.admin.updateUserById(c.id, { email_confirm: true });
      if (!error) confirmes++;
    }
  }

  // 2. Envoyer l'e-mail FR de réactivation (throttlé via sendEmailBatch).
  const payloads = cibles.map((c) => {
    const { subject, html } = templateReactivation({ prenom: c.prenom });
    return { to: c.email, subject, html, meta: { prenom: c.prenom } };
  });
  const result = await sendEmailBatch(payloads);
  const echecs = result.details.filter((d) => !d.ok).map((d) => ({ email: d.email, raison: d.error || "Refusé par Resend" }));

  return NextResponse.json({
    mode:           onlyEmail ? "test-1" : "envoi-reel",
    cibles:         cibles.length,
    confirmes,
    envoyes:        result.sent,
    echecs:         result.failed,
    duration_ms:    result.duration_ms,
    details_echecs: echecs,
  });
}
