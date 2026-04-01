"use client";

import { useState, useEffect } from "react";
import { Clock, Flag } from "lucide-react";

interface Props {
  dateCourse: string;  // "YYYY-MM-DD"
  heureDepart: string; // "HH:MM:SS" (UTC)
  /** En mode compact (ex: CourseCard), n'affiche rien si le départ est passé */
  compact?: boolean;
}

export default function CountdownTimer({ dateCourse, heureDepart, compact = false }: Props) {
  const [diff, setDiff] = useState<number | null>(null);

  useEffect(() => {
    // Reconstituer le timestamp UTC de départ
    const dep = new Date(`${dateCourse}T${heureDepart}Z`);

    const calc = () => setDiff(dep.getTime() - Date.now());
    calc();
    const id = setInterval(calc, 1000);
    return () => clearInterval(id);
  }, [dateCourse, heureDepart]);

  // Pendant l'hydratation (SSR → client)
  if (diff === null) {
    if (compact) return null;
    return (
      <div className="inline-flex items-center gap-1.5 text-text-muted text-sm font-mono">
        <Clock className="w-3.5 h-3.5" />
        <span>…</span>
      </div>
    );
  }

  // Course passée / en cours
  if (diff <= 0) {
    if (compact) return null;
    return (
      <div className="inline-flex items-center gap-1.5 text-text-muted text-xs font-medium">
        <Flag className="w-3.5 h-3.5" />
        <span>Départ passé</span>
      </div>
    );
  }

  const hours   = Math.floor(diff / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  const seconds = Math.floor((diff % 60_000) / 1_000);

  const isVeryClose = diff < 5 * 60 * 1_000;   // < 5 min → rouge pulsant
  const isClose     = diff < 30 * 60 * 1_000;  // < 30 min → or pulsant

  return (
    <div
      className={`inline-flex items-center gap-1.5 font-mono font-bold text-sm ${
        isVeryClose
          ? "text-status-loss animate-pulse"
          : isClose
          ? "text-gold-primary animate-pulse"
          : "text-gold-light"
      }`}
    >
      <Clock className="w-3.5 h-3.5 flex-shrink-0" />
      <span>
        {hours > 0 ? `${hours}h ` : ""}
        {String(minutes).padStart(2, "0")}m{" "}
        {String(seconds).padStart(2, "0")}s
      </span>
    </div>
  );
}
