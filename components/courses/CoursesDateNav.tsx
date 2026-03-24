"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  currentDate: string;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function formatLabel(dateStr: string): string {
  const today = new Date().toISOString().split("T")[0];
  const yesterday = addDays(today, -1);
  const tomorrow = addDays(today, 1);
  if (dateStr === today)     return "Aujourd'hui";
  if (dateStr === yesterday) return "Hier";
  if (dateStr === tomorrow)  return "Demain";
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
}

export default function CoursesDateNav({ currentDate }: Props) {
  const today = new Date().toISOString().split("T")[0];

  // 7-day range: 3 before, today, 3 after
  const days = Array.from({ length: 7 }, (_, i) => addDays(currentDate, i - 3));

  const prevDate = addDays(currentDate, -1);
  const nextDate = addDays(currentDate, 1);

  return (
    <div className="flex items-center gap-2">
      {/* Prev */}
      <Link
        href={`/courses?date=${prevDate}`}
        className="p-2 rounded-lg bg-bg-elevated border border-border hover:border-gold-primary/40 text-text-secondary hover:text-text-primary transition-all flex-shrink-0"
        aria-label="Jour précédent"
      >
        <ChevronLeft className="w-4 h-4" />
      </Link>

      {/* Date pills — scrollable on mobile */}
      <div className="flex-1 overflow-x-auto">
        <div className="flex items-center gap-1.5 min-w-max">
          {days.map((d) => {
            const isActive = d === currentDate;
            const isToday = d === today;
            return (
              <Link
                key={d}
                href={`/courses?date=${d}`}
                className={cn(
                  "px-3 py-2 rounded-xl text-xs font-medium transition-all border whitespace-nowrap",
                  isActive
                    ? "bg-gold-primary text-bg-primary border-gold-primary font-bold"
                    : isToday
                    ? "bg-bg-elevated border-gold-primary/40 text-gold-light"
                    : "bg-bg-elevated border-border text-text-secondary hover:border-gold-primary/30 hover:text-text-primary"
                )}
              >
                {formatLabel(d)}
                {isToday && !isActive && (
                  <span className="ml-1 w-1 h-1 rounded-full bg-gold-primary inline-block align-middle" />
                )}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Next */}
      <Link
        href={`/courses?date=${nextDate}`}
        className="p-2 rounded-lg bg-bg-elevated border border-border hover:border-gold-primary/40 text-text-secondary hover:text-text-primary transition-all flex-shrink-0"
        aria-label="Jour suivant"
      >
        <ChevronRight className="w-4 h-4" />
      </Link>
    </div>
  );
}
