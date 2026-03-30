import Link from "next/link";
import {
  Lock, Star, ChevronRight, Eye, Trophy, Flame,
  MapPin, Clock, TrendingUp, Zap, Globe2,
} from "lucide-react";
import { createServiceClient } from "@/lib/supabase/server";
import { isJouableAfrique, getNationaleLabel } from "@/lib/pmu-api";

/** Retourne 1 si Nationale 1, 2 si Nat2, 3 si Nat3, 0 sinon */
function getNatNum(paris: string[]): number {
  if (paris.includes("QUINTE_PLUS") || paris.includes("QUINTE")) return 1;
  if (paris.includes("QUARTE_PLUS") || paris.includes("QUARTE")) return 2;
  if (paris.includes("TIERCE")) return 3;
  return 0;
}

export default async function PronosticsSection() {
  const supabase = createServiceClient();
  const today    = new Date().toISOString().split("T")[0];
  const weekAgo  = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];

  // ── 1. Pronostics du JOUR publiés, sans filtre de marché
  //        (= tous les pronostics publiés aujourd'hui, triés par confiance desc)
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

  // Fallback : si aucun pronostic aujourd'hui → derniers 7 jours
  let rawProno = todayPronoRaw || [];
  if (rawProno.length === 0) {
    const { data: recentProno } = await supabase
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
      .gte("date_publication", weekAgo)
      .order("date_publication", { ascending: false })
      .order("confiance",        { ascending: false })
      .limit(6);
    rawProno = recentProno || [];
  }

  const displayList = rawProno.slice(0, 3);

  // Vedette = Quinté+ en priorité, sinon Quarté+, sinon Tiercé, sinon premier
  const vedetteProno: any =
    displayList.find((p: any) => getNatNum(Array.isArray((p.course as any)?.paris_disponibles) ? (p.course as any).paris_disponibles : []) === 1) ||
    displayList.find((p: any) => getNatNum(Array.isArray((p.course as any)?.paris_disponibles) ? (p.course as any).paris_disponibles : []) === 2) ||
    displayList[0] ||
    null;

  // ── 2. Si aucun pronostic publié → courses du jour comme placeholder ──
  let placeholderCourses: any[] = [];
  if (!vedetteProno) {
    const { data: todayCourses } = await supabase
      .from("courses")
      .select(`
        id, libelle, heure_depart, numero_reunion, numero_course,
        paris_disponibles,
        hippodrome:hippodromes(nom)
      `)
      .eq("date_course", today)
      .order("heure_depart", { ascending: true })
      .limit(6);

    placeholderCourses = ((todayCourses || []) as any[]).slice(0, 3);
  }

  // ── CASE A : Aucune donnée du tout ─────────────────────────────────
  if (!vedetteProno && !placeholderCourses.length) {
    return (
      <section className="py-16 sm:py-20 bg-bg-card/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center py-10">
          <Globe2 className="w-10 h-10 text-gold-primary mx-auto mb-4 opacity-60" />
          <h2 className="font-serif text-2xl font-bold text-text-primary mb-2">Pronostics du Jour</h2>
          <p className="text-text-secondary text-sm max-w-md mx-auto">
            Les pronostics du marché africain seront disponibles dès 8h00 (heure de Paris).
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
  if (!vedetteProno && placeholderCourses.length > 0) {
    const nat1Course: any = placeholderCourses.find((c: any) =>
      getNatNum(c.paris_disponibles || []) === 1
    ) || placeholderCourses[0];

    return (
      <section className="py-16 sm:py-20 bg-bg-card/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Vedette "à venir" */}
          <div className="relative rounded-2xl overflow-hidden mb-10 border border-gold-primary/40 bg-gradient-to-br from-bg-card via-[#1A1610] to-bg-card shadow-gold">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold-primary to-transparent" />
            <div className="relative z-10 p-6 sm:p-8">
              <div className="flex flex-wrap items-center gap-3 mb-5">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-gold-primary text-bg-primary rounded-full font-bold text-xs uppercase tracking-widest shadow-gold">
                  <Zap className="w-3.5 h-3.5" fill="currentColor" />
                  Vedette du Jour
                </div>
                <span className="text-xs px-2.5 py-1 rounded-full bg-bg-elevated border border-border text-text-secondary font-medium">
                  {getNationaleLabel(nat1Course.paris_disponibles || []) || nat1Course.paris_disponibles?.[0]}
                </span>
              </div>
              <p className="font-serif text-xl font-bold text-text-primary mb-1">{nat1Course.libelle}</p>
              <div className="flex items-center gap-4 text-sm text-text-secondary mb-6">
                <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-gold-primary" />{nat1Course.hippodrome?.nom}</span>
                <span className="flex items-center gap-1.5 text-gold-light font-semibold"><Clock className="w-3.5 h-3.5" />{(nat1Course.heure_depart || "").substring(0, 5)}</span>
              </div>
              <Link href="/pronostics" className="inline-flex items-center gap-2 px-5 py-2.5 bg-gold-primary hover:bg-gold-dark text-bg-primary font-bold text-sm rounded-xl transition-all shadow-gold">
                <Trophy className="w-4 h-4" />
                Pronostic disponible bientôt — S&apos;abonner
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold-primary/50 to-transparent" />
          </div>

          {/* Bannière */}
          <BannerImage count={placeholderCourses.length} />

          {/* Liste des courses du jour */}
          <div className="flex items-center justify-between mb-6">
            <p className="text-text-secondary text-sm">Courses disponibles aujourd&apos;hui</p>
            <Link href="/pronostics" className="hidden sm:flex items-center gap-1 text-gold-primary hover:text-gold-light text-sm font-medium transition-colors">
              Tous les pronostics <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="space-y-4">
            {placeholderCourses.map((c: any) => (
              <div key={c.id} className="card-base p-5 relative overflow-hidden">
                <div className="absolute inset-0 shimmer-bg pointer-events-none" />
                <div className="relative z-10 flex items-center justify-between">
                  <div>
                    <p className="text-text-secondary text-sm font-medium mb-1">
                      📍 R{c.numero_reunion}C{c.numero_course} — {c.libelle} — {c.hippodrome?.nom}
                    </p>
                    <p className="text-gold-light text-sm font-semibold">{(c.heure_depart || "").substring(0, 5)}</p>
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

  return (
    <section className="py-16 sm:py-20 bg-bg-card/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* ── CARTE VEDETTE DU JOUR ── */}
        <div className="relative rounded-2xl overflow-hidden mb-10 border border-gold-primary/40 bg-gradient-to-br from-bg-card via-[#1A1610] to-bg-card shadow-gold">
          <div className="absolute inset-0 z-0">
            <img
              src="/images/heroes/hero-a-propos.jpg"
              alt="Cheval vedette"
              className="w-full h-full object-cover opacity-20"
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
                {getNationaleLabel(vCourse?.paris_disponibles || []) || vedette.type_pari}
              </span>
            </div>

            <div className="sm:flex sm:items-start sm:gap-8">
              {/* Sélection principale */}
              <div className="flex items-center gap-4 mb-5 sm:mb-0 sm:flex-shrink-0">
                {vedette.selection && vedette.selection.length > 0 && (
                  <div className="w-16 h-16 rounded-2xl bg-gold-faint border-2 border-gold-primary/60 flex flex-col items-center justify-center shadow-gold">
                    <span className="text-xs text-gold-light/70 uppercase tracking-wider leading-none mb-0.5">N°</span>
                    <span className="text-3xl font-bold font-serif text-gold-primary leading-none">
                      {Array.isArray(vedette.selection) ? vedette.selection[0] : vedette.selection}
                    </span>
                  </div>
                )}
                <div>
                  <h3 className="font-serif text-xl sm:text-2xl font-bold text-text-primary leading-tight">
                    {vCourse?.libelle || "Course du jour"}
                  </h3>
                  <div className="flex items-center gap-0.5 mt-1">
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
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-4 mb-4 text-sm">
                  <div className="flex items-center gap-1.5 text-text-secondary">
                    <MapPin className="w-3.5 h-3.5 text-gold-primary flex-shrink-0" />
                    {vCourse?.hippodrome?.nom} — R{vCourse?.numero_reunion}C{vCourse?.numero_course}
                  </div>
                  <div className="flex items-center gap-1.5 text-gold-light font-semibold">
                    <Clock className="w-3.5 h-3.5" />
                    {(vCourse?.heure_depart || "").substring(0, 5)}
                  </div>
                </div>

                {vedette.analyse_courte && (
                  <p className="text-text-secondary text-sm leading-relaxed mb-5 italic border-l-2 border-gold-primary/40 pl-3">
                    &ldquo;{vedette.analyse_courte}&rdquo;
                  </p>
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

        {/* Bannière visuelle */}
        <BannerImage count={displayList.length} />

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
            const isLocked = p.niveau_acces !== "GRATUIT";
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
                      {!isLocked ? "GRATUIT" : "★ PREMIUM"}
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
                  <p className="text-text-secondary text-sm mb-3 font-medium">
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
                      <p className="text-text-secondary text-sm leading-relaxed mb-4">
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

function BannerImage({ count }: { count: number }) {
  return (
    <div className="relative rounded-2xl overflow-hidden mb-12">
      <img
        src="/images/heroes/hero-legal.jpg"
        alt="Chevaux au galop"
        className="w-full h-48 object-cover rounded-xl"
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
          <span className="text-gold-light">73% de réussite ce mois.</span>
        </p>
        <div className="flex items-center gap-3 mt-4">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-primary/70 backdrop-blur-sm border border-gold-primary/30 rounded-full">
            <Flame className="w-3.5 h-3.5 text-gold-primary" />
            <span className="text-gold-light text-xs font-semibold">{count} pronostic{count > 1 ? "s" : ""} ce jour</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-status-win/20 backdrop-blur-sm border border-status-win/30 rounded-full">
            <Trophy className="w-3.5 h-3.5 text-status-win" />
            <span className="text-status-win text-xs font-semibold">Experts Paris</span>
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
        href="/abonnements"
        className="inline-flex items-center gap-2 px-8 py-4 bg-gold-primary hover:bg-gold-dark text-bg-primary font-bold text-base rounded-xl transition-all shadow-gold"
      >
        <Star className="w-5 h-5" fill="currentColor" />
        Accéder à tous les pronostics Premium
      </Link>
      <p className="mt-3 text-text-muted text-xs">
        Paiement par Orange Money · MTN MoMo · Wave · Accès immédiat
      </p>
    </div>
  );
}
