import { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Crown, Star, Zap, Calendar, Clock, TrendingUp,
  Eye, Heart, Bell, Shield, ChevronRight, ArrowRight,
  Trophy, Target, BarChart3, User,
} from "lucide-react";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { PLAN_CONFIG, CONFIDENCE_CONFIG, BET_TYPE_LABELS } from "@/types";
import type { Pronostic } from "@/types";

export const metadata: Metadata = {
  title: "Mon Espace Membre — Elite Turf",
  description: "Gérez votre abonnement, consultez vos pronostics et suivez vos statistiques.",
};

export const dynamic = "force-dynamic";

const STATUS_CONFIG = {
  GRATUIT: {
    label: "Gratuit",
    color: "text-text-secondary",
    bg: "bg-bg-elevated",
    border: "border-border",
    Icon: Zap,
  },
  PREMIUM: {
    label: "Premium",
    color: "text-gold-primary",
    bg: "bg-gold-faint",
    border: "border-gold-primary/40",
    Icon: Star,
  },
  VIP: {
    label: "VIP Elite",
    color: "text-purple-400",
    bg: "bg-purple-500/10",
    border: "border-purple-500/30",
    Icon: Crown,
  },
  EXPIRE: {
    label: "Expiré",
    color: "text-status-loss",
    bg: "bg-status-loss/10",
    border: "border-status-loss/30",
    Icon: Shield,
  },
};

const RESULTAT_STYLES = {
  GAGNANT: "text-status-win bg-status-win/10 border-status-win/20",
  PERDANT: "text-status-loss bg-status-loss/10 border-status-loss/20",
  PARTIEL: "text-status-partial bg-status-partial/10 border-status-partial/20",
  EN_ATTENTE: "text-status-pending bg-status-pending/10 border-status-pending/20",
};

const RESULTAT_LABELS = {
  GAGNANT: "✓ Gagnant",
  PERDANT: "✗ Perdant",
  PARTIEL: "~ Partiel",
  EN_ATTENTE: "En attente",
};

