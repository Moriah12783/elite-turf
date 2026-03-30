import { Metadata } from "next";
import Link from "next/link";
import {
  Check, Star, Zap, Crown, Shield, Clock,
  MessageCircle, ChevronDown, ArrowRight, Users
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PLAN_CONFIG } from "@/types";
import PaiementButton from "@/components/abonnements/PaiementButton";
import PageHero from "@/components/layout/PageHero";

export const metadata: Metadata = {
  title: "Abonnements — Pronostics PMU dès 29€",
  description:
    "Accédez aux meilleurs pronostics PMU pour les parieurs francophones. Plans à partir de 29€. Paiement Orange Money, MTN MoMo, Wave, CB. Accès immédiat après paiement.",
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
    a: "Commencez par le Plan Starter (29€). Il couvre le Tiercé PMU et vous donne accès à 3 analyses par semaine sur Vincennes et Longchamp — idéal pour débuter.",
  },
  {
    q: "Les pronostics couvrent-ils les courses que je joue depuis mon pays ?",
    a: "Oui. Que vous jouiez via le PMU-CI (Côte d'Ivoire), la Lonase (Sénégal), le PMU Maroc ou tout autre opérateur africain, les courses de référence sont les mêmes courses françaises que nous analysons (Vincennes, Longchamp, Chantilly).",
  },
];

