import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { buildGenyUrlFromStored } from "@/lib/geny";
import {
  parseRapportsPMU,
  parseCommentaire,
  type RapportsPMU,
} from "@/lib/sync/geny-rapports-parser";
import { parseArrivee } from "@/lib/sync/geny-arrivees";

/**
 * POST /api/admin/arrivees/prefill-from-geny
 *
 * Récupère via Geny.com l'arrivée + les rapports PMU + le commentaire d'une
 * course donnée, et retourne ces données SANS LES SAUVEGARDER. C'est à l'admin
 * de valider/corriger via la UI puis de POST-er sur /api/admin/arrivees pour
 * persister.
 *
 * Workflow :
 *  1. Admin clique "Pré-remplir depuis Geny" sur une course
 *  2. Cet endpoint fetch la page Geny et parse les data
 *  3. Le formulaire admin se pré-remplit avec les valeurs extraites
 *  4. Admin valide (ou corrige les erreurs de parsing) et clique "Enregistrer"
 *  5. POST /api/admin/arrivees → persistance finale
 *
 * Rationale : on dissocie le "prefetch" du "save" pour permettre la review
 * humaine. Geny rate parfois des rapports (template variant) et l'admin a
 * besoin de pouvoir corriger avant insertion en DB.
 */

const FETCH_TIMEOUT_MS = 8000;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36";

interface PostBody {
  course_id: string;
}

interface PrefillResponse {
  ok:          true;
  source_url:  string;
  arrivee:     number[] | null;
  rapports:    RapportsPMU | null;
  commentaire: string | null;
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    const body = (await req.json()) as PostBody;

    if (!body.course_id) {
      return NextResponse.json(
        { error: "course_id manquant" },
        { status: 400 },
      );
    }

    // ── Récupérer geny_url + numéros des partants (filtre validation) ────
    // Les numéros des partants sont passés au parser pour rejeter tous les
    // numéros HTML qui ne sont PAS des partants (sidebars, rapports €, IDs).
    // Garantit zéro faux positif dans l'extraction de l'arrivée.
    const { data: course, error: courseErr } = await supabase
      .from("courses")
      .select("id, geny_url, partants(numero)")
      .eq("id", body.course_id)
      .single();

    if (courseErr || !course) {
      return NextResponse.json(
        { error: "Course introuvable" },
        { status: 404 },
      );
    }

    if (!course.geny_url) {
      return NextResponse.json(
        {
          error:
            "Course sans geny_url (ex: course LONACI Côte d'Ivoire). Saisie manuelle requise.",
        },
        { status: 422 },
      );
    }

    // Liste des numéros de partants pour validation par le parser
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const validNumbers: number[] = Array.isArray((course as any).partants)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? (course as any).partants
          .map((p: { numero: number }) => p.numero)
          .filter((n: number) => Number.isInteger(n))
      : [];

    // ── Fetch Geny avec timeout ─────────────────────────────────────────
    const url = buildGenyUrlFromStored(course.geny_url, "resultats");
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);

    let html = "";
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent":      USER_AGENT,
          Accept:            "text/html,application/xhtml+xml",
          "Accept-Language": "fr-FR,fr;q=0.9",
          Referer:           "https://www.geny.com/",
        },
        cache:  "no-store",
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (!res.ok) {
        return NextResponse.json(
          { error: `Geny HTTP ${res.status}` },
          { status: 502 },
        );
      }
      html = await res.text();
    } catch (err) {
      clearTimeout(timer);
      const msg = err instanceof Error ? err.message : "fetch error";
      return NextResponse.json(
        { error: `Geny fetch failed : ${msg}` },
        { status: 502 },
      );
    }

    // ── Parse arrivée + rapports + commentaire (best-effort) ────────────
    // On passe validNumbers (numéros des partants) au parser pour qu'il
    // filtre TOUT numéro qui n'est pas un partant valide → élimine
    // sidebars, rapports €, IDs et autres faux positifs.
    let arrivee: number[] | null = null;
    try {
      arrivee = parseArrivee(html, validNumbers.length > 0 ? validNumbers : undefined);
    } catch (err) {
      console.warn("[prefill-from-geny] parseArrivee failed:", err);
    }

    let rapports: RapportsPMU | null = null;
    try {
      const r = parseRapportsPMU(html);
      if (r && Object.keys(r).length > 0) rapports = r;
    } catch (err) {
      console.warn("[prefill-from-geny] parseRapportsPMU failed:", err);
    }

    let commentaire: string | null = null;
    try {
      commentaire = parseCommentaire(html);
    } catch (err) {
      console.warn("[prefill-from-geny] parseCommentaire failed:", err);
    }

    const payload: PrefillResponse = {
      ok:          true,
      source_url:  url,
      arrivee,
      rapports,
      commentaire,
    };
    return NextResponse.json(payload);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    console.error("[POST prefill-from-geny] exception:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
