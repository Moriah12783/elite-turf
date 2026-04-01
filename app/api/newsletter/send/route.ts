import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email";
import { templateNewsletter } from "@/lib/email/templates/newsletter";

/**
 * POST /api/newsletter/send
 * Envoie la newsletter "L'Œil de l'Élite" au(x) segment(s) choisi(s).
 * Body JSON : {
 *   segment: "prospects" | "actifs" | "elite" | "tous",
 *   editoTexte, secretTitre, secretTexte, bilanTexte, numeroEdition?
 * }
 */
export async function POST(req: NextRequest) {
  // Auth admin
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const adminClient = createServiceClient();
  const { data: profile } = await adminClient
    .from("profiles").select("role").eq("id", user.id).single();
  if (!profile || profile.role !== "ADMIN") {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const body = await req.json();
  const { segment, editoTexte, secretTitre, secretTexte, bilanTexte, numeroEdition } = body;

  if (!editoTexte?.trim() || !secretTitre?.trim() || !secretTexte?.trim() || !bilanTexte?.trim()) {
    return NextResponse.json({ error: "Tous les champs de contenu sont requis" }, { status: 400 });
  }

  // Récupère les destinataires selon le segment
  type Destinataire = { email: string; prenom: string; seg: "prospects" | "actifs" | "elite" };
  const destinataires: Destinataire[] = [];

  if (segment === "prospects" || segment === "tous") {
    const { data: leads } = await adminClient
      .from("leads").select("email, prenom");
    if (leads) {
      // Déduplique par email
      const emails = new Set<string>();
      for (const l of leads) {
        if (!emails.has(l.email)) {
          emails.add(l.email);
          destinataires.push({ email: l.email, prenom: l.prenom || "Turfiste", seg: "prospects" });
        }
      }
    }
  }

  if (segment === "actifs" || segment === "tous") {
    const { data: actifs } = await adminClient
      .from("profiles").select("email, nom_complet")
      .eq("statut_abonnement", "PREMIUM");
    if (actifs) {
      for (const a of actifs) {
        if (a.email) {
          const prenom = a.nom_complet?.split(" ")[0] || "Membre";
          destinataires.push({ email: a.email, prenom, seg: "actifs" });
        }
      }
    }
  }

  if (segment === "elite" || segment === "tous") {
    const { data: elites } = await adminClient
      .from("profiles").select("email, nom_complet")
      .eq("statut_abonnement", "VIP");
    if (elites) {
      for (const e of elites) {
        if (e.email) {
          const prenom = e.nom_complet?.split(" ")[0] || "Membre Elite";
          destinataires.push({ email: e.email, prenom, seg: "elite" });
        }
      }
    }
  }

  if (destinataires.length === 0) {
    return NextResponse.json({ envoyes: 0, echecs: 0, message: "Aucun destinataire trouvé" });
  }

  // Envoi séquentiel avec délai anti-spam (200ms entre chaque)
  let envoyes = 0;
  let echecs  = 0;

  for (const dest of destinataires) {
    const { subject, html } = templateNewsletter({
      prenom: dest.prenom,
      segment: dest.seg,
      editoTexte,
      secretTitre,
      secretTexte,
      bilanTexte,
      numeroEdition,
    });

    const ok = await sendEmail({ to: dest.email, subject, html });
    if (ok) envoyes++; else echecs++;

    // Pause anti-spam entre les envois
    await new Promise(r => setTimeout(r, 200));
  }

  console.log(`[Newsletter] Segment: ${segment} — Envoyés: ${envoyes}, Échecs: ${echecs}`);

  return NextResponse.json({
    envoyes,
    echecs,
    total: destinataires.length,
  });
}
