import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { sendEmailBatch } from "@/lib/email";
import { templateNouveauPronostic } from "@/lib/email/templates/nouveau-pronostic";

const CRON_SECRET = process.env.CRON_SECRET || "";

/**
 * POST /api/admin/pronostics/notifier
 * Body: { pronosticId: string }
 *
 * Envoie un email à tous les abonnés éligibles quand un pronostic est publié.
 * - GRATUIT  → tous les utilisateurs actifs
 * - PRO      → STARTER + PRO + ELITE
 * - ELITE    → ELITE uniquement
 *
 * ── Sécurité ─────────────────────────────────────────────────────────────
 * Cette route peut envoyer des milliers d'emails. 2 voies d'auth acceptées :
 *
 *   1. **Bearer CRON_SECRET** dans le header Authorization
 *      → pour les scripts automatisés (curl, jobs internes, etc.)
 *
 *   2. **Session admin Supabase** (cookie)
 *      → pour les clics depuis l'interface admin web (/admin/pronostics).
 *      L'utilisateur doit avoir `profiles.role = 'ADMIN'`.
 *
 * Si aucune des 2 voies ne valide → 401 Unauthorized.
 */
async function checkAuth(req: NextRequest): Promise<{ ok: boolean; reason?: string }> {
  // ── Voie 1 : Bearer CRON_SECRET ────────────────────────────────────
  const auth = req.headers.get("authorization") || "";
  if (CRON_SECRET && auth === `Bearer ${CRON_SECRET}`) {
    return { ok: true };
  }

  // ── Voie 2 : Session admin Supabase ────────────────────────────────
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { ok: false, reason: "non authentifié" };
    }

    const svc = createServiceClient();
    const { data: profile } = await svc
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.role === "ADMIN") {
      return { ok: true };
    }
    return { ok: false, reason: "réservé aux admins" };
  } catch {
    return { ok: false, reason: "erreur vérification session" };
  }
}

export async function POST(req: NextRequest) {
  try {
    // ── 0. Authentification obligatoire ─────────────────────────────────
    const authResult = await checkAuth(req);
    if (!authResult.ok) {
      return NextResponse.json(
        { error: "Unauthorized", reason: authResult.reason },
        { status: 401 },
      );
    }

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
    const niveauAcces = prono.niveau_acces as "GRATUIT" | "STARTER" | "PRO" | "ELITE";
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

    if (niveauAcces === "ELITE") {
      query = query.eq("statut_abonnement", "ELITE");
    } else if (niveauAcces === "PRO") {
      query = query.in("statut_abonnement", ["STARTER", "PRO", "ELITE"]);
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

    // ── 3. Envoyer les emails avec throttling unifié (sendEmailBatch) ───────
    // Avant : séquentiel + pause 200ms toutes les 10 emails = burst risk + inégal
    // Maintenant : sendEmailBatch garantit exactement 5 emails/sec (default)
    const payloads = abonnes
      .filter((a) => a.email)
      .map((a) => {
        const { subject, html } = templateNouveauPronostic({
          nomComplet:    a.nom_complet ?? a.email,
          hippodrome,
          dateString,
          typePari,
          niveauAcces,
          analysesCourte: prono.analyse_courte ?? "",
          nbPartants,
          pronosticId:   prono.id,
        });
        return { to: a.email, subject, html };
      });

    const result = await sendEmailBatch(payloads);

    return NextResponse.json({
      ok: true,
      sent:   result.sent,
      errors: result.failed,
      total:  result.total,
      duration_ms: result.duration_ms,
      niveau: niveauAcces,
    });

  } catch (err) {
    console.error("[pronostics/notifier]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
