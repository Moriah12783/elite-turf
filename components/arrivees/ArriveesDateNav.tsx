"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ChevronRight, CalendarDays, History } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  currentDate: string;
  /** Liste des dates (YYYY-MM-DD) qui ont au moins 1 arrivée enregistrée.
   *  Permet d'afficher une pastille "✓" sur les jours avec contenu. */
  datesWithArrivees?: string[];
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function formatLabel(dateStr: string, today: string): string {
  const yesterday = addDays(today, -1);
  const tomorrow  = addDays(today, +1);
  if (dateStr === today)     return "Aujourd'hui";
  if (dateStr === yesterday) return "Hier";
  if (dateStr === tomorrow)  return "Demain";
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
}

/**
 * Navigation date pour la page /arrivees/[date].
 *
 * Composants :
 *  - Bouton "← Hier" (jour précédent)
 *  - Pills cliquables : 6 jours autour de currentDate (passé privilégié)
 *  - Bouton "Demain →" (jour suivant)
 *  - Native date picker pour jumper à n'importe quelle date
 *  - Pastille ✓ sur les jours avec au moins 1 arrivée enregistrée
 *
 * Stratégie UX : les arrivées sont pour le PASSÉ, donc on affiche 5 jours
 * passés + aujourd'hui + 1 jour futur. Le user peut aller plus loin via
 * le date picker (jusqu'à -365j, +30j).
 */
export default function ArriveesDateNav({ currentDate, datesWithArrivees = [] }: Props) {
  const router = useRouter();
  const today = new Date().toISOString().split("T")[0];
  const hasArrivees = new Set(datesWithArrivees);

  // Limites cohérentes avec le serveur : -365j (historique 1 an) → +30j (programme futur)
  const minDate = addDays(today, -365);
  const maxDate = addDays(today, +30);

  // 7 pills : on centre sur currentDate mais on biaise vers le passé
  // (les arrivées du futur n'existent pas, donc 5 passés + courant + 1 futur).
  const days = Array.from({ length: 7 }, (_, i) => addDays(currentDate, i - 5));

  const prevDate = addDays(currentDate, -1);
  const nextDate = addDays(currentDate, +1);
  const isAtMin  = currentDate <= minDate;
  const isAtMax  = currentDate >= maxDate;

  function handleDatePick(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    if (v && /^\d{4}-\d{2}-\d{2}$/.test(v) && v >= minDate && v <= maxDate) {
      router.push(`/arrivees/${v}`);
    }
  }

  return (
    <div className="card-base p-3 mb-6">
      <div className="flex items-center gap-2">
        {/* Prev button */}
        <Link
          href={isAtMin ? "#" : `/arrivees/${prevDate}`}
          aria-label="Jour précédent"
          aria-disabled={isAtMin}
          className={cn(
            "p-2 rounded-lg border transition-all flex-shrink-0",
            isAtMin
              ? "bg-bg-elevated/50 border-border/50 text-text-muted/50 cursor-not-allowed pointer-events-none"
              : "bg-bg-elevated border-border hover:border-gold-primary/40 text-text-secondary hover:text-text-primary",
          )}
        >
          <ChevronLeft className="w-4 h-4" />
        </Link>

        {/* Pills horizontales (scrollables sur mobile) */}
        <div className="flex-1 overflow-x-auto -mx-1 px-1">
          <div className="flex items-center gap-1.5 min-w-max">
            {days.map((d) => {
              const isActive    = d === currentDate;
              const isTodayPill = d === today;
              const hasContent  = hasArrivees.has(d);
              return (
                <Link
                  key={d}
                  href={`/arrivees/${d}`}
                  className={cn(
                    "relative px-3 py-2 rounded-xl text-xs font-medium transition-all border whitespace-nowrap",
                    isActive
                      ? "bg-gold-primary text-bg-primary border-gold-primary font-bold shadow-gold-sm"
                      : isTodayPill
                      ? "bg-bg-elevated border-gold-primary/40 text-gold-light hover:border-gold-primary"
                      : "bg-bg-elevated border-border text-text-secondary hover:border-gold-primary/30 hover:text-text-primary",
                  )}
                >
                  {formatLabel(d, today)}
                  {/* Pastille verte si la date a au moins 1 arrivée */}
                  {hasContent && !isActive && (
                    <span
                      className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-status-win border border-bg-primary"
                      title="Arrivées disponibles"
                    />
                  )}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Next button */}
        <Link
          href={isAtMax ? "#" : `/arrivees/${nextDate}`}
          aria-label="Jour suivant"
          aria-disabled={isAtMax}
          className={cn(
            "p-2 rounded-lg border transition-all flex-shrink-0",
            isAtMax
              ? "bg-bg-elevated/50 border-border/50 text-text-muted/50 cursor-not-allowed pointer-events-none"
              : "bg-bg-elevated border-border hover:border-gold-primary/40 text-text-secondary hover:text-text-primary",
          )}
        >
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Ligne secondaire : date picker + lien historique */}
      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/30">
        {/* Native date picker — accès direct à n'importe quelle date */}
        <label className="flex items-center gap-2 flex-1 min-w-0">
          <CalendarDays className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
          <span className="text-text-muted text-xs hidden sm:inline">Aller à :</span>
          <input
            type="date"
            value={currentDate}
            min={minDate}
            max={maxDate}
            onChange={handleDatePick}
            className="flex-1 min-w-0 bg-transparent border-none outline-none text-text-primary text-xs font-mono focus:text-gold-primary"
            aria-label="Sélectionner une date"
          />
        </label>

        {/* Lien vers aujourd'hui (raccourci si user perdu dans le passé) */}
        {currentDate !== today && (
          <Link
            href={`/arrivees/${today}`}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs text-gold-primary hover:bg-gold-primary/10 transition-colors flex-shrink-0"
          >
            <History className="w-3 h-3" />
            <span className="hidden sm:inline">Retour aujourd&apos;hui</span>
            <span className="sm:hidden">Aujourd&apos;hui</span>
          </Link>
        )}
      </div>
    </div>
  );
}
