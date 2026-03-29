import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import ModifierCourseClient from "./ModifierCourseClient";

export default async function ModifierCoursePage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createServiceClient();

  const [{ data: course }, { data: hippodromes }] = await Promise.all([
    supabase.from("courses").select("*").eq("id", params.id).single(),
    supabase.from("hippodromes").select("id, nom, pays").eq("actif", true).order("nom"),
  ]);

  if (!course) redirect("/admin/courses");

  return (
    <ModifierCourseClient
      course={course}
      hippodromes={hippodromes || []}
    />
  );
}
