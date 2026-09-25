import Link from "next/link";
import Image from "next/image";
import {
  Lock, Star, ChevronRight, Eye, Trophy, Flame,
  MapPin, Clock, TrendingUp, Zap, Globe2,
} from "lucide-react";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { isJouableAfrique, getNationaleLabel, fetchPmuPartants } from "@/lib/pmu-api";
import { canAccess } from "@/lib/auth/access";
import { resolveUserSubscription } from "@/lib/auth/subscription";
import { pickQuinteDuJour } from "@/lib/turf/course-vedette";
import { pickCoursesASuivre, type CourseASuivre } from "@/lib/turf/courses-a-suivre";
import { heureGmtDepuisParis } from "@/lib/seo/dates";

const LABEL_QUINTE = "Nationale 1 — Quinté+";

/** Retourne 1 si Nationale 1, 2 si Nat2, 3 si Nat3, 0 sinon */
function getNatNum(paris: string[]): number {
  if (paris.includes("QUINTE_PLUS") || paris.includes("QUINTE")) return 1;
  if (paris.includes("QUARTE_PLUS") || paris.includes("QUARTE")) return 2;
  if (paris.includes("TIERCE")) return 3;
  return 0;
}

/** Extrait paris_disponibles depuis un pronostic (gère cours tableau ou objet) */
function getCourseParisDisponibles(p: any): string[] {
  const c = Array.isArray(p.course) ? p.course[0] : p.course;
  return Array.isArray(c?.paris_disponibles) ? c.paris_disponibles : [];
}

/** Heure Paris en minutes depuis minuit */
function getNowParisMins(): number {
  const fmt = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit", hour12: false,
  });
  const parts = fmt.formatToParts(new Date());
  return parseInt(parts.find(p => p.type === "hour")!.value) * 60
       + parseInt(parts.find(p => p.type === "minute")!.value);
}

/**
 * Heure GMT/UTC en minutes depuis minuit. La fenêtre de publication ANNONCÉE
 * (FAQ, JSON-LD) est « entre 8h30 et 9h30 heure GMT » — l'état « en attente de
 * publication » doit donc se baser sur cette fenêtre GMT, pas sur l'heure de
 * Paris ni sur des heuristiques de départ de course (audit Sprint 1, P7).
 */
function getNowGmtMins(): number {
  const now = new Date();
  return now.getUTCHours() * 60 + now.getUTCMinutes();
}
const FIN_FENETRE_PUBLICATION_GMT = 9 * 60 + 30; // 9h30 GMT

/** Date du jour en heure Paris */
function getTodayParis(): string {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date()).split("/").reverse().join("-");
}

/** Vérifie l'accès selon le niveau et l'abonnement utilisateur */
// canAccess() : source unique dans "@/lib/auth/access" (importée en tête).

/** True si la course est terminée (départ > 40 min passé) */
function isCourseTerminee(heureDepart: string | undefined, nowMins: number): boolean {
  if (!heureDepart) return false;
  const [h, m] = heureDepart.substring(0, 5).split(":").map(Number);
  return nowMins - (h * 60 + m) > 40;
}

