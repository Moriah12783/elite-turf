import { Metadata } from "next";
import Link from "next/link";
import {
  Check, Star, Zap, Crown, Shield, Clock,
  MessageCircle, ChevronDown, ArrowRight, Gift, Users, Flame
} from "lucide-react";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { PLAN_CONFIG } from "@/types";
import PaiementButton from "@/components/abonnements/PaiementButton";
import PageHero from "@/components/layout/PageHero";
import { PROMO } from "@/lib/promo";
import FaqJsonLd, { FaqSection } from "@/components/seo/FaqJsonLd";

// FAQ Schema.org — visent les requêtes "comment payer pmu mobile money",
// "abonnement quinté+", "tarif pronostic pmu", "annuler abonnement".
// Page à forte intent commercial → rich snippet = boost CTR critique.
const ABONNEMENTS_FAQ = [
  {
    question: "Comment payer mon abonnement Elite Turf en Mobile Money ?",
    answer:
      "Nous acceptons Orange Money, MTN Mobile Money, Moov Money et Wave depuis 8 pays africains (Côte d'Ivoire, Sénégal, Cameroun, Burkina Faso, Mali, Bénin, Togo, Maroc). Le paiement Mobile Money est instantané, votre abonnement est activé en moins de 60 secondes après confirmation. Pour les utilisateurs européens, le paiement par carte bancaire (Stripe) est également disponible.",
  },
  {
    question: "Quelle est la différence entre Starter, Pro et Elite ?",
    answer:
      "Le pack Starter donne accès aux pronostics Pro (Tiercé, Quarté+). Le pack Pro ajoute le Quinté+ premium et l'historique 30 jours. Le pack Elite inclut tout cela + l'accès aux analyses Elite Top Selection avec score composite, les notifications WhatsApp prioritaires et le support direct sous 2h. Les tarifs commencent à 65€ pour 30 jours d'accès Starter.",
  },
  {
    question: "Puis-je annuler mon abonnement à tout moment ?",
    answer:
      "Oui, vous pouvez annuler à tout moment depuis votre espace membre. L'annulation prend effet à la fin de la période en cours (vous gardez l'accès jusqu'à expiration). Aucun renouvellement automatique n'est appliqué sans votre confirmation explicite.",
  },
  {
    question: "Mon abonnement se renouvelle-t-il automatiquement ?",
    answer:
      "Non. Elite Turf fonctionne uniquement par abonnement ponctuel : vous payez pour une période fixe (30 jours), puis vous décidez activement de renouveler ou non. Aucun prélèvement automatique = aucune surprise sur votre compte ou carte bancaire.",
  },
  {
    question: "Je n'arrive pas à payer en Mobile Money, que faire ?",
    answer:
      "Vérifiez d'abord que votre solde Mobile Money est suffisant et que votre compte n'est pas bloqué par votre opérateur. Si le problème persiste, contactez-nous sur WhatsApp au +33 6 44 68 67 20 — nous répondons sous 2h en moyenne et pouvons activer manuellement votre abonnement après vérification du paiement.",
  },
  {
    question: "Quel est le délai de remboursement en cas de problème ?",
    answer:
      "Si vous rencontrez un problème technique majeur dans les 24h suivant votre paiement (compte non activé, accès refusé, etc.), nous procédons à un remboursement intégral sous 48h ouvrées. Pour toute autre demande, contactez notre support à contact@elite-turf.fr.",
  },
];

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://www.elite-turf.fr");

export const metadata: Metadata = {
  title: "Abonnements — Pronostics PMU | Free, Starter, Pro, Elite",
  description:
    "Accédez aux meilleurs pronostics PMU pour les parieurs francophones. 1 Tiercé gratuit par jour sans inscription. Plans payants à partir de 65€. Orange Money, MTN MoMo, Wave, CB.",
  alternates: { canonical: `${APP_URL}/abonnements` },
};

export const dynamic = "force-dynamic";

const PLAN_ICONS = { Starter: Zap, Pro: Star, Elite: Crown };

