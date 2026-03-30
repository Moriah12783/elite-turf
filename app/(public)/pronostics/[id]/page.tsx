import type { ElementType } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Metadata } from "next";
import {
  Star, Lock, Eye, MapPin, Clock, Users, ArrowLeft,
  TrendingUp, CheckCircle2, XCircle, Clock3, Minus,
  ChevronRight, Zap, BarChart3
} from "lucide-react";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { BET_TYPE_LABELS, CONFIDENCE_CONFIG } from "@/types";
import type { SubscriptionStatus, PronosticResult } from "@/types";
import PaywallBanner from "@/components/pronostics/PaywallBanner";

interface PageProps {
  params: { id: string };
}

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("pronostics")
    .select("analyse_courte, course:courses(libelle, hippodrome:hippodromes(nom))")
    .eq("id", params.id)
    .single();

  if (!data) return { title: "Pronostic — Elite Turf" };
  const course = data.course as any;
  return {
    title: `${course?.libelle || "Pronostic"} — ${course?.hippodrome?.nom || ""} | Elite Turf`,
    description: data.analyse_courte,
  };
}

const RESULTAT_CONFIG: Record<PronosticResult, { label: string; icon: ElementType; classes: string; bg: string }> = {
  GAGNANT:    { label: "GAGNANT",   icon: CheckCircle2, classes: "text-status-win",     bg: "bg-status-win/10 border-status-win/30" },
  PERDANT:    { label: "PERDANT",   icon: XCircle,      classes: "text-status-loss",    bg: "bg-status-loss/10 border-status-loss/30" },
  PARTIEL:    { label: "PARTIEL",   icon: Minus,        classes: "text-status-partial", bg: "bg-status-partial/10 border-status-partial/30" },
  EN_ATTENTE: { label: "EN COURS",  icon: Clock3,       classes: "text-text-muted",     bg: "bg-bg-elevated border-border" },
};

function canAccess(niveau: string, sub: SubscriptionStatus): boolean {
  if (niveau === "GRATUIT") return true;
  if (niveau === "PREMIUM") return sub === "PREMIUM" || sub === "VIP";
  if (niveau === "VIP") return sub === "VIP";
  return false;
}

