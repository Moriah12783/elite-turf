"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Trophy, Target, Clock, Lock, RefreshCw, ChevronRight } from "lucide-react";
import type { LivePayload, LiveCourse } from "@/lib/live/today";
import type { CourseLiveStatus } from "@/lib/live/status";

const STATUS_CFG: Record<
  CourseLiveStatus,
  { label: string; classes: string; pulse?: boolean }
> = {
  A_VENIR: { label: "À venir", classes: "text-text-muted bg-bg-elevated border-border" },
  IMMINENTE: {
    label: "Au départ",
    classes: "text-status-partial bg-status-partial/10 border-status-partial/30",
    pulse: true,
  },
  RESULTAT_IMMINENT: {
    label: "Résultat imminent",
    classes: "text-status-pending bg-status-pending/10 border-status-pending/30",
    pulse: true,
  },
  TERMINEE: { label: "Terminée", classes: "text-status-win bg-status-win/10 border-status-win/30" },
};

function fmtHeure(h: string | null): string {
  if (!h) return "";
  const [hh, mm] = h.split(":");
  return mm != null ? `${Number(hh)}h${mm}` : h;
}

function medal(rank: number): string {
  return rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `${rank}.`;
}

export default function LiveBoard({ initial }: { initial: LivePayload }) {
  const [payload, setPayload] = useState<LivePayload>(initial);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  // Auto-refresh : polling ~60 s, UNIQUEMENT pendant la fenêtre courses et tant
  // qu'il reste des courses non terminées. S'arrête tout seul sinon.
  useEffect(() => {
    if (!payload.racingWindowOpen || !payload.anyPending) return;
    const id = setInterval(async () => {
      try {
        const res = await fetch("/api/live/today", { cache: "no-store" });
        if (res.ok) {
          setPayload(await res.json());
          setUpdatedAt(
            new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
          );
        }
      } catch {
        /* réseau : on réessaiera au prochain tick */
      }
    }, 60_000);
    return () => clearInterval(id);
  }, [payload.racingWindowOpen, payload.anyPending]);

  const live = payload.racingWindowOpen && payload.anyPending;
  const { scoreboard } = payload;
  const pct = scoreboard.joues > 0 ? Math.round((scoreboard.gagnants / scoreboard.joues) * 100) : 0;

  return (
    <div className="space-y-8">
      {/* ── Barre d'état live ───────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          {live ? (
            <>
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
              </span>
              <span className="text-text-secondary text-sm font-medium">
                En direct · mise à jour automatique
              </span>
            </>
          ) : (
            <span className="text-text-muted text-sm">
              {payload.anyPending ? "Reprise du direct à l'ouverture des courses" : "Journée terminée"}
            </span>
          )}
        </div>
        {updatedAt && (
          <span className="inline-flex items-center gap-1.5 text-text-muted text-xs">
            <RefreshCw className="w-3 h-3" /> Actualisé à {updatedAt}
          </span>
        )}
      </div>

      {/* ── Scoreboard : nos pronostics du jour ─────────────────────────── */}
      <div className="card-base p-5 sm:p-6 border border-gold-primary/20">
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="w-5 h-5 text-gold-primary" />
          <h2 className="font-serif font-bold text-text-primary text-lg">
            Nos pronostics aujourd&apos;hui
          </h2>
        </div>

        {scoreboard.joues > 0 ? (
          <div className="flex items-center gap-5 flex-wrap">
            <div className="flex items-baseline gap-1.5">
              <span className="text-4xl font-bold font-serif text-status-win">
                {scoreboard.gagnants}
              </span>
              <span className="text-text-muted text-lg">/ {scoreboard.joues}</span>
              <span className="text-text-secondary text-sm ml-1">bases gagnantes</span>
            </div>
            <div className="h-10 w-px bg-border hidden sm:block" />
            <div className="flex items-center gap-1.5">
              <Target className="w-4 h-4 text-gold-primary" />
              <span className="text-text-primary font-semibold">{scoreboard.places}</span>
              <span className="text-text-secondary text-sm">placées (top 3)</span>
            </div>
            <div className="flex-1 min-w-[140px]">
              <div className="h-2 bg-bg-elevated rounded-full overflow-hidden">
                <div
                  className="h-full bg-status-win rounded-full transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="text-text-muted text-xs mt-1">{pct}% de bases gagnantes</p>
            </div>
          </div>
        ) : (
          <p className="text-text-secondary text-sm">
            Le bilan se remplit <strong className="text-text-primary">au fil des arrivées</strong> de
            la journée. Recalculé en direct sur les vrais résultats — aucun chiffre retouché.
          </p>
        )}
      </div>

      {/* ── Timeline des courses ────────────────────────────────────────── */}
      <div>
        <h2 className="font-serif font-bold text-text-primary text-lg mb-4">Les courses du jour</h2>
        {payload.courses.length === 0 ? (
          <div className="card-base p-8 text-center">
            <Clock className="w-9 h-9 text-text-muted mx-auto mb-3" />
            <p className="text-text-secondary text-sm">
              Aucune course au programme pour aujourd&apos;hui.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {payload.courses.map((c) => (
              <CourseRow key={c.id} course={c} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CourseRow({ course }: { course: LiveCourse }) {
  const cfg = STATUS_CFG[course.statut];
  const isPremium = course.prono != null && course.prono.niveau !== "GRATUIT";

  return (
    <div className="card-base p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono text-text-muted">
              R{course.reunion}C{course.course}
            </span>
            {course.heure_depart && (
              <span className="text-xs text-text-muted">· {fmtHeure(course.heure_depart)}</span>
            )}
          </div>
          <p className="text-text-primary font-semibold text-sm mt-0.5 truncate">
            {course.libelle}
            {course.hippodrome && (
              <span className="text-text-muted font-normal"> — {course.hippodrome}</span>
            )}
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border whitespace-nowrap ${cfg.classes}`}
        >
          {cfg.pulse && (
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-current" />
            </span>
          )}
          {cfg.label}
        </span>
      </div>

      {/* Podium (course terminée) */}
      {course.podium.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-3">
          {course.podium.map((p) => (
            <span key={p.rank} className="inline-flex items-center gap-1 text-sm">
              <span>{medal(p.rank)}</span>
              <span
                className={p.rank === 1 ? "text-gold-primary font-semibold" : "text-text-secondary"}
              >
                {p.nom || `N°${p.numero}`}
              </span>
              <span className="text-text-muted text-xs">({p.numero})</span>
            </span>
          ))}
        </div>
      )}

      {/* Résultat de notre base / teaser premium */}
      {course.prono &&
        (course.prono.outcome ? (
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <span
              className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full border ${
                course.prono.outcome.gagnant
                  ? "text-status-win bg-status-win/10 border-status-win/30"
                  : course.prono.outcome.place
                    ? "text-gold-light bg-gold-faint border-gold-primary/30"
                    : "text-text-muted bg-bg-elevated border-border"
              }`}
            >
              {course.prono.outcome.gagnant
                ? "✓ Notre base a gagné"
                : course.prono.outcome.place
                  ? "Notre base placée (top 3)"
                  : "Notre base non placée"}
            </span>
            <Link
              href={`/pronostics/${course.prono.id}`}
              className="inline-flex items-center text-xs text-gold-primary hover:text-gold-light font-semibold"
            >
              {isPremium ? "Analyse premium" : "Voir l'analyse"}
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        ) : (
          <div className="mt-3">
            <Link
              href={isPremium ? "/abonnements" : `/pronostics/${course.prono.id}`}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-gold-light bg-gold-faint border border-gold-primary/30 px-2.5 py-1 rounded-full hover:bg-gold-primary/20 transition-colors"
            >
              {isPremium && <Lock className="w-3 h-3" />}
              {isPremium ? "Pronostic premium publié" : "Notre pronostic"}
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        ))}
    </div>
  );
}