const PLAN_STYLES = {
  Starter: {
    border:   "border-border",
    iconBg:   "bg-bg-elevated border-border",
    iconText: "text-text-secondary",
    price:    "text-text-primary",
    btn:      "secondary" as const,
    glow:     "",
  },
  Pro: {
    border:   "border-gold-primary/60",
    iconBg:   "bg-gold-faint border-gold-primary/40",
    iconText: "text-gold-primary",
    price:    "text-gold-primary",
    btn:      "primary" as const,
    glow:     "ring-2 ring-gold-primary/20 shadow-gold",
  },
  Elite: {
    border:   "border-purple-500/40",
    iconBg:   "bg-purple-500/10 border-purple-500/30",
    iconText: "text-purple-400",
    price:    "text-purple-400",
    btn:      "elite" as const,
    glow:     "ring-1 ring-purple-500/20",
  },
};

const FAQ = [
  {
    q: "Comment fonctionne le plan Free ?",
    a: "Le plan Free vous donne accès à 1 pronostic Tiercé gratuit par jour, sans abonnement payant. Il vous suffit de créer un compte gratuit. Aucune carte bancaire requise.",
  },
  {
    q: "Comment fonctionne le paiement Mobile Money depuis l'Afrique ?",
    a: "Cliquez sur votre plan, choisissez Orange Money, MTN MoMo ou Wave. Vous recevez une notification push sur votre téléphone. Validez et votre accès est activé en moins de 2 minutes.",
  },
  {
    q: "Les prix sont en euros — puis-je payer en francs CFA ?",
    a: "Oui. Lors du paiement via Mobile Money (Orange, MTN, Wave), la conversion est effectuée automatiquement. Vous réglez l'équivalent en FCFA selon le cours du jour.",
  },
  {
    q: "Quand est-ce que j'accède aux pronostics ?",
    a: "Immédiatement après confirmation du paiement. Pas d'attente, pas de validation manuelle. Notre Quinté+ est publié chaque matin avant 8h heure de Paris.",
  },
  {
    q: "Puis-je annuler à tout moment ?",
    a: "Oui. L'abonnement est mensuel sans engagement. Vous gardez l'accès jusqu'à la fin de la période payée.",
  },
  {
    q: "Quel plan choisir si je suis débutant ?",
    a: "Commencez par le plan Free : 1 Tiercé gratuit par jour pour tester notre approche. Quand vous êtes prêt, passez au Pack Starter (65€/7j) pour découvrir la méthode complète.",
  },
  {
    q: "Les pronostics couvrent-ils les courses que je joue depuis mon pays ?",
    a: "Oui. Que vous jouiez via le PMU-CI (Côte d'Ivoire), la Lonase (Sénégal), le PMU Maroc ou tout autre opérateur africain, les courses de référence sont les mêmes courses françaises que nous analysons.",
  },
];

