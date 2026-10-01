/**
 * /programme — page pilier « Programme PMU du jour » (brief SEO du 01/10/2026,
 * B2).
 *
 * Avant : 404 — seules les pages datées existaient, alors que `/programme` est
 * l'une des sections qui apportent le plus de trafic et que `/llms.txt`
 * pointait déjà ici. Une URL fixe accumule l'autorité sur « programme PMU du
 * jour », ce que des pages datées ne font pas.
 *
 * Contenu : le programme du jour (vue partagée avec /programme/[date]), puis
 * les jours suivants et l'accès aux courses avec la Sélection stats. Rendu
 * dynamique (la vue appelle noStore() pour aujourd'hui).
 *
 * Distinct de /courses (liste interactive avec filtres et Sélection stats) :
 * ici, le programme par réunion et la navigation entre les jours.
 */
import { Metadata } from "next";
import { unstable_noStore as noStore } from "next/cache";
import Link from "next/link";
import { ChevronRight, CalendarDays, ListChecks } from "lucide-react";
import { formatDateCompact, formatDateLong, formatDateShort, todayParis } from "@/lib/seo/dates";
import { pickQuinteDuJour } from "@/lib/turf/course-vedette";
import { chargerCoursesProgramme } from "./donnees";
import VueProgramme from "./VueProgramme";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://www.elite-turf.fr");

function decaler(date: string, jours: number): string {
  return new Date(Date.parse(date + "T12:00:00Z") + jours * 86400000).toISOString().slice(0, 10);
}

export async function generateMetadata(): Promise<Metadata> {
  noStore();
  const date = todayParis();
  const courses = await chargerCoursesProgramme(date);
  // Sans marque : le gabarit du root layout ajoute « | Elite Turf ».
  const titre = `🏇 Programme PMU du jour · ${formatDateCompact(date)} — Quinté+, Tiercé, Quarté+`;
  const description =
    `Programme PMU du jour (${formatDateLong(date)})` +
    (courses.length > 0 ? ` : ${courses.length} courses` : "") +
    ". Réunions, horaires, partants, Quinté+ du jour et programme des prochains jours. Pronostics Elite Turf.";
  return {
    title: titre,
    description,
    alternates: { canonical: `${APP_URL}/programme` },
    openGraph: {
      title: `${titre} | Elite Turf`,
      description,
      url: `${APP_URL}/programme`,
      type: "website",
    },
  };
}

export default async function ProgrammePilier() {
  noStore();
  const aujourdhui = todayParis();
  return <VueProgramme date={aujourdhui} pilier complement={<ComplementProgramme aujourdhui={aujourdhui} />} />;
}

/** Les prochains jours + accès à la liste des courses avec Sélection stats. */
async function ComplementProgramme({ aujourdhui }: { aujourdhui: string }) {
  const jours = [decaler(aujourdhui, 1), decaler(aujourdhui, 2)];
  const programmes = await Promise.all(jours.map((d) => chargerCoursesProgramme(d)));

  return (
    <div className="mt-10">
      <div className="flex items-center gap-2 mb-3">
        <CalendarDays className="w-5 h-5 text-gold-primary" />
        <h2 className="font-serif font-bold text-text-primary text-lg">Les prochains jours</h2>
      </div>
      <div className="grid sm:grid-cols-3 gap-3">
        {jours.map((d, i) => {
          const courses = programmes[i];
          const quinte: any = pickQuinteDuJour(courses);
          return (
            <Link
              key={d}
              href={`/programme/${d}`}
              className="card-base p-4 hover:border-gold-primary/40 transition-all flex items-center gap-3"
            >
              <div className="flex-1 min-w-0">
                <div className="text-text-primary text-sm font-semibold">
                  {i === 0 ? "Demain" : "Après-demain"} · {formatDateShort(d)}
                </div>
                <div className="text-text-muted text-xs truncate">
                  {courses.length > 0
                    ? `${courses.length} courses${quinte ? ` · Quinté+ : ${quinte.libelle}` : ""}`
                    : "Programme publié la veille"}
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-text-muted flex-shrink-0" />
            </Link>
          );
        })}
        <Link
          href="/courses"
          className="card-base p-4 hover:border-gold-primary/40 transition-all flex items-center gap-3"
        >
          <ListChecks className="w-5 h-5 text-gold-primary flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-text-primary text-sm font-semibold">Toutes les courses du jour</div>
            <div className="text-text-muted text-xs">Avec la Sélection stats gratuite</div>
          </div>
          <ChevronRight className="w-4 h-4 text-text-muted flex-shrink-0" />
        </Link>
      </div>
    </div>
  );
}
