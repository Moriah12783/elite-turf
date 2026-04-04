import { redirect } from "next/navigation";
import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
import { ArrowLeft } from "lucide-react";
import PartantsClient from "./PartantsClient";

export default async function PartantsPage({ params }: { params: { id: string } }) {
  const supabase = createServiceClient();

  const [{ data: course }, { data: partants }] = await Promise.all([
    supabase
      .from("courses")
      .select(`
        id, libelle, date_course, heure_depart,
        numero_reunion, numero_course, nb_partants,
        hippodrome:hippodromes(nom)
      `)
      .eq("id", params.id)
      .single(),
    supabase
      .from("partants")
      .select("id, numero, nom_cheval, jockey, entraineur, cote, musique, poids_kg, deferre, non_partant")
      .eq("course_id", params.id)
      .order("numero", { ascending: true }),
  ]);

  if (!course) redirect("/admin/courses");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/admin/courses"
          className="p-2 rounded-lg hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="font-serif text-2xl font-bold text-text-primary">
            Partants — {course.libelle}
          </h1>
          <p className="text-text-secondary text-sm mt-0.5">
            R{course.numero_reunion}C{course.numero_course} · {course.hippodrome?.nom} ·{" "}
            {new Date(course.date_course + "T12:00:00").toLocaleDateString("fr-FR", {
              weekday: "long", day: "numeric", month: "long",
            })} · {course.heure_depart?.slice(0, 5)}
          </p>
        </div>
      </div>

      <PartantsClient
        courseId={params.id}
        nbPartants={course.nb_partants || 10}
        initialPartants={partants || []}
      />
    </div>
  );
}