export default async function PronosticsSection() {
  const supabase  = createServiceClient();

  // Lire l'abonnement utilisateur pour déverrouiller les pronostics Pro/Elite
  let userSubscription = "GRATUIT";
  try {
    const supabaseClient = await createClient();
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (user) {
      userSubscription = await resolveUserSubscription(supabase, user.id);
    }
  } catch {
    // Non authentifié
  }

  const today     = getTodayParis();
  const nowMins   = getNowParisMins();
  // Fenêtre de publication annoncée (8h30–9h30 GMT) déjà passée ?
  const apresFenetrePublication = getNowGmtMins() > FIN_FENETRE_PUBLICATION_GMT;
  const weekAgo   = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];

  // ── 1. Pronostics du JOUR publiés
  const { data: todayPronoRaw } = await supabase
    .from("pronostics")
    .select(`
      id, niveau_acces, type_pari, confiance, analyse_courte, selection, nb_vues, date_publication,
      course:courses(
        id, libelle, heure_depart, numero_reunion, numero_course, date_course,
        paris_disponibles,
        hippodrome:hippodromes(nom)
      )
    `)
    .eq("publie", true)
    .gte("date_publication", today)
    .order("date_publication", { ascending: false })
    .order("confiance",        { ascending: false })
    .limit(10);

  // Pronostics du jour uniquement — pas de fallback sur les jours précédents
  let rawProno = (todayPronoRaw || []).filter((p: any) => {
    const c = Array.isArray(p.course) ? p.course[0] : p.course;
    return c?.date_course === today;
  });

  // ── Marquer chaque pronostic : course terminée ou non ──────────────
  const pronosWithStatus = rawProno.map((p: any) => {
    const c = Array.isArray(p.course) ? p.course[0] : p.course;
    const terminee = isCourseTerminee(c?.heure_depart, nowMins);
    return { ...p, _terminee: terminee };
  });

  // Trier : pronostics à venir / en cours en premier, terminés à la fin
  pronosWithStatus.sort((a: any, b: any) => {
    if (a._terminee === b._terminee) return 0;
    return a._terminee ? 1 : -1;
  });

  const displayList = pronosWithStatus.slice(0, 3);
  const aDesPronos  = pronosWithStatus.length > 0;

  // ── 2. Courses du jour (TOUTES : le Quinté+ part souvent en fin d'après-midi)
  const { data: todayCoursesRaw } = await supabase
    .from("courses")
    .select(`
      id, libelle, heure_depart, numero_reunion, numero_course,
      paris_disponibles, nationale, jouable_afrique, statut,
      nb_partants, distance_metres,
      hippodrome:hippodromes(nom, pays)
    `)
    .eq("date_course", today)
    .order("heure_depart", { ascending: true });
  const todayCourses = (todayCoursesRaw || []) as any[];

  // ── 3. LA vedette = le Quinté+ du jour (Nationale 1), jouable France + Afrique.
  // AVANT (jusqu'au 25/09/2026) : sans pronostic publié, la vedette était la 1re
  // des 3 prochaines courses → le matin, une course à simple gagnant quelconque
  // (ex. Prix d'Arles, 11h00) au lieu du Quinté+ du soir. Cf. pickQuinteDuJour.
  const quinte: any = pickQuinteDuJour(todayCourses);
  const idCoursePronostic = (p: any) =>
    (Array.isArray(p.course) ? p.course[0] : p.course)?.id;

  // Carte vedette « pronostic » : celui publié sur le Quinté+ s'il existe.
  // Pas de Quinté+ identifiable (données incomplètes) → ancien choix, parmi les
  // pronostics publiés : Quinté+ > Quarté+ > premier à venir.
  const aVenir = pronosWithStatus.filter((p: any) => !p._terminee);
  const vedetteProno: any = quinte
    ? pronosWithStatus.find((p: any) => idCoursePronostic(p) === quinte.id) || null
    : aVenir.find((p: any) => getNatNum(getCourseParisDisponibles(p)) === 1) ||
      aVenir.find((p: any) => getNatNum(getCourseParisDisponibles(p)) === 2) ||
      aVenir[0] ||
      pronosWithStatus.find((p: any) => getNatNum(getCourseParisDisponibles(p)) === 1) ||
      pronosWithStatus[0] ||
      null;

  // Placeholder (aucun pronostic publié) : les courses qui intéressent les
  // abonnés, comme sur la LONACI — Nationale 2, Nationale 3, une course du Maroc
  // (hors Quinté+, déjà en vedette). Avant : les 3 premières courses du jour.
  const placeholderCourses: CourseASuivre<any>[] = aDesPronos
    ? []
    : pickCoursesASuivre(todayCourses, { exclureId: quinte?.id, maintenantMinutesParis: nowMins });

  // ── CASE A : Aucune donnée du tout ─────────────────────────────────
  if (!aDesPronos && !quinte && !placeholderCourses.length) {
    return (
      <section className="py-16 sm:py-20 bg-bg-card/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center py-10">
          <Globe2 className="w-10 h-10 text-gold-primary mx-auto mb-4 opacity-60" />
          <h2 className="font-serif text-2xl font-bold text-text-primary mb-2">Pronostics du Jour</h2>
          <p className="text-text-secondary text-sm max-w-md mx-auto">
            {apresFenetrePublication
              ? "Aucun pronostic n'a été publié aujourd'hui. Consultez nos archives et le programme des prochaines courses."
              : "Les pronostics du jour sont publiés entre 8h30 et 9h30 (heure GMT)."}
          </p>
          <Link
            href="/pronostics"
            className="mt-6 inline-flex items-center gap-2 px-6 py-3 bg-gold-primary hover:bg-gold-dark text-bg-primary font-bold text-sm rounded-xl transition-all shadow-gold"
          >
            <Trophy className="w-4 h-4" />
            Voir tous les pronostics
          </Link>
        </div>
      </section>
    );
  }

  // ── CASE B : Courses du jour mais pas encore de pronostics publiés ──
  if (!aDesPronos) {
    return (
      <section className="py-16 sm:py-20 bg-bg-card/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Vedette "à venir" = le Quinté+. Introuvable → pas de carte plutôt
              qu'une course quelconque présentée comme la vedette. */}
          {quinte && (
            <QuinteVedetteCard course={quinte} date={today}>
              {/* État honnête basé sur la donnée réelle + fenêtre GMT (audit P7) :
                  avant/pendant la fenêtre → « publication en cours » ; après →
                  pas de vedette aujourd'hui, on oriente vers la sélection gratuite. */}
              {apresFenetrePublication ? (
                <>
                  <p className="text-text-secondary text-sm mb-4">
                    Pas de pronostic vedette aujourd&apos;hui — profitez de{" "}
                    <span className="text-gold-light font-medium">Sélection stats gratuite</span> sur chaque course.
                  </p>
                  <Link href="/courses" className="inline-flex items-center gap-2 px-5 py-2.5 bg-gold-primary hover:bg-gold-dark text-bg-primary font-bold text-sm rounded-xl transition-all shadow-gold">
                    <Trophy className="w-4 h-4" />
                    Voir la Sélection stats gratuite
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </>
              ) : (
                <>
                  <p className="text-text-secondary text-sm mb-4">
                    Publication en cours — le pronostic expert est publié entre 8h30 et 9h30 (heure GMT).
                  </p>
                  <Link href="/pronostics" className="inline-flex items-center gap-2 px-5 py-2.5 bg-gold-primary hover:bg-gold-dark text-bg-primary font-bold text-sm rounded-xl transition-all shadow-gold">
                    <Trophy className="w-4 h-4" />
                    S&apos;abonner pour y accéder
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </>
              )}
            </QuinteVedetteCard>
          )}

          {/* Bannière */}
          {/* Aucun pronostic publié : on compte des COURSES, pas des pronostics. */}
          <BannerImage compteur={placeholderCourses.length > 0
            ? `${placeholderCourses.length} course${placeholderCourses.length > 1 ? "s" : ""} à suivre`
            : null} />

          {/* Liste des courses du jour */}
          {placeholderCourses.length > 0 && (
          <div className="flex items-center justify-between mb-6">
            <p className="text-text-secondary text-sm">Courses disponibles aujourd&apos;hui</p>
            <Link href="/pronostics" className="hidden sm:flex items-center gap-1 text-gold-primary hover:text-gold-light text-sm font-medium transition-colors">
              Tous les pronostics <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          )}
          <div className="space-y-4">
            {placeholderCourses.map(({ course: c, etiquette }) => (
              <div key={c.id} className="card-base p-5 relative overflow-hidden">
                <div className="absolute inset-0 shimmer-bg pointer-events-none" />
                <div className="relative z-10 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    {etiquette && (
                      <span className="inline-block mb-2 text-xs px-2.5 py-0.5 rounded-full bg-gold-faint border border-gold-primary/30 text-gold-light font-semibold">
                        {etiquette}
                      </span>
                    )}
                    <p className="text-text-secondary text-sm font-medium mb-1 break-words">
                      📍 R{c.numero_reunion}C{c.numero_course} — {c.libelle} — {c.hippodrome?.nom}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                      <HeuresParisGmt date={today} heure={c.heure_depart} />
                      {/* Gardes > 0 : un 0 en base veut dire « inconnu », pas « zéro ». */}
                      {c.nb_partants > 0 && <span className="text-text-secondary">· {c.nb_partants} partants</span>}
                      {c.distance_metres > 0 && <span className="text-text-secondary">· {Number(c.distance_metres).toLocaleString("fr-FR")} m</span>}
                    </div>
                  </div>
                  <Link href="/abonnements" className="flex items-center gap-2 px-4 py-2 bg-gold-primary hover:bg-gold-dark text-bg-primary font-semibold text-xs rounded-lg transition-colors shadow-gold">
                    <Lock className="w-3.5 h-3.5" />
                    Débloquer
                  </Link>
                </div>
              </div>
            ))}
          </div>
          <CtaBlock />
        </div>
      </section>
    );
  }

  // ── CASE C : Pronostics africains disponibles ───────────────────────
  const vedette: any = vedetteProno;
  // Normaliser la relation "course" qui peut être un objet ou un tableau (Supabase inference)
  const vCourse: any = Array.isArray(vedette?.course) ? vedette.course[0] : vedette?.course;
  const listWithoutVedette = displayList.filter((p: any) => p.id !== vedette?.id);

  // ── 3. Favori automatique : cheval avec la cote la plus basse (PMU) ──
  let favoriAuto: { nom: string; cote: number; numero: number } | null = null;
  if (vCourse) {
    try {
      const dateStrFav = (vCourse.date_course || today).replace(/-/g, "");
      const participants = await fetchPmuPartants(
        dateStrFav,
        vCourse.numero_reunion,
        vCourse.numero_course,
      );
      const avecCote = participants
        .filter((p) => p.coteProbable || p.coteDefinitive)
        .map((p) => ({
          numero: p.numPmu,
          nom:    p.nom,
          cote:   p.coteDefinitive ?? p.coteProbable ?? 99,
        }))
        .sort((a, b) => a.cote - b.cote);
      if (avecCote.length > 0) favoriAuto = avecCote[0];
    } catch {
      // PMU indisponible — on n'affiche pas le favori
    }
  }

  return (
    <section id="pronostics" className="py-16 sm:py-20 bg-bg-card/30 scroll-mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* ── CARTE VEDETTE DU JOUR ── pronostic publié sur le Quinté+, sinon
            le Quinté+ lui-même (nos pronostics du jour sont alors juste dessous). */}
        {!vedette && quinte && (
          <QuinteVedetteCard course={quinte} date={today}>
            <p className="text-text-secondary text-sm mb-4">
              Partants, cotes et arrivée du Quinté+ sur sa page dédiée. Nos pronostics experts du jour sont juste en dessous.
            </p>
            <Link href={`/quinte-plus/${today}`} className="inline-flex items-center gap-2 px-5 py-2.5 bg-gold-primary hover:bg-gold-dark text-bg-primary font-bold text-sm rounded-xl transition-all shadow-gold">
              <Trophy className="w-4 h-4" />
              Voir le Quinté+ du jour
              <ChevronRight className="w-4 h-4" />
            </Link>
          </QuinteVedetteCard>
        )}
        {vedette && (
        <div className="relative rounded-2xl overflow-hidden mb-10 border border-gold-primary/40 bg-gradient-to-br from-bg-card via-[#1A1610] to-bg-card shadow-gold">
          <div className="absolute inset-0 z-0">
            <Image
              src="/images/heroes/hero-a-propos.jpg"
              alt="Cheval de la course vedette du jour — Elite Turf"
              fill
              sizes="100vw"
              loading="lazy"
              className="object-cover opacity-20"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-bg-card/95 via-bg-card/80 to-bg-card/95" />
          </div>
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold-primary to-transparent" />

          <div className="relative z-10 p-6 sm:p-8">
            <div className="flex flex-wrap items-center gap-3 mb-5">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-gold-primary text-bg-primary rounded-full font-bold text-xs uppercase tracking-widest shadow-gold">
                <Zap className="w-3.5 h-3.5" fill="currentColor" />
                Vedette du Jour
              </div>
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-status-win/10 border border-status-win/25 text-status-win text-xs font-semibold rounded-full">
                <TrendingUp className="w-3 h-3" />
                Confiance max
              </span>
              <span className="text-xs px-2.5 py-1 rounded-full bg-bg-elevated border border-border text-text-secondary font-medium">
                {quinte && vCourse?.id === quinte.id
                  ? LABEL_QUINTE
                  : getNationaleLabel(vCourse?.paris_disponibles || []) || vedette.type_pari}
              </span>
            </div>

            <div className="sm:flex sm:items-start sm:gap-8">
              {/* Sélection principale */}
              <div className="flex items-center gap-4 mb-5 sm:mb-0 sm:flex-shrink-0 sm:max-w-xs min-w-0">
                {vedette.selection && vedette.selection.length > 0 && (
                  <div className="w-16 h-16 flex-shrink-0 rounded-2xl bg-gold-faint border-2 border-gold-primary/60 flex flex-col items-center justify-center shadow-gold">
                    <span className="text-xs text-gold-light/70 uppercase tracking-wider leading-none mb-0.5">N°</span>
                    <span className="text-3xl font-bold font-serif text-gold-primary leading-none">
                      {canAccess(vedette.niveau_acces, userSubscription)
                        ? (Array.isArray(vedette.selection) ? vedette.selection[0] : vedette.selection)
                        : "?"}
                    </span>
                  </div>
                )}
                <div className="min-w-0">
                  <h3 className="font-serif text-xl sm:text-2xl font-bold text-text-primary leading-tight break-words">
                    {vCourse?.libelle || "Course du jour"}
                  </h3>
                  <div className="flex items-center gap-0.5 mt-1 flex-wrap">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className="w-3.5 h-3.5"
                        fill={i < (vedette.confiance || 3) ? "#C9A84C" : "transparent"}
                        color={i < (vedette.confiance || 3) ? "#C9A84C" : "#3A3A50"}
                      />
                    ))}
                    <span className="text-gold-light text-xs ml-1 font-medium">
                      {vedette.confiance >= 5 ? "Confiance max" : `Confiance ${vedette.confiance}/5`}
                    </span>
                  </div>
                </div>
              </div>

              {/* Infos + analyse */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-4 mb-4 text-sm">
                  <div className="flex items-center gap-1.5 text-text-secondary">
                    <MapPin className="w-3.5 h-3.5 text-gold-primary flex-shrink-0" />
                    {vCourse?.hippodrome?.nom} — R{vCourse?.numero_reunion}C{vCourse?.numero_course}
                  </div>
                  <HeuresParisGmt date={vCourse?.date_course || today} heure={vCourse?.heure_depart} />
                </div>

                {vedette.analyse_courte && (
                  <p className="text-text-secondary text-sm leading-relaxed mb-4 italic border-l-2 border-gold-primary/40 pl-3 line-clamp-4">
                    &ldquo;{canAccess(vedette.niveau_acces, userSubscription)
                      ? vedette.analyse_courte
                      : "Analyse de l'expert réservée aux abonnés — débloquez la sélection complète et le commentaire détaillé."}&rdquo;
                  </p>
                )}

                {/* Favori automatique PMU */}
                {favoriAuto && (
                  <div className="flex items-center gap-3 mb-5 px-3 py-2.5 bg-bg-elevated border border-gold-primary/20 rounded-xl w-fit">
                    <span className="text-gold-light text-xs font-semibold uppercase tracking-wider">Favori</span>
                    <span className="w-px h-4 bg-border" />
                    <span className="w-6 h-6 rounded-full bg-gold-faint border border-gold-primary/40 flex items-center justify-center text-gold-primary font-bold text-xs flex-shrink-0">
                      {favoriAuto.numero}
                    </span>
                    <span className="text-text-primary font-semibold text-sm">{favoriAuto.nom}</span>
                    <span className="text-gold-light font-bold text-sm">{favoriAuto.cote.toFixed(1)}</span>
                  </div>
                )}

                <Link
                  href="/pronostics"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-gold-primary hover:bg-gold-dark text-bg-primary font-bold text-sm rounded-xl transition-all shadow-gold"
                >
                  <Trophy className="w-4 h-4" />
                  Voir l&apos;analyse complète
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>

          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold-primary/50 to-transparent" />
        </div>
        )}

        {/* Bannière visuelle */}
        <BannerImage compteur={`${displayList.length} pronostic${displayList.length > 1 ? "s" : ""} ce jour`} />

        {/* En-tête liste */}
        <div className="flex items-center justify-between mb-6">
          <p className="text-text-secondary text-sm">
            Pronostics disponibles aujourd&apos;hui
          </p>
          <Link
            href="/pronostics"
            className="hidden sm:flex items-center gap-1 text-gold-primary hover:text-gold-light text-sm font-medium transition-colors"
          >
            Tous les pronostics <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Liste des pronostics */}
        <div className="space-y-4">
          {displayList.map((p: any) => {
            const isLocked = !canAccess(p.niveau_acces, userSubscription);
            // Normaliser la relation course (Supabase peut retourner un tableau)
            const pCourse: any = Array.isArray(p.course) ? p.course[0] : p.course;
            const paris    = pCourse?.paris_disponibles || [];
            const natLabel = getNationaleLabel(paris);

            return (
              <div key={p.id} className="card-base p-5 sm:p-6 relative overflow-hidden">
                {isLocked && <div className="absolute inset-0 shimmer-bg pointer-events-none" />}
                <div className="relative z-10">
                  {/* Badges */}
                  <div className="flex flex-wrap items-center gap-3 mb-4">
                    <span className={`text-xs px-3 py-1 rounded-full font-semibold border ${
                      !isLocked
                        ? "bg-status-win/10 text-status-win border-status-win/20"
                        : "bg-gold-faint text-gold-light border-gold-primary/30"
                    }`}>
                      {!isLocked ? (p.niveau_acces === "GRATUIT" ? "GRATUIT" : p.niveau_acces === "ELITE" ? "★ ELITE" : "★ PRO") : (p.niveau_acces === "ELITE" ? "★ ELITE" : "★ PRO")}
                    </span>
                    <span className="text-xs px-3 py-1 rounded-full bg-bg-elevated border border-border text-text-secondary font-medium">
                      {p.type_pari}
                    </span>
                    {natLabel && (
                      <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        🌍 {natLabel.split(" — ")[0]}
                      </span>
                    )}
                    <div className="flex items-center gap-0.5 ml-auto">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className="w-3.5 h-3.5"
                          fill={i < (p.confiance || 3) ? "#C9A84C" : "transparent"}
                          color={i < (p.confiance || 3) ? "#C9A84C" : "#3A3A50"}
                        />
                      ))}
                      <span className="text-text-muted text-xs ml-1.5">Confiance</span>
                    </div>
                  </div>

                  {/* Course */}
                  <p className="text-text-secondary text-sm mb-3 font-medium break-words">
                    📍 R{pCourse?.numero_reunion}C{pCourse?.numero_course} — {pCourse?.libelle} — {pCourse?.hippodrome?.nom} —{" "}
                    <span className="text-gold-light">{(pCourse?.heure_depart || "").substring(0, 5)}</span>
                  </p>

                  {/* Sélection */}
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-text-muted text-xs uppercase tracking-wider">Sélection :</span>
                    {!isLocked ? (
                      <div className="flex items-center gap-2">
                        {(Array.isArray(p.selection) ? p.selection : []).map((n: number) => (
                          <span key={n} className="w-8 h-8 rounded-full bg-gold-faint border border-gold-primary/40 flex items-center justify-center text-gold-light font-bold text-sm">
                            {n}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        {[1, 2, 3].map((n) => (
                          <span key={n} className="w-8 h-8 rounded-full bg-bg-elevated border border-border flex items-center justify-center text-text-muted font-bold text-sm paywall-blur">
                            ?
                          </span>
                        ))}
                        <Lock className="w-4 h-4 text-gold-primary ml-1" />
                      </div>
                    )}
                  </div>

                  {/* Analyse */}
                  {!isLocked ? (
                    p.analyse_courte && (
                      <p className="text-text-secondary text-sm leading-relaxed mb-4 line-clamp-3">
                        {p.analyse_courte}
                      </p>
                    )
                  ) : (
                    <div className="relative mb-4">
                      <p className="text-text-secondary text-sm leading-relaxed paywall-blur select-none">
                        Analyse complète réservée aux abonnés. Sélection experte avec ratio gain/risque optimisé.
                      </p>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Link href="/abonnements" className="flex items-center gap-2 px-4 py-2 bg-gold-primary hover:bg-gold-dark text-bg-primary font-semibold text-sm rounded-lg transition-colors shadow-gold">
                          <Lock className="w-4 h-4" />
                          Débloquer l&apos;analyse
                        </Link>
                      </div>
                    </div>
                  )}

                  {/* Pied */}
                  <div className="flex items-center justify-between pt-3 border-t border-border/50">
                    <div className="flex items-center gap-1 text-text-muted text-xs">
                      <Eye className="w-3.5 h-3.5" />
                      {(p.nb_vues || 0).toLocaleString("fr-CI")} vues
                    </div>
                    <Link href={`/pronostics/${p.id}`} className="flex items-center gap-1 text-gold-primary hover:text-gold-light text-xs font-medium transition-colors">
                      Détail complet <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <CtaBlock />
      </div>
    </section>
  );
}

// ── Sous-composants ────────────────────────────────────────────────────

/**
 * Heure de départ à l'heure de Paris ET en GMT : la base est à l'heure de
 * Paris, les abonnés d'Afrique de l'Ouest (et la LONACI) lisent l'heure GMT.
 */
function HeuresParisGmt({ date, heure }: { date: string; heure: string | null | undefined }) {
  const paris = (heure || "").substring(0, 5);
  const gmt = heureGmtDepuisParis(date, heure);
  if (!paris) return null;
  return (
    <span className="flex items-center gap-1.5 text-gold-light font-semibold">
      <Clock className="w-3.5 h-3.5" />
      {paris}
      <span className="text-text-secondary font-normal">Paris</span>
      {gmt && (
        <>
          <span className="text-text-muted font-normal">·</span>
          {gmt}
          <span className="text-text-secondary font-normal">GMT</span>
        </>
      )}
    </span>
  );
}

/** Carte « Vedette du Jour » d'une COURSE (le Quinté+), sans pronostic. */
function QuinteVedetteCard({ course, date, children }: { course: any; date: string; children: React.ReactNode }) {
  return (
    <div className="relative rounded-2xl overflow-hidden mb-10 border border-gold-primary/40 bg-gradient-to-br from-bg-card via-[#1A1610] to-bg-card shadow-gold">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold-primary to-transparent" />
      <div className="relative z-10 p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-3 mb-5">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-gold-primary text-bg-primary rounded-full font-bold text-xs uppercase tracking-widest shadow-gold">
            <Zap className="w-3.5 h-3.5" fill="currentColor" />
            Vedette du Jour
          </div>
          <span className="text-xs px-2.5 py-1 rounded-full bg-bg-elevated border border-border text-text-secondary font-medium">
            {LABEL_QUINTE}
          </span>
        </div>
        <p className="font-serif text-xl font-bold text-text-primary mb-1">{course.libelle}</p>
        <div className="flex flex-wrap items-center gap-4 text-sm text-text-secondary mb-4">
          <span className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-gold-primary" />
            {course.hippodrome?.nom}{course.numero_reunion ? ` — R${course.numero_reunion}C${course.numero_course}` : ""}
          </span>
          <HeuresParisGmt date={date} heure={course.heure_depart} />
        </div>
        {children}
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold-primary/50 to-transparent" />
    </div>
  );
}

function BannerImage({ compteur }: { compteur: string | null }) {
  return (
    <div className="relative rounded-2xl overflow-hidden mb-12 h-48">
      <Image
        src="/images/heroes/hero-legal.jpg"
        alt="Chevaux au galop sur un hippodrome PMU — pronostics Elite Turf"
        fill
        sizes="100vw"
        loading="lazy"
        className="object-cover rounded-xl"
      />
      <div className="absolute inset-0 bg-bg-primary/65" />
      <div className="absolute inset-0 bg-gradient-to-r from-bg-primary/80 via-transparent to-bg-primary/80" />
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
        <div className="flex items-center gap-2 mb-3">
          <Star className="w-5 h-5 text-gold-primary" fill="currentColor" />
          <span className="text-gold-light text-sm font-medium uppercase tracking-widest">Nos Experts</span>
        </div>
        <h2 className="font-serif text-2xl sm:text-4xl font-bold text-text-primary drop-shadow-lg mb-2">
          Pronostics du Jour
        </h2>
        <p className="text-text-secondary text-sm sm:text-base max-w-lg">
          Analyses approfondies par nos spécialistes hippiques.{" "}
          <span className="text-gold-light">Résultats publiés chaque jour.</span>
        </p>
        <div className="flex items-center gap-3 mt-4">
          {compteur && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-primary/70 backdrop-blur-sm border border-gold-primary/30 rounded-full">
              <Flame className="w-3.5 h-3.5 text-gold-primary" />
              <span className="text-gold-light text-xs font-semibold">{compteur}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-status-win/20 backdrop-blur-sm border border-status-win/30 rounded-full">
            <Trophy className="w-3.5 h-3.5 text-status-win" />
            <span className="text-status-win text-xs font-semibold">Analyses expertes</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function CtaBlock() {
  return (
    <div className="mt-10 text-center">
      <Link
        href="/pronostics"
        className="inline-flex items-center gap-2 px-8 py-4 bg-gold-primary hover:bg-gold-dark text-bg-primary font-bold text-base rounded-xl transition-all shadow-gold"
      >
        <Star className="w-5 h-5" fill="currentColor" />
        Voir tous les pronostics du jour
      </Link>
      <p className="mt-3 text-text-muted text-xs">
        Paiement par carte bancaire (toutes cartes, tous pays) · Mobile Money bientôt · Accès immédiat
      </p>
    </div>
  );
}
