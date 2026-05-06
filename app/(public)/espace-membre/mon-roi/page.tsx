/**
 * /espace-membre/mon-roi — Tableau de bord ROI personnel.
 *
 * Calcule le ROI théorique cumulé d'un parieur qui aurait suivi tous les
 * pronostics qu'il a vus (selon son niveau d'abonnement).
 *
 * Levier rétention M2 : on rappelle au user combien il GAGNE / aurait gagné
 * en suivant Elite Turf, ce qui réduit le churn.
 */

import { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Trophy, TrendingUp, BarChart3, Calendar, Award,
  ArrowRight, ChevronRight, Star, Zap,
} from "lucide-react";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import PageHero from "@/components/layout/PageHero";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://www.elite-turf.fr");

export const metadata: Metadata = {
  title: "Mon ROI — Suivez vos gains théoriques | Elite Turf",
  description: "Tableau de bord personnel : ROI cumulé, victoires, top performers. Réservé aux membres Elite Turf.",
  alternates: { canonical: `${APP_URL}/espace-membre/mon-roi` },
  // Page privée — ne pas indexer
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function MonRoiPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/connexion?redirect=/espace-membre/mon-roi");

  const sc = createServiceClient();

  // Profil pour avoir le statut + date_inscription
  const { data: profile } = await sc
    .from("profiles")
    .select("nom_complet, statut_abonnement, date_inscription")
    .eq("id", user.id)
    .single();
  const statut = profile?.statut_abonnement || "GRATUIT";

  // Les niveaux accessibles selon le plan utilisateur
  const niveauxAccessibles = (() => {
    if (statut === "ELITE")   return ["GRATUIT", "STARTER", "PRO", "ELITE"];
    if (statut === "PRO")     return ["GRATUIT", "STARTER", "PRO"];
    if (statut === "STARTER") return ["GRATUIT", "STARTER"];
    return ["GRATUIT"];
  })();

  // Récupérer tous les pronostics publiés terminés des 90 derniers jours
  const minus90 = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString();
  const { data: pronostics } = await sc
    .from("pronostics")
    .select(`
      id, type_pari, niveau_acces, resultat,
      gains_theoriques, rapport_gagnant, date_publication,
      course:courses(libelle, date_course, hippodrome:hippodromes(nom))
    `)
    .eq("publie", true)
    .neq("resultat", "EN_ATTENTE")
    .gte("date_publication", minus90)
    .in("niveau_acces", niveauxAccessibles)
    .order("date_publication", { ascending: false })
    .limit(200);

  const list = ((pronostics ?? []) as any[]);

  // Compute ROI
  let totalGains = 0;
  let totalMises = list.length;
  let nbGagnants = 0;
  let nbPartiels = 0;
  let nbPerdants = 0;
  for (const p of list) {
    if (p.resultat === "GAGNANT") {
      nbGagnants++;
      totalGains += (p.gains_theoriques ?? p.rapport_gagnant ?? 0);
    } else if (p.resultat === "PARTIEL") {
      nbPartiels++;
      totalGains += (p.gains_theoriques ?? p.rapport_gagnant ?? 0) * 0.3;
    } else {
      nbPerdants++;
    }
  }
  const roi = totalMises > 0 ? Math.round(((totalGains - totalMises) / totalMises) * 100) : 0;
  const tauxReussite = totalMises > 0 ? Math.round((nbGagnants / totalMises) * 100) : 0;

  // Group by month for trend
  const monthly = new Map<string, { gains: number; mises: number; victoires: number }>();
  for (const p of list) {
    const month = (p.date_publication || "").slice(0, 7); // YYYY-MM
    if (!month) continue;
    const cur = monthly.get(month) ?? { gains: 0, mises: 0, victoires: 0 };
    cur.mises += 1;
    if (p.resultat === "GAGNANT") {
      cur.gains += (p.gains_theoriques ?? p.rapport_gagnant ?? 0);
      cur.victoires += 1;
    } else if (p.resultat === "PARTIEL") {
      cur.gains += (p.gains_theoriques ?? p.rapport_gagnant ?? 0) * 0.3;
    }
    monthly.set(month, cur);
  }
  const monthlyData = Array.from(monthly.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, s]) => ({
      month,
      gains:    Math.round(s.gains * 100) / 100,
      mises:    s.mises,
      roi:      s.mises > 0 ? Math.round(((s.gains - s.mises) / s.mises) * 100) : 0,
      victoires: s.victoires,
    }));

  // 5 derniers gagnants
  const derniersGagnants = list.filter((p) => p.resultat === "GAGNANT").slice(0, 5);

  const prenom = profile?.nom_complet?.split(" ")[0] || "Membre";
  const nbJoursAbo = profile?.date_inscription
    ? Math.floor((Date.now() - new Date(profile.date_inscription).getTime()) / (24 * 3600 * 1000))
    : 0;

  return (
    <div className="min-h-screen bg-bg-primary">
      <PageHero
        image="/images/heroes/hero-performances.jpg"
        titre={`Bonjour ${prenom}, voici votre ROI`}
        sousTitre={`${list.length} pronostics analysés sur 90 jours · Niveau ${statut}`}
      />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">

        <nav className="mb-8 flex items-center gap-2 text-xs text-text-muted">
          <Link href="/" className="hover:text-gold-primary">Accueil</Link>
          <ChevronRight className="w-3 h-3" />
          <Link href="/espace-membre" className="hover:text-gold-primary">Espace membre</Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-text-secondary">Mon ROI</span>
        </nav>

        {/* ── KPI principaux ────────────────────────────────────── */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          <KpiCard
            label="ROI cumulé 90j"
            value={roi >= 0 ? `+${roi} %` : `${roi} %`}
            color={roi >= 0 ? "text-status-win" : "text-status-loss"}
            accent={roi >= 0}
          />
          <KpiCard
            label="Taux de réussite"
            value={`${tauxReussite} %`}
            color="text-gold-primary"
          />
          <KpiCard
            label="Pronostics suivis"
            value={`${list.length}`}
            color="text-text-primary"
          />
          <KpiCard
            label="Gagnants"
            value={`${nbGagnants}`}
            color="text-status-win"
          />
        </section>

        {/* ── Récap visuel ──────────────────────────────────────── */}
        <section className="card-base p-6 mb-8">
          <h2 className="font-serif text-xl font-bold text-text-primary mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-gold-primary" />
            Vos gains théoriques cumulés
          </h2>
          <p className="text-text-secondary text-sm mb-6">
            Calcul effectué sur la base d&apos;une mise de 1 € par pronostic suivi. {totalMises > 0 ? (
              <>Si vous aviez suivi tous les pronostics du niveau <strong>{statut}</strong> pendant 90 jours,
              vous auriez théoriquement <strong className={roi >= 0 ? "text-status-win" : "text-status-loss"}>
              {roi >= 0 ? "gagné" : "perdu"} {Math.abs(Math.round(totalGains - totalMises))} €</strong> {" "}
              (gains : {totalGains.toFixed(0)} € / mises : {totalMises} €).</>
            ) : (
              <>Aucun pronostic accessible à votre niveau sur les 90 derniers jours.</>
            )}
          </p>

          {/* Graph mensuel — barres CSS simples */}
          {monthlyData.length > 0 && (
            <div className="space-y-3">
              {monthlyData.map((m) => (
                <div key={m.month}>
                  <div className="flex items-center justify-between text-xs text-text-muted mb-1">
                    <span>{m.month}</span>
                    <span className={m.roi >= 0 ? "text-status-win" : "text-status-loss"}>
                      ROI {m.roi >= 0 ? "+" : ""}{m.roi} % · {m.victoires}/{m.mises}
                    </span>
                  </div>
                  <div className="relative h-6 bg-bg-elevated rounded-md overflow-hidden">
                    <div
                      className={`absolute inset-y-0 left-0 rounded-md ${m.roi >= 0 ? "bg-status-win/40" : "bg-status-loss/40"}`}
                      style={{ width: `${Math.min(Math.abs(m.roi), 200) / 2}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Derniers gagnants ────────────────────────────────── */}
        {derniersGagnants.length > 0 && (
          <section className="card-base p-6 mb-8">
            <h2 className="font-serif text-xl font-bold text-text-primary mb-4 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-status-win" />
              Vos 5 derniers pronostics gagnants
            </h2>
            <ul className="space-y-2">
              {derniersGagnants.map((p) => {
                const c = Array.isArray(p.course) ? p.course[0] : p.course;
                const hippo = Array.isArray(c?.hippodrome) ? c.hippodrome[0] : c?.hippodrome;
                return (
                  <li key={p.id}>
                    <Link
                      href={`/pronostics/${p.id}`}
                      className="flex items-center gap-3 p-3 rounded-xl bg-bg-elevated border border-border hover:border-status-win/40 transition-all"
                    >
                      <Trophy className="w-4 h-4 text-status-win flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-text-primary text-sm font-medium truncate">
                          {c?.libelle || p.type_pari}
                        </div>
                        <div className="text-text-muted text-xs">
                          {hippo?.nom} · {c?.date_course && new Date(c.date_course + "T12:00:00").toLocaleDateString("fr-FR")}
                        </div>
                      </div>
                      {p.gains_theoriques && (
                        <span className="text-status-win text-sm font-bold whitespace-nowrap">
                          +{Math.round(p.gains_theoriques)} €
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* ── Streak / membre depuis ───────────────────────────── */}
        <section className="card-base p-6 mb-8 border-gold-primary/30 bg-gradient-to-r from-bg-card to-[#1A1610]">
          <div className="flex items-center gap-4">
            <Award className="w-10 h-10 text-gold-primary flex-shrink-0" />
            <div className="flex-1">
              <h3 className="font-serif text-lg font-bold text-text-primary mb-1">
                Membre depuis {nbJoursAbo} jours
              </h3>
              <p className="text-text-secondary text-sm">
                {nbJoursAbo < 7
                  ? "Bienvenue ! Continuez à explorer nos pronostics pour optimiser votre ROI."
                  : nbJoursAbo < 30
                    ? "Vous prenez vos marques. Le ROI s'améliore avec la régularité."
                    : "Vous êtes un membre engagé. Merci de votre confiance !"}
              </p>
            </div>
          </div>
        </section>

        {/* ── CTAs upgrade selon plan ──────────────────────────── */}
        {statut === "GRATUIT" && (
          <UpgradeCTA
            title="Débloquez tous les pronostics"
            text="Avec le pack Starter (65 €/mois), vous avez accès à TOUS les pronostics, pas uniquement le gratuit du jour. ROI théorique typique : +30 à +80 %."
            href="/abonnements"
            cta="Voir les offres"
          />
        )}

        {statut === "STARTER" && (
          <UpgradeCTA
            title="Passez au pack Pro"
            text="Le pack Pro débloque les pronostics Pro avec analyse complète. ROI moyen sur 90j de nos abonnés Pro : +45-60 %."
            href="/abonnements#pro"
            cta="Découvrir le pack Pro"
          />
        )}

        {statut === "PRO" && (
          <UpgradeCTA
            title="Devenez membre Elite"
            text="Le pack Elite vous donne accès aux pronostics ELITE (3-4 publications/jour) + WhatsApp direct avec nos experts. Réservé aux passionnés."
            href="/abonnements#elite"
            cta="Découvrir le pack Elite"
          />
        )}
      </div>
    </div>
  );
}

function KpiCard({ label, value, color, accent }: { label: string; value: string; color: string; accent?: boolean }) {
  return (
    <div className={`card-base p-4 ${accent ? "border-status-win/40" : ""}`}>
      <div className={`font-serif font-bold text-2xl sm:text-3xl ${color}`}>{value}</div>
      <div className="text-text-muted text-xs uppercase tracking-wider mt-1">{label}</div>
    </div>
  );
}

function UpgradeCTA({ title, text, href, cta }: { title: string; text: string; href: string; cta: string }) {
  return (
    <div className="p-6 sm:p-8 rounded-2xl bg-gradient-to-r from-bg-card via-[#1A1610] to-bg-card border border-gold-primary/30">
      <div className="flex items-start gap-4">
        <Star className="w-10 h-10 text-gold-primary flex-shrink-0" fill="#C9A84C" />
        <div className="flex-1">
          <h3 className="font-serif text-xl font-bold text-text-primary mb-2">{title}</h3>
          <p className="text-text-secondary text-sm mb-4">{text}</p>
          <Link
            href={href}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gold-primary hover:bg-gold-dark text-bg-primary font-bold text-sm rounded-xl transition-all"
          >
            <Zap className="w-4 h-4" /> {cta} <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