export default async function PronosticDetailPage({ params }: PageProps) {
  // ── Session ──────────────────────────────────────────────────────
  const supabaseClient = await createClient();
  const { data: { user } } = await supabaseClient.auth.getUser();

  let userSubscription: SubscriptionStatus = "GRATUIT";
  if (user) {
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("statut_abonnement")
      .eq("id", user.id)
      .single();
    if (profile) userSubscription = profile.statut_abonnement as SubscriptionStatus;
  }

  // ── Data ──────────────────────────────────────────────────────────
  const supabase = createServiceClient();
  const { data: p } = await supabase
    .from("pronostics")
    .select(`
      id, niveau_acces, type_pari, selection, confiance,
      analyse_courte, analyse_texte, resultat, nb_vues, nb_likes,
      publie, date_publication,
      course:courses(
        id, libelle, date_course, heure_depart,
        distance_metres, categorie, terrain, nb_partants,
        arrivee_officielle,
        hippodrome:hippodromes(nom, pays, ville),
        partants(id, numero, nom_cheval, jockey, cote, musique, non_partant)
      )
    `)
    .eq("id", params.id)
    .eq("publie", true)
    .single();

  if (!p) notFound();

  const hasAccess = canAccess(p.niveau_acces, userSubscription);
  const conf = CONFIDENCE_CONFIG[p.confiance as keyof typeof CONFIDENCE_CONFIG];
  const resultatConf = RESULTAT_CONFIG[p.resultat as PronosticResult];
  const ResultatIcon = resultatConf.icon;
  const course = p.course as any;
  const partants: any[] = (course?.partants || [])
    .filter((pt: any) => !pt.non_partant)
    .sort((a: any, b: any) => a.numero - b.numero);

  // Incrémenter les vues (best effort)
  supabase
    .from("pronostics")
    .update({ nb_vues: (p.nb_vues || 0) + 1 })
    .eq("id", p.id)
    .then(() => {});

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* ── HERO BANNER ─────────────────────────────────────────────── */}
      <div className="relative overflow-hidden h-40 sm:h-52">
        <img
          src="/images/heroes/hero-pronostics.jpg"
          alt="Course hippique"
          className="w-full h-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-bg-primary/75" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-bg-primary" />
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 -mt-10 relative z-10 pb-16">

        {/* Back */}
        <Link
          href="/pronostics"
          className="inline-flex items-center gap-1.5 text-text-secondary hover:text-gold-light text-sm font-medium transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour aux pronostics
        </Link>

        {/* ── MAIN CARD ── */}
        <div className="card-base overflow-hidden mb-6">
          {/* Color accent top */}
          <div className={`h-1 w-full ${
            p.niveau_acces === "VIP" ? "bg-purple-500" :
            p.niveau_acces === "PREMIUM" ? "bg-gradient-to-r from-gold-primary to-gold-light" :
            "bg-status-win"
          }`} />

          <div className="p-6 sm:p-8">
            {/* Badges row */}
            <div className="flex flex-wrap items-center gap-2 mb-5">
              <span className={`inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-full font-bold border ${
                p.niveau_acces === "GRATUIT"
                  ? "bg-status-win/10 text-status-win border-status-win/20"
                  : p.niveau_acces === "VIP"
                  ? "bg-purple-500/10 text-purple-400 border-purple-500/20"
                  : "bg-gold-faint text-gold-light border-gold-primary/30"
              }`}>
                {p.niveau_acces === "GRATUIT" ? "✓ GRATUIT" : p.niveau_acces === "VIP" ? "★ VIP" : "⭐ PREMIUM"}
              </span>
              <span className="text-xs px-3 py-1.5 rounded-full bg-bg-elevated border border-border text-text-secondary font-medium">
                {BET_TYPE_LABELS[p.type_pari as keyof typeof BET_TYPE_LABELS]}
              </span>
              <span className={`ml-auto inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-bold border ${resultatConf.bg} ${resultatConf.classes}`}>
                <ResultatIcon className="w-3.5 h-3.5" />
                {resultatConf.label}
              </span>
            </div>

            {/* Course title */}
            <h1 className="font-serif text-xl sm:text-2xl font-bold text-text-primary mb-4 leading-snug">
              {course?.libelle || "Course hippique"}
            </h1>

            {/* Course details grid */}
            {course && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6 p-4 bg-bg-elevated rounded-xl border border-border/50">
                <div className="flex flex-col gap-1">
                  <span className="text-text-muted text-xs uppercase tracking-wider">Hippodrome</span>
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-gold-primary flex-shrink-0" />
                    <span className="text-text-primary text-sm font-semibold">
                      {course.hippodrome?.nom || "—"}
                    </span>
                  </div>
                  <span className="text-text-muted text-xs">{course.hippodrome?.pays}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-text-muted text-xs uppercase tracking-wider">Départ</span>
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-gold-primary flex-shrink-0" />
                    <span className="text-gold-light text-sm font-bold">
                      {course.heure_depart?.slice(0, 5)}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-text-muted text-xs uppercase tracking-wider">Distance</span>
                  <div className="flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-gold-primary flex-shrink-0" />
                    <span className="text-text-primary text-sm font-semibold">
                      {course.distance_metres}m
                    </span>
                  </div>
                  <span className="text-text-muted text-xs">{course.categorie}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-text-muted text-xs uppercase tracking-wider">Partants</span>
                  <div className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-gold-primary flex-shrink-0" />
                    <span className="text-text-primary text-sm font-semibold">
                      {course.nb_partants}
                    </span>
                  </div>
                  {course.terrain && (
                    <span className="text-text-muted text-xs">{course.terrain}</span>
                  )}
                </div>
              </div>
            )}

            {/* Confidence */}
            <div className="flex items-center gap-3 mb-6 p-3 bg-bg-elevated rounded-xl border border-border/50">
              <div className="flex items-center gap-0.5">
                {[...Array(4)].map((_, i) => (
                  <Star
                    key={i}
                    className="w-4 h-4"
                    fill={i < conf.stars ? "#C9A84C" : "transparent"}
                    color={i < conf.stars ? "#C9A84C" : "#3A3A50"}
                  />
                ))}
              </div>
              <span className={`text-sm font-semibold ${conf.color}`}>
                Confiance {conf.label}
              </span>
              <div className="ml-auto flex items-center gap-1 text-text-muted text-xs">
                <Eye className="w-3.5 h-3.5" />
                {(p.nb_vues || 0).toLocaleString("fr-CI")} vues
              </div>
            </div>

            {/* ── SELECTION ── */}
            <div className="mb-6">
              <h2 className="text-text-muted text-xs uppercase tracking-wider font-semibold mb-3 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-gold-primary" />
                Sélection conseillée
              </h2>
              {hasAccess ? (
                <div className="space-y-2">
                  {/* Chevaux sélectionnés avec noms */}
                  <div className="space-y-1.5">
                    {p.selection.map((n: number, idx: number) => {
                      const horse = partants.find((pt: any) => pt.numero === n);
                      const isInArrivee = course?.arrivee_officielle?.includes(n);
                      return (
                        <div
                          key={idx}
                          className={`flex items-center gap-3 p-2.5 rounded-xl border transition-colors ${
                            isInArrivee && p.resultat !== "EN_ATTENTE"
                              ? "bg-status-win/10 border-status-win/30"
                              : "bg-bg-elevated border-border/50"
                          }`}
                        >
                          <span className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-base flex-shrink-0 ${
                            isInArrivee && p.resultat !== "EN_ATTENTE"
                              ? "bg-status-win/20 border-2 border-status-win/50 text-status-win"
                              : "bg-gold-faint border-2 border-gold-primary/50 text-gold-light"
                          }`}>
                            {n}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-text-primary text-sm font-semibold leading-tight">
                              {horse ? horse.nom_cheval : `Cheval n°${n}`}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-text-muted text-xs">
                                {idx === 0 ? "1er choix" : idx === 1 ? "2e choix" : idx === 2 ? "3e choix" : `${idx+1}e choix`}
                              </span>
                              {horse?.cote && (
                                <span className="text-gold-light text-xs font-medium">
                                  · cote {Number(horse.cote).toFixed(1)}
                                </span>
                              )}
                              {horse?.jockey && (
                                <span className="text-text-muted text-xs hidden sm:inline">
                                  · {horse.jockey}
                                </span>
                              )}
                            </div>
                          </div>
                          {isInArrivee && p.resultat !== "EN_ATTENTE" && (
                            <span className="flex-shrink-0 text-[10px] px-2 py-0.5 rounded-full bg-status-win/20 text-status-win border border-status-win/30 font-bold">
                              ✓ Placé
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Arrivée officielle comparée */}
                  {p.resultat !== "EN_ATTENTE" && course?.arrivee_officielle?.length > 0 && (
                    <div className="mt-3 p-3 bg-bg-elevated rounded-xl border border-border/50">
                      <p className="text-text-muted text-xs font-semibold uppercase tracking-wider mb-2">
                        Arrivée officielle
                      </p>
                      <div className="flex items-center gap-2 flex-wrap">
                        {course.arrivee_officielle.slice(0, Math.max(p.selection.length, 5)).map((n: number, idx: number) => {
                          const isSelected = p.selection.includes(n);
                          const horse = partants.find((pt: any) => pt.numero === n);
                          return (
                            <div key={idx} className="flex flex-col items-center gap-0.5">
                              <span className={`w-9 h-9 rounded-full border-2 flex items-center justify-center font-bold text-sm ${
                                isSelected
                                  ? "border-status-win bg-status-win/10 text-status-win"
                                  : "border-border bg-bg-elevated text-text-muted"
                              }`}>
                                {n}
                              </span>
                              <span className="text-[9px] text-text-muted">
                                {idx + 1}{idx === 0 ? "er" : "e"}
                              </span>
                              {horse && (
                                <span className="text-[8px] text-text-muted max-w-[50px] text-center leading-tight">
                                  {horse.nom_cheval.split(" ")[0]}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-3 flex-wrap">
                  {p.selection.map((_: number, idx: number) => (
                    <span
                      key={idx}
                      className="w-12 h-12 rounded-full bg-bg-elevated border border-border flex items-center justify-center text-text-muted font-bold text-lg paywall-blur"
                    >
                      ?
                    </span>
                  ))}
                  <Lock className="w-5 h-5 text-gold-primary ml-2" />
                </div>
              )}
            </div>

            {/* ── ANALYSE ── */}
            <div className="mb-6">
              <h2 className="text-text-muted text-xs uppercase tracking-wider font-semibold mb-3 flex items-center gap-2">
                <Star className="w-4 h-4 text-gold-primary" />
                Analyse de l&apos;expert
              </h2>
              {hasAccess ? (
                <div className="space-y-3">
                  <p className="text-text-secondary text-sm leading-relaxed italic border-l-2 border-gold-primary/40 pl-4 py-1">
                    &ldquo;{p.analyse_courte}&rdquo;
                  </p>
                  {p.analyse_texte && (
                    <div className="mt-4 p-4 bg-bg-elevated rounded-xl border border-border/50">
                      <p className="text-text-secondary text-sm leading-relaxed whitespace-pre-line">
                        {p.analyse_texte}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="relative">
                  <div className="paywall-blur select-none space-y-2">
                    <p className="text-text-secondary text-sm leading-relaxed">
                      {p.analyse_courte}
                    </p>
                    <p className="text-text-secondary text-sm leading-relaxed">
                      Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Paywall full banner si pas d'accès */}
            {!hasAccess && (
              <PaywallBanner niveau={p.niveau_acces as "PREMIUM" | "VIP"} />
            )}
          </div>
        </div>

        {/* ── NAVIGATION PRONOSTICS ── */}
        <div className="flex items-center justify-between">
          <Link
            href="/pronostics"
            className="flex items-center gap-2 text-text-secondary hover:text-text-primary text-sm font-medium transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Tous les pronostics
          </Link>
          <Link
            href="/abonnements"
            className="flex items-center gap-2 px-4 py-2 bg-gold-primary hover:bg-gold-dark text-bg-primary font-bold text-sm rounded-xl transition-all shadow-gold-sm"
          >
            <Zap className="w-4 h-4" fill="currentColor" />
            S&apos;abonner
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
