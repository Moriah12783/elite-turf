/**
 * /pronostics/gratuit
 *
 * URL PERMANENTE du pronostic gratuit du jour Elite Turf.
 *
 * Utilité :
 *   - Lien partageable WhatsApp / SMS / email qui pointe TOUJOURS vers le
 *     pronostic gratuit le plus récent (le 1er publié du jour, ou celui de
 *     la veille en fallback si pas encore publié pour aujourd'hui).
 *   - L'UUID d'un pronostic change chaque jour — un lien direct
 *     /pronostics/<UUID> devient invalide le lendemain. Cette route résout
 *     ce problème en faisant un lookup dynamique.
 *
 * Stratégie de résolution :
 *   1. Cherche le pronostic GRATUIT publié le plus récent dont la course
 *      est aujourd'hui ou hier (fenêtre 48h pour absorber les retards de
 *      publication).
 *   2. Si trouvé → redirect 307 (temporary) vers /pronostics/<id>
 *      (l'URL canonique reste /pronostics/gratuit pour le partage social).
 *   3. Sinon → affiche page "Bientôt disponible" avec CTAs.
 *
 * SEO :
 *   - Indexable (canonical sur /pronostics/gratuit)
 *   - Title + description riches pour CTR SERP
 *   - revalidate 5 min : le pronostic du jour change rarement après
 *     publication, donc cache court suffit.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Gift, Sparkles, ArrowRight, Trophy } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/server";
import PageHero from "@/components/layout/PageHero";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://www.elite-turf.fr");

// Cache court : si un nouveau pronostic gratuit est publié, on veut le
// servir rapidement (sans attendre le revalidate d'une heure du sitemap).
export const revalidate = 300; // 5 minutes

export const metadata: Metadata = {
  title:       "🎁 Pronostic Gratuit du jour",
  description: "Pronostic gratuit du jour : le Radar de la presse résume ce que pronostiquent les journaux, et la Sélection stats éclaire chaque course du programme. En accès libre, sans inscription.",
  alternates:  { canonical: `${APP_URL}/pronostics/gratuit` },
  openGraph: {
    title:       "🎁 Pronostic Gratuit du jour — Elite Turf",
    description: "Le Radar de la presse et la Sélection stats d'Elite Turf, en accès libre et sans inscription.",
    url:         `${APP_URL}/pronostics/gratuit`,
    type:        "article",
  },
};

/**
 * Récupère l'ID du pronostic gratuit le plus récent éligible.
 * Fenêtre de recherche : courses des 2 derniers jours (today + hier) pour
 * absorber les délais de publication (un pronostic peut être publié le matin
 * pour la course du jour, ou la veille au soir).
 */
async function getLatestGratuitId(): Promise<string | null> {
  const supabase = createServiceClient();

  // Calcul date Paris (pas UTC) pour aligner avec l'horloge métier
  const todayParis = new Date().toLocaleDateString("fr-CA", {
    timeZone: "Europe/Paris",
  }); // YYYY-MM-DD

  const minusOneDay = new Date(new Date().getTime() - 24 * 60 * 60 * 1000)
    .toLocaleDateString("fr-CA", { timeZone: "Europe/Paris" });

  const { data } = await supabase
    .from("pronostics")
    .select("id, date_publication, course:courses!inner(date_course)")
    .eq("niveau_acces", "GRATUIT")
    .eq("publie",       true)
    .gte("course.date_course", minusOneDay)
    .lte("course.date_course", todayParis)
    .order("date_publication", { ascending: false, nullsFirst: false })
    .limit(1);

  if (!data || data.length === 0) return null;
  return data[0].id ?? null;
}

export default async function PronosticGratuitPage() {
  // ── 1. Lookup du pronostic gratuit du jour ──────────────────────────
  const gratuitId = await getLatestGratuitId();
  if (gratuitId) {
    // Redirect temporaire (307) → l'URL canonique reste /pronostics/gratuit
    // pour le partage social, mais l'utilisateur voit le détail.
    redirect(`/pronostics/${gratuitId}`);
  }

  // ── 2. Aucun pronostic gratuit → l'offre gratuite réelle ────────────
  // Depuis juillet 2026, plus de pronostic gratuit quotidien : le Radar de la
  // presse et la Sélection stats l'ont remplacé (décision de Steph, rappelée
  // le 01/10/2026). Avant cette date, la page promettait un pronostic gratuit
  // « chaque jour » qui n'arrivait plus.
  return (
    <div className="min-h-screen bg-bg-primary">
      <PageHero
        image="/images/heroes/hero-pronostics.jpg"
        titre="L'offre gratuite Elite Turf"
        sousTitre="Ce qu'Elite Turf vous offre, sans inscription"
      />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">

        {/* ── Carte centrale : l'offre gratuite ── */}
        <section className="card-base p-8 sm:p-10 text-center">
          <div className="w-20 h-20 rounded-3xl bg-gold-faint border border-gold-primary/30 flex items-center justify-center mx-auto mb-6">
            <Gift className="w-10 h-10 text-gold-primary" />
          </div>

          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-text-primary mb-3">
            Notre offre gratuite
          </h1>

          <p className="text-text-secondary text-base leading-relaxed max-w-xl mx-auto mb-6">
            Le pronostic gratuit quotidien a laissé la place à deux outils en accès libre :
            le <strong className="text-text-primary">Radar de la presse</strong>, qui résume ce que
            pronostiquent les journaux, et la <strong className="text-text-primary">Sélection stats</strong>,
            notre lecture statistique de chaque course du programme.
          </p>
        </section>

        {/* ── CTAs ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link
            href="/courses"
            className="card-base p-6 group hover:border-gold-primary/40 transition-all"
          >
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-gold-faint border border-gold-primary/20 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-5 h-5 text-gold-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-serif font-bold text-text-primary mb-1 group-hover:text-gold-light transition-colors">
                  La Sélection stats du jour
                </h3>
                <p className="text-text-muted text-sm leading-relaxed">
                  Sur chaque course du programme, en accès libre
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-text-muted group-hover:text-gold-primary transition-colors mt-1" />
            </div>
          </Link>

          <Link
            href="/abonnements"
            className="card-base p-6 group hover:border-gold-primary/40 transition-all"
          >
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-gold-faint border border-gold-primary/20 flex items-center justify-center flex-shrink-0">
                <Trophy className="w-5 h-5 text-gold-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-serif font-bold text-text-primary mb-1 group-hover:text-gold-light transition-colors">
                  Les pronostics experts
                </h3>
                <p className="text-text-muted text-sm leading-relaxed">
                  Tiercé, Quarté+, Quinté+ : dès 65 € pour 7 jours
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-text-muted group-hover:text-gold-primary transition-colors mt-1" />
            </div>
          </Link>
        </div>

        {/* ── Note rassurante ── */}
        <p className="text-text-muted text-xs text-center leading-relaxed">
          🎯 Le Radar de la presse s&apos;affiche sur la page d&apos;accueil, la Sélection stats
          sur la page de chaque course. Les deux sont gratuits et sans inscription.
        </p>
      </div>
    </div>
  );
}