export default async function AbonnementsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let currentPlan: string | null = null;
  if (user) {
    const serviceClient = createServiceClient();
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("statut_abonnement")
      .eq("id", user.id)
      .single();
    currentPlan = profile?.statut_abonnement || null;
  }

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil",      item: APP_URL },
      { "@type": "ListItem", position: 2, name: "Abonnements",  item: `${APP_URL}/abonnements` },
    ],
  };

  return (
    <div className="min-h-screen bg-bg-primary">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      <PageHero
        image="/images/heroes/hero-abonnements.jpg"
        titre="Choisissez votre accès"
        sousTitre="1 Tiercé gratuit par jour sans inscription. Accès complet à partir de 65€. Orange Money, MTN MoMo, Wave ou CB."
      />

      {/* ── TRUST STRIP (above the fold) ─────────────────────────────────
          Audit Clarity 18/05/2026 : sur /abonnements, scroll depth moyen
          ~60%, beaucoup quittent avant d'atteindre les réassurances qui
          étaient sous la grille de plans. Trust strip déplacé EN HAUT,
          immédiatement visible après le hero, pour répondre à la question
          "ce site est-il sûr ?" AVANT que l'utilisateur ne voit les prix.
          Impact attendu : +10-15% scroll depth + baisse du bounce rate. */}
      <div className="border-b border-border bg-bg-card/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 sm:gap-5 text-xs flex-wrap">
            <div className="flex items-center gap-2 text-status-win">
              <Shield className="w-4 h-4 flex-shrink-0" />
              <span className="font-semibold">Paiement 100% Sécurisé</span>
            </div>
            <span className="hidden sm:block w-px h-4 bg-border" aria-hidden="true" />
            <div className="flex items-center gap-2 text-gold-light">
              <Zap className="w-4 h-4 flex-shrink-0" />
              <span className="font-semibold">Activation en moins de 2 min</span>
            </div>
            <span className="hidden sm:block w-px h-4 bg-border" aria-hidden="true" />
            <div className="flex items-center gap-2 text-text-secondary">
              <Clock className="w-4 h-4 flex-shrink-0" />
              <span className="font-semibold">Sans engagement · Résiliable</span>
            </div>
            <span className="hidden sm:block w-px h-4 bg-border" aria-hidden="true" />
            <div className="flex items-center gap-2 text-text-secondary">
              <MessageCircle className="w-4 h-4 flex-shrink-0" />
              <span className="font-semibold">Support WhatsApp · 30 min</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 space-y-16">

        {/* ── BANDEAU PROMO LANCEMENT ── */}
        {PROMO.actif && (
          <div className="mt-8 relative overflow-hidden rounded-2xl border border-gold-primary/40 bg-gradient-to-r from-bg-card via-gold-faint to-bg-card">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold-primary to-transparent" />
            <div className="px-6 py-5 flex flex-col sm:flex-row items-center gap-5">
              <div className="flex-shrink-0 w-14 h-14 rounded-2xl bg-gold-primary/10 border border-gold-primary/30 flex items-center justify-center">
                <Flame className="w-7 h-7 text-gold-primary" />
              </div>
              <div className="flex-1 text-center sm:text-left">
                <p className="text-gold-primary font-bold text-sm uppercase tracking-wider mb-0.5">
                  🎉 Offre de lancement — {PROMO.reductionPct}% de réduction
                </p>
                <p className="text-text-primary font-semibold text-base">
                  Rejoignez Elite Turf au meilleur prix avant le <span className="text-gold-light">{PROMO.dateExpiration}</span>
                </p>
                <p className="text-text-muted text-sm mt-0.5">
                  Code&nbsp;
                  <span className="font-mono font-bold text-gold-primary bg-gold-primary/10 px-2 py-0.5 rounded border border-gold-primary/30">
                    {PROMO.code}
                  </span>
                  &nbsp;·&nbsp;Starter&nbsp;
                  <span className="line-through text-text-muted">{PROMO.prix.Starter}€</span>
                  &nbsp;<span className="font-bold text-status-win">{PROMO.prixReduits.Starter.toLocaleString("fr-FR", { minimumFractionDigits: 2 })}€</span>
                  &nbsp;·&nbsp;Pro&nbsp;
                  <span className="line-through text-text-muted">{PROMO.prix.Pro}€</span>
                  &nbsp;<span className="font-bold text-status-win">{PROMO.prixReduits.Pro.toLocaleString("fr-FR", { minimumFractionDigits: 2 })}€</span>
                  &nbsp;·&nbsp;Elite&nbsp;
                  <span className="line-through text-text-muted">{PROMO.prix.Elite}€</span>
                  &nbsp;<span className="font-bold text-status-win">{PROMO.prixReduits.Elite.toLocaleString("fr-FR", { minimumFractionDigits: 2 })}€</span>
                </p>
              </div>
              <a href="#plans" className="flex-shrink-0 px-5 py-2.5 bg-gold-primary hover:bg-gold-dark text-bg-primary font-bold text-sm rounded-xl transition-colors shadow-gold whitespace-nowrap">
                J&apos;en profite →
              </a>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold-primary to-transparent" />
          </div>
        )}

        {/* ── CTA Guide Gratuit ── */}
        <div className="mt-4 p-4 rounded-xl bg-gold-faint border border-gold-primary/30 flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
          <div className="text-2xl">📥</div>
          <div className="flex-1">
            <p className="text-text-primary font-semibold text-sm">Nouveau sur Elite Turf ?</p>
            <p className="text-text-secondary text-sm">
              Commencez par notre guide gratuit — <span className="text-gold-light font-medium">5 secrets pour détecter les outsiders gagnants</span>
            </p>
          </div>
          <a href="/guide-initie" className="flex-shrink-0 px-4 py-2 bg-gold-primary hover:bg-gold-dark text-bg-primary font-bold text-sm rounded-xl transition-colors shadow-gold-sm whitespace-nowrap">
            Télécharger gratuitement →
          </a>
        </div>

        {/* ── 4 PLANS ── */}
        <div id="plans" className="-mt-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">

            {/* ── Plan FREE (statique) ── */}
            <div className={`card-base border-2 border-status-win/30 relative flex flex-col p-6 transition-all ${currentPlan === "GRATUIT" ? "ring-2 ring-status-win/20" : ""}`}>
              <div className="mb-6">
                <div className="w-12 h-12 rounded-2xl border bg-status-win/10 border-status-win/20 flex items-center justify-center mb-4">
                  <Gift className="w-6 h-6 text-status-win" />
                </div>
                <h2 className="font-serif font-bold text-2xl text-text-primary mb-1">FREE</h2>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-status-win/80 mb-1">
                  Accès gratuit permanent
                </p>
                <p className="text-text-secondary text-sm mb-4">Essayer avant de s&apos;engager</p>

                {/* Niveau */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-text-muted">Niveau de filtrage</span>
                    <span className="text-xs font-bold text-status-win">Découverte</span>
                  </div>
                  <div className="w-full bg-bg-elevated rounded-full h-1.5">
                    <div className="h-1.5 rounded-full bg-status-win/60" style={{ width: "20%" }} />
                  </div>
                  <div className="flex mt-1 gap-0.5">
                    {[1,2,3,4,5].map(s => (
                      <span key={s} className={`text-xs ${s === 1 ? "text-status-win" : "text-text-muted"}`}>◆</span>
                    ))}
                  </div>
                </div>

                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold font-serif text-status-win">0</span>
                  <span className="text-text-muted text-sm">€</span>
                </div>
                <p className="text-text-muted text-xs mt-1">Sans engagement · Permanent</p>
              </div>

              <ul className="space-y-3 mb-8 flex-1">
                {[
                  "1 pronostic Tiercé gratuit par jour",
                  "Accès aux résultats publics",
                  "Lecture de la page Pronostics",
                  "Sans carte bancaire",
                  "Inscription en 30 secondes",
                ].map((f, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 mt-0.5 flex-shrink-0 text-status-win" />
                    <span className="text-text-secondary text-sm">{f}</span>
                  </li>
                ))}
              </ul>

              {currentPlan === "GRATUIT" ? (
                <div className="w-full py-3 rounded-xl text-center text-sm font-semibold bg-status-win/10 text-status-win border border-status-win/20">
                  ✓ Votre plan actuel
                </div>
              ) : user ? (
                <Link href="/pronostics" className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold border border-status-win/30 text-status-win hover:bg-status-win/10 transition-all">
                  Voir les pronostics gratuits
                </Link>
              ) : (
                <Link href="/inscription" className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold border border-status-win/30 text-status-win hover:bg-status-win/10 transition-all">
                  <Users className="w-4 h-4" />
                  Créer un compte gratuit
                </Link>
              )}
            </div>

            {/* ── Plans payants (Starter / Pro / Elite) — le plan "Test" est masqué ici ── */}
            {PLAN_CONFIG.filter((p) => p.nom !== "Test").map((plan) => {
              const Icon   = PLAN_ICONS[plan.nom as keyof typeof PLAN_ICONS];
              const styles = PLAN_STYLES[plan.nom as keyof typeof PLAN_STYLES];
              const isCurrentPlan =
                (plan.nom === "Starter" && currentPlan === "STARTER") ||
                (plan.nom === "Pro"     && currentPlan === "PRO")     ||
                (plan.nom === "Elite"   && currentPlan === "ELITE");

              return (
                <div
                  key={plan.id}
                  id={plan.id}
                  className={`card-base border-2 ${styles.border} ${styles.glow} relative flex flex-col p-6 transition-all`}
                >
                  {/* Badges */}
                  {plan.populaire && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-10">
                      <span className="px-4 py-1.5 bg-gold-primary text-bg-primary text-[11px] font-bold rounded-full whitespace-nowrap shadow-gold">
                        ⭐ LE PLUS POPULAIRE
                      </span>
                    </div>
                  )}
                  {plan.nom === "Elite" && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-10">
                      <span className="px-4 py-1.5 bg-purple-600 text-white text-[11px] font-bold rounded-full whitespace-nowrap">
                        👑 LA PLUS SÉLECTIVE
                      </span>
                    </div>
                  )}

                  <div className="mb-6">
                    <div className={`w-12 h-12 rounded-2xl border ${styles.iconBg} flex items-center justify-center mb-4`}>
                      {Icon && <Icon className={`w-6 h-6 ${styles.iconText}`} />}
                    </div>
                    <h2 className="font-serif font-bold text-2xl text-text-primary mb-1">
                      {plan.nom.toUpperCase()}
                    </h2>
                    {plan.nom === "Starter" && (
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted/80 mb-1">
                        Découvrir la méthode
                      </p>
                    )}
                    {plan.nom === "Pro" && (
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-gold-primary/80 mb-1">
                        Le pack le plus équilibré
                      </p>
                    )}
                    {plan.nom === "Elite" && (
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-purple-400/80 mb-1">
                        La sélection dans la sélection
                      </p>
                    )}
                    <p className="text-text-secondary text-sm mb-3">{plan.description}</p>

                    {/* Niveau de filtrage */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-text-muted">Niveau de filtrage</span>
                        <span className={`text-xs font-bold ${plan.nom === "Elite" ? "text-purple-400" : plan.populaire ? "text-gold-primary" : "text-status-win"}`}>
                          {plan.nom === "Starter" ? "Standard" : plan.nom === "Pro" ? "Optimisé" : "Expert"}
                        </span>
                      </div>
                      <div className="w-full bg-bg-elevated rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full ${plan.nom === "Elite" ? "bg-purple-400" : plan.populaire ? "bg-gold-primary" : "bg-status-win"}`}
                          style={{ width: plan.nom === "Starter" ? "45%" : plan.nom === "Pro" ? "75%" : "100%" }}
                        />
                      </div>
                      <div className="flex mt-1 gap-0.5">
                        {[1,2,3,4,5].map(s => (
                          <span key={s} className={`text-xs ${
                            (plan.nom === "Starter" && s <= 2) || (plan.nom === "Pro" && s <= 4) || plan.nom === "Elite"
                              ? plan.nom === "Elite" ? "text-purple-400" : plan.populaire ? "text-gold-primary" : "text-status-win"
                              : "text-text-muted"
                          }`}>◆</span>
                        ))}
                      </div>
                    </div>

                    {PROMO.actif && plan.nom in PROMO.prixReduits ? (
                      <div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-xl font-medium text-text-muted line-through">
                            {plan.prix_eur.toLocaleString("fr-FR", { minimumFractionDigits: 2 })}€
                          </span>
                          <span className="text-xs font-bold px-1.5 py-0.5 bg-status-win/10 text-status-win border border-status-win/20 rounded-full">
                            −{PROMO.reductionPct}%
                          </span>
                        </div>
                        <div className="flex items-baseline gap-1">
                          <span className={`text-4xl font-bold font-serif ${styles.price}`}>
                            {PROMO.prixReduits[plan.nom as keyof typeof PROMO.prixReduits].toLocaleString("fr-FR", { minimumFractionDigits: 2 })}
                          </span>
                          <span className="text-text-muted text-sm">€</span>
                        </div>
                        <p className="text-status-win text-xs mt-0.5 font-semibold">
                          Économie {PROMO.economies[plan.nom as keyof typeof PROMO.economies].toLocaleString("fr-FR", { minimumFractionDigits: 2 })}€ · jusqu&apos;au {PROMO.dateExpiration}
                        </p>
                      </div>
                    ) : (
                      <div className="flex items-baseline gap-2">
                        <span className={`text-4xl font-bold font-serif ${styles.price}`}>
                          {plan.prix_eur.toLocaleString("fr-FR", { minimumFractionDigits: 2 })}
                        </span>
                        <span className="text-text-muted text-sm">€</span>
                      </div>
                    )}
                    <p className="text-text-muted text-xs mt-1">
                      {plan.duree_jours} jours · Orange Money, MTN, Wave acceptés
                    </p>
                  </div>

                  <ul className="space-y-3 mb-8 flex-1">
                    {plan.features.map((f, i) => (
                      <li key={i} className="flex items-start gap-2.5">
                        <Check className={`w-4 h-4 mt-0.5 flex-shrink-0 ${plan.populaire ? "text-gold-primary" : plan.nom === "Elite" ? "text-purple-400" : "text-status-win"}`} />
                        <span className="text-text-secondary text-sm">{f}</span>
                      </li>
                    ))}
                  </ul>

                  {isCurrentPlan ? (
                    <div className="w-full py-3 rounded-xl text-center text-sm font-semibold bg-status-win/10 text-status-win border border-status-win/20">
                      ✓ Plan actuel
                    </div>
                  ) : (
                    <PaiementButton
                      plan={plan}
                      userId={user?.id}
                      userEmail={user?.email}
                      variant={styles.btn}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Réassurance déplacée en haut de page (trust strip above the fold). */}
        </div>

        {/* ── MOYENS DE PAIEMENT ── */}
        <div className="text-center">
          <p className="text-text-muted text-xs uppercase tracking-widest font-semibold mb-5">
            Moyens de paiement acceptés
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            {[
              { emoji: "🟠", label: "Orange Money CI" },
              { emoji: "🟡", label: "MTN MoMo" },
              { emoji: "🔵", label: "Wave" },
              { emoji: "💳", label: "Visa / Mastercard" },
            ].map((p) => (
              <div key={p.label} className="flex items-center gap-2 px-4 py-2.5 bg-bg-card border border-border rounded-xl">
                <span className="text-lg">{p.emoji}</span>
                <span className="text-text-secondary text-sm font-medium">{p.label}</span>
              </div>
            ))}
          </div>
          <div className="mt-5 flex items-center justify-center gap-2 text-text-muted text-xs">
            <Clock className="w-3.5 h-3.5" />
            Activation de l&apos;accès en moins de 2 minutes après paiement
          </div>
        </div>

        {/* ── TABLEAU COMPARATIF ── */}
        <div className="card-base overflow-hidden">
          <div className="p-5 border-b border-border">
            <h2 className="font-serif font-bold text-text-primary text-lg text-center">Comparaison détaillée</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-bg-elevated">
                  <th className="text-left px-5 py-3 text-text-muted text-xs font-semibold uppercase tracking-wider w-1/3">Fonctionnalité</th>
                  {[
                    { label: "Free",    color: "text-status-win"  },
                    { label: "Starter", color: "text-text-muted"  },
                    { label: "Pro",     color: "text-gold-light"  },
                    { label: "Elite",   color: "text-purple-400"  },
                  ].map(({ label, color }) => (
                    <th key={label} className={`px-4 py-3 text-center text-xs font-bold uppercase tracking-wider ${color}`}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {[
                  { label: "Durée",                       values: ["Permanent",      "7 jours",        "30 jours",             "30 jours"]          },
                  { label: "Tiercé gratuit / jour",       values: ["1 / jour",       "—",              "—",                    "—"]                 },
                  { label: "Pronostics par jour",         values: ["—",              "3 / semaine",    "1+ quotidien",         "1+ premium"]        },
                  { label: "Pronostics Tiercé / Quarté",  values: ["—",              "✓",              "✓",                    "✓"]                 },
                  { label: "Pronostics Quinté+",          values: ["—",              "—",              "✓",                    "✓"]                 },
                  { label: "Type de sélection",           values: ["Tiercé simple",  "Lecture simple", "8 chevaux",            "6 chevaux (filtrée)"]},
                  { label: "Niveau de filtrage",          values: ["Découverte",     "Standard",       "Optimisé",             "Expert"]            },
                  { label: "Analyse incluse",             values: ["—",              "Courte",         "Claire & structurée",  "Filtrée & exigeante"]},
                  { label: "Alerte Dernière Minute",      values: ["—",              "—",              "Email",                "WhatsApp"]          },
                  { label: "Gestion de mise",             values: ["—",              "—",              "Détaillée",            "Personnalisée"]     },
                  { label: "Alertes SMS / Push",          values: ["—",              "5 / mois",       "20 / mois",            "Illimitées"]        },
                  { label: "Statistiques",                values: ["—",              "—",              "Complètes",            "Export Excel / PDF"]},
                  { label: "Support WhatsApp",            values: ["—",              "—",              "48h",                  "Prioritaire"]       },
                  { label: "Résiliable à tout moment",    values: ["—",              "✓",              "✓",                    "✓"]                 },
                ].map((row, i) => (
                  <tr key={i} className="hover:bg-bg-hover transition-colors">
                    <td className="px-5 py-3 text-text-secondary text-sm">{row.label}</td>
                    {row.values.map((v, j) => (
                      <td key={j} className={`px-4 py-3 text-center text-sm font-medium ${
                        v === "—" ? "text-text-muted" :
                        j === 0 ? "text-status-win" :
                        j === 2 ? "text-gold-light" :
                        j === 3 ? "text-purple-400" :
                        "text-text-secondary"
                      }`}>
                        {v}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── FAQ ── */}
        <div className="max-w-2xl mx-auto">
          <h2 className="font-serif font-bold text-text-primary text-2xl text-center mb-8">Questions fréquentes</h2>
          <div className="space-y-3">
            {FAQ.map((item, i) => (
              <details key={i} className="card-base group">
                <summary className="p-4 cursor-pointer flex items-start justify-between gap-3 list-none">
                  <span className="text-text-primary text-sm font-semibold leading-snug">{item.q}</span>
                  <ChevronDown className="w-4 h-4 text-text-muted flex-shrink-0 mt-0.5 group-open:rotate-180 transition-transform" />
                </summary>
                <div className="px-4 pb-4">
                  <p className="text-text-secondary text-sm leading-relaxed border-t border-border/50 pt-3">{item.a}</p>
                </div>
              </details>
            ))}
          </div>
        </div>

        {/* ── BESOIN D'AIDE ── */}
        <div className="text-center p-6 rounded-2xl bg-bg-card border border-border">
          <MessageCircle className="w-8 h-8 text-gold-primary mx-auto mb-3" />
          <h3 className="font-serif font-semibold text-text-primary text-lg mb-2">Besoin d&apos;aide pour choisir ?</h3>
          <p className="text-text-secondary text-sm mb-4">Notre équipe répond sur WhatsApp en moins de 30 minutes</p>
          <a
            href="https://wa.me/+33644686720?text=Bonjour, j'aimerais des informations sur les abonnements Elite Turf"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#25D366] hover:bg-[#1ebe5d] text-white font-bold text-sm rounded-xl transition-colors"
          >
            <MessageCircle className="w-4 h-4" />
            Nous contacter sur WhatsApp
          </a>
        </div>

        {/* FAQ Schema.org — boost CTR via rich snippets en SERP commerciale */}
        <FaqJsonLd items={ABONNEMENTS_FAQ} />
        <FaqSection items={ABONNEMENTS_FAQ} title="Questions fréquentes sur les abonnements" />

      </div>
    </div>
  );
}
