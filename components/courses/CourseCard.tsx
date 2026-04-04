"use client";

import Link from "next/link";
import {
  Clock, Users, ChevronRight, Star,
  CheckCircle2, Zap, ExternalLink
} from "lucide-react";
import { buildGenyUrl } from "@/lib/geny";
import { isJouableAfrique, getNationaleLabel } from "@/lib/pmu-api";
import CountdownTimer from "@/components/courses/CountdownTimer";

// Pool complet des 9 photos PMU locales
const ALL_IMAGES = [
  "/images/heroes/hero-courses.jpg",
  "/images/heroes/hero-pronostics.jpg",
  "/images/heroes/hero-performances.jpg",
  "/images/heroes/hero-a-propos.jpg",
  "/images/heroes/hero-legal.jpg",
  "/images/heroes/hero-guide.jpg",
  "/images/heroes/hero-blog.jpg",
  "/images/heroes/hero-abonnements.jpg",
  "/images/heroes/hero-contact.jpg",
];

// Offset de base par hippodrome — garantit que des hippodromes différents
// commencent sur des images différentes, et numero_course assure la variété
// au sein du même hippodrome (R9C1 ≠ R9C2 ≠ R9C3…)
const HIPPODROME_SEED: Record<string, number> = {
  "Longchamp":                0,
  "ParisLongchamp":           0,
  "Vincennes":                1,
  "Chantilly":                2,
  "Auteuil":                  3,
  "Deauville":                4,
  "Saint-Cloud":              5,
  "Maisons-Laffitte":         6,
  "Compiegne":                7,
  "Fontainebleau":            8,
  "Cagnes-sur-Mer":           3,
  "Hippodrome de la Riviera": 4,
  "Lyon-Parilly":             5,
  "Bordeaux":                 6,
  "Toulouse":                 7,
  "La Teste":                 8,
};

function getCourseImage(hippodromeName: string, numeroCourse: number): string {
  const seed = HIPPODROME_SEED[hippodromeName] ?? Math.abs(hippodromeName.charCodeAt(0) % ALL_IMAGES.length);
  return ALL_IMAGES[(seed + numeroCourse - 1) % ALL_IMAGES.length];
}

const CATEGORIE_COLORS: Record<string, string> = {
  PLAT:     "bg-blue-500/10 text-blue-400 border-blue-500/20",
  TROT:     "bg-purple-500/10 text-purple-400 border-purple-500/20",
  OBSTACLE: "bg-orange-500/10 text-orange-400 border-orange-500/20",
};

const TERRAIN_LABELS: Record<string, string> = {
  BON: "Bon", BON_SOUPLE: "Bon souple", SOUPLE: "Souple",
  LOURD: "Lourd", TRES_LOURD: "Très lourd",
};

const STATUT_CONFIG = {
  PROGRAMME: { label: "Programmé",  dot: "bg-text-muted",              badge: "text-text-muted bg-bg-elevated border-border" },
  EN_COURS:  { label: "En cours",   dot: "bg-status-win animate-pulse", badge: "text-status-win bg-status-win/10 border-status-win/30" },
  TERMINE:   { label: "Terminé",    dot: "bg-text-muted",              badge: "text-text-muted bg-bg-elevated border-border" },
  ANNULE:    { label: "Annulé",     dot: "bg-status-loss",             badge: "text-status-loss bg-status-loss/10 border-status-loss/30" },
};

// Badge Quinté+/Quarté+/Tiercé selon le type de pari du pronostic
const TYPE_PARI_BADGE: Record<string, { label: string; classes: string }> = {
  QUINTE_PLUS: { label: "🏇 Quinté+",  classes: "text-gold-primary bg-gold-faint border-gold-primary/40" },
  QUARTE:      { label: "🐎 Quarté+",  classes: "text-blue-400 bg-blue-400/10 border-blue-400/30" },
  TIERCE:      { label: "🎯 Tiercé",   classes: "text-purple-400 bg-purple-500/10 border-purple-500/30" },
  TRIO:        { label: "🎲 Trio",     classes: "text-text-secondary bg-bg-elevated border-border" },
  COUPLE:      { label: "🔗 Couplé",   classes: "text-text-secondary bg-bg-elevated border-border" },
  SIMPLE:      { label: "⭐ Simple",   classes: "text-text-secondary bg-bg-elevated border-border" },
};

