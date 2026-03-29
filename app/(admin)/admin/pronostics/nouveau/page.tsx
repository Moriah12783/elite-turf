import { createServiceClient } from "@/lib/supabase/server";
import NouveauPronosticClient from "./NouveauPronosticClient";

export default async function NouveauPronosticPage() {
  const supabase = createServiceClient();
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];

  const { data: courses } = await supabase
    .from("courses")
    .select("id, libelle, date_course, heure_depart, hippodrome:hippodromes(nom)")
    .gte("date_course", weekAgo)
    .order("date_course", { ascending: false })
    .order("heure_depart", { ascending: true })
    .limit(60);

  return <NouveauPronosticClient courses={(courses as any) || []} />;
}
