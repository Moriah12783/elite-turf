import type { ElementType } from "react";
import Link from "next/link";
import {
  Star, Lock, Eye, ChevronRight, MapPin, Clock,
  TrendingUp, CheckCircle2, XCircle, Clock3, Minus
} from "lucide-react";
import PaywallBanner from "./PaywallBanner";
import { BET_TYPE_LABELS, CONFIDENCE_CONFIG } from "@/types";
import type { PronosticLevel, SubscriptionStatus, BetType, Confidence, PronosticResult } from "@/types";

interface PronosticCardProps {
  pronostic: {
    id: string;
    niveau_acces: PronosticLevel;
    type_pari: BetType;
    selection: number[];
    confiance: Confidence;
    analyse_courte: string;
    analyse_texte?: string | null;
    resultat: PronosticResult;
    nb_vues: number;
    nb_likes: number;
    publie: boolean;
    date_publication?: string | null;
    course?: {
      id: string;
      libelle: string;
      date_course: string;
      heure_depart: string;
      distance_metres: number;
      categorie: string;
      terrain?: string | null;
      nb_partants: number;
      hippodrome?: { nom: string; pays: string } | null;
    } | null;
  };
  userSubscription: SubscriptionStatus;
}

function canAccess(niveau: PronosticLevel, sub: SubscriptionStatus): boolean {
  if (niveau === "GRATUIT") return true;
  if (niveau === "PREMIUM") return sub === "PREMIUM" || sub === "VIP";
  if (niveau === "VIP") return sub === "VIP";
  return false;
}

const RESULTAT_CONFIG: Record<PronosticResult, { label: string; icon: ElementType; classes: string }> = {
  GAGNANT:    { label: "Gagnant",   icon: CheckCircle2, classes: "bg-status-win/15 text-status-win border-status-win/20" },
  PERDANT:    { label: "Perdant",   icon: XCircle,      classes: "bg-status-loss/15 text-status-loss border-status-loss/20" },
  PARTIEL:    { label: "Partiel",   icon: Minus,        classes: "bg-status-partial/15 text-status-partial border-status-partial/20" },
  EN_ATTENTE: { label: "En cours",  icon: Clock3,       classes: "bg-bg-elevated text-text-muted border-border" },
};

const RESULTAT_CONFIG_DEPASSE = { label: "Archivé", icon: Clock3, classes: "bg-bg-elevated text-text-muted border-border" };

const CATEGORIE_COLORS: Record<string, string> = {
  PLAT:     "bg-blue-500/10 text-blue-400 border-blue-500/20",
  TROT:     "bg-purple-500/10 text-purple-400 border-purple-500/20",
  OBSTACLE: "bg-orange-500/10 text-orange-400 border-orange-500/20",
};

