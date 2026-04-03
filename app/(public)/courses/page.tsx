import { Suspense } from "react";
import { Metadata } from "next";
import Link from "next/link";
import {
  Calendar, Clock, MapPin, Users,
  ChevronRight, Star, Zap, AlertCircle
} from "lucide-react";
import { createServiceClient, createClient } from "@/lib/supabase/server";
import CoursesDateNav from "@/components/courses/CoursesDateNav";
import CourseCard from "@/components/courses/CourseCard";
import PageHero from "@/components/layout/PageHero";
import TermineesCollapse from "@/components/courses/TermineesCollapse";

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

/**
 * Calcule le statut "réel" d'une course à partir de l'heure de départ et de l'heure actuelle.
 * Cela permet d'afficher les bons statuts même si la base de données n'est pas synchronisée.
 *
 * Règles (heure Paris) :
 *  - Course annulée → ANNULE (toujours respecté)
 *  - Départ passé depuis > 40 min → TERMINE
 *  - Départ dans moins de 5 min ou passé depuis < 40 min → EN_COURS
 *  - Sinon → PROGRAMME
 */
function getEffectiveStatut(course: any, nowParis: Date): string {
  if (course.statut === "ANNULE") return "ANNULE";

  // Si la DB dit TERMINE et qu'on a une arrivée officielle → on fait confiance
  if (course.statut === "TERMINE" && course.arrivee_officielle?.length > 0) return "TERMINE";

  // Calculer l'heure de départ en heure locale (Paris = UTC+2 en été, UTC+1 en hiver)
  const heureDepart = course.heure_depart?.substring(0, 5); // "HH:MM"
  if (!heureDepart) return course.statut || "PROGRAMME";

  const [h, m] = heureDepart.split(":").map(Number);
  const departParis = new Date(nowParis);
  departParis.setHours(h, m, 0, 0);

  const diffMin = (nowParis.getTime() - departParis.getTime()) / 60000;

  if (diffMin > 40)  return "TERMINE";
  if (diffMin > -5)  return "EN_COURS";
  return "PROGRAMME";
}

