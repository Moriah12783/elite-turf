import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email";
import { templateNouveauPronostic } from "@/lib/email/templates/nouveau-pronostic";

/**
 * POST /api/admin/pronostics/notifier
 * Body: { pronosticId: string }
 *
 * Envoie un email à tous les abonnés éligibles quand un pronostic est publié.
 * - GRATUIT  → tous les utilisateurs actifs
 * - PREMIUM  → PREMIUM + VIP
 * - VIP      → VIP uniquement
 */
export async function POST(req: NextRequest) {
  try {
    const { pronosticId } = await req.json();
    if (!pronosticId) {
      return NextResponse.json({ error: "pronosticId requis" }, { status: 400 });
    }

    const supabase = createServiceClient();

    // ── 1. Récupérer le pronostic + course + hippodrome ──────────────────────
    const { data: prono, error: pronoErr } = await supabase
      .from("pronostics")
      .select(`
        id, type_pari, niveau_acces, analyse_courte, selection,
        course:courses (
          date_course, nb_partants,
          hippodrome:hippodromes ( nom )
        )
      `)
      .eq("id", pronosticId)
      .single();

    if (pronoErr || !prono) {
      return NextResponse.json({ error: "Pronostic introuvable" }, { status: 404 });
    }

    const courseRaw = Array.isArray(prono.course) ? prono.course[0] : prono.course;
    const hippodromeRaw = Array.isArray(courseRaw?.hippodrome)
      ? courseRaw.hippodrome[0]
      : courseRaw?.hippodrome;

    const hippodrome  = hippodromeRaw?.nom ?? "Hippodrome";
    const dateCourse  = courseRaw?.date_course ?? new Date().toISOString().split("T")[0];
    const nbPartants  = courseRaw?.nb_partants ?? prono.selection?.length ?? 0;
    const niveauAcces = prono.niveau_acces as "GRATUIT" | "PREMIUM" | "VIP";
    const typePari    = prono.type_pari ?? "TIERCE";

    const dateString = new Date(dateCourse).toLocaleDateString("fr-FR", {
      weekday: "long", day: "numeric", month: "long",
    });

    // ── 2. Récupérer les abonnés éligibles ───────────────────────────────────
    let query = supabase
      .from("profiles")
      .select("email, nom_complet, statut_abonnement")
      .eq("actif", true)
      .not("email", "is", null);

    if (niveauAcces === "VIP") {
      query = query.eq("statut_abonnement", "VIP");
    } else if (niveauAcces === "PREMIUM") {
      query = query.in("statut_abonnement", ["PREMIUM", "VIP"]);
    }
    // GRATUIT → tous les actifs (pas de filtre supplémentaire)

    const { data: abonnes, error: abonnesErr } = await query;

    if (abonnesErr || !abonnes || abonnes.length === 0) {
      return NextResponse.json({
        ok: true,
        sent: 0,
        message: "Aucun abonné éligible trouvé",
      });
    }

    // ── 3. Envoyer les emails (par lots de 50) ───────────────────────────────
    let sent = 0;
    let errors = 0;

    for (const abonne of abonnes) {
      if (!abonne.email) continue;

      const { subject, html } = templateNouveauPronostic({
        nomComplet:    abonne.nom_complet ?? abonne.email,
        hippodrome,
        dateString,
        typePari,
        niveauAcces,
        analysesCourte: prono.analyse_courte ?? "",
        nbPartants,
        pronosticId:   prono.id,
      });

      const ok = await sendEmail({ to: abonne.email, subject, html });
      if (ok) sent++; else errors++;

      // Petite pause pour ne pas saturer Resend sur de gros volumes
      if (sent % 10 === 0) await new Promise(r => setTimeout(r, 200));
    }

    return NextResponse.json({
      ok: true,
      sent,
      errors,
      total: abonnes.length,
      niveau: niveauAcces,
    });

  } catch (err) {
    console.error("[pronostics/notifier]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
