import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email";
import { templateNewsletterLancement } from "@/lib/email/templates/newsletter-lancement";
import { PROMO } from "@/lib/promo";

// Sécurité : clé secrète obligatoire dans le header
function isAuthorized(req: NextRequest): boolean {
  const key = req.headers.get("x-admin-key");
  return key === process.env.CRON_SECRET;
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * GET  → dry-run : liste les prospects sans envoyer
 * POST → envoi réel à tous les prospects GRATUIT
 */
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

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
    mode:       "dry-run",
    total:      prospects?.length ?? 0,
    promo:      { reduction: `${PROMO.reductionPct}%`, code: PROMO.code, expire: PROMO.dateExpiration },
    apercu:     prospects?.slice(0, 5).map(p => ({ email: p.email, prenom: p.nom_complet?.split(" ")[0] || "Turfiste" })),
  });
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const supabase = createServiceClient();

  // Lecture des prospects (abonnement GRATUIT = non encore payants)
  const { data: prospects, error } = await supabase
    .from("profiles")
    .select("id, email, nom_complet, statut_abonnement")
    .eq("statut_abonnement", "GRATUIT")
    .eq("actif", true)
    .not("email", "is", null)
    .order("date_inscription", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!prospects?.length) return NextResponse.json({ message: "Aucun prospect trouvé", envoyes: 0 });

  const resultats = { envoyes: 0, echecs: 0, details: [] as string[] };

  // Envoi par batch de 10 avec pause de 1s entre chaque batch (respect rate limit Resend)
  const BATCH = 10;
  for (let i = 0; i < prospects.length; i += BATCH) {
    const batch = prospects.slice(i, i + BATCH);

    await Promise.all(
      batch.map(async (prospect) => {
        const prenom = prospect.nom_complet?.split(" ")[0] || "Turfiste";
        try {
          const { subject, html } = templateNewsletterLancement({
            prenom,
            numeroEdition:  1,
            reductionPct:   PROMO.reductionPct,
            dateExpiration: PROMO.dateExpiration,
            codePromo:      PROMO.code,
          });

          const ok = await sendEmail({ to: prospect.email, subject, html });
          if (ok) {
            resultats.envoyes++;
            resultats.details.push(`✓ ${prospect.email}`);
          } else {
            resultats.echecs++;
            resultats.details.push(`✗ ${prospect.email} (echec Resend)`);
          }
        } catch (err: any) {
          resultats.echecs++;
          resultats.details.push(`✗ ${prospect.email} — ${err.message}`);
        }
      })
    );

    // Pause entre les batches pour respecter les limites de Resend
    if (i + BATCH < prospects.length) await delay(1000);
  }

  return NextResponse.json({
    mode:    "envoi-reel",
    total:   prospects.length,
    ...resultats,
  });
}
