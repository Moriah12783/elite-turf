/**
 * POST /api/admin/replays  (form-encoded, depuis /admin/replays)
 *
 * Curation des replays officiels. `_action` = "add" | "delete".
 * Protégé par requireAdminAuth (session ADMIN ou Bearer CRON_SECRET).
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth/checkAdminAuth";
import { createServiceClient } from "@/lib/supabase/server";
import { extractYouTubeId } from "@/lib/live/youtube";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const authError = await requireAdminAuth(req);
  if (authError) return authError;

  const form = await req.formData();
  const action = String(form.get("_action") || "");
  const supabase = createServiceClient();
  const back = new URL("/admin/replays", req.url);

  try {
    if (action === "delete") {
      const id = String(form.get("id") || "");
      if (id) await supabase.from("replays").delete().eq("id", id);
      back.searchParams.set("ok", "1");
      return NextResponse.redirect(back, 303);
    }

    // add
    const titre = String(form.get("titre") || "").trim();
    const dateCourse = String(form.get("date_course") || "").trim();
    const hippodrome = String(form.get("hippodrome") || "").trim() || null;
    const youtubeId = extractYouTubeId(String(form.get("youtube") || ""));

    if (!titre || !dateCourse || !youtubeId) {
      back.searchParams.set("error", "champs");
      return NextResponse.redirect(back, 303);
    }

    await supabase.from("replays").insert({
      titre,
      date_course: dateCourse,
      hippodrome,
      youtube_id: youtubeId,
    });
    back.searchParams.set("ok", "1");
    return NextResponse.redirect(back, 303);
  } catch (e) {
    console.error("[admin/replays]", (e as Error)?.message);
    back.searchParams.set("error", "serveur");
    return NextResponse.redirect(back, 303);
  }
}
