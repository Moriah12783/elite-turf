import type { Metadata } from "next";
import { unstable_noStore as noStore } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { buildLivePayload } from "@/lib/live/today";
import { parisDateISOPlusDays } from "@/lib/paris-date";
import PageHero from "@/components/layout/PageHero";
import LiveBoard from "@/components/live/LiveBoard";
import ReplaySection, { type Replay } from "@/components/live/ReplaySection";

export const metadata: Metadata = {
  title: "Le Direct — Arrivées en temps réel & bilan live | Elite Turf",
  description:
    "Suivez les arrivées des courses PMU en direct et le bilan en temps réel de nos pronostics Elite Turf. Replays officiels (Equidia, France Galop, Le Trot).",
  alternates: { canonical: "https://www.elite-turf.fr/live" },
};

// Toujours dynamique : on lit l'état du jour à chaque requête (le composant
// client prend le relais avec un rafraîchissement automatique ~60 s).
export const dynamic = "force-dynamic";

export default async function LivePage() {
  noStore();
  const payload = await buildLivePayload();

  const supabase = createServiceClient();
  const { data: replays } = await supabase
    .from("replays")
    .select("id, date_course, titre, youtube_id, hippodrome")
    .gte("date_course", parisDateISOPlusDays(-7))
    .order("date_course", { ascending: false })
    .order("ordre", { ascending: true })
    .limit(12);

  return (
    <div className="min-h-screen bg-bg-primary">
      <PageHero
        image="/images/heroes/hero-performances.jpg"
        titre="Le Direct"
        sousTitre="Les arrivées en temps réel + le bilan live de nos pronostics"
      />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12">
        <LiveBoard initial={payload} />
        <ReplaySection replays={(replays ?? []) as Replay[]} />
      </div>
    </div>
  );
}
