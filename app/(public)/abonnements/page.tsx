import { Metadata } from "next";
import Link from "next/link";
import {
  Check, Star, Zap, Crown, Shield, Clock,
  MessageCircle, ArrowRight, Gift, Users, Flame, BellRing
} from "lucide-react";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { PLAN_CONFIG } from "@/types";
import PaiementButton from "@/components/abonnements/PaiementButton";
import PageHero from "@/components/layout/PageHero";
import { PROMO } from "@/lib/promo";
import FaqJsonLd, { FaqSection } from "@/components/seo/FaqJsonLd";
import { whatsappUrl } from "@/lib/constants/whatsapp";
import { OFFRE_PRONOSTICS_EXPERTS } from "@/lib/pricing";
import TrackPageView from "@/components/analytics/TrackPageView";

// FAQ Schema.org — visent les requêtes "comment payer pmu mobile money",
// "abonnement quinté+", "tarif pronostic pmu", "annuler abonnement".
// Page à forte intent commercial → rich snippet = boost CTR critique.
//
// SOURCE UNIQUE de la FAQ /abonnements (audit Sprint 1, P6) : fusion des deux
// anciens blocs (« Questions fréquentes » manuel + « FAQ abonnements ») en un
// seul array de 10 questions dédupliquées, rendu UNE fois (FaqSection) avec UN
// seul JSON-LD FAQPage (FaqJsonLd).
const ABONNEMENTS_FAQ = [
  {
    question: "Comment fonctionne le plan Free ?",
    answer:
      "Le plan Free vous donne accès à la Sélection stats sur chaque course du programme : notre lecture statistique (favoris au marché, drivers et entraîneurs reconnus, forme) pour structurer vos paris et comprendre la course. Elle est différente de nos pronostics du jour — l'analyse experte réservée aux abonnés Starter, Pro et Elite. C'est gratuit, sans carte bancaire.",
  },
  {
    question: "Quelle est la différence entre Starter, Pro et Elite ?",
    answer:
      "Le pack Starter donne accès aux pronostics Pro (Tiercé, Quarté+). Le pack Pro ajoute le Quinté+ premium et l'historique 30 jours. Le pack Elite inclut tout cela + l'accès aux analyses Elite Top Selection avec score composite, les notifications WhatsApp prioritaires et le support direct sous 2h. Les tarifs commencent à 65€ pour 7 jours d'accès Starter.",
  },
  {
    question: "Quel plan choisir si je suis débutant ?",
    answer:
      "Commencez par le plan Free : la Sélection stats gratuite sur chaque course pour vous familiariser avec notre lecture. Quand vous êtes prêt, passez au Pack Starter (65€/7j) pour accéder à nos pronostics experts du jour.",
  },
  {
    question: "Comment payer mon abonnement Elite Turf ?",
    answer:
      "Le paiement se fait par carte bancaire (Visa / Mastercard) : toutes les cartes de tous les pays sont acceptées — prépayée, virtuelle ou débit (y compris les cartes prépayées Wave et Orange Money). Votre accès est activé immédiatement après le paiement. Le paiement Mobile Money (Orange Money, MTN, Wave) sera bientôt disponible pour le Burkina Faso, le Mali, le Sénégal et d'autres pays.",
  },
  {
    question: "Les prix sont en euros — puis-je payer depuis l'Afrique ?",
    answer:
      "Oui. Vous payez par carte bancaire en euros — toutes les cartes africaines sont acceptées, y compris les cartes prépayées virtuelles Wave / Orange Money que la plupart des wallets permettent de créer. Le paiement direct en Mobile Money (FCFA) arrive bientôt.",
  },
  {
    question: "Quand est-ce que j'accède aux pronostics ?",
    answer:
      "Immédiatement après confirmation du paiement. Pas d'attente, pas de validation manuelle. Les pronostics du jour sont publiés chaque matin entre 8h30 et 9h30 (heure GMT, soit l'heure locale d'Abidjan et Dakar), et vous êtes alerté par email et WhatsApp dès leur mise en ligne.",
  },
  {
    question: "Que se passe-t-il si mon premier pronostic expert est perdant ?",
    answer:
      "Nous prolongeons votre accès de 7 jours, offerts. La garantie s'applique au premier pronostic expert reçu après votre souscription, une fois par abonné : écrivez-nous simplement sur WhatsApp et la prolongation est appliquée après vérification du résultat.",
  },
  {
    question: "Puis-je annuler mon abonnement à tout moment ?",
    answer:
      "Oui. Si vous avez activé le renouvellement automatique (option proposée au paiement), vous l'annulez en un clic depuis votre espace membre : l'accès reste actif jusqu'à la fin de la période en cours, sans nouveau prélèvement. Par défaut, sans cette option, rien n'est reconduit — vous payez une période fixe, puis vous décidez librement de renouveler ou non.",
  },
  {
    question: "Je n'arrive pas à payer, que faire ?",
    answer:
      "Vérifiez que votre carte est autorisée pour les paiements en ligne / internationaux et que le solde est suffisant. Une carte prépayée virtuelle (Wave, Orange Money) fonctionne très bien. Si le problème persiste, contactez-nous sur WhatsApp au +33 6 44 68 67 20 — nous répondons sous 2h en moyenne.",
  },
  {
    question: "Quel est le délai de remboursement en cas de problème ?",
    answer:
      "Si vous rencontrez un problème technique majeur dans les 24h suivant votre paiement (compte non activé, accès refusé, etc.), nous procédons à un remboursement intégral sous 48h ouvrées. Pour toute autre demande, contactez notre support à contact@elite-turf.fr.",
  },
  {
    question: "Les pronostics couvrent-ils les courses que je joue depuis mon pays ?",
    answer:
      "Oui. Que vous jouiez via le PMU-CI (Côte d'Ivoire), la Lonase (Sénégal), le PMU Maroc ou tout autre opérateur africain, les courses de référence sont les mêmes courses françaises que nous analysons.",
  },
];

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://www.elite-turf.fr");

