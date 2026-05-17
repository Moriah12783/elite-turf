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
import { Gift, Star, ArrowRight, Clock, Trophy } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/server";
import PageHero from "@/components/layout/PageHero";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://www.elite-turf.fr");

// Cache court : si un nouveau pronostic gratuit est publié, on veut le
// servir rapidement (sans attendre le revalidate d'une heure du sitemap).
export const revalidate = 300; // 5 minutes

export const metadata: Metadata = {
  title:       "🎁 Pronostic Gratuit du jour — Elite Turf",
  description: "Découvrez gratuitement le pronostic PMU du jour (Tiercé / Quinté+) sélectionné par Elite Turf. Analyse complète, sélection en clair, aucun engagement.",
  alternates:  { canonical: `${APP_URL}/pronostics/gratuit` },
  openGraph: {
    title:       "🎁 Pronostic Gratuit du jour — Elite Turf",
    description: "Le pronostic PMU offert par Elite Turf. Analyse complète, sélection en clair, mis à jour quotidiennement.",
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

  // ── 2. Aucun pronostic gratuit disponible → page "bientôt" ──────────
  return (
    <div className="min-h-screen bg-bg-primary">
      <PageHero
        image="/images/heroes/hero-pronostics.jpg"
        titre="Pronostic Gratuit du jour"
        sousTitre="Notre cadeau quotidien pour les passionnés du turf — analysé par notre équipe experte"
      />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">

        {/* ── Carte centrale : "Bientôt disponible" ── */}
        <section className="card-base p-8 sm:p-10 text-center">
          <div className="w-20 h-20 rounded-3xl bg-gold-faint border border-gold-primary/30 flex items-center justify-center mx-auto mb-6">
            <Gift className="w-10 h-10 text-gold-primary" />
          </div>

          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-text-primary mb-3">
            Pronostic gratuit du jour bientôt disponible
          </h1>

          <p className="text-text-secondary text-base leading-relaxed max-w-xl mx-auto mb-6">
            Notre équipe publie chaque jour <strong className="text-text-primary">avant 8h00</strong>
            {" "}(heure de Paris) une sélection gratuite de l&apos;une des courses majeures du jour —
            Tiercé, Quarté+ ou Quinté+ selon le programme.
          </p>

          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-bg-elevated border border-border text-text-muted text-sm">
            <Clock className="w-4 h-4 text-gold-primary" />
            Revenez d&apos;ici quelques heures
          </div>
        </section>

        {/* ── CTAs ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link
            href="/pronostics"
            className="card-base p-6 group hover:border-gold-primary/40 transition-all"
          >
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-gold-faint border border-gold-primary/20 flex items-center justify-center flex-shrink-0">
                <Star className="w-5 h-5 text-gold-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-serif font-bold text-text-primary mb-1 group-hover:text-gold-light transition-colors">
                  Voir tous les pronostics
                </h3>
                <p className="text-text-muted text-sm leading-relaxed">
                  Explorez nos analyses du jour et de la semaine
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
                  Abonnements Premium
                </h3>
                <p className="text-text-muted text-sm leading-relaxed">
                  Accès à tous nos pronostics Pro et Elite
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-text-muted group-hover:text-gold-primary transition-colors mt-1" />
            </div>
          </Link>
        </div>

        {/* ── Note rassurante ── */}
        <p className="text-text-muted text-xs text-center leading-relaxed">
          🎯 Le pronostic gratuit est publié quotidiennement par notre équipe d&apos;analystes.
          Il est sélectionné sur la course la plus jouée du jour, généralement à Vincennes,
          Auteuil, Longchamp ou ParisLongchamp.
          <br />
          Partagez ce lien :{" "}
          <code className="px-1.5 py-0.5 rounded bg-bg-elevated border border-border text-text-secondary">
            elite-turf.fr/pronostics/gratuit
          </code>
          {" "}— il pointe toujours vers le pronostic le plus récent.
        </p>
      </div>
    </div>
  );
}