export default async function CoursesPage({ searchParams }: PageProps) {
  // ── Heure Paris (UTC+2 en été, UTC+1 en hiver) ────────────────────
  const nowUtc   = new Date();
  // Obtenir l'heure Paris via Intl (gère DST automatiquement)
  const parisFmt = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  });
  const partsP   = parisFmt.formatToParts(nowUtc);
  const hP       = parseInt(partsP.find(p => p.type === "hour")!.value);
  const mP       = parseInt(partsP.find(p => p.type === "minute")!.value);
  const sP       = parseInt(partsP.find(p => p.type === "second")!.value);
  // Créer une Date "locale Paris" pour la comparaison (même jour, heure Paris)
  const nowParis = new Date(nowUtc);
  nowParis.setHours(hP, mP, sP, 0);

  // ── Date cible ────────────────────────────────────────────────────
  const todayStr   = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(nowUtc).split("/").reverse().join("-"); // DD/MM/YYYY → YYYY-MM-DD

  const targetDate = searchParams.date || todayStr;
  const displayDate = new Date(targetDate + "T12:00:00");
  const isToday    = targetDate === todayStr;

  // ── Session ───────────────────────────────────────────────────────
  const supabaseClient = await createClient();
  const { data: { user } } = await supabaseClient.auth.getUser();
  let userSubscription = "GRATUIT";
  if (user) {
    const { data: profile } = await createServiceClient()
      .from("profiles").select("statut_abonnement").eq("id", user.id).single();
    if (profile) userSubscription = profile.statut_abonnement;
  }

  // ── Requête courses — PAS de filtre statut DB pour aujourd'hui ────
  // On calcule le statut réel côté serveur à partir de l'heure de départ
  const supabase = createServiceClient();

  let query = supabase
    .from("courses")
    .select(`
      id, numero_reunion, numero_course, libelle,
      date_course, heure_depart, distance_metres,
      categorie, terrain, nb_partants, statut, arrivee_officielle,
      paris_disponibles,
      hippodrome:hippodromes(id, nom, pays, ville),
      pronostics(id, niveau_acces, publie, type_pari)
    `)
    .eq("date_course", targetDate)
    .order("heure_depart", { ascending: true });

  if (searchParams.categorie) query = query.eq("categorie", searchParams.categorie);
  // Pour les autres dates, on filtre par statut DB si demandé
  // Pour aujourd'hui on le fait sur le statut calculé (voir ci-dessous)
  if (searchParams.statut && !isToday) query = query.eq("statut", searchParams.statut);

  const { data: rawCourses } = await query;

  // ── Enrichir chaque course avec son statut effectif (temps réel) ──
  const allCourses = (rawCourses || []).map((c: any) => {
    const hippo    = c.hippodrome;
    const hippoObj = Array.isArray(hippo) ? hippo[0] : hippo;
    const effectif = isToday ? getEffectiveStatut(c, nowParis) : c.statut;
    return { ...c, hippodrome: hippoObj, statut: effectif };
  });

  // ── Filtre hippodrome + filtre statut (calculé) ───────────────────
  const courses = allCourses.filter((c: any) => {
    if (searchParams.hippodrome && c.hippodrome?.nom !== searchParams.hippodrome) return false;
    if (searchParams.statut && isToday && c.statut !== searchParams.statut) return false;
    return true;
  });

  // ── Séparation actives / terminées (aujourd'hui sans filtre statut) ──
  const separerParStatut = isToday && !searchParams.statut;

  const coursesActives   = separerParStatut
    ? courses.filter((c: any) => c.statut !== "TERMINE" && c.statut !== "ANNULE")
    : courses;
  const coursesTerminees = separerParStatut
    ? courses.filter((c: any) => c.statut === "TERMINE")
    : [];

  // ── Regrouper par hippodrome ──────────────────────────────────────
  function groupByHippodrome(list: any[]) {
    const grouped: Record<string, { hippodrome: any; courses: any[] }> = {};
    for (const c of list) {
      const key = c.hippodrome?.nom || "Autre";
      if (!grouped[key]) grouped[key] = { hippodrome: c.hippodrome, courses: [] };
      grouped[key].courses.push(c);
    }
    return Object.values(grouped);
  }

  const groups          = groupByHippodrome(coursesActives);
  const groupsTerminees = groupByHippodrome(coursesTerminees);

  // ── Stats rapides ─────────────────────────────────────────────────
  const totalPartants = courses.reduce((s: number, c: any) => s + (c.nb_partants || 0), 0);
  const avecPronostic = courses.filter((c: any) =>
    c.pronostics?.some((p: any) => p.publie)
  ).length;
  const nbEnCours   = allCourses.filter((c: any) => c.statut === "EN_COURS").length;
  const nbProgramme = allCourses.filter((c: any) => c.statut === "PROGRAMME").length;
  const nbTermine   = allCourses.filter((c: any) => c.statut === "TERMINE").length;

  // ── Sous-titre hero dynamique ─────────────────────────────────────
  let heroSubtitle = "";
  if (!isToday) {
    heroSubtitle = displayDate.toLocaleDateString("fr-FR", {
      weekday: "long", day: "numeric", month: "long",
    });
  } else {
    const parts: string[] = [];
    if (nbEnCours > 0)   parts.push(`${nbEnCours} en cours`);
    if (nbProgramme > 0) parts.push(`${nbProgramme} à venir`);
    if (nbTermine > 0)   parts.push(`${nbTermine} terminée${nbTermine > 1 ? "s" : ""}`);
    heroSubtitle = parts.length > 0
      ? parts.join(" · ")
      : `${allCourses.length} course${allCourses.length > 1 ? "s" : ""} programmée${allCourses.length > 1 ? "s" : ""}`;
  }

  return (
    <div className="min-h-screen bg-bg-primary">

      <PageHero
        image="/images/heroes/hero-courses.jpg"
        titre="Programme des Courses"
        sousTitre={heroSubtitle}
      />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* ── Badges stats ────────────────────────────────────────── */}
        <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[#003189]/10 border border-[#003189]/30 rounded-full">
            <span className="text-xs">🇫🇷</span>
            <span className="text-[#4A7FD4] text-xs font-semibold">Données officielles PMU France</span>
          </div>
          {nbEnCours > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-status-win/10 border border-status-win/30 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-status-win animate-pulse" />
              <span className="text-status-win text-xs font-semibold">{nbEnCours} en direct</span>
            </div>
          )}
          {allCourses.length > 0 && (
            <>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-bg-elevated border border-border rounded-full">
                <Star className="w-3.5 h-3.5 text-gold-primary" />
                <span className="text-text-secondary text-xs font-medium">{avecPronostic} pronostic{avecPronostic > 1 ? "s" : ""} Elite</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-bg-elevated border border-border rounded-full">
                <Users className="w-3.5 h-3.5 text-text-muted" />
                <span className="text-text-muted text-xs">{totalPartants} partants</span>
              </div>
            </>
          )}
        </div>

        {/* ── Navigation dates ─────────────────────────────────────── */}
        <div className="mb-6">
          <Suspense fallback={<div className="h-10 bg-bg-elevated rounded-xl animate-pulse" />}>
            <CoursesDateNav currentDate={targetDate} />
          </Suspense>
        </div>

        {/* ── Filtres rapides ──────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-2 mb-8 overflow-x-auto pb-1">
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

          {[
            { value: "PROGRAMME", label: "📋 À venir" },
            { value: "EN_COURS",  label: "🟢 En direct" },
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

        {/* ── CONTENU ─────────────────────────────────────────────── */}
        {allCourses.length === 0 ? (
          <EmptyState date={targetDate} isToday={isToday} />
        ) : courses.length === 0 ? (
          // Filtre actif mais aucune course dans cette catégorie
          <div className="card-base p-10 text-center">
            <AlertCircle className="w-8 h-8 text-text-muted mx-auto mb-3" />
            <p className="text-text-secondary text-sm font-medium mb-1">
              Aucune course {searchParams.statut === "EN_COURS" ? "en cours" : searchParams.statut === "TERMINE" ? "terminée" : "programmée"} pour l&apos;instant
            </p>
            <Link href={`/courses${targetDate !== todayStr ? `?date=${targetDate}` : ""}`} className="mt-4 inline-flex items-center gap-2 text-gold-primary text-sm hover:text-gold-light transition-colors">
              ← Voir toutes les courses
            </Link>
          </div>
        ) : (
          <div className="space-y-8">

            {/* Courses actives (EN_COURS + PROGRAMME) */}
            {coursesActives.length === 0 && separerParStatut ? (
              <div className="card-base p-8 text-center">
                <Clock className="w-8 h-8 text-text-muted mx-auto mb-3" />
                <p className="text-text-secondary text-sm font-medium mb-1">
                  Toutes les courses du jour sont terminées
                </p>
                <p className="text-text-muted text-xs">
                  Consultez les résultats ci-dessous ou revenez demain pour le programme.
                </p>
              </div>
            ) : (
              groups.map((group) => (
                <HippodromeGroup
                  key={group.hippodrome?.nom || "autre"}
                  hippodrome={group.hippodrome}
                  courses={group.courses}
                  userSubscription={userSubscription}
                />
              ))
            )}

            {/* Courses terminées — section collapsible */}
            {separerParStatut && coursesTerminees.length > 0 && (
              <TermineesCollapse
                count={coursesTerminees.length}
                groups={groupsTerminees}
                userSubscription={userSubscription}
              />
            )}
          </div>
        )}

        {/* CTA abonnement */}
        {userSubscription === "GRATUIT" && avecPronostic > 0 && allCourses.length > 0 && (
          <div className="mt-10 p-5 rounded-2xl bg-gradient-to-r from-bg-card via-[#1A1610] to-bg-card border border-gold-primary/30 flex flex-col sm:flex-row items-center gap-4">
            <div className="flex-1 text-center sm:text-left">
              <p className="text-text-primary font-semibold text-sm mb-1">
                Accédez aux analyses complètes
              </p>
              <p className="text-text-muted text-xs">
                Nos experts publient des pronostics détaillés pour chaque course. À partir de 65€.
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
  hippodrome, courses, userSubscription,
}: {
  hippodrome: any;
  courses: any[];
  userSubscription: string;
}) {
  return (
    <div>
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
      <div className="space-y-3">
        {courses.map((course: any) => (
          <CourseCard key={course.id} course={course} userSubscription={userSubscription} />
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
          ? "Le programme PMU du jour sera disponible à partir de 6h00 Paris. Revenez bientôt."
          : "Aucune course PMU n'est enregistrée pour cette date."}
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
  const todayStr = new Date().toISOString().split("T")[0];
  if (date !== todayStr) params.set("date", date);
  Object.entries(current).forEach(([k, v]) => {
    if (k !== key && k !== "date" && v) params.set(k, v);
  });
  if (value) params.set(key, value);
  const qs = params.toString();
  return `/courses${qs ? `?${qs}` : ""}`;
}
