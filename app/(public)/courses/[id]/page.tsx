import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Metadata } from "next";
import {
  MapPin, Clock, Users, TrendingUp, ArrowLeft,
  Star, CheckCircle2, Lock, ChevronRight,
  Zap, BarChart3, Calendar, ExternalLink,
} from "lucide-react";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { SubscriptionStatus } from "@/types";
import { buildGenyUrl, buildGenyUrlFromStored, fetchGenyPartants } from "@/lib/geny";
import { fetchPmuPartants } from "@/lib/pmu-api";
import CountdownTimer from "@/components/courses/CountdownTimer";
import CourseTabsClient from "@/components/courses/CourseTabsClient";
import { buildSportsEventJsonLd } from "@/lib/seo/sportsevent-jsonld";
import { getCourseStatsEnrichies } from "@/lib/courses/getCourseStatsEnrichies";
import { buildNotreSelection, shouldShowNotreSelectionPromo } from "@/lib/courses/notre-selection";
import { NotreSelectionPromo } from "@/components/courses/NotreSelectionPromo";
import { canAccess } from "@/lib/auth/access";
import { resolveUserSubscription } from "@/lib/auth/subscription";

export const dynamic = "force-dynamic";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://www.elite-turf.fr");

interface PageProps { params: { id: string } }

const TERRAIN_LABELS: Record<string, string> = {
  BON: "Bon", BON_SOUPLE: "Bon souple", SOUPLE: "Souple",
  LOURD: "Lourd", TRES_LOURD: "Très lourd",
};

const CATEGORIE_COLORS: Record<string, string> = {
  PLAT:     "bg-blue-500/10 text-blue-400 border-blue-500/20",
  TROT:     "bg-purple-500/10 text-purple-400 border-purple-500/20",
  OBSTACLE: "bg-orange-500/10 text-orange-400 border-orange-500/20",
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const supabase = createServiceClient();
  const { data: c } = await supabase
    .from("courses")
    .select("libelle, date_course, heure_depart, nb_partants, categorie, distance_metres, statut, hippodrome:hippodromes(nom, pays)")
    .eq("id", params.id)
    .single();
  if (!c) return { title: "Course — Elite Turf" };
  const hippoName = (c.hippodrome as any)?.nom || "";
  const dateFr = c.date_course
    ? new Date(c.date_course + "T12:00:00").toLocaleDateString("fr-FR", {
        day: "numeric", month: "long", year: "numeric",
      })
    : "";

  // ── Boost CTR : meta enrichie avec données chiffrées + signaux d'intent ──
  // Avant : "Programme, partants, cotes et pronostic de la course X à Y le Z."
  //   → générique, pas de chiffres, pas de fraîcheur, CTR ~4%.
  // Après : "🏇 X — Y, 13h55 · 13 partants, cotes live, pronostic Elite Turf."
  //   → emoji visuel SERP + heure départ (intent) + nb partants (curiosité)
  //   + "live" (fraîcheur) + "pronostic Elite Turf" (valeur perçue).
  const heureCourte = c.heure_depart ? c.heure_depart.slice(0, 5) : "";
  const partantsStr = c.nb_partants ? `${c.nb_partants} partants` : "";
  const distanceStr = c.distance_metres ? `${c.distance_metres}m` : "";
  const isTermine   = c.statut === "TERMINE";
  const cotesLabel  = isTermine ? "arrivée officielle" : "cotes live";

  // Titre court (max ~60 chars idéal en SERP). Garde le libellé + hippo + indice.
  const title = isTermine
    ? `🏆 ${c.libelle} — ${hippoName} ${dateFr} : arrivée & rapports`
    : `🏇 ${c.libelle} — ${hippoName} ${heureCourte ? `${heureCourte} ` : ""}| Pronostic Elite Turf`;

  // Description riche (max ~155 chars). Concentre l'info utile au visiteur.
  const description = isTermine
    ? `🏆 Arrivée officielle ${c.libelle} à ${hippoName} le ${dateFr}${partantsStr ? ` · ${partantsStr}` : ""}. Rapports PMU détaillés + pronostic Elite Turf décodé.`
    : `🏇 ${c.libelle} à ${hippoName}${heureCourte ? ` à ${heureCourte}` : ""}${partantsStr ? ` · ${partantsStr}` : ""}${distanceStr ? `, ${distanceStr}` : ""} · ${cotesLabel}, musique des chevaux, pronostic Elite Turf gratuit.`;

  return {
    title,
    description,
    alternates: { canonical: `${APP_URL}/courses/${params.id}` },
  };
}

