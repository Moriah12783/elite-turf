import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { fetchGenyPartants, type GenyParticipant } from "@/lib/geny";

/**
 * POST /api/admin/partants/[courseId]/prefill-from-geny
 *
 * Récupère via Geny.com la liste complète des partants d'une course (numéro,
 * nom du cheval, jockey/driver, cote probable, musique, poids, âge/sexe, NP)
 * et retourne ces données SANS LES SAUVEGARDER. C'est à l'admin de valider/
 * corriger via la UI puis de PUT-er sur /api/admin/partants/[courseId] pour
 * persister.
 *
 * Workflow (mirror du flux /admin/arrivees) :
 *  1. Admin clique "Pré-remplir Geny" sur la page partants d'une course
 *  2. Cet endpoint fetch Geny + parse les data
 *  3. Le client se pré-remplit avec les valeurs extraites
 *  4. Admin valide (ou corrige les erreurs de parsing) et clique "Enregistrer"
 *  5. PUT /api/admin/partants/[courseId] → persistance finale
 *
 * Rationale : on dissocie le "prefetch" du "save" pour permettre la review
 * humaine. Geny rate parfois des champs (musique, poids selon disciplines)
 * et l'admin a besoin de pouvoir corriger avant insertion en DB.
 */

interface PartantPayload {
  numero:        number;
  nom_cheval:    string;
  jockey:        string | null;
  entraineur:    string | null;
  cote:          number | null;
  musique:       string | null;
  poids_kg:      number | null;
  age:           number | null;
  sexe:          string | null;
  place_corde:   number | null;
  non_partant:   boolean;
}

interface PrefillResponse {
  ok:         true;
  source_url: string;
  partants:   PartantPayload[];
  warnings?:  string[];
}

/**
 * Mappe un GenyParticipant vers le format attendu par PartantsClient (et
 * la table `partants` Supabase).
 */
function mapGenyParticipant(p: GenyParticipant): PartantPayload {
  return {
    numero:      p.numPmu,
    nom_cheval:  (p.nom || "").trim().toUpperCase(),
    jockey:      p.jockey?.nom?.trim() || null,
    entraineur:  p.entraineur?.nom?.trim() || null,
    cote:        typeof p.coteProbable === "number" && Number.isFinite(p.coteProbable)
                   ? p.coteProbable
                   : null,
    musique:     p.musique?.trim() || null,
    poids_kg:    typeof p.poids === "number" && Number.isFinite(p.poids) ? p.poids : null,
    age:         typeof p.age === "number" && Number.isFinite(p.age) ? p.age : null,
    sexe:        p.sexe?.trim() || null,
    place_corde: typeof p.placeCorde === "number" && Number.isFinite(p.placeCorde)
                   ? p.placeCorde
                   : null,
    non_partant: !!p.nonPartant,
  };
}

export async function POST(
  _req: NextRequest,
  { params }: { params: { courseId: string } },
) {
  try {
    const supabase = createServiceClient();

    // ── Récupérer la course (date, R, C, geny_url) ──────────────────────
    const { data: course, error: courseErr } = await supabase
      .from("courses")
      .select("id, date_course, numero_reunion, numero_course, geny_url")
      .eq("id", params.courseId)
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
            "Course sans geny_url (ex: course LONACI Côte d'Ivoire). " +
            "Saisie manuelle requise des partants.",
        },
        { status: 422 },
      );
    }

    // ── Fetch + parse Geny via la fonction existante ────────────────────
    // fetchGenyPartants gère timeout, headers, fallback sur date/R/C.
    const genyParticipants = await fetchGenyPartants(
      course.date_course,
      course.numero_reunion,
      course.numero_course,
      8000,           // timeout 8s
      course.geny_url,
    );

    if (genyParticipants.length === 0) {
      return NextResponse.json(
        {
          error:
            "Geny n'a retourné aucun partant. La page peut être vide " +
            "(course pas encore publiée) ou le parsing a échoué.",
        },
        { status: 502 },
      );
    }

    // ── Mappage + warnings ─────────────────────────────────────────────
    const partants = genyParticipants.map(mapGenyParticipant);
    const warnings: string[] = [];

    // Détection de cas suspects pour informer l'admin
    const sansCote = partants.filter((p) => p.cote == null).length;
    if (sansCote > 0) {
      warnings.push(
        `${sansCote} partant(s) sans cote probable (Geny n'affiche pas toujours les cotes ` +
        `avant la fermeture des paris).`,
      );
    }

    const sansMusique = partants.filter((p) => !p.musique).length;
    if (sansMusique === partants.length) {
      warnings.push(
        "Aucun partant n'a de musique extraite. Le format Geny varie selon la " +
        "discipline (galop/trot/obstacle) — corrige manuellement si besoin.",
      );
    }

    const nonPartants = partants.filter((p) => p.non_partant).length;
    if (nonPartants > 0) {
      warnings.push(`${nonPartants} non-partant(s) détecté(s) — vérifie avant d'enregistrer.`);
    }

    // Source URL pour permettre à l'admin d'aller vérifier sur Geny si besoin
    const sourceUrl = course.geny_url.startsWith("http")
      ? course.geny_url
      : `https://www.geny.com${course.geny_url.startsWith("/") ? course.geny_url : "/" + course.geny_url}`;

    const payload: PrefillResponse = {
      ok:         true,
      source_url: sourceUrl,
      partants,
      warnings:   warnings.length > 0 ? warnings : undefined,
    };

    return NextResponse.json(payload);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    console.error("[POST prefill-from-geny partants] exception:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
