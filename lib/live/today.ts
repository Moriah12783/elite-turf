/**
 * lib/live/today.ts
 *
 * Assemble le payload « Le Direct » du jour : les courses (état + podium) et le
 * bilan en direct de NOS pronostics. Partagé par la page (`/live`, rendu SSR
 * initial) ET l'endpoint de polling (`/api/live/today`) → une seule logique.
 *
 * Données 100 % internes (déjà en base) : aucune nouvelle source, aucune vidéo.
 */

import { createServiceClient } from "@/lib/supabase/server";
import { todayParisISO, parisMinutesOfDay } from "@/lib/paris-date";
import { buildArriveePodium, type PodiumPlace } from "@/lib/courses/arrivee";
import {
  computeCourseStatus,
  heureToMinutes,
  type CourseLiveStatus,
} from "@/lib/live/status";
import {
  evaluateBaseVsArrivee,
  buildScoreboard,
  type SelectionOutcome,
  type Scoreboard,
} from "@/lib/live/selection-result";

export interface LiveProno {
  id: string;
  niveau: string; // niveau_acces : GRATUIT | STARTER | PRO | ELITE
  typePari: string;
  /** null tant que la course n'est pas terminée. */
  outcome: { gagnant: boolean; place: boolean } | null;
}

export interface LiveCourse {
  id: string;
  reunion: number;
  course: number;
  libelle: string;
  hippodrome: string | null;
  pays: string | null;
  heure_depart: string | null;
  statut: CourseLiveStatus;
  podium: PodiumPlace[]; // top 5, vide si pas terminée
  prono: LiveProno | null;
}

export interface LivePayload {
  date: string;
  /** Fenêtre courses (≈ 11h-21h30 Paris) → inutile de poller en dehors. */
  racingWindowOpen: boolean;
  /** Reste-t-il des courses non terminées ? → sinon on arrête de poller. */
  anyPending: boolean;
  scoreboard: Scoreboard;
  courses: LiveCourse[];
}

const NIVEAU_RANK: Record<string, number> = { ELITE: 3, PRO: 2, STARTER: 1, GRATUIT: 0 };

export async function buildLivePayload(): Promise<LivePayload> {
  const supabase = createServiceClient();
  const date = todayParisISO();
  const nowMinutes = parisMinutesOfDay();

  // 1. Courses du jour (mêmes champs que /arrivees, minimal).
  const { data: rawCourses } = await supabase
    .from("courses")
    .select(
      `
      id, numero_reunion, numero_course, libelle, heure_depart, arrivee_officielle,
      hippodrome:hippodromes(nom, pays),
      partants(numero, nom_cheval)
    `,
    )
    .eq("date_course", date)
    .neq("statut", "ANNULE")
    .order("heure_depart", { ascending: true });

  const courses = (rawCourses ?? []) as any[];
  const courseIds = courses.map((c) => c.id);

  // 2. Pronostics publiés du jour, indexés par course (on garde le + haut niveau).
  const pronoByCourse = new Map<string, any>();
  if (courseIds.length > 0) {
    const { data: pronos } = await supabase
      .from("pronostics")
      .select("id, course_id, niveau_acces, type_pari, selection")
      .in("course_id", courseIds)
      .eq("publie", true);
    for (const p of (pronos ?? []) as any[]) {
      const cur = pronoByCourse.get(p.course_id);
      if (!cur || (NIVEAU_RANK[p.niveau_acces] ?? 0) > (NIVEAU_RANK[cur.niveau_acces] ?? 0)) {
        pronoByCourse.set(p.course_id, p);
      }
    }
  }

  // 3. Construction des courses live + collecte des résultats de nos bases.
  const outcomes: SelectionOutcome[] = [];
  const liveCourses: LiveCourse[] = courses.map((c) => {
    const hippo = Array.isArray(c.hippodrome) ? c.hippodrome[0] : c.hippodrome;
    const arrivee: number[] = Array.isArray(c.arrivee_officielle) ? c.arrivee_officielle : [];
    const hasArrivee = arrivee.length > 0;
    const podium = hasArrivee ? buildArriveePodium(arrivee, c.partants).slice(0, 5) : [];
    const statut = computeCourseStatus({
      hasArrivee,
      startMinutes: heureToMinutes(c.heure_depart),
      nowMinutes,
    });

    const pr = pronoByCourse.get(c.id);
    let prono: LiveProno | null = null;
    if (pr) {
      let outcome: { gagnant: boolean; place: boolean } | null = null;
      if (hasArrivee) {
        const ev = evaluateBaseVsArrivee(pr.selection, arrivee);
        outcome = { gagnant: ev.gagnant, place: ev.place };
        outcomes.push(ev);
      }
      prono = { id: pr.id, niveau: pr.niveau_acces, typePari: pr.type_pari, outcome };
    }

    return {
      id: c.id,
      reunion: c.numero_reunion,
      course: c.numero_course,
      libelle: c.libelle,
      hippodrome: hippo?.nom ?? null,
      pays: hippo?.pays ?? null,
      heure_depart: c.heure_depart,
      statut,
      podium,
      prono,
    };
  });

  return {
    date,
    racingWindowOpen: nowMinutes >= 11 * 60 && nowMinutes <= 21 * 60 + 30,
    anyPending: liveCourses.some((c) => c.statut !== "TERMINEE"),
    scoreboard: buildScoreboard(outcomes),
    courses: liveCourses,
  };
}