// canAccess() : source unique dans "@/lib/auth/access" (importée en tête).

export default async function CourseDetailPage({ params }: PageProps) {
  // ── Auth ─────────────────────────────────────────────────────────────────
  const supabaseClient = await createClient();
  const { data: { user } } = await supabaseClient.auth.getUser();
  let userSubscription: SubscriptionStatus = "GRATUIT";
  if (user) {
    userSubscription = (await resolveUserSubscription(createServiceClient(), user.id)) as SubscriptionStatus;
  }

  // ── Données ───────────────────────────────────────────────────────────────
  const supabase = createServiceClient();
  const { data: course } = await supabase
    .from("courses")
    .select(`
      id, numero_reunion, numero_course, libelle,
      date_course, heure_depart, distance_metres,
      categorie, terrain, nb_partants, statut, arrivee_officielle,
      geny_url,
      hippodrome:hippodromes(nom, pays, ville),
      partants(
        id, numero, nom_cheval, jockey, entraineur,
        cote, musique, poids_kg, non_partant
      ),
      pronostics(
        id, niveau_acces, type_pari, selection,
        confiance, analyse_courte, publie
      )
    `)
    .eq("id", params.id)
    .single();

  if (!course) notFound();

  const c = course as any;

  // ── Fallback Geny : si aucun partant en DB, on scrape Geny à la volée ───────
  // Le cron enrichir-partants gère PMU (09:27 + 11:47 UTC).
  // Si les partants ne sont pas en DB c'est que PMU a échoué (HTTP 420) →
  // on va directement sur Geny qui est publiquement accessible sans rate-limit.
  // On essaie uniquement pour les courses d'aujourd'hui non terminées.
  const todayISO = new Date().toISOString().split("T")[0];
  if (
    (!c.partants || c.partants.length === 0) &&
    c.date_course === todayISO &&
    c.statut !== "TERMINE" &&
    c.numero_reunion &&
    c.numero_course
  ) {
    try {
      console.log(`[CourseDetail] Fallback Geny pour R${c.numero_reunion}C${c.numero_course} url=${c.geny_url ?? "non-stockée"}`);

      // Geny en source principale — on passe l'URL réelle stockée en DB (obligatoire
      // car l'URL Geny contient un slug + ID interne qu'on ne peut pas reconstruire).
      const genyPartants = await fetchGenyPartants(
        c.date_course,
        c.numero_reunion,
        c.numero_course,
        6000,
        c.geny_url ?? null,
      );

      if (genyPartants.length > 0) {
        const toInsert = genyPartants
          .filter((g) => !g.nom?.toUpperCase().includes("NON_PARTANT"))
          .map((g) => ({
            course_id:   c.id,
            numero:      g.numPmu,
            nom_cheval:  g.nom,
            jockey:      g.jockey?.nom ?? null,
            entraineur:  g.entraineur?.nom ?? null,
            cote:        g.coteProbable ?? null,
            musique:     g.musique ?? null,
            poids_kg:    g.poids ?? null,
            place_corde: g.placeCorde ?? null,
            age:         g.age ?? null,
            sexe:        g.sexe ?? null,
            non_partant: g.nonPartant ?? false,
            scraped_at:  new Date().toISOString(),
          }));
        // Persister en DB pour les prochaines visites
        const supabaseSvc = createServiceClient();
        await supabaseSvc.from("partants").delete().eq("course_id", c.id);
        const { error: insErr } = await supabaseSvc.from("partants").insert(toInsert);
        if (!insErr) {
          c.partants = toInsert.map((g, i) => ({ ...g, id: `tmp-${i}` }));
        }
      } else {
        // Geny vide → tentative PMU rapide (1 seul endpoint, timeout court)
        console.log(`[CourseDetail] Geny vide — tentative PMU rapide`);
        const dateStr = c.date_course.replace(/-/g, "");
        const pmuPartants = await fetchPmuPartants(dateStr, c.numero_reunion, c.numero_course);
        if (pmuPartants.length > 0) {
          const toInsert = pmuPartants
            .filter((p) => !p.nom?.toUpperCase().includes("NON_PARTANT"))
            .map((p) => ({
              course_id:   c.id,
              numero:      p.numPmu,
              nom_cheval:  p.nom,
              jockey:      p.jockey?.nom ?? null,
              entraineur:  p.entraineur?.nom ?? null,
              cote:        (p as any).coteDefinitive ?? p.coteProbable ?? (p as any).dernierRapportDirect?.rapport ?? null,
              musique:     p.musique ?? null,
              poids_kg:    (p as any).handicapPoids ?? p.poids ?? null,
              place_corde: p.placeCorde ?? null,
              age:         p.age ?? null,
              sexe:        p.sexe ?? null,
              non_partant: false,
              scraped_at:  new Date().toISOString(),
            }));
          const supabaseSvc = createServiceClient();
          await supabaseSvc.from("partants").delete().eq("course_id", c.id);
          const { error: insErr } = await supabaseSvc.from("partants").insert(toInsert);
          if (!insErr) {
            c.partants = toInsert.map((p, i) => ({ ...p, id: `tmp-${i}` }));
          }
        }
      }
    } catch (err) {
      console.error(`[CourseDetail] Erreur fallback partants:`, err instanceof Error ? err.message : err);
    }
  }

  const refCourse      = `R${c.numero_reunion}C${c.numero_course}`;
  const pronosticPublie = c.pronostics?.find((p: any) => p.publie);
  const allPartants: any[] = (c.partants || []).sort((a: any, b: any) => a.numero - b.numero);
  const partants:    any[] = allPartants.filter((p: any) => !p.non_partant);
  const nonPartants: any[] = allPartants.filter((p: any) =>  p.non_partant);

  // ── Stats enrichies (croisement avec tables chevaux/jockeys/entraineurs) ──
  // 3 queries Supabase parallèles via .in("slug", [...]). Coût ~50-150ms.
  // Si une entité n'est pas encore en BDD (course très récente, cron pas passé),
  // la UI handle gracefully avec un fallback "Données en cours de constitution".
  const statsEnrichies = await getCourseStatsEnrichies(partants);
  // « Notre sélection » : top 8 stats (favoris + drivers/entraîneurs reconnus
  // + forme), déterministe, calculée serveur depuis les partants enrichis.
  const notreSelection = buildNotreSelection(statsEnrichies.partants);
  const isSubscribed = ["STARTER", "PRO", "ELITE"].includes(userSubscription);
  // Anti-cannibalisation : si le visiteur a accès au pronostic premium publié
  // de cette course, on lui masque la « Notre sélection » gratuite (clone du
  // produit payé). Visible pour tous ailleurs.
  const viewerHasAccessiblePremiumPronostic =
    !!pronosticPublie &&
    pronosticPublie.niveau_acces !== "GRATUIT" &&
    canAccess(pronosticPublie.niveau_acces, userSubscription);

  // Construire le lien Geny : utiliser l'URL réelle stockée si disponible,
  // sinon fallback sur la page programme du jour.
  const genyType = c.statut === "TERMINE" ? "resultats" : "partants";
  const genyUrl = c.geny_url
    ? buildGenyUrlFromStored(c.geny_url, genyType)
    : buildGenyUrl(c.date_course, c.numero_reunion, c.numero_course, genyType);

  const dateStr   = c.date_course.replace(/-/g, "");
  const isFrance  = !c.hippodrome?.pays || c.hippodrome.pays === "France";
  const hippoSlug = (c.hippodrome?.nom || "").toUpperCase().replace(/\s+/g, "-").replace(/[^A-Z0-9-]/g, "");
  const pmuUrl    = isFrance
    ? `https://www.pmu.fr/turf/${dateStr}/${hippoSlug}/R${c.numero_reunion}/C${c.numero_course}`
    : null;

  // Déterminer si on doit afficher le countdown (avant le départ)
  const isUpcoming = c.statut === "PROGRAMME" || c.statut === "EN_COURS";

  // ── JSON-LD SportsEvent (helper centralisé) + BreadcrumbList ─────────────
  // Helper assure tous les champs recommandés Google : endDate, image,
  // performer, organizer, description, eventStatus, eventAttendanceMode.
  const sportsEventJsonLd = buildSportsEventJsonLd(c);
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil",   item: APP_URL },
      { "@type": "ListItem", position: 2, name: "Courses",   item: `${APP_URL}/courses` },
      { "@type": "ListItem", position: 3, name: c.libelle,    item: `${APP_URL}/courses/${c.id}` },
    ],
  };

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* JSON-LD — SportsEvent + Breadcrumb pour Google */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(sportsEventJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      {/* Hero */}
      <div className="relative overflow-hidden h-36 sm:h-48">
        <Image
          src="/images/heroes/hero-courses.jpg"
          alt="Course hippique"
          fill
          sizes="100vw"
          priority
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-bg-primary/75" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-bg-primary" />
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 -mt-8 relative z-10 pb-16">
        {/* Retour */}
        <Link
          href={`/courses?date=${c.date_course}`}
          className="inline-flex items-center gap-1.5 text-text-secondary hover:text-gold-light text-sm font-medium transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Programme du{" "}
          {new Date(c.date_course + "T12:00:00").toLocaleDateString("fr-FR", {
            day: "numeric", month: "long",
          })}
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── Colonne principale ── */}
          <div className="lg:col-span-2 space-y-6">

            {/* ── Fiche course ── */}
            <div className="card-base overflow-hidden">
              {/* Barre de statut */}
              <div className={`h-1 w-full ${
                c.statut === "EN_COURS" ? "bg-status-win" :
                c.statut === "TERMINE"  ? "bg-text-muted" :
                "bg-gradient-to-r from-gold-primary to-gold-light"
              }`} />

              <div className="p-6">
                {/* Badges + liens externes */}
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <span className="text-xs px-2.5 py-1 rounded bg-bg-elevated border border-border text-text-muted font-mono">
                    {refCourse}
                  </span>
                  <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${CATEGORIE_COLORS[c.categorie] || ""}`}>
                    {c.categorie}
                  </span>

                  {c.statut === "EN_COURS" && (
                    <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-bold bg-status-win/10 text-status-win border border-status-win/30">
                      <span className="w-1.5 h-1.5 rounded-full bg-status-win animate-pulse" />
                      EN COURS
                    </span>
                  )}
                  {c.statut === "TERMINE" && (
                    <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-bold bg-bg-elevated text-text-muted border border-border">
                      <CheckCircle2 className="w-3 h-3" /> Terminé
                    </span>
                  )}

                  {/* Liens externes */}
                  <div className="ml-auto flex items-center gap-2">
                    {pmuUrl && (
                      <a
                        href={pmuUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-[#003189]/10 hover:bg-[#003189]/20 text-[#4A7FD4] border border-[#003189]/20 transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" /> PMU.fr
                      </a>
                    )}
                    <a
                      href={genyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-gold-faint hover:bg-gold-faint/80 text-gold-light border border-gold-primary/20 transition-colors"
                    >
                      <ExternalLink className="w-3 h-3" /> Geny
                    </a>
                  </div>
                </div>

                {/* Titre */}
                <h1 className="font-serif text-xl sm:text-2xl font-bold text-text-primary mb-5">
                  {c.libelle}
                </h1>

                {/* Countdown banner (avant le départ) */}
                {isUpcoming && c.date_course && c.heure_depart && (
                  <div className="mb-5 p-3 rounded-xl bg-bg-elevated border border-gold-primary/20 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-text-muted text-xs mb-0.5">Départ dans</p>
                      <CountdownTimer
                        dateCourse={c.date_course}
                        heureDepart={c.heure_depart}
                      />
                    </div>
                    <div className="text-right">
                      <p className="text-text-muted text-xs mb-0.5">Heure prévue</p>
                      <p className="text-gold-light font-mono font-semibold text-sm">
                        {c.heure_depart?.slice(0, 5)} UTC
                      </p>
                    </div>
                  </div>
                )}

                {/* Grille d'infos */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { icon: MapPin,     label: "Hippodrome", value: c.hippodrome?.nom,         sub: c.hippodrome?.pays },
                    { icon: Clock,      label: "Départ",     value: c.heure_depart?.slice(0,5), sub: c.date_course, gold: true },
                    { icon: TrendingUp, label: "Distance",   value: `${c.distance_metres}m`,   sub: TERRAIN_LABELS[c.terrain] || c.terrain },
                    { icon: Users,      label: "Partants",   value: `${partants.length || c.nb_partants}`, sub: `${c.nb_partants} engagés` },
                  ].map((item, i) => (
                    <div key={i} className="p-3 bg-bg-elevated rounded-xl border border-border/50">
                      <item.icon className="w-4 h-4 text-gold-primary mb-1.5" />
                      <p className="text-text-muted text-xs mb-0.5">{item.label}</p>
                      <p className={`font-semibold text-sm ${item.gold ? "text-gold-light" : "text-text-primary"}`}>
                        {item.value || "—"}
                      </p>
                      {item.sub && <p className="text-text-muted text-xs mt-0.5">{item.sub}</p>}
                    </div>
                  ))}
                </div>

                {/* Arrivée officielle (résumé rapide si TERMINÉ) */}
                {c.statut === "TERMINE" && c.arrivee_officielle?.length > 0 && (
                  <div className="mt-4 p-4 bg-status-win/5 border border-status-win/20 rounded-xl">
                    <p className="text-status-win text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Arrivée officielle
                    </p>
                    <div className="flex items-center gap-3 flex-wrap">
                      {c.arrivee_officielle.map((n: number, idx: number) => {
                        const horse = allPartants.find((p: any) => p.numero === n);
                        return (
                          <div key={idx} className="flex flex-col items-center gap-1">
                            <span className="w-10 h-10 rounded-full border-2 border-status-win/40 bg-status-win/10 flex items-center justify-center text-status-win font-bold text-sm">
                              {n}
                            </span>
                            <span className="text-text-muted text-[10px]">
                              {idx === 0 ? "1er" : idx === 1 ? "2e" : idx === 2 ? "3e" : `${idx+1}e`}
                            </span>
                            {horse && (
                              <span className="text-text-secondary text-[9px] max-w-[60px] text-center leading-tight">
                                {horse.nom_cheval}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {shouldShowNotreSelectionPromo(notreSelection) && !viewerHasAccessiblePremiumPronostic && (
              <NotreSelectionPromo items={notreSelection} variant="banner" />
            )}

            {/* ── Onglets : Partants / Côtes / Arrivées & Rapports / Statistiques ── */}
            <CourseTabsClient
              courseId={c.id}
              partants={partants}
              nonPartants={nonPartants}
              arriveeOfficielle={c.arrivee_officielle}
              pronosticSelection={pronosticPublie && canAccess(pronosticPublie.niveau_acces, userSubscription) ? pronosticPublie.selection : null}
              statut={c.statut}
              genyUrl={genyUrl}
              isVedette={!!pronosticPublie}
              isSubscribed={isSubscribed}
              statsEnrichies={statsEnrichies}
              hasPublishedPronostic={!!pronosticPublie}
              notreSelection={notreSelection}
              hideNotreSelection={viewerHasAccessiblePremiumPronostic}
            />

          </div>

          {/* ── Sidebar : Pronostic ── */}
          <div className="space-y-4">
            {pronosticPublie ? (
              <div className="card-base overflow-hidden">
                <div className="h-1 bg-gradient-to-r from-gold-primary to-gold-light" />
                <div className="p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Star className="w-4 h-4 text-gold-primary" fill="currentColor" />
                    <h3 className="font-serif font-semibold text-text-primary text-sm">
                      Pronostic Expert
                    </h3>
                    <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-semibold border ${
                      pronosticPublie.niveau_acces === "GRATUIT"
                        ? "bg-status-win/10 text-status-win border-status-win/20"
                        : "bg-gold-faint text-gold-light border-gold-primary/30"
                    }`}>
                      {pronosticPublie.niveau_acces}
                    </span>
                  </div>

                  {canAccess(pronosticPublie.niveau_acces, userSubscription) ? (
                    <>
                      <div className="mb-3">
                        <span className="text-text-muted text-xs block mb-2">Sélection :</span>
                        <div className="flex flex-col gap-1.5">
                          {pronosticPublie.selection?.map((n: number, idx: number) => {
                            const horse = allPartants.find((p: any) => p.numero === n);
                            return (
                              <div key={n} className="flex items-center gap-2">
                                <span className="w-7 h-7 rounded-full bg-gold-faint border border-gold-primary/40 flex items-center justify-center text-gold-light font-bold text-xs flex-shrink-0">
                                  {n}
                                </span>
                                {horse ? (
                                  <span className="text-text-secondary text-xs font-medium">{horse.nom_cheval}</span>
                                ) : (
                                  <span className="text-text-muted text-xs">
                                    {idx === 0 ? "1er choix" : idx === 1 ? "2e choix" : `${idx+1}e choix`}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      <p className="text-text-secondary text-xs leading-relaxed italic mb-4">
                        &ldquo;{pronosticPublie.analyse_courte}&rdquo;
                      </p>
                      <Link
                        href={`/pronostics/${pronosticPublie.id}`}
                        className="flex items-center justify-center gap-1.5 w-full py-2.5 bg-gold-primary hover:bg-gold-dark text-bg-primary font-bold text-xs rounded-xl transition-all shadow-gold-sm"
                      >
                        Analyse complète <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-text-muted text-xs">Sélection :</span>
                        <div className="flex gap-1.5">
                          {pronosticPublie.selection?.slice(0, 3).map((_: number, i: number) => (
                            <span key={i} className="w-8 h-8 rounded-full bg-bg-elevated border border-border flex items-center justify-center text-text-muted text-sm paywall-blur">?</span>
                          ))}
                          <Lock className="w-4 h-4 text-gold-primary" />
                        </div>
                      </div>
                      <Link
                        href="/abonnements"
                        className="flex items-center justify-center gap-1.5 w-full py-2.5 bg-gold-primary hover:bg-gold-dark text-bg-primary font-bold text-xs rounded-xl transition-all shadow-gold-sm"
                      >
                        <Zap className="w-3.5 h-3.5" fill="currentColor" />
                        Débloquer l&apos;analyse
                      </Link>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="card-base p-5 text-center">
                <Star className="w-8 h-8 text-text-muted mx-auto mb-3" />
                <p className="text-text-secondary text-sm font-medium mb-1">Pronostic en préparation</p>
                <p className="text-text-muted text-xs">Publié avant le départ de la course</p>
              </div>
            )}

            {/* Navigation */}
            <Link
              href={`/courses?date=${c.date_course}`}
              className="flex items-center justify-center gap-2 w-full py-3 bg-bg-elevated hover:bg-bg-hover border border-border hover:border-gold-primary/30 rounded-xl text-text-secondary hover:text-text-primary text-sm font-medium transition-all"
            >
              <Calendar className="w-4 h-4" />
              Tout le programme du jour
            </Link>
            <Link
              href="/pronostics"
              className="flex items-center justify-center gap-2 w-full py-3 bg-bg-elevated hover:bg-bg-hover border border-border hover:border-gold-primary/30 rounded-xl text-text-secondary hover:text-text-primary text-sm font-medium transition-all"
            >
              <Star className="w-4 h-4" />
              Tous les pronostics
            </Link>

            {shouldShowNotreSelectionPromo(notreSelection) && !viewerHasAccessiblePremiumPronostic && (
              <NotreSelectionPromo items={notreSelection} variant="sidebar" />
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
