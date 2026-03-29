import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import ModifierPronosticClient from "./ModifierPronosticClient";

export default async function ModifierPronosticPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createServiceClient();
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];

  const [{ data: pronostic }, { data: courses }] = await Promise.all([
    supabase.from("pronostics").select("*").eq("id", params.id).single(),
    supabase
      .from("courses")
      .select("id, libelle, date_course, heure_depart, hippodrome:hippodromes(nom)")
      .gte("date_course", weekAgo)
      .order("date_course", { ascending: false })
      .order("heure_depart", { ascending: true })
      .limit(60),
  ]);

  if (!pronostic) redirect("/admin/pronostics");

  return (
    <ModifierPronosticClient
      pronostic={pronostic}
      courses={(courses as any) || []}
    />
  );
}