export default function PronosticCard({ pronostic: p, userSubscription }: PronosticCardProps) {
  const hasAccess = canAccess(p.niveau_acces, userSubscription);
  const conf = CONFIDENCE_CONFIG[p.confiance];
  // Si le résultat est EN_ATTENTE mais que la date de course est passée → "Non actualisé"
  const today = new Date().toISOString().split("T")[0];
  const racePast = p.resultat === "EN_ATTENTE" && p.course?.date_course && p.course.date_course < today;
  const resultatConf = racePast ? RESULTAT_CONFIG_DEPASSE : RESULTAT_CONFIG[p.resultat];
  const ResultatIcon = resultatConf.icon;

  return (
    <article className="card-base relative overflow-hidden group">
      {/* Premium shimmer */}
      {p.niveau_acces === "PREMIUM" && (
        <div className="absolute inset-0 shimmer-bg pointer-events-none rounded-xl" />
      )}
      {p.niveau_acces === "VIP" && (
        <div className="absolute inset-0 bg-gradient-to-r from-purple-500/3 via-transparent to-purple-500/3 pointer-events-none rounded-xl" />
      )}

      <div className="relative z-10 p-5 sm:p-6">

        {/* ── Top: Badges ── */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {/* Niveau */}
          <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-semibold border ${
            p.niveau_acces === "GRATUIT"
              ? "bg-status-win/10 text-status-win border-status-win/20"
              : p.niveau_acces === "VIP"
              ? "bg-purple-500/10 text-purple-400 border-purple-500/20"
              : "bg-gold-faint text-gold-light border-gold-primary/30"
          }`}>
            {p.niveau_acces === "GRATUIT" ? "✓ La Base Solide" : p.niveau_acces === "VIP" ? "★ L'Outsider Elite" : "⭐ Le Duo de Choc"}
          </span>

          {/* Type de pari */}
          <span className="text-xs px-2.5 py-1 rounded-full bg-bg-elevated border border-border text-text-secondary font-medium">
            {BET_TYPE_LABELS[p.type_pari]}
          </span>

          {/* Catégorie course */}
          {p.course?.categorie && (
            <span className={`text-xs px-2 py-0.5 rounded-full border ${CATEGORIE_COLORS[p.course.categorie] || ""}`}>
              {p.course.categorie}
            </span>
          )}

          {/* Résultat */}
          <span className={`ml-auto inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-semibold border ${resultatConf.classes}`}>
            <ResultatIcon className="w-3 h-3" />
            {resultatConf.label}
          </span>
        </div>

        {/* ── Course info ── */}
        {p.course && (
          <div className="flex flex-wrap items-center gap-3 mb-3 text-sm">
            <div className="flex items-center gap-1.5 text-text-secondary">
              <MapPin className="w-3.5 h-3.5 text-gold-primary flex-shrink-0" />
              <span className="font-medium">{p.course.hippodrome?.nom || "—"}</span>
              <span className="text-text-muted">· {p.course.hippodrome?.pays}</span>
            </div>
            <div className="flex items-center gap-1.5 text-gold-light font-semibold">
              <Clock className="w-3.5 h-3.5" />
              {p.course.heure_depart.slice(0, 5)}
            </div>
            <span className="text-text-muted text-xs">{p.course.distance_metres}m</span>
          </div>
        )}

        {/* ── Course name ── */}
        <h3 className="font-serif font-semibold text-text-primary text-base mb-4 leading-snug group-hover:text-gold-light transition-colors">
          {p.course?.libelle || "Course à venir"}
        </h3>

        {/* ── Confidence stars ── */}
        <div className="flex items-center gap-2 mb-4">
          <div className="flex items-center gap-0.5">
            {[...Array(4)].map((_, i) => (
              <Star
                key={i}
                className="w-3.5 h-3.5"
                fill={i < conf.stars ? "#C9A84C" : "transparent"}
                color={i < conf.stars ? "#C9A84C" : "#3A3A50"}
              />
            ))}
          </div>
          <span className={`text-xs font-semibold ${conf.color}`}>
            Confiance {conf.label}
          </span>
        </div>

        {/* ── Selection ── */}
        <div className="flex items-center gap-3 mb-4">
          <span className="text-text-muted text-xs uppercase tracking-wider flex-shrink-0">
            Sélection :
          </span>
          {hasAccess ? (
            <div className="flex items-center gap-2 flex-wrap">
              {p.selection.map((n, idx) => (
                <span
                  key={idx}
                  className="w-8 h-8 rounded-full bg-gold-faint border border-gold-primary/40 flex items-center justify-center text-gold-light font-bold text-sm"
                >
                  {n}
                </span>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {p.selection.slice(0, 3).map((_, idx) => (
                <span
                  key={idx}
                  className="w-8 h-8 rounded-full bg-bg-elevated border border-border flex items-center justify-center text-text-muted font-bold text-sm paywall-blur"
                >
                  ?
                </span>
              ))}
              {p.selection.length > 3 && (
                <span className="text-text-muted text-xs">+{p.selection.length - 3}</span>
              )}
              <Lock className="w-4 h-4 text-gold-primary ml-1" />
            </div>
          )}
        </div>

        {/* ── Analyse ── */}
        {hasAccess ? (
          <p className="text-text-secondary text-sm leading-relaxed mb-5 italic border-l-2 border-gold-primary/30 pl-3">
            &ldquo;{p.analyse_courte}&rdquo;
          </p>
        ) : (
          <div className="relative mb-5">
            <p className="text-text-secondary text-sm leading-relaxed italic paywall-blur select-none">
              {p.analyse_courte}
            </p>
          </div>
        )}

        {/* ── Paywall banner (if no access) ── */}
        {!hasAccess && (
          <div className="mb-5">
            <PaywallBanner niveau={p.niveau_acces as "PREMIUM" | "VIP"} compact />
          </div>
        )}

        {/* ── Footer ── */}
        <div className="flex items-center justify-between pt-3 border-t border-border/50">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 text-text-muted text-xs">
              <Eye className="w-3.5 h-3.5" />
              {(p.nb_vues || 0).toLocaleString("fr-CI")}
            </div>
            {p.nb_likes > 0 && (
              <div className="flex items-center gap-1 text-text-muted text-xs">
                <TrendingUp className="w-3.5 h-3.5" />
                {p.nb_likes}
              </div>
            )}
          </div>
          <Link
            href={`/pronostics/${p.id}`}
            className="flex items-center gap-1 text-gold-primary hover:text-gold-light text-xs font-semibold transition-colors"
          >
            Voir le détail
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </article>
  );
}
