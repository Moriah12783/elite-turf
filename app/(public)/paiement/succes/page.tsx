import { Metadata } from "next";
import Link from "next/link";
import { CheckCircle, Crown, ArrowRight, Star, Zap } from "lucide-react";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { PLAN_CONFIG } from "@/types";

export const metadata: Metadata = {
  title: "Paiement réussi — Elite Turf",
  description: "Votre abonnement Elite Turf est maintenant actif.",
};

export const dynamic = "force-dynamic";

const PLAN_ICONS = { Starter: Zap, Pro: Star, Elite: Crown };
const PLAN_COLORS = {
  Starter: "text-status-win",
  Pro: "text-gold-primary",
  Elite: "text-purple-400",
};

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export default async function PaiementSuccesPage({
  searchParams,
}: {
  searchParams: Promise<{ tx?: string; plan?: string; sandbox?: string }>;
}) {
  const params = await searchParams;
  const planId = params.plan;
  const isSandbox = params.sandbox === "1";
  const plan = PLAN_CONFIG.find((p) => p.id === planId);

  // Récupérer le profil mis à jour
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // En mode sandbox, activer l'abonnement côté serveur
  if (isSandbox && user && planId && params.tx) {
    try {
      await fetch(`${APP_URL}/api/paiement/sandbox-confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactionId: params.tx,
          planId,
          userId: user.id,
        }),
      });
    } catch {
      // Sandbox non bloquant
    }
  }

  let profile = null;
  let abonnement = null;

  if (user) {
    const serviceClient = createServiceClient();
    const [profileRes, abonnementRes] = await Promise.all([
      serviceClient
        .from("profiles")
        .select("nom_complet, statut_abonnement, date_expiration_abonnement")
        .eq("id", user.id)
        .single(),
      serviceClient
        .from("abonnements")
        .select("*, plan:plan_id(nom)")
        .eq("user_id", user.id)
        .eq("statut", "ACTIF")
        .order("date_debut", { ascending: false })
        .limit(1)
        .single(),
    ]);
    profile = profileRes.data;
    abonnement = abonnementRes.data;
  }

  const PlanIcon = plan ? PLAN_ICONS[plan.nom] : CheckCircle;
  const planColor = plan ? PLAN_COLORS[plan.nom] : "text-status-win";
  const prenom = profile?.nom_complet?.split(" ")[0] || "Champion";

  const dateExpiration = profile?.date_expiration_abonnement
    ? new Date(profile.date_expiration_abonnement).toLocaleDateString("fr-CI", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center px-4 py-16">
      <div className="max-w-lg w-full text-center">

        {/* Icône succès animée */}
        <div className="relative inline-flex mb-8">
          <div className="w-24 h-24 rounded-full bg-status-win/10 border-2 border-status-win/30 flex items-center justify-center animate-pulse-slow">
            <CheckCircle className="w-12 h-12 text-status-win" strokeWidth={1.5} />
          </div>
          {plan && (
            <div className="absolute -bottom-2 -right-2 w-10 h-10 rounded-full bg-bg-card border-2 border-border flex items-center justify-center">
              <PlanIcon className={`w-5 h-5 ${planColor}`} />
            </div>
          )}
        </div>

        {/* Titre */}
        <h1 className="font-serif text-3xl font-bold text-text-primary mb-2">
          Félicitations, {prenom} ! 🎉
        </h1>
        <p className="text-text-secondary text-lg mb-8">
          Votre paiement a été confirmé et votre accès est maintenant actif.
        </p>

        {/* Carte récap abonnement */}
        {plan && (
          <div className="card-base p-6 mb-8 text-left">
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-10 h-10 rounded-xl bg-bg-elevated border border-border flex items-center justify-center`}>
                <PlanIcon className={`w-5 h-5 ${planColor}`} />
              </div>
              <div>
                <p className="font-bold text-text-primary">Plan {plan.nom}</p>
                <p className="text-text-muted text-xs">Abonnement mensuel</p>
              </div>
              <span className="ml-auto px-3 py-1 bg-status-win/10 text-status-win text-xs font-bold rounded-full border border-status-win/20">
                ✓ ACTIF
              </span>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-text-muted">Montant payé</span>
                <span className="text-text-primary font-semibold">
                  {plan.prix_eur.toLocaleString("fr-FR", { minimumFractionDigits: 2 })}€
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Durée</span>
                <span className="text-text-primary font-semibold">
                  {plan.duree_jours} jours
                </span>
              </div>
              {dateExpiration && (
                <div className="flex justify-between">
                  <span className="text-text-muted">Expire le</span>
                  <span className="text-text-primary font-semibold">
                    {dateExpiration}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Accès rapide */}
        <div className="grid grid-cols-2 gap-3 mb-8">
          <Link
            href="/pronostics"
            className="btn-primary text-center py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
          >
            <Star className="w-4 h-4" />
            Mes pronostics
          </Link>
          <Link
            href="/espace-membre"
            className="btn-secondary text-center py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
          >
            Mon espace
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Message WhatsApp */}
        <div className="p-4 rounded-xl bg-bg-card border border-border">
          <p className="text-text-secondary text-sm">
            🎯 <span className="text-text-primary font-semibold">Conseil :</span>{" "}
            Rejoignez notre groupe WhatsApp VIP pour recevoir les pronostics du matin à 7h30.
          </p>
          <a
            href="https://wa.me/+22507000000?text=Bonjour, je viens de souscrire à Elite Turf !"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-2 text-[#25D366] text-sm font-semibold hover:underline"
          >
            Rejoindre le groupe WhatsApp →
          </a>
        </div>

      </div>
    </div>
  );
}