export default async function EspaceMembrePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Non connecté → rediriger vers la connexion
  if (!user) {
    redirect("/auth/connexion?redirect=/espace-membre");
  }

  const serviceClient = createServiceClient();

  // Fetch en parallèle : profil + abonnement actif + pronostics récents + stats
  const [profileRes, abonnementRes, pronosticsRes] = await Promise.all([
    serviceClient
      .from("profiles")
      .select("nom_complet, email, pays, ville, statut_abonnement, date_inscription, date_expiration_abonnement, avatar_url")
      .eq("id", user.id)
      .single(),

    serviceClient
      .from("abonnements")
      .select(`
        id, date_debut, date_fin, statut, auto_renouvellement,
        plan:plan_id(id, nom, prix_fcfa, duree_jours, acces_premium, acces_vip)
      `)
      .eq("user_id", user.id)
      .eq("statut", "ACTIF")
      .order("date_debut", { ascending: false })
      .limit(1)
      .maybeSingle(),

    serviceClient
      .from("pronostics")
      .select(`
        id, type_pari, confiance, analyse_courte, resultat, nb_vues,
        date_publication, niveau_acces,
        course:course_id(
          libelle, date_course,
          hippodrome:hippodrome_id(nom)
        )
      `)
      .order("date_publication", { ascending: false })
      .limit(8),
  ]);

  const profile = profileRes.data;
  const abonnement = abonnementRes.data;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recentPronostics = ((pronosticsRes.data as any[]) || []) as Pronostic[];

  // Calculer les stats personnelles (simplifiées)
  const statusKey = (profile?.statut_abonnement || "GRATUIT") as keyof typeof STATUS_CONFIG;
  const statusCfg = STATUS_CONFIG[statusKey] || STATUS_CONFIG.GRATUIT;
  const StatusIcon = statusCfg.Icon;

  // Plan actif
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const plan = (abonnement?.plan as any) as { nom: string; prix_fcfa: number; duree_jours: number } | null;
  const planConfig = plan ? PLAN_CONFIG.find((p) => p.nom === plan.nom) : null;

  const dateExpiration = profile?.date_expiration_abonnement
    ? new Date(profile.date_expiration_abonnement)
    : null;
  const joursRestants = dateExpiration
    ? Math.max(0, Math.ceil((dateExpiration.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  const dateInscription = profile?.date_inscription
    ? new Date(profile.date_inscription).toLocaleDateString("fr-CI", {
        month: "long",
        year: "numeric",
      })
    : null;

  // Stats pronostics
  const gagnants = recentPronostics.filter((p) => p.resultat === "GAGNANT").length;
  const termines = recentPronostics.filter((p) => p.resultat !== "EN_ATTENTE").length;
  const tauxReussite = termines > 0 ? Math.round((gagnants / termines) * 100) : 0;
  const prenom = profile?.nom_complet?.split(" ")[0] || "Membre";

  return (
    <div className="min-h-screen bg-bg-primary">

      {/* ── HEADER MEMBRE ─────────────────────────────────────────── */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-bg-elevated to-bg-primary" />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold-primary/40 to-transparent" />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
            {/* Avatar */}
            <div className="w-16 h-16 rounded-2xl bg-bg-card border-2 border-border flex items-center justify-center flex-shrink-0">
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={prenom}
                  className="w-full h-full object-cover rounded-2xl"
                />
              ) : (
                <User className="w-8 h-8 text-text-muted" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h1 className="font-serif text-2xl font-bold text-text-primary">
                  Bonjour, {prenom} !
                </h1>
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${statusCfg.bg} ${statusCfg.border} ${statusCfg.color}`}
                >
                  <StatusIcon className="w-3.5 h-3.5" />
                  {statusCfg.label}
                </span>
              </div>
              <p className="text-text-muted text-sm">
                {user.email}
                {dateInscription && (
                  <span className="ml-2 text-text-muted">· Membre depuis {dateInscription}</span>
                )}
              </p>
            </div>

            <Link
              href="/pronostics"
              className="btn-primary flex items-center gap-2 whitespace-nowrap"
            >
              <Star className="w-4 h-4" />
              Voir les pronostics
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 space-y-8">

        {/* ── ALERTE EXPIRATION IMMINENTE ───────────────────────────── */}
        {joursRestants > 0 && joursRestants <= 5 && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-status-partial/10 border border-status-partial/30">
            <Bell className="w-5 h-5 text-status-partial flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-text-primary font-semibold text-sm">
                Votre abonnement expire dans {joursRestants} jour{joursRestants > 1 ? "s" : ""}
              </p>
              <p className="text-text-secondary text-xs mt-0.5">
                Renouvelez maintenant pour ne pas perdre votre accès.
              </p>
            </div>
            <Link href="/abonnements" className="btn-primary text-xs px-3 py-1.5 whitespace-nowrap">
              Renouveler
            </Link>
          </div>
        )}

        {/* ── ABONNEMENT ACTUEL ─────────────────────────────────────── */}
        <div>
          <h2 className="font-serif font-bold text-text-primary text-lg mb-4">
            Mon abonnement
          </h2>

          {statusKey === "GRATUIT" || statusKey === "EXPIRE" ? (
            /* Pas d'abonnement actif */
            <div className="card-base p-6 text-center">
              <Shield className="w-10 h-10 text-text-muted mx-auto mb-3" />
              <p className="text-text-primary font-semibold mb-1">
                {statusKey === "EXPIRE" ? "Abonnement expiré" : "Aucun abonnement actif"}
              </p>
              <p className="text-text-secondary text-sm mb-4">
                Accédez à tous les pronostics Premium et VIP dès aujourd&apos;hui.
              </p>
              <Link href="/abonnements" className="btn-primary inline-flex items-center gap-2">
                <Crown className="w-4 h-4" />
                Voir les offres
              </Link>
            </div>
          ) : (
            /* Abonnement actif */
            <div className={`card-base border-2 p-6 ${statusCfg.border}`}>
              <div className="flex items-start justify-between gap-4 mb-5">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center ${statusCfg.bg} ${statusCfg.border}`}>
                    <StatusIcon className={`w-6 h-6 ${statusCfg.color}`} />
                  </div>
                  <div>
                    <p className="font-bold text-text-primary text-lg">
                      Plan {plan?.nom || statusCfg.label}
                    </p>
                    <p className="text-text-muted text-sm">
                      {planConfig?.prix_eur?.toLocaleString("fr-FR", { minimumFractionDigits: 2 })}€/mois
                    </p>
                  </div>
                </div>
                <span className="px-3 py-1.5 bg-status-win/10 text-status-win text-xs font-bold rounded-full border border-status-win/20">
                  ✓ ACTIF
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-5">
                <div className="p-3 bg-bg-elevated rounded-xl">
                  <p className="text-text-muted text-xs mb-1">Expire le</p>
                  <p className="text-text-primary font-semibold text-sm">
                    {dateExpiration?.toLocaleDateString("fr-CI", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    }) || "—"}
                  </p>
                </div>
                <div className="p-3 bg-bg-elevated rounded-xl">
                  <p className="text-text-muted text-xs mb-1">Jours restants</p>
                  <p className={`font-semibold text-sm ${joursRestants <= 5 ? "text-status-partial" : "text-status-win"}`}>
                    {joursRestants} jour{joursRestants > 1 ? "s" : ""}
                  </p>
                </div>
                <div className="p-3 bg-bg-elevated rounded-xl">
                  <p className="text-text-muted text-xs mb-1">Alertes incluses</p>
                  <p className="text-text-primary font-semibold text-sm">
                    {planConfig?.nb_alertes === -1 ? "Illimitées" : `${planConfig?.nb_alertes || 0}/mois`}
                  </p>
                </div>
              </div>

              {/* Features incluses */}
              {planConfig?.features && (
                <div className="border-t border-border/50 pt-4">
                  <p className="text-text-muted text-xs uppercase tracking-wider font-semibold mb-3">
                    Inclus dans votre plan
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {planConfig.features.map((f, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <div className="w-1.5 h-1.5 rounded-full bg-status-win flex-shrink-0" />
                        <span className="text-text-secondary">{f}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-4 flex gap-2">
                <Link
                  href="/abonnements"
                  className="btn-secondary text-sm flex items-center gap-2"
                >
                  Changer de plan
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* ── STATS RAPIDES ─────────────────────────────────────────── */}
        <div>
          <h2 className="font-serif font-bold text-text-primary text-lg mb-4">
            Mes statistiques
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              {
                Icon: Eye,
                label: "Pronostics consultés",
                value: recentPronostics.length.toString(),
                sub: "ce mois",
                color: "text-gold-primary",
              },
              {
                Icon: Trophy,
                label: "Pronostics gagnants",
                value: gagnants.toString(),
                sub: "sur les 8 derniers",
                color: "text-status-win",
              },
              {
                Icon: Target,
                label: "Taux de réussite",
                value: `${tauxReussite}%`,
                sub: "pronostics terminés",
                color: "text-gold-primary",
              },
              {
                Icon: BarChart3,
                label: "Jours d'abonnement",
                value: joursRestants > 0 ? joursRestants.toString() : "0",
                sub: "restants",
                color: joursRestants <= 5 ? "text-status-partial" : "text-status-win",
              },
            ].map(({ Icon, label, value, sub, color }) => (
              <div key={label} className="card-base p-4">
                <Icon className={`w-5 h-5 ${color} mb-2`} />
                <p className={`text-2xl font-bold font-serif ${color}`}>{value}</p>
                <p className="text-text-primary text-xs font-semibold mt-1">{label}</p>
                <p className="text-text-muted text-xs">{sub}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── PRONOSTICS RÉCENTS ────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-serif font-bold text-text-primary text-lg">
              Derniers pronostics
            </h2>
            <Link
              href="/pronostics"
              className="flex items-center gap-1.5 text-gold-primary text-sm font-semibold hover:text-gold-light transition-colors"
            >
              Voir tout
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {recentPronostics.length === 0 ? (
            <div className="card-base p-8 text-center">
              <TrendingUp className="w-10 h-10 text-text-muted mx-auto mb-3" />
              <p className="text-text-secondary text-sm">
                Aucun pronostic disponible pour le moment.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentPronostics.map((p) => {
                const course = p.course as {
                  libelle?: string;
                  date_course?: string;
                  hippodrome?: { nom: string };
                } | undefined;
                const confCfg = CONFIDENCE_CONFIG[p.confiance];
                const resultClass = RESULTAT_STYLES[p.resultat] || RESULTAT_STYLES.EN_ATTENTE;
                const resultLabel = RESULTAT_LABELS[p.resultat] || "En attente";

                return (
                  <Link
                    key={p.id}
                    href={`/pronostics/${p.id}`}
                    className="card-base p-4 flex items-start gap-4 hover:border-gold-primary/30 transition-colors group"
                  >
                    {/* Niveau */}
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      p.niveau_acces === "VIP"
                        ? "bg-purple-500/10 border border-purple-500/30"
                        : p.niveau_acces === "PREMIUM"
                        ? "bg-gold-faint border border-gold-primary/30"
                        : "bg-bg-elevated border border-border"
                    }`}>
                      {p.niveau_acces === "VIP" ? (
                        <Crown className="w-4 h-4 text-purple-400" />
                      ) : p.niveau_acces === "PREMIUM" ? (
                        <Star className="w-4 h-4 text-gold-primary" />
                      ) : (
                        <Zap className="w-4 h-4 text-text-muted" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-text-primary font-semibold text-sm truncate group-hover:text-gold-light transition-colors">
                            {course?.libelle || "Pronostic"} — {course?.hippodrome?.nom || "—"}
                          </p>
                          <p className="text-text-muted text-xs mt-0.5">
                            {BET_TYPE_LABELS[p.type_pari]} ·{" "}
                            {p.date_publication
                              ? new Date(p.date_publication).toLocaleDateString("fr-CI", {
                                  day: "numeric",
                                  month: "short",
                                })
                              : "—"}
                          </p>
                        </div>
                        <span className={`flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-bold border ${resultClass}`}>
                          {resultLabel}
                        </span>
                      </div>
                      <p className="text-text-secondary text-xs mt-2 line-clamp-1">
                        {p.analyse_courte}
                      </p>
                    </div>

                    {/* Confiance */}
                    <div className="flex-shrink-0 flex gap-px">
                      {[...Array(4)].map((_, i) => (
                        <div
                          key={i}
                          className={`w-1 h-4 rounded-sm ${
                            i < confCfg.stars ? "bg-gold-primary" : "bg-bg-elevated"
                          }`}
                        />
                      ))}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* ── ACCÈS RAPIDES ─────────────────────────────────────────── */}
        <div>
          <h2 className="font-serif font-bold text-text-primary text-lg mb-4">
            Accès rapide
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { href: "/pronostics", Icon: Star, label: "Pronostics", desc: "Toutes les sélections" },
              { href: "/courses", Icon: Calendar, label: "Courses", desc: "Programme du jour" },
              { href: "/performances", Icon: TrendingUp, label: "Performances", desc: "Nos statistiques" },
              { href: "/abonnements", Icon: Crown, label: "Abonnements", desc: "Changer de plan" },
            ].map(({ href, Icon, label, desc }) => (
              <Link
                key={href}
                href={href}
                className="card-base p-4 hover:border-gold-primary/30 transition-colors group text-left"
              >
                <Icon className="w-6 h-6 text-gold-primary mb-2 group-hover:scale-110 transition-transform" />
                <p className="text-text-primary font-semibold text-sm">{label}</p>
                <p className="text-text-muted text-xs mt-0.5">{desc}</p>
              </Link>
            ))}
          </div>
        </div>

        {/* ── BESOIN D'AIDE ─────────────────────────────────────────── */}
        <div className="p-5 rounded-2xl bg-bg-card border border-border flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-[#25D366]/10 border border-[#25D366]/30 flex items-center justify-center flex-shrink-0">
            <Heart className="w-5 h-5 text-[#25D366]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-text-primary font-semibold text-sm">Support prioritaire</p>
            <p className="text-text-muted text-xs">Réponse en moins de 30 min sur WhatsApp</p>
          </div>
          <a
            href="https://wa.me/+22507000000"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 bg-[#25D366] hover:bg-[#1ebe5d] text-white text-xs font-bold rounded-xl transition-colors whitespace-nowrap flex-shrink-0"
          >
            Nous écrire
          </a>
        </div>

      </div>
    </div>
  );
}
