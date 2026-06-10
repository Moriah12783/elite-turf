/**
 * /admin/temoignages — modération des témoignages RÉELS (audit S1.5, Lot 3).
 *
 * Flux : l'abonné écrit sur WhatsApp (CTA « Partager mon expérience ») →
 * l'admin saisit ici (statut pending) → approve/reject. Seuls les `approved`
 * apparaissent sur la home (PreuveSection), toujours avec disclaimer.
 */

import { createServiceClient } from "@/lib/supabase/server";
import TemoignagesClient from "./TemoignagesClient";

export const dynamic = "force-dynamic";

export default async function AdminTemoignagesPage() {
  const supabase = createServiceClient();
  const { data: temoignages } = await supabase
    .from("testimonials")
    .select("*")
    .order("created_at", { ascending: false });

  return <TemoignagesClient initial={temoignages ?? []} />;
}
