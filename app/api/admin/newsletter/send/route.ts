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

/**
 * GET  → dry-run : liste les prospects sans envoyer
 * POST → envoi réel à tous les prospects GRATUIT
 */
export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const supabase = createServiceClient();
  const { data: prospects, error } = await supabase
    .from("profiles")
    .select("id, email, nom_complet, statut_abonnement")
    .eq("statut_abonnement", "GRATUIT")
    .eq("actif", true)
    .not("email", "is", null)
    .order("date_inscription", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    mode:   "dry-run",
    total:  prospects?.length ?? 0,
    promo:  { reduction: `${PROMO.reductionPct}%`, code: PROMO.code, expire: PROMO.dateExpiration },
    apercu: prospects?.slice(0, 5).map(p => ({ email: p.email, prenom: p.nom_complet?.split(" ")[0] || "Turfiste" })),
  });
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const numeroEdition = body?.numeroEdition ?? 1;

  const supabase = createServiceClient();
  const { data: prospects, error } = await supabase
    .from("profiles")
    .select("id, email, nom_complet, statut_abonnement")
    .eq("statut_abonnement", "GRATUIT")
    .eq("actif", true)
    .not("email", "is", null)
    .order("date_inscription", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!prospects?.length) return NextResponse.json({ message: "Aucun prospect trouvé", envoyes: 0 });

  const resultats = { envoyes: 0, echecs: 0 };

  const BATCH = 10;
  for (let i = 0; i < prospects.length; i += BATCH) {
    const batch = prospects.slice(i, i + BATCH);

    await Promise.all(
      batch.map(async (prospect) => {
        const prenom = prospect.nom_complet?.split(" ")[0] || "Turfiste";
        try {
          const { subject, html } = templateNewsletterLancement({
            prenom,
            numeroEdition,
            reductionPct:   PROMO.reductionPct,
            dateExpiration: PROMO.dateExpiration,
            codePromo:      PROMO.code,
          });
          const ok = await sendEmail({ to: prospect.email, subject, html });
          if (ok) resultats.envoyes++; else resultats.echecs++;
        } catch {
          resultats.echecs++;
        }
      })
    );

    if (i + BATCH < prospects.length) await delay(1000);
  }

  return NextResponse.json({
    mode:  "envoi-reel",
    total: prospects.length,
    ...resultats,
  });
}