// ── Metadata CTR boost (Sprint A 21/05/2026) ──
// Avant : "Abonnements — Pronostics PMU | Free, Starter, Pro, Elite" (56c)
// Après : emoji 💎 en début pour signal visuel SERP + prix concret + brand.
// Description plus dense avec chiffre de réussite implicite (Mobile Money).
export const metadata: Metadata = {
  // NB : pas de suffixe « | Elite Turf » ici — le template du root layout
  // ("%s | Elite Turf") l'ajoute déjà (audit Sprint 1, P6 : title doublé).
  title: "💎 Abonnements Pronostics PMU — Free, Starter 65€, Pro 152€, Elite",
  description:
    "💎 Pronostics PMU Elite Turf : Free avec la Sélection stats sur chaque course, Starter 65€, Pro 152€ (Quinté+ premium), Elite 208€. Paiement par carte bancaire (Visa/Mastercard), toutes cartes tous pays.",
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

export default async function AbonnementsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let currentPlan: string | null = null;
  let isAdmin = false;
  if (user) {
    const serviceClient = createServiceClient();
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("statut_abonnement, role")
      .eq("id", user.id)
      .single();
    currentPlan = profile?.statut_abonnement || null;
    isAdmin = profile?.role === "ADMIN";
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
      {/* Tracking GA4 : view_pricing (funnel acquisition → conversion) */}
      <TrackPageView event="view_pricing" params={{ source: "abonnements" }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      <PageHero
        image="/images/heroes/hero-abonnements.jpg"
        titre="Choisissez votre accès"
        sousTitre="Sélection stats gratuite sur chaque course du jour. Accès complet aux pronostics experts à partir de 65€. Carte bancaire (Visa/Mastercard) — toutes cartes, tous pays. Mobile Money bientôt."
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
              <span className="font-semibold">Support WhatsApp · sous 2h</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── HORAIRE DE PUBLICATION + ALERTES ─────────────────────────────
          Pose une attente claire AVANT les prix : "quand vais-je recevoir
          mon pronostic du jour, et comment le saurai-je ?". L'horaire est
          donné en GMT (= heure locale d'Abidjan/Dakar, audience principale)
          et calé sur le créneau réel de publication (cron IA ~9h30 UTC).
          Bandeau pleine largeur, juste sous le hero = bien visible. */}
      <div className="border-b border-gold-primary/20 bg-gradient-to-r from-bg-card via-gold-faint/50 to-bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-7 text-center sm:text-left">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gold-primary/10 border border-gold-primary/30 flex items-center justify-center">
                <Clock className="w-5 h-5 text-gold-primary" />
              </div>
              <p className="text-sm text-text-primary font-semibold leading-snug">
                Pronostics du jour publiés{" "}
                <span className="text-gold-light">chaque jour entre 8h30 et 9h30</span>
                <span className="text-text-muted font-normal"> (heure GMT · Abidjan / Dakar)</span>
              </p>
            </div>
            <span className="hidden sm:block w-px h-9 bg-border" aria-hidden="true" />
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-status-win/10 border border-status-win/20 flex items-center justify-center">
                <BellRing className="w-5 h-5 text-status-win" />
              </div>
              <p className="text-sm text-text-secondary leading-snug">
                Abonnés <span className="text-text-primary font-semibold">alertés par email et WhatsApp</span> dès la mise en ligne
              </p>
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

              <div className="flex-1 mb-8">
                <ul className="space-y-3">
                  {[
                    "Sélection stats sur chaque course du jour",
                    "Lecture statistique pour structurer vos paris",
                    "Accès aux résultats publics",
                    "Sans carte bancaire",
                    "Inscription en 30 secondes",
                  ].map((f, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 mt-0.5 flex-shrink-0 text-status-win" />
                      <span className="text-text-secondary text-sm">{f}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-text-muted text-[11px] italic leading-snug mt-4 border-t border-border/40 pt-3">
                  Sélection stats ≠ nos pronostics du jour : c&apos;est notre lecture
                  statistique pour comprendre la course. L&apos;analyse experte reste
                  réservée aux abonnés Starter / Pro / Elite.
                </p>
              </div>

              {currentPlan === "GRATUIT" ? (
                <div className="w-full space-y-2">
                  <div className="w-full py-3 rounded-xl text-center text-sm font-semibold bg-status-win/10 text-status-win border border-status-win/20">
                    ✓ Votre plan actuel
                  </div>
                  <Link href="/courses" className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold border border-status-win/30 text-status-win hover:bg-status-win/10 transition-all">
                    Voir la Sélection stats du jour
                  </Link>
                </div>
              ) : user ? (
                <Link href="/courses" className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold border border-status-win/30 text-status-win hover:bg-status-win/10 transition-all">
                  Voir la Sélection stats du jour
                </Link>
              ) : (
                <Link href="/inscription" className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold border border-status-win/30 text-status-win hover:bg-status-win/10 transition-all">
                  <Users className="w-4 h-4" />
                  Créer un compte gratuit
                </Link>
              )}
            </div>

            {/* ── Plans payants (Starter / Pro / Elite) — "Test" masqué au public, SAUF
                le plan test 1€ révélé à l'ADMIN pour valider le tunnel Stripe en live
                (TEMPORAIRE — à retirer après validation de la bascule compte Tsalach). ── */}
            {PLAN_CONFIG.filter((p) => p.nom !== "Test" || (isAdmin && p.id === "test")).map((plan) => {
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
                        Le galop d&apos;essai
                      </p>
                    )}
                    {plan.nom === "Pro" && (
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-gold-primary/80 mb-1">
                        Le choix de la majorité
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
                      {plan.duree_jours} jours · Carte bancaire (toutes cartes, tous pays)
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
              { emoji: "💳", label: "Visa / Mastercard" },
              { emoji: "🌍", label: "Toutes cartes, tous pays" },
              { emoji: "🪪", label: "Prépayée · virtuelle · débit" },
              { emoji: "⏳", label: "Mobile Money bientôt" },
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
                  { label: "Sélection stats", values: ["✓ chaque course", "✓",            "✓",                    "✓"]                 },
                  { label: "Pronostics experts du jour",  values: [OFFRE_PRONOSTICS_EXPERTS.free, OFFRE_PRONOSTICS_EXPERTS.starter, OFFRE_PRONOSTICS_EXPERTS.pro, OFFRE_PRONOSTICS_EXPERTS.elite] },
                  { label: "Pronostics Tiercé / Quarté",  values: ["—",              "✓",              "✓",                    "✓"]                 },
                  { label: "Pronostics Quinté+",          values: ["—",              "—",              "✓",                    "✓"]                 },
                  { label: "Couplé / Trio",               values: ["—",              "—",              "✓",                    "✓"]                 },
                  { label: "Type de sélection",           values: ["Tiercé simple",  "Base + appuis",  "8 chevaux hiérarchisés", "6 chevaux (filtrée)"]},
                  { label: "Niveau de filtrage",          values: ["Découverte",     "Standard",       "Optimisé",             "Expert"]            },
                  { label: "Analyse incluse",             values: ["—",              "Argumentée",     "Claire & structurée",  "Filtrée & exigeante"]},
                  { label: "Alerte Dernière Minute",      values: ["—",              "—",              "Email",                "WhatsApp"]          },
                  { label: "Gestion de mise",             values: ["—",              "Suggérée",       "Détaillée",            "Personnalisée"]     },
                  { label: "Alertes SMS / Push",          values: ["—",              "5 / mois",       "20 / mois",            "Illimitées"]        },
                  { label: "Statistiques",                values: ["—",              "Bilan hebdo",    "Complètes + ROI",      "Export Excel / PDF"]},
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

        {/* ── BESOIN D'AIDE ── */}
        <div className="text-center p-6 rounded-2xl bg-bg-card border border-border">
          <MessageCircle className="w-8 h-8 text-gold-primary mx-auto mb-3" />
          <h3 className="font-serif font-semibold text-text-primary text-lg mb-2">Besoin d&apos;aide pour choisir ?</h3>
          <p className="text-text-secondary text-sm mb-4">Notre équipe répond sur WhatsApp sous 2h en moyenne</p>
          <a
            href={whatsappUrl("Bonjour, j'aimerais des informations sur les abonnements Elite Turf")}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#25D366] hover:bg-[#1ebe5d] text-white font-bold text-sm rounded-xl transition-colors"
          >
            <MessageCircle className="w-4 h-4" />
            Nous contacter sur WhatsApp
          </a>
        </div>

        {/* FAQ unique (HTML + JSON-LD FAQPage) — fusion des 2 anciens blocs, audit P6 */}
        <FaqJsonLd items={ABONNEMENTS_FAQ} />
        <FaqSection items={ABONNEMENTS_FAQ} title="Questions fréquentes" />

      </div>
    </div>
  );
}
