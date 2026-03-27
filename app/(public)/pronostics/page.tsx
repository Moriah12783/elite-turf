import { Suspense } from "react";
import { Metadata } from "next";
import { Star, TrendingUp, Trophy, Flame, AlertCircle } from "lucide-react";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { SubscriptionStatus } from "@/types";
import PronosticCard from "@/components/pronostics/PronosticCard";
import PronosticsFilters from "@/components/pronostics/PronosticsFilters";
import PaywallBanner from "@/components/pronostics/PaywallBanner";
import PageHero from "@/components/layout/PageHero";

export const metadata: Metadata = {
  title: "Pronostics du Jour — Elite Turf",
  description:
    "Pronostics Tiercé, Quarté+, Quinté+ par nos experts. Taux de réussite 73%. Analyses hippiques pour la Côte d'Ivoire et l'parieurs francophones.",
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

  // ── 2. Construire la plage de dates selon la période ───────────────
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let dateFrom: string;
  if (searchParams.periode === "mois") {
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    dateFrom = firstDay.toISOString().split("T")[0];
  } else if (searchParams.periode === "semaine") {
    const monday = new Date(today);
    monday.setDate(today.getDate() - today.getDay() + 1);
    dateFrom = monday.toISOString().split("T")[0];
  } else {
    dateFrom = today.toISOString().split("T")[0];
  }

  // ── 3. Requête Supabase (service client pour récupérer tout) ────────
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
        hippodrome:hippodromes(nom, pays)
      )
    `
    )
    .eq("publie", true)
    .gte("date_publication", dateFrom)
    .order("date_publication", { ascending: false });

  // Filtre type de pari
  if (searchParams.type) {
    query = query.eq("type_pari", searchParams.type);
  }
  // Filtre niveau
  if (searchParams.niveau) {
    query = query.eq("niveau_acces", searchParams.niveau);
  }

  const { data: allPronostics } = await query.limit(50);

  // Filtre hippodrome (côté serveur après récupération)
  const pronostics = (allPronostics || []).filter((p: any) => {
    if (!searchParams.hippodrome) return true;
    return p.course?.hippodrome?.nom === searchParams.hippodrome;
  });

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
        image="https://images.unsplash.com/photo-1708882308455-cd5f478f7bf9?w=1920&q=80"
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
              <span className="text-gold-light font-semibold">9,90€/mois</span> pour tout voir.
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
              totalCount={pronostics.length}
            />
          </Suspense>
        </div>

        {/* Pronostics list */}
        {pronostics.length > 0 ? (
          <div className="space-y-4">
            {pronostics.map((p: any) => (
              <PronosticCard
                key={p.id}
                pronostic={p}
                userSubscription={userSubscription}
              />
            ))}
          </div>
        ) : (
          <EmptyState periode={searchParams.periode} />
        )}

        {/* CTA bas de page */}
        {userSubscription === "GRATUIT" && pronostics.length > 0 && (
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
          : "Les pronostics du jour seront publiés ce matin. Revenez avant 8h00."}
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
