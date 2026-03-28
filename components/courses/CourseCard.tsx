import Link from "next/link";
import {
  Clock, Users, ChevronRight, Star,
  CheckCircle2, Zap, ExternalLink
} from "lucide-react";
import { buildGenyUrl } from "@/lib/geny";

const HIPPODROME_IMAGES: Record<string, string> = {
  "Longchamp":             "https://images.unsplash.com/photo-1495543377553-b2aba1f925d7?w=600&q=80",
  "Vincennes":             "https://images.unsplash.com/photo-1526094633853-031707a44819?w=600&q=80",
  "Chantilly":             "https://images.unsplash.com/photo-1526094633853-031707a44819?w=600&q=80",
  "Auteuil":               "https://images.unsplash.com/photo-1495543377553-b2aba1f925d7?w=600&q=80",
  "Deauville":             "https://images.unsplash.com/photo-1708882308455-cd5f478f7bf9?w=600&q=80",
  "Cagnes-sur-Mer":        "https://images.unsplash.com/photo-1708882308455-cd5f478f7bf9?w=600&q=80",
  "Hippodrome de la Riviera": "https://images.unsplash.com/photo-1526094633853-031707a44819?w=600&q=80",
};
const DEFAULT_IMG = "https://images.unsplash.com/photo-1526094633853-031707a44819?w=600&q=80";

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
  };
  userSubscription: string;
}

export default function CourseCard({ course: c, userSubscription }: Props) {
  const statut         = STATUT_CONFIG[c.statut as keyof typeof STATUT_CONFIG] || STATUT_CONFIG.PROGRAMME;
  const imageUrl       = HIPPODROME_IMAGES[c.hippodrome?.nom || ""] || DEFAULT_IMG;
  const pronosticPublie = c.pronostics?.find((p) => p.publie);
  const refCourse      = `R${c.numero_reunion}C${c.numero_course}`;
  const typePari       = pronosticPublie?.type_pari;
  const typeBadge      = typePari ? TYPE_PARI_BADGE[typePari] : null;

  const hasPronosticAccess =
    !pronosticPublie ||
    pronosticPublie.niveau_acces === "GRATUIT" ||
    (pronosticPublie.niveau_acces === "PREMIUM" && (userSubscription === "PREMIUM" || userSubscription === "VIP")) ||
    (pronosticPublie.niveau_acces === "VIP" && userSubscription === "VIP");

  // URLs externes
  const dateStr   = c.date_course.replace(/-/g, "");   // YYYYMMDD
  const hippoSlug = (c.hippodrome?.nom || "").toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  const pmuUrl    = `https://www.pmu.fr/turf/${dateStr}/${hippoSlug}/R${c.numero_reunion}/C${c.numero_course}`;
  const genyUrl   = buildGenyUrl(c.date_course, c.numero_reunion, c.numero_course, "partants");

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
              <div className="flex items-center gap-1 text-gold-light font-bold text-sm flex-shrink-0">
                <Clock className="w-3.5 h-3.5" />
                {c.heure_depart.slice(0, 5)}
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
              <div className="flex items-center gap-2 mb-3 p-2.5 bg-bg-elevated rounded-lg border border-border/50">
                <CheckCircle2 className="w-3.5 h-3.5 text-status-win flex-shrink-0" />
                <span className="text-text-muted text-xs">Arrivée :</span>
                <div className="flex items-center gap-1.5">
                  {c.arrivee_officielle.slice(0, 5).map((n: number, idx: number) => (
                    <span key={idx} className="w-6 h-6 rounded-full bg-bg-card border border-border flex items-center justify-center text-text-primary text-xs font-bold">
                      {n}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Pied de carte */}
          <div className="flex items-center justify-between pt-2 border-t border-border/40 mt-2 flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 text-text-muted text-xs">
                <Users className="w-3.5 h-3.5" />
                {c.nb_partants} partants
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Bouton PMU.fr */}
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
