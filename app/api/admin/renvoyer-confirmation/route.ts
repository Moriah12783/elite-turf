import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email";
import { templateConfirmationPack } from "@/lib/email/templates/confirmation-pack";

/**
 * POST /api/admin/renvoyer-confirmation   { "email": "client@exemple.com" }
 *
 * Envoie (ou renvoie) l'e-mail de confirmation d'abonnement à un membre, à
 * partir de l'état RÉEL de son profil.
 *
 * POURQUOI CETTE ROUTE EXISTE
 * Les activations Mobile Money se font à la main en base : aucun webhook ne
 * passe, donc l'e-mail de confirmation ne part jamais tout seul. Jusqu'ici il
 * n'existait aucun moyen propre de l'envoyer — la seule route disponible,
 * `/api/admin/email-test`, préfixe son sujet de « [TEST] », inenvoyable à un
 * vrai client. Constaté le 25/08/2026 en activant un abonné malien.
 *
 * Utilise le VRAI template : l'abonné reçoit exactement le même e-mail qu'un
 * paiement automatique, encadré « mode d'emploi » compris.
 *
 * 🔴 NE DEVINE RIEN. Le palier, la date d'expiration et le prénom sont LUS en
 * base. Si le profil n'est pas activé (statut GRATUIT/EXPIRE) la route REFUSE :
 * envoyer une confirmation à quelqu'un qui n'a pas d'accès serait pire que de
 * ne rien envoyer.
 */
export async function POST(req: NextRequest) {
  // ── Auth admin (même schéma que les autres routes admin) ─────────────────
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const admin = createServiceClient();
  const { data: adminProfile } = await admin
    .from("profiles").select("role").eq("id", user.id).single();
  if (!adminProfile || adminProfile.role !== "ADMIN") {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  // ── Destinataire ─────────────────────────────────────────────────────────
  const body = await req.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (!email) return NextResponse.json({ error: "Champ `email` manquant" }, { status: 400 });

  const { data: profil, error } = await admin
    .from("profiles")
    .select("nom_complet, email, statut_abonnement, date_expiration_abonnement")
    .eq("email", email)
    .single();
  if (error || !profil) {
    return NextResponse.json({ error: `Aucun profil pour ${email}` }, { status: 404 });
  }

  // Refus explicite plutôt qu'un e-mail mensonger.
  const statut = profil.statut_abonnement;
  if (statut !== "STARTER" && statut !== "PRO" && statut !== "ELITE") {
    return NextResponse.json(
      { error: `Profil non activé (statut ${statut}) — activer avant d'envoyer la confirmation.` },
      { status: 409 },
    );
  }
  if (!profil.date_expiration_abonnement) {
    return NextResponse.json(
      { error: "Profil sans date d'expiration — corriger avant d'envoyer." },
      { status: 409 },
    );
  }

  const planNom: "Starter" | "Pro" | "Elite" =
    statut === "ELITE" ? "Elite" : statut === "PRO" ? "Pro" : "Starter";
  const nbAlertes = statut === "ELITE" ? -1 : statut === "PRO" ? 20 : 5;

  const { subject, html } = templateConfirmationPack({
    nomComplet:     profil.nom_complet || "Champion",
    email:          profil.email,
    planNom,
    dateExpiration: String(profil.date_expiration_abonnement).slice(0, 10),
    nbAlertes,
  });

  const envoye = await sendEmail({ to: profil.email, subject, html });
  if (!envoye) {
    return NextResponse.json({ error: "Envoi refusé par le fournisseur d'e-mail" }, { status: 502 });
  }

  return NextResponse.json({
    success: true,
    destinataire: profil.email,
    palier: planNom,
    expire_le: String(profil.date_expiration_abonnement).slice(0, 10),
    subject,
  });
}