interface Props {
  course: {
    id: string;
    date_course: string;
    numero_reunion: number;
    numero_course: number;
    libelle: string;
    heure_depart: string;
    distance_metres: number;
    categorie: string;
    terrain?: string | null;
    nb_partants: number;
    statut: string;
    arrivee_officielle?: number[] | null;
    hippodrome?: { nom: string; pays: string } | null;
    pronostics?: Array<{ id: string; niveau_acces: string; publie: boolean; type_pari?: string }> | null;
    partants?: Array<{ numero: number; nom_cheval: string }> | null;
    paris_disponibles?: string[] | null;
  };
  userSubscription: string;
}

export default function CourseCard({ course: c, userSubscription }: Props) {
  const statut          = STATUT_CONFIG[c.statut as keyof typeof STATUT_CONFIG] || STATUT_CONFIG.PROGRAMME;
  const imageUrl        = getCourseImage(c.hippodrome?.nom || "", c.numero_course || 1);
  const pronosticPublie = c.pronostics?.find((p) => p.publie);
  const refCourse       = `R${c.numero_reunion}C${c.numero_course}`;
  const typePari        = pronosticPublie?.type_pari;
  const typeBadge       = typePari ? TYPE_PARI_BADGE[typePari] : null;

  const paris           = c.paris_disponibles ?? [];
  const jouableAfrique  = isJouableAfrique(paris);
  const nationaleLabel  = getNationaleLabel(paris);

  const hasPronosticAccess =
    !pronosticPublie ||
    pronosticPublie.niveau_acces === "GRATUIT" ||
    (pronosticPublie.niveau_acces === "PREMIUM" && (userSubscription === "PREMIUM" || userSubscription === "VIP")) ||
    (pronosticPublie.niveau_acces === "VIP" && userSubscription === "VIP");

  // URLs externes
  const dateStr    = c.date_course.replace(/-/g, "");   // YYYYMMDD
  const isFrance   = !c.hippodrome?.pays || c.hippodrome.pays === "France";
  const hippoSlug  = (c.hippodrome?.nom || "").toUpperCase().replace(/\s+/g, "-").replace(/[^A-Z0-9-]/g, "");
  const pmuUrl     = isFrance ? `https://www.pmu.fr/turf/${dateStr}/${hippoSlug}/R${c.numero_reunion}/C${c.numero_course}` : null;
  const isTermine  = c.statut === "TERMINE";
  const genyUrl    = buildGenyUrl(c.date_course, c.numero_reunion, c.numero_course, isTermine ? "resultats" : "partants");

  return (
    <div className="card-base overflow-hidden group hover:border-gold-primary/40 transition-all">
      <div className="flex flex-col sm:flex-row">

        {/* ── Image latérale ── */}
        <div className="relative sm:w-36 h-28 sm:h-auto flex-shrink-0 overflow-hidden">
          <img
            src={imageUrl}
            alt={c.hippodrome?.nom || "Hippodrome"}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-transparent to-bg-card/50 sm:block hidden" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-bg-card/60 sm:hidden" />

          {/* Ref badge */}
          <div className="absolute top-2 left-2 px-2 py-0.5 bg-bg-primary/80 backdrop-blur-sm border border-border/60 rounded text-text-muted text-xs font-mono">
            {refCourse}
          </div>
          {c.statut === "EN_COURS" && (
            <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 bg-status-win/20 border border-status-win/40 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-status-win animate-pulse" />
              <span className="text-status-win text-[10px] font-bold">LIVE</span>
            </div>
          )}
        </div>

        {/* ── Contenu principal ── */}
        <div className="flex-1 p-4 sm:p-5 flex flex-col justify-between min-w-0">
          <div>
            {/* Titre + heure */}
            <div className="flex items-start justify-between gap-3 mb-2">
              <Link href={`/courses/${c.id}`} className="font-serif font-semibold text-text-primary text-base leading-snug group-hover:text-gold-light transition-colors truncate">
                {c.libelle}
              </Link>
              <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                <div className="flex items-center gap-1 text-gold-light font-bold text-sm">
                  <Clock className="w-3.5 h-3.5" />
                  {c.heure_depart.slice(0, 5)}
                </div>
                {c.statut === "PROGRAMME" && (
                  <CountdownTimer
                    dateCourse={c.date_course}
                    heureDepart={c.heure_depart}
                    compact
                  />
                )}
              </div>
            </div>

            {/* Tags */}
            <div className="flex items-center gap-2 flex-wrap mb-3">
              <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${CATEGORIE_COLORS[c.categorie] || ""}`}>
                {c.categorie === "PLAT" ? "🏇 Plat" : c.categorie === "TROT" ? "🐎 Trot" : "🚧 Obstacle"}
              </span>
              {typeBadge && (
                <span className={`text-xs px-2.5 py-0.5 rounded-full border font-bold ${typeBadge.classes}`}>
                  {typeBadge.label}
                </span>
              )}
              {jouableAfrique && (
                <span
                  title={`Jouable depuis l'Afrique — ${nationaleLabel || "Paris disponibles"}`}
                  className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-semibold bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                >
                  🌍 {nationaleLabel ?? "Jouable en Afrique"}
                </span>
              )}
              <span className="text-text-muted text-xs">{c.distance_metres}m</span>
              {c.terrain && (
                <span className="text-text-muted text-xs">· {TERRAIN_LABELS[c.terrain] || c.terrain}</span>
              )}
              <span className={`ml-auto text-xs px-2 py-0.5 rounded-full border font-medium ${statut.badge}`}>
                <span className={`inline-block w-1.5 h-1.5 rounded-full ${statut.dot} mr-1 align-middle`} />
                {statut.label}
              </span>
            </div>

            {/* Arrivée officielle */}
            {c.statut === "TERMINE" && c.arrivee_officielle && c.arrivee_officielle.length > 0 && (
              <div className="mb-3 p-2.5 bg-bg-elevated rounded-lg border border-border/50">
                <div className="flex items-center gap-2 flex-wrap">
                  <CheckCircle2 className="w-3.5 h-3.5 text-status-win flex-shrink-0" />
                  <span className="text-text-muted text-xs font-medium">Arrivée officielle</span>
                </div>
                <div className="mt-2 flex flex-col gap-1">
                  {c.arrivee_officielle.slice(0, 5).map((n: number, idx: number) => {
                    const cheval = c.partants?.find((p: any) => p.numero === n);
                    const ordinals = ["1er", "2e", "3e", "4e", "5e"];
                    return (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="text-text-muted text-xs w-6 text-right flex-shrink-0">{ordinals[idx]}</span>
                        <span className="w-6 h-6 rounded-full bg-bg-card border border-border flex items-center justify-center text-text-primary text-xs font-bold flex-shrink-0">
                          {n}
                        </span>
                        {cheval && (
                          <span className="text-text-secondary text-xs font-medium truncate">{cheval.nom_cheval}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Pied de carte */}
          <div className="flex items-center justify-between pt-2 border-t border-border/40 mt-2 flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 text-text-muted text-xs">
                <Users className="w-3.5 h-3.5" />
                {(c.partants && c.partants.length > 0 ? c.partants.length : c.nb_partants) || "?"} partants
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Bouton PMU.fr — uniquement pour les hippodromes français */}
              {pmuUrl && (
                <a
                  href={pmuUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-[#003189]/10 hover:bg-[#003189]/20 text-[#4A7FD4] border border-[#003189]/20 transition-colors whitespace-nowrap"
                >
                  <ExternalLink className="w-3 h-3" />
                  PMU.fr
                </a>
              )}

              {/* Bouton Geny */}
              <a
                href={genyUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-gold-faint hover:bg-gold-faint/80 text-gold-light border border-gold-primary/20 transition-colors whitespace-nowrap"
              >
                <ExternalLink className="w-3 h-3" />
                Geny
              </a>

              {/* Badge pronostic */}
              {pronosticPublie ? (
                hasPronosticAccess ? (
                  <Link
                    href={`/pronostics/${pronosticPublie.id}`}
                    onClick={e => e.stopPropagation()}
                    className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-semibold bg-status-win/10 text-status-win border border-status-win/20"
                  >
                    <Star className="w-3 h-3" fill="currentColor" />
                    Pronostic
                  </Link>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-semibold bg-gold-faint text-gold-light border border-gold-primary/30">
                    <Zap className="w-3 h-3" fill="currentColor" />
                    Premium
                  </span>
                )
              ) : (
                <Link
                  href={`/courses/${c.id}`}
                  onClick={e => e.stopPropagation()}
                  className="flex items-center gap-0.5 text-gold-primary hover:text-gold-light text-xs font-semibold transition-colors"
                >
                  Détail <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
