import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { createServiceClient } from "@/lib/supabase/server";

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
  const courseQuery = await supabase
    .from("courses")
    .select("id,date_course,numero_reunion,numero_course,arrivee_officielle,statut")
    .eq("date_course", date)
    .eq("numero_reunion", meeting)
    .eq("numero_course", race)
    .maybeSingle();

  if (courseQuery.error) {
    console.error("[ETPE results bridge] course lookup:", courseQuery.error);
    return NextResponse.json(
      { status: "UPSTREAM_ERROR", error: courseQuery.error.message },
      { status: 502 },
    );
  }

  if (!courseQuery.data) {
    return NextResponse.json({ status: "NOT_FOUND" }, { status: 404 });
  }

  const arrivalQuery = await supabase
    .from("arrivees")
    .select("ordre_arrivee,horodatage")
    .eq("course_id", courseQuery.data.id)
    .maybeSingle();

  if (arrivalQuery.error) {
    console.error("[ETPE results bridge] arrival lookup:", arrivalQuery.error);
    return NextResponse.json(
      { status: "UPSTREAM_ERROR", error: arrivalQuery.error.message },
      { status: 502 },
    );
  }

  const finishOrder =
    arrivalQuery.data?.ordre_arrivee ?? courseQuery.data.arrivee_officielle;
  const final =
    courseQuery.data.statut === "TERMINE"
    && validFinishOrder(finishOrder);

  if (!final) {
    return NextResponse.json({
      status: "PENDING",
      race: {
        eliteCourseId: courseQuery.data.id,
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
        eliteCourseId: courseQuery.data.id,
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
