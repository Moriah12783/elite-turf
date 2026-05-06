/**
 * /arrivees — index page that redirects to today's arrivées.
 *
 * Lets the navbar / external links target a stable, evergreen URL
 * (/arrivees) without having to compute today's date client-side.
 */

import { redirect } from "next/navigation";
import { todayParis } from "@/lib/seo/dates";

export const dynamic = "force-dynamic";

export default function ArriveesIndex() {
  redirect(`/arrivees/${todayParis()}`);
}
