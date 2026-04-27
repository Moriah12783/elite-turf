import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email";
import { templateNewsletterLancement } from "@/lib/email/templates/newsletter-lancement";
import { PROMO } from "@/lib/promo";

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function isAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const adminClient = createServiceClient();
  const { data: profile } = await adminClient
    .from("profiles").select("role").eq("id", user.id).single();
  return profile?.role === "ADMIN";
}

type Destinataire = { email: string; prenom: string };

async function collectDestinataires(): Promise<Destinataire[]> {
  const supabase = createServiceClient();
  const map = new Map<string, Destinataire>();

  const { data: leads } = await supabase
    .from("leads").select("email, prenom");
  for (const l of leads ?? []) {
    if (l.email) map.set(l.email.toLowerCase(), { email: l.email, prenom: l.prenom || "Turfiste" });
  }

  const { data: actifs } = await supabase
    .from("profiles").select("email, nom_complet")
    .in("statut_abonnement", ["STARTER", "PRO"]);
  for (const a of actifs ?? []) {
    if (a.email && !map.has(a.email.toLowerCase()))
      map.set(a.email.toLowerCase(), { email: a.email, prenom: a.nom_complet?.split(" ")[0] || "Membre" });
  }

  const { data: elites } = await supabase
    .from("profiles").select("email, nom_complet")
    .eq("statut_abonnement", "ELITE");
  for (const e of elites ?? []) {
    if (e.email && !map.has(e.email.toLowerCase()))
      map.set(e.email.toLowerCase(), { email: e.email, prenom: e.nom_complet?.split(" ")[0] || "Membre Élite" });
  }

  return Array.from(map.values());
}

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const destinataires = await collectDestinataires();
  return NextResponse.json({
    mode:   "dry-run",
    total:  destinataires.length,
    promo:  { reduction: `${PROMO.reductionPct}%`, code: PROMO.code, expire: PROMO.dateExpiration },
    apercu: destinataires.slice(0, 5).map(d => ({ email: d.email, prenom: d.prenom })),
  });
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const numeroEdition = body?.numeroEdition ?? 1;

  const destinataires = await collectDestinataires();
  if (!destinataires.length) return NextResponse.json({ message: "Aucun destinataire trouvé", envoyes: 0 });

  const envoyes: string[] = [];
  const echecs: { email: string; raison: string }[] = [];

  const BATCH = 10;
  for (let i = 0; i < destinataires.length; i += BATCH) {
    const batch = destinataires.slice(i, i + BATCH);

    await Promise.all(
      batch.map(async (dest) => {
        try {
          const { subject, html } = templateNewsletterLancement({
            prenom:         dest.prenom,
            numeroEdition,
            reductionPct:   PROMO.reductionPct,
            dateExpiration: PROMO.dateExpiration,
            codePromo:      PROMO.code,
          });
          const ok = await sendEmail({ to: dest.email, subject, html });
          if (ok) {
            envoyes.push(dest.email);
          } else {
            echecs.push({ email: dest.email, raison: "Refusé par Resend (voir logs serveur)" });
          }
        } catch (err: any) {
          echecs.push({ email: dest.email, raison: err?.message || "Erreur inconnue" });
        }
      })
    );

    if (i + BATCH < destinataires.length) await delay(1000);
  }

  console.log(`[Newsletter Lancement] Envoyés: ${envoyes.length}, Échecs: ${echecs.length}`);
  if (echecs.length) console.error("[Newsletter Lancement] Échecs:", echecs);

  return NextResponse.json({
    mode:    "envoi-reel",
    total:   destinataires.length,
    envoyes: envoyes.length,
    echecs:  echecs.length,
    details_echecs: echecs,
  });
}