export default async function AbonnementsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let currentPlan = null;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("statut_abonnement, nom_complet")
      .eq("id", user.id)
      .single();
    currentPlan = profile?.statut_abonnement;
  }

  return (
    <div className="min-h-screen bg-bg-primary">

      <PageHero
        image="/images/heroes/hero-abonnements.jpg"
        titre="Nos Abonnements"
        sousTitre="À partir de 29€ — Orange Money, MTN MoMo, Wave ou Carte bancaire. Accès immédiat."
      />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 space-y-16">

        {/* ── CTA Guide Gratuit ─────────────────────────────────────── */}
        <div className="mt-8 p-4 rounded-xl bg-gold-faint border border-gold-primary/30 flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
          <div className="text-2xl">📥</div>
          <div className="flex-1">
            <p className="text-text-primary font-semibold text-sm">
              Nouveau sur Elite Turf ?
            </p>
            <p className="text-text-secondary text-sm">
              Commencez par notre guide gratuit — <span className="text-gold-light font-medium">5 secrets pour détecter les outsiders gagnants</span>
            </p>
          </div>
          <a
            href="/guide-initie"
            className="flex-shrink-0 px-4 py-2 bg-gold-primary hover:bg-gold-dark text-bg-primary font-bold text-sm rounded-xl transition-colors shadow-gold-sm whitespace-nowrap"
          >
            Télécharger gratuitement →
          </a>
        </div>

        {/* ── PLANS ────────────────────────────────────────────────── */}
        <div id="plans" className="-mt-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {PLAN_CONFIG.map((plan) => {
              const Icon   = PLAN_ICONS[plan.nom];
              const styles = PLAN_STYLES[plan.nom];
              const isCurrentPlan =
                (plan.nom === "Starter" && currentPlan === "PREMIUM") ||
                (plan.nom === "Elite"   && currentPlan === "VIP");

              return (
                <div
                  key={plan.id}
                  id={plan.id}
                  className={`card-base border-2 ${styles.border} ${styles.glow} relative flex flex-col p-6 transition-all`}
                >
                  {/* Populaire badge */}
                  {plan.populaire && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-10">
                      <span className="px-4 py-1.5 bg-gold-primary text-bg-primary text-[11px] font-bold rounded-full whitespace-nowrap shadow-gold">
                        ⭐ LE PLUS POPULAIRE
                      </span>
                    </div>
                  )}

                  {/* Plan header */}
                  <div className="mb-6">
                    <div className={`w-12 h-12 rounded-2xl border ${styles.iconBg} flex items-center justify-center mb-4`}>
                      <Icon className={`w-6 h-6 ${styles.iconText}`} />
                    </div>
                    <h2 className="font-serif font-bold text-2xl text-text-primary mb-1">
                      {plan.nom === "Starter" ? "PACK DÉCOUVERTE" : plan.nom === "Pro" ? "PACK PERFORMANCE" : "PACK ELITE"}
                    </h2>
                    <p className="text-text-secondary text-sm mb-3">{plan.description}</p>

                    {/* Taux de réussite */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-text-muted">Taux de réussite</span>
                        <span className={`text-xs font-bold ${plan.nom === "Elite" ? "text-purple-400" : plan.populaire ? "text-gold-primary" : "text-status-win"}`}>
                          {plan.nom === "Starter" ? "~70%" : plan.nom === "Pro" ? "~82%" : "+92%"}
                        </span>
                      </div>
                      <div className="w-full bg-bg-elevated rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full ${plan.nom === "Elite" ? "bg-purple-400" : plan.populaire ? "bg-gold-primary" : "bg-status-win"}`}
                          style={{ width: plan.nom === "Starter" ? "70%" : plan.nom === "Pro" ? "82%" : "92%" }}
                        />
                      </div>
                      <div className="flex mt-1 gap-0.5">
                        {[1,2,3,4,5].map(s => (
                          <span key={s} className={`text-xs ${
                            (plan.nom === "Starter" && s <= 3) || (plan.nom === "Pro" && s <= 4) || plan.nom === "Elite"
                              ? plan.nom === "Elite" ? "text-purple-400" : plan.populaire ? "text-gold-primary" : "text-status-win"
                              : "text-text-muted"
                          }`}>⭐</span>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-baseline gap-2">
                      <span className={`text-4xl font-bold font-serif ${styles.price}`}>
                        {plan.prix_eur.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      <span className="text-text-muted text-sm">€</span>
                    </div>
                    <p className="text-text-muted text-xs mt-1">
                      {plan.duree_jours} jours · Orange Money, MTN, Wave acceptés
                    </p>
                  </div>

                  {/* Features */}
                  <ul className="space-y-3 mb-8 flex-1">
                    {plan.features.map((f, i) => (
                      <li key={i} className="flex items-start gap-2.5">
                        <Check className={`w-4 h-4 mt-0.5 flex-shrink-0 ${plan.populaire ? "text-gold-primary" : plan.nom === "Elite" ? "text-purple-400" : "text-status-win"}`} />
                        <span className="text-text-secondary text-sm">{f}</span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
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

          {/* Garantie + réassurance */}
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3 text-xs flex-wrap">
            <div className="flex items-center gap-2 px-4 py-2 bg-status-win/5 border border-status-win/20 rounded-full text-status-win">
              <Shield className="w-3.5 h-3.5" />
              Paiement 100% Sécurisé
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-gold-faint border border-gold-primary/20 rounded-full text-gold-light">
              <span>⚡</span>
              Activation instantanée après paiement
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-bg-elevated border border-border rounded-full text-text-secondary">
              <span>↩️</span>
              Résiliable à tout moment
            </div>
          </div>
        </div>

        {/* ── MOYENS DE PAIEMENT ───────────────────────────────────── */}
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

        {/* ── TABLEAU COMPARATIF ───────────────────────────────────── */}
        <div className="card-base overflow-hidden">
          <div className="p-5 border-b border-border">
            <h2 className="font-serif font-bold text-text-primary text-lg text-center">
              Comparaison détaillée
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-bg-elevated">
                  <th className="text-left px-5 py-3 text-text-muted text-xs font-semibold uppercase tracking-wider">Fonctionnalité</th>
                  {PLAN_CONFIG.map((p) => (
                    <th key={p.id} className={`px-4 py-3 text-center text-xs font-bold uppercase tracking-wider ${p.populaire ? "text-gold-light" : "text-text-muted"}`}>
                      {p.nom}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {[
                  { label: "Durée",                        values: ["7 jours", "30 jours", "90 jours"] },
                  { label: "Objectif de réussite",         values: ["~70%", "~82%", "+92%"] },
                  { label: "Indice de confiance",          values: ["⭐⭐⭐", "⭐⭐⭐⭐", "⭐⭐⭐⭐⭐"] },
                  { label: "Pronostics Tiercé / Quarté",   values: ["3/sem", "Illimité", "Illimité"] },
                  { label: "Pronostics Quinté+",           values: ["—", "✓", "✓"] },
                  { label: "Pronostics VIP exclusifs",     values: ["—", "—", "✓"] },
                  { label: "Type de sélection",            values: ["Standard", "Optimisée", "Expert (réduite)"] },
                  { label: "Alerte Dernière Minute",       values: ["—", "Email", "WhatsApp"] },
                  { label: "Gestion de mise",              values: ["Basique", "Détaillée", "Personnalisée"] },
                  { label: "Analyse d'expert",             values: ["Courte", "Complète", "Complète + Vidéo"] },
                  { label: "Alertes SMS/Push",             values: ["5/mois", "20/mois", "Illimitées"] },
                  { label: "Statistiques",                 values: ["Basiques", "Complètes", "Export Excel/PDF"] },
                  { label: "Support WhatsApp",             values: ["—", "48h", "Prioritaire"] },
                  { label: "Hippodromes couverts",         values: ["Vincennes, Longchamp", "V, LC, Chantilly, Deauville", "Tous (8 hippodromes FR)"] },
                ].map((row, i) => (
                  <tr key={i} className="hover:bg-bg-hover transition-colors">
                    <td className="px-5 py-3 text-text-secondary text-sm">{row.label}</td>
                    {row.values.map((v, j) => (
                      <td key={j} className={`px-4 py-3 text-center text-sm font-medium ${
                        v === "—" ? "text-text-muted" :
                        j === 1 ? "text-gold-light" :
                        j === 2 ? "text-purple-400" :
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

        {/* ── FAQ ──────────────────────────────────────────────────── */}
        <div className="max-w-2xl mx-auto">
          <h2 className="font-serif font-bold text-text-primary text-2xl text-center mb-8">
            Questions fréquentes
          </h2>
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

        {/* ── BESOIN D'AIDE ─────────────────────────────────────────── */}
        <div className="text-center p-6 rounded-2xl bg-bg-card border border-border">
          <MessageCircle className="w-8 h-8 text-gold-primary mx-auto mb-3" />
          <h3 className="font-serif font-semibold text-text-primary text-lg mb-2">
            Besoin d&apos;aide pour choisir ?
          </h3>
          <p className="text-text-secondary text-sm mb-4">
            Notre équipe répond sur WhatsApp en moins de 30 minutes
          </p>
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

      </div>
    </div>
  );
}
