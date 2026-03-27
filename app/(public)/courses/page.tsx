import { Suspense } from "react";
import { Metadata } from "next";
import Link from "next/link";
import {
  Calendar, Clock, MapPin, Users, TrendingUp,
  ChevronRight, Star, Flag, Zap, AlertCircle
} from "lucide-react";
import { createServiceClient, createClient } from "@/lib/supabase/server";
import CoursesDateNav from "@/components/courses/CoursesDateNav";
import CourseCard from "@/components/courses/CourseCard";
import PageHero from "@/components/layout/PageHero";

export const metadata: Metadata = {
  title: "Programme des Courses — Elite Turf",
  description:
    "Toutes les courses hippiques du jour : Longchamp, Vincennes, Abidjan et plus. Hippodromes, horaires, partants et pronostics experts.",
};

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: {
    date?: string;
    categorie?: string;
    hippodrome?: string;
    statut?: string;
  };
}

export default async function CoursesPage({ searchParams }: PageProps) {
  // ── Date cible ────────────────────────────────────────────────────
  const today = new Date();
  const targetDate = searchParams.date || today.toISOString().split("T")[0];

  const displayDate = new Date(targetDate + "T12:00:00");
  const isToday = targetDate === today.toISOString().split("T")[0];

  // ── Session (pour savoir si l'user a un abonnement) ───────────────
  const supabaseClient = await createClient();
  const { data: { user } } = await supabaseClient.auth.getUser();
  let userSubscription = "GRATUIT";
  if (user) {
    const { data: profile } = await supabaseClient
      .from("profiles").select("statut_abonnement").eq("id", user.id).single();
    if (profile) userSubscription = profile.statut_abonnement;
  }

  // ── Requête courses ───────────────────────────────────────────────
  const supabase = createServiceClient();

  let query = supabase
    .from("courses")
    .select(`
      id, numero_reunion, numero_course, libelle,
      date_course, heure_depart, distance_metres,
      categorie, terrain, nb_partants, statut, arrivee_officielle,
      hippodrome:hippodromes(id, nom, pays, ville),
      pronostics(id, niveau_acces, publie)
    `)
    .eq("date_course", targetDate)
    .order("heure_depart", { ascending: true });

  if (searchParams.categorie) query = query.eq("categorie", searchParams.categorie);
  if (searchParams.statut)    query = query.eq("statut", searchParams.statut);

  const { data: allCourses } = await query;

  // Filtre hippodrome côté serveur
  const courses = (allCourses || []).filter((c: any) => {
    if (!searchParams.hippodrome) return true;
    return c.hippodrome?.nom === searchParams.hippodrome;
  });

  // ── Hippodromes distincts pour filtre ─────────────────────────────
  const { data: hippodromes } = await supabase
    .from("hippodromes").select("nom, pays").eq("actif", true).order("nom");

  // ── Regrouper par hippodrome ──────────────────────────────────────
  const grouped: Record<string, { hippodrome: any; courses: any[] }> = {};
  for (const c of courses) {
    // Supabase returns joined FK as array in types but object at runtime — cast to any
    const hippo = (c.hippodrome as any);
    const hippoObj = Array.isArray(hippo) ? hippo[0] : hippo;
    const key = hippoObj?.nom || "Autre";
    if (!grouped[key]) grouped[key] = { hippodrome: hippoObj, courses: [] };
    grouped[key].courses.push({ ...c, hippodrome: hippoObj });
  }
  const groups = Object.values(grouped);

  // ── Stats rapides ─────────────────────────────────────────────────
  const totalPartants = courses.reduce((s: number, c: any) => s + (c.nb_partants || 0), 0);
  const avecPronostic = courses.filter((c: any) =>
    c.pronostics?.some((p: any) => p.publie)
  ).length;

  return (
    <div className="min-h-screen bg-bg-primary">

      {/* ── HERO ──────────────────────────────────────────────────── */}
      <PageHero
        image="https://images.unsplash.com/photo-1567427017947-545c5f8d16ad?w=1920&q=80"
        titre="Programme des Courses"
        sousTitre={isToday ? `Aujourd'hui — ${courses.length} course${courses.length > 1 ? "s" : ""} programmée${courses.length > 1 ? "s" : ""}` : displayDate.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
      />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* ── Navigation de dates ────────────────────────────────── */}
        <div className="mb-6">
          <Suspense fallback={<div className="h-10 bg-bg-elevated rounded-xl animate-pulse" />}>
            <CoursesDateNav currentDate={targetDate} />
          </Suspense>
        </div>

        {/* ── Filtres rapides ────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-2 mb-8 overflow-x-auto pb-1">
          {/* Catégorie */}
          {[
            { value: "", label: "Toutes" },
            { value: "PLAT", label: "🏇 Plat" },
            { value: "TROT", label: "🐎 Trot" },
            { value: "OBSTACLE", label: "🚧 Obstacle" },
          ].map((f) => (
            <Link
              key={f.value}
              href={buildUrl(searchParams, "categorie", f.value, targetDate)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all whitespace-nowrap ${
                (searchParams.categorie || "") === f.value
                  ? "bg-gold-primary text-bg-primary border-gold-primary"
                  : "bg-bg-elevated border-border text-text-secondary hover:border-gold-primary/40"
              }`}
            >
              {f.label}
            </Link>
          ))}

          <span className="text-border text-xs hidden sm:block">|</span>

          {/* Statut */}
          {[
            { value: "PROGRAMME", label: "📋 Programmé" },
            { value: "EN_COURS",  label: "🟢 En cours" },
            { value: "TERMINE",   label: "✓ Terminé" },
          ].map((f) => (
            <Link
              key={f.value}
              href={buildUrl(searchParams, "statut", searchParams.statut === f.value ? "" : f.value, targetDate)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all whitespace-nowrap ${
                searchParams.statut === f.value
                  ? "bg-bg-elevated border-gold-primary/60 text-gold-light"
                  : "bg-bg-elevated border-border text-text-secondary hover:border-gold-primary/40"
              }`}
            >
              {f.label}
            </Link>
          ))}
        </div>

        {/* ── CONTENU ────────────────────────────────────────────── */}
        {courses.length === 0 ? (
          <EmptyState date={targetDate} isToday={isToday} />
        ) : (
          <div className="space-y-8">
            {groups.map((group) => (
              <HippodromeGroup
                key={group.hippodrome?.nom || "autre"}
                hippodrome={group.hippodrome}
                courses={group.courses}
                userSubscription={userSubscription}
              />
            ))}
          </div>
        )}

        {/* CTA abonnement */}
        {userSubscription === "GRATUIT" && avecPronostic > 0 && courses.length > 0 && (
          <div className="mt-10 p-5 rounded-2xl bg-gradient-to-r from-bg-card via-[#1A1610] to-bg-card border border-gold-primary/30 flex flex-col sm:flex-row items-center gap-4">
            <div className="flex-1 text-center sm:text-left">
              <p className="text-text-primary font-semibold text-sm mb-1">
                Accédez aux analyses complètes
              </p>
              <p className="text-text-muted text-xs">
                Nos experts publient des pronostics détaillés pour chaque course. À partir de 9,90€/mois.
              </p>
            </div>
            <Link
              href="/abonnements"
              className="flex items-center gap-2 px-5 py-2.5 bg-gold-primary hover:bg-gold-dark text-bg-primary font-bold text-sm rounded-xl transition-all shadow-gold whitespace-nowrap"
            >
              <Zap className="w-4 h-4" fill="currentColor" />
              Voir les offres
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Groupe par hippodrome ──────────────────────────────────────────────
function HippodromeGroup({
  hippodrome,
  courses,
  userSubscription,
}: {
  hippodrome: any;
  courses: any[];
  userSubscription: string;
}) {
  return (
    <div>
      {/* Hippodrome header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center gap-2 flex-1">
          <MapPin className="w-4 h-4 text-gold-primary flex-shrink-0" />
          <h2 className="font-serif font-bold text-text-primary text-lg">
            {hippodrome?.nom || "Hippodrome"}
          </h2>
          <span className="text-text-muted text-sm">·</span>
          <span className="text-text-muted text-sm">{hippodrome?.pays}</span>
        </div>
        <span className="text-text-muted text-xs bg-bg-elevated border border-border px-2 py-1 rounded-lg">
          {courses.length} course{courses.length > 1 ? "s" : ""}
        </span>
      </div>
      <hr className="gold-divider mb-4" />

      {/* Courses list */}
      <div className="space-y-3">
        {courses.map((course: any) => (
          <CourseCard
            key={course.id}
            course={course}
            userSubscription={userSubscription}
          />
        ))}
      </div>
    </div>
  );
}

// ── Empty State ────────────────────────────────────────────────────────
function EmptyState({ date, isToday }: { date: string; isToday: boolean }) {
  return (
    <div className="py-16 text-center">
      <div className="w-16 h-16 rounded-2xl bg-bg-elevated border border-border flex items-center justify-center mx-auto mb-4">
        <AlertCircle className="w-7 h-7 text-text-muted" />
      </div>
      <h3 className="font-serif text-lg font-semibold text-text-primary mb-2">
        {isToday ? "Programme non disponible" : "Aucune course ce jour"}
      </h3>
      <p className="text-text-secondary text-sm max-w-xs mx-auto mb-6">
        {isToday
          ? "Le programme du jour n'a pas encore été importé. Revenez bientôt."
          : "Aucune course n'est enregistrée pour cette date."}
      </p>
      <Link
        href="/courses"
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-gold-primary hover:bg-gold-dark text-bg-primary font-bold text-sm rounded-xl transition-all shadow-gold"
      >
        <Calendar className="w-4 h-4" />
        Voir aujourd&apos;hui
      </Link>
    </div>
  );
}

// ── URL builder ────────────────────────────────────────────────────────
function buildUrl(
  current: Record<string, string | undefined>,
  key: string,
  value: string,
  date: string
): string {
  const params = new URLSearchParams();
  if (date !== new Date().toISOString().split("T")[0]) params.set("date", date);
  Object.entries(current).forEach(([k, v]) => {
    if (k !== key && k !== "date" && v) params.set(k, v);
  });
  if (value) params.set(key, value);
  const qs = params.toString();
  return `/courses${qs ? `?${qs}` : ""}`;
}
