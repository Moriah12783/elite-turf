import { Suspense } from "react";
import { Metadata } from "next";
import { Star, TrendingUp, Trophy, Flame, AlertCircle, CalendarDays, History } from "lucide-react";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { SubscriptionStatus } from "@/types";
import PronosticCard from "@/components/pronostics/PronosticCard";
import PronosticsFilters from "@/components/pronostics/PronosticsFilters";
import PaywallBanner from "@/components/pronostics/PaywallBanner";
import PageHero from "@/components/layout/PageHero";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://elite-turf.fr";

export const metadata: Metadata = {
  title: "Pronostics du Jour — Elite Turf",
  description:
    "Pronostics Tiercé, Quarté+, Quinté+ par nos experts. Analyses hippiques pour la Côte d'Ivoire et les parieurs francophones. Résultats vérifiables sur Geny.",
  alternates: { canonical: `${APP_URL}/pronostics` },
};

// Force dynamic rendering (user session + search params)
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: {
    type?: string;
    niveau?: string;
    periode?: string;
    hippodrome?: string;
  };
}

export default async function PronosticsPage({ searchParams }: PageProps) {
  // ── 1. Session utilisateur ──────────────────────────────────────────
  const supabaseClient = await createClient();
  const {
    data: { user },
  } = await supabaseClient.auth.getUser();

  let userSubscription: SubscriptionStatus = "GRATUIT";
  if (user) {
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("statut_abonnement")
      .eq("id", user.id)
      .single();
    if (profile) userSubscription = profile.statut_abonnement as SubscriptionStatus;
  }

  // ── 2. Dates de référence ──────────────────────────────────────────
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr  = today.toISOString().split("T")[0];
  const d30 = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
  const dateFrom30 = d30.toISOString().split("T")[0];

  // ── 3. Requête Supabase — 30 derniers jours publiés ────────────────
  const supabase = createServiceClient();

  let query = supabase
    .from("pronostics")
    .select(
      `
      id, niveau_acces, type_pari, selection, confiance,
      analyse_courte, analyse_texte, resultat, nb_vues, nb_likes,
      publie, date_publication,
      course:courses(
        id, libelle, date_course, heure_depart,
        distance_metres, categorie, terrain, nb_partants,
        paris_disponibles,
        hippodrome:hippodromes(nom, pays)
      )
    `
    )
    .eq("publie", true)
    .gte("date_publication", dateFrom30)
    .order("date_publication", { ascending: false });

  if (searchParams.type)    query = query.eq("type_pari",    searchParams.type);
  if (searchParams.niveau)  query = query.eq("niveau_acces", searchParams.niveau);

  const { data: allPronostics } = await query.limit(100);

  // ── 4. Séparer aujourd'hui / historique avec résultat ─────────────
  // Les pronostics "périmés" (EN_ATTENTE passé) sont cachés du fil principal
  const allFiltered = (allPronostics || []).filter((p: any) => {
    if (searchParams.hippodrome && p.course?.hippodrome?.nom !== searchParams.hippodrome) return false;
    return true;
  });

  // Aujourd'hui uniquement
  const pronosticsAujourdhui = allFiltered.filter(
    (p: any) => p.course?.date_course === todayStr
  );

  // Historique : seulement ceux avec un résultat réel (pas EN_ATTENTE périmé)
  const pronosticsHistorique = allFiltered.filter(
    (p: any) =>
      p.course?.date_course < todayStr &&
      p.resultat !== "EN_ATTENTE"
  );

  // Vue filtrée (quand période explicite) : tout sauf les périmés
  let dateFrom = todayStr;
  if (searchParams.periode === "mois") {
    dateFrom = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split("T")[0];
  } else if (searchParams.periode === "semaine") {
    const mon = new Date(today); mon.setDate(today.getDate() - today.getDay() + 1);
    dateFrom = mon.toISOString().split("T")[0];
  } else if (searchParams.periode === "30_jours") {
    dateFrom = dateFrom30;
  }

  // Mode "filtre actif" : afficher avec période choisie, toujours exclure périmés
  const periodeActive = !!(searchParams.periode || searchParams.type || searchParams.niveau || searchParams.hippodrome);
  const pronosticsFiltre = periodeActive
    ? allFiltered.filter((p: any) => {
        const isStale = p.resultat === "EN_ATTENTE" && p.course?.date_course < todayStr;
        return !isStale && (!searchParams.periode || (p.course?.date_course ?? "") >= dateFrom);
      })
    : [];

  // Pronostics à afficher dans la liste principale (mode filtre uniquement)
  const pronostics = periodeActive ? pronosticsFiltre : [];

  // ── 4. Stats rapides ───────────────────────────────────────────────
  const { data: statsData } = await supabase
    .from("pronostics")
    .select("resultat")
    .eq("publie", true)
    .neq("resultat", "EN_ATTENTE");

  const totalTermines = statsData?.length || 0;
  const totalGagnants = statsData?.filter((p: any) => p.resultat === "GAGNANT").length || 0;
  const tauxReussite = totalTermines > 0 ? Math.round((totalGagnants / totalTermines) * 100) : 0;

  // ── 5. Hippodromes pour le filtre ──────────────────────────────────
  const { data: hippodromes } = await supabase
    .from("hippodromes")
    .select("nom")
    .eq("actif", true)
    .order("nom");

  // ── 6. Compter PREMIUM/VIP pour le bandeau CTA ────────────────────
  const lockedCount = pronostics.filter(
    (p: any) => !canAccess(p.niveau_acces, userSubscription)
  ).length;

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* ── HERO BANNER ──────────────────────────────────────────────── */}
      <PageHero
        image="/images/heroes/hero-pronostics.jpg"
        titre="Pronostics du Jour"
        sousTitre={`Tiercé, Quarté+, Quinté+ — ${tauxReussite}% de réussite sur ${totalTermines} pronostics publiés`}
      />

      {/* ── CONTENT ──────────────────────────────────────────────────── */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Bandeau upgrade si contenu bloqué */}
        {lockedCount > 0 && userSubscription === "GRATUIT" && (
          <div className="mb-6 p-4 rounded-xl bg-gold-faint border border-gold-primary/30 flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <AlertCircle className="w-5 h-5 text-gold-primary flex-shrink-0 mt-0.5 sm:mt-0" />
            <p className="text-text-secondary text-sm flex-1">
              <span className="text-gold-light font-semibold">{lockedCount} pronostic{lockedCount > 1 ? "s" : ""} Premium</span>{" "}
              masqués. Abonnez-vous à partir de{" "}
              <span className="text-gold-light font-semibold">65€</span> pour tout voir.
            </p>
            <a
              href="/abonnements"
              className="px-4 py-2 bg-gold-primary hover:bg-gold-dark text-bg-primary font-bold text-xs rounded-lg transition-colors whitespace-nowrap shadow-gold-sm"
            >
              Voir les offres →
            </a>
          </div>
        )}

        {/* Filters */}
        <div className="mb-6">
          <Suspense fallback={<div className="h-10 bg-bg-elevated rounded-xl animate-pulse" />}>
            <PronosticsFilters
              hippodromes={hippodromes || []}
              totalCount={periodeActive ? pronostics.length : pronosticsAujourdhui.length + pronosticsHistorique.length}
            />
          </Suspense>
        </div>

        {periodeActive ? (
          /* ── Mode filtre actif ── */
          pronostics.length > 0 ? (
            <div className="space-y-4">
              {pronostics.map((p: any) => (
                <PronosticCard key={p.id} pronostic={p} userSubscription={userSubscription} />
              ))}
            </div>
          ) : (
            <EmptyState periode={searchParams.periode} />
          )
        ) : (
          /* ── Vue par défaut : 2 sections propres ── */
          <>
            {/* Section 1 : Aujourd'hui */}
            <div className="mb-10">
              <div className="flex items-center gap-2 mb-4">
                <CalendarDays className="w-4 h-4 text-gold-primary" />
                <h2 className="font-serif font-semibold text-text-primary text-base">
                  Sélections du jour
                </h2>
                <span className="ml-auto text-xs text-text-muted">
                  {pronosticsAujourdhui.length} pronostic{pronosticsAujourdhui.length !== 1 ? "s" : ""}
                </span>
              </div>
              {pronosticsAujourdhui.length > 0 ? (
                <div className="space-y-4">
                  {pronosticsAujourdhui.map((p: any) => (
                    <PronosticCard key={p.id} pronostic={p} userSubscription={userSubscription} />
                  ))}
                </div>
              ) : (
                <div className="card-base p-8 text-center text-text-muted text-sm">
                  <Star className="w-8 h-8 mx-auto mb-3 text-text-muted/40" />
                  Nos sélections du jour seront publiées avant 8h00.
                </div>
              )}
            </div>

            {/* Section 2 : Résultats récents */}
            {pronosticsHistorique.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <History className="w-4 h-4 text-text-muted" />
                  <h2 className="font-serif font-semibold text-text-secondary text-base">
                    Résultats récents
                  </h2>
                  <span className="ml-auto text-xs text-text-muted">
                    30 derniers jours
                  </span>
                </div>
                <div className="space-y-4">
                  {pronosticsHistorique.slice(0, 10).map((p: any) => (
                    <PronosticCard key={p.id} pronostic={p} userSubscription={userSubscription} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* CTA bas de page */}
        {userSubscription === "GRATUIT" && (pronosticsAujourdhui.length > 0 || pronostics.length > 0) && (
          <div className="mt-12">
            <PaywallBanner niveau="PREMIUM" />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Helper ────────────────────────────────────────────────────────────
function canAccess(niveau: string, sub: SubscriptionStatus): boolean {
  if (niveau === "GRATUIT") return true;
  if (niveau === "PREMIUM") return sub === "PREMIUM" || sub === "VIP";
  if (niveau === "VIP") return sub === "VIP";
  return false;
}

// ── Empty State ───────────────────────────────────────────────────────
function EmptyState({ periode }: { periode?: string }) {
  return (
    <div className="py-16 text-center">
      <div className="w-16 h-16 rounded-2xl bg-bg-elevated border border-border flex items-center justify-center mx-auto mb-4">
        <Star className="w-7 h-7 text-text-muted" />
      </div>
      <h3 className="font-serif text-lg font-semibold text-text-primary mb-2">
        Aucun pronostic trouvé
      </h3>
      <p className="text-text-secondary text-sm max-w-xs mx-auto mb-6">
        {periode
          ? "Aucun pronostic ne correspond à vos filtres pour cette période."
          : "Aucun pronostic sur les 30 derniers jours. Revenez demain matin avant 8h00 pour nos nouvelles analyses."}
      </p>
      {periode && (
        <a
          href="/pronostics"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-gold-primary hover:bg-gold-dark text-bg-primary font-bold text-sm rounded-xl transition-all shadow-gold"
        >
          <TrendingUp className="w-4 h-4" />
          Voir les pronostics du jour
        </a>
      )}
    </div>
  );
}
