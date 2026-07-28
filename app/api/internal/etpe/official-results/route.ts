import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { createServiceClient } from "@/lib/supabase/server";
import { resoudreCourseUnique } from "@/lib/courses/resolve-course";

export const dynamic = "force-dynamic";

function authorized(request: NextRequest): boolean {
  const expected = process.env.ETPE_RESULTS_BRIDGE_SECRET?.trim();
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!expected || !supplied) return false;

  const expectedHash = createHash("sha256").update(expected).digest();
  const suppliedHash = createHash("sha256").update(supplied).digest();
  return timingSafeEqual(expectedHash, suppliedHash);
}

function positiveInteger(value: string | null): number | null {
  if (!value || !/^\d+$/.test(value)) return null;
  const parsed = Number.parseInt(value, 10);
  return parsed > 0 ? parsed : null;
}

function validFinishOrder(value: unknown): value is number[] {
  return (
    Array.isArray(value)
    && value.length >= 5
    && value.length <= 20
    && value.every((runner) => Number.isInteger(runner) && runner >= 1 && runner <= 99)
    && new Set(value).size === value.length
  );
}

/**
 * GET /api/internal/etpe/official-results?date=YYYY-MM-DD&meeting=1&race=8
 *
 * Pont signé, en lecture seule, entre Elite Turf et le Predictive Engine.
 * Il n'expose une arrivée que lorsqu'elle a été validée dans l'admin Elite Turf
 * et que la course est marquée TERMINE.
 */
export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ status: "UNAUTHORIZED" }, { status: 401 });
  }

  const date = request.nextUrl.searchParams.get("date");
  const meeting = positiveInteger(request.nextUrl.searchParams.get("meeting"));
  const race = positiveInteger(request.nextUrl.searchParams.get("race"));

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !meeting || !race) {
    return NextResponse.json(
      { status: "INVALID_REQUEST", error: "date, meeting et race sont requis" },
      { status: 400 },
    );
  }

  const supabase = createServiceClient();

  // ⚠️ (date, R, C) N'IDENTIFIE PAS une course : 429 clés ambiguës en base au
  // 28/07/2026 (deux réunions de province distinctes peuvent porter le même
  // numéro le même jour). `.maybeSingle()` levait alors une erreur remontée en
  // 502 « UPSTREAM_ERROR » — diagnostic trompeur, la base allait très bien.
  // Le paramètre facultatif `hippodrome` permet de départager ; à défaut on
  // répond AMBIGUOUS avec les candidates, jamais une course au hasard.
  const hippodrome = request.nextUrl.searchParams.get("hippodrome");

  const courseQuery = await supabase
    .from("courses")
    .select("id,date_course,numero_reunion,numero_course,arrivee_officielle,statut,hippodrome:hippodromes(nom)")
    .eq("date_course", date)
    .eq("numero_reunion", meeting)
    .eq("numero_course", race);

  if (courseQuery.error) {
    console.error("[ETPE results bridge] course lookup:", courseQuery.error);
    return NextResponse.json(
      { status: "UPSTREAM_ERROR", error: courseQuery.error.message },
      { status: 502 },
    );
  }

  const lignes = (courseQuery.data ?? []) as any[];
  const resolution = resoudreCourseUnique(
    lignes.map((c) => ({ id: c.id, hippodrome_nom: c.hippodrome?.nom ?? null })),
    hippodrome,
  );

  if (resolution.statut === "ABSENTE") {
    return NextResponse.json({ status: "NOT_FOUND" }, { status: 404 });
  }

  if (resolution.statut === "AMBIGUE") {
    console.warn(
      `[ETPE results bridge] ${date} R${meeting}C${race} : ${resolution.candidats.length} courses candidates`,
    );
    return NextResponse.json(
      {
        status: "AMBIGUOUS",
        error: "Plusieurs courses partagent cette clé — préciser ?hippodrome=",
        candidats: resolution.candidats.map((c) => c.hippodrome_nom),
      },
      { status: 409 },
    );
  }

  const courseRetenue = lignes.find((c) => c.id === resolution.course.id)!;

  const arrivalQuery = await supabase
    .from("arrivees")
    .select("ordre_arrivee,horodatage")
    .eq("course_id", courseRetenue.id)
    .maybeSingle();

  if (arrivalQuery.error) {
    console.error("[ETPE results bridge] arrival lookup:", arrivalQuery.error);
    return NextResponse.json(
      { status: "UPSTREAM_ERROR", error: arrivalQuery.error.message },
      { status: 502 },
    );
  }

  const finishOrder =
    arrivalQuery.data?.ordre_arrivee ?? courseRetenue.arrivee_officielle;
  const final =
    courseRetenue.statut === "TERMINE"
    && validFinishOrder(finishOrder);

  if (!final) {
    return NextResponse.json({
      status: "PENDING",
      race: {
        eliteCourseId: courseRetenue.id,
        date,
        meeting,
        race,
      },
    });
  }

  const verifiedAt = arrivalQuery.data?.horodatage ?? new Date().toISOString();
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "")
    ?? "https://elite-turf.fr";

  return NextResponse.json(
    {
      status: "FINAL",
      source: "ELITE_TURF_ADMIN_VERIFIED",
      race: {
        eliteCourseId: courseRetenue.id,
        date,
        meeting,
        race,
      },
      result: {
        finishOrder,
        verifiedAt,
      },
      evidence: {
        url: `${baseUrl}/arrivees/${date}`,
      },
    },
    {
      headers: {
        "cache-control": "private, no-store, max-age=0",
      },
    },
  );
}
