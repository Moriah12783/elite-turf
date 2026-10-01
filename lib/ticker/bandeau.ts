/**
 * Bandeau défilant (haut de toutes les pages publiques) — brief SEO du
 * 01/10/2026, B4.
 *
 * Avant : le composant démarrait sur une liste INVENTÉE et figée (« R1
 * Vincennes — Quinté+ : Programme disponible à 8h00 ◆ R2 Longchamp — Tiercé…
 * ◆ R3 Chantilly… ») sous un badge « PMU Live » clignotant. C'est ce texte que
 * Google lisait sur toutes les pages, quel que soit le jour (rendu serveur
 * avant le chargement des vraies données), et que voyait tout visiteur dont le
 * chargement échouait. Les requêtes « courses du jour » de l'API, elles,
 * échouaient en silence (colonnes inexistantes).
 *
 * Ici : uniquement des données RÉELLES du jour, construites de façon pure et
 * testée — arrivées, prochains départs, pronostics publiés — puis des messages
 * Elite Turf exacts. Rien d'inventé quand il n'y a pas de données.
 *
 * PUR, ES5-safe.
 */

export interface TickerItem {
  label:  string;
  result: string;
  status: "win" | "partial" | "pending";
}

export interface CourseBandeau {
  id: string;
  numero_reunion: number;
  numero_course: number;
  heure_depart: string | null;
  statut: string | null;
  arrivee_officielle: number[] | null;
  nb_partants: number | null;
  hippodrome: { nom: string | null } | null;
}

export interface PronosticBandeau {
  course_id: string;
  type_pari: string | null;
  resultat: string | null;
}

const LIBELLE_PARI: Record<string, string> = {
  QUINTE_PLUS: "Quinté+",
  QUARTE_PLUS: "Quarté+",
  QUARTE:      "Quarté+",
  TIERCE:      "Tiercé",
  SIMPLE_GAGNANT: "Simple gagnant",
  SIMPLE_PLACE:   "Simple placé",
  COUPLE:      "Couplé",
  TRIO:        "Trio",
};

/** Messages permanents, vrais à toute heure (ni faux direct ni course précise). */
export const MESSAGES_ELITE_TURF: TickerItem[] = [
  { label: "🏇 Elite Turf",    result: "Pronostics PMU experts — formules dès 65 € (7 jours)",   status: "pending" },
  { label: "📅 Programme",     result: "Le programme PMU et le Quinté+ du jour sur Elite Turf",   status: "pending" },
  { label: "📋 Arrivées",      result: "Arrivées officielles et rapports PMU des courses du jour", status: "pending" },
  { label: "📊 Sélection stats", result: "Une sélection statistique gratuite sur chaque course",  status: "pending" },
];

function minutes(heure: string | null): number | null {
  const m = /^(\d{2}):(\d{2})/.exec(heure ?? "");
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

const etiquette = (c: CourseBandeau) => `R${c.numero_reunion}C${c.numero_course} ${c.hippodrome?.nom || "PMU"}`;

export function construireBandeau(opts: {
  courses: CourseBandeau[];
  pronostics: PronosticBandeau[];
  maintenantMinutesParis: number;
  maxArrivees?: number;
  maxDeparts?: number;
  maxPronostics?: number;
}): TickerItem[] {
  const { courses, pronostics, maintenantMinutesParis } = opts;
  const items: TickerItem[] = [];

  // 1. Arrivées officielles du jour, les plus récentes d'abord.
  const arrivees = courses
    .filter((c) => Array.isArray(c.arrivee_officielle) && c.arrivee_officielle.length > 0)
    .sort((a, b) => (b.heure_depart ?? "").localeCompare(a.heure_depart ?? ""))
    .slice(0, opts.maxArrivees ?? 6);
  for (let i = 0; i < arrivees.length; i++) {
    const c = arrivees[i];
    items.push({
      label: etiquette(c),
      result: `🏁 Arrivée : ${(c.arrivee_officielle as number[]).slice(0, 5).join(" - ")}`,
      status: "win",
    });
  }

  // 2. Prochains départs : seulement les courses pas encore parties.
  const departs = courses
    .filter((c) => {
      const m = minutes(c.heure_depart);
      return m !== null && m >= maintenantMinutesParis && c.statut !== "ANNULE" && c.statut !== "TERMINE";
    })
    .sort((a, b) => (a.heure_depart ?? "").localeCompare(b.heure_depart ?? ""))
    .slice(0, opts.maxDeparts ?? 6);
  for (let i = 0; i < departs.length; i++) {
    const c = departs[i];
    items.push({
      label: etiquette(c),
      result: `🕐 ${(c.heure_depart ?? "").slice(0, 5)} (Paris)${(c.nb_partants ?? 0) > 0 ? ` · ${c.nb_partants} partants` : ""}`,
      status: "pending",
    });
  }

  // 3. Pronostics publiés : UN par course (Elite et Pro portent souvent sur la même).
  const parId: Record<string, CourseBandeau> = {};
  for (let i = 0; i < courses.length; i++) parId[courses[i].id] = courses[i];
  const vus: Record<string, true> = {};
  let nbPronos = 0;
  for (let i = 0; i < pronostics.length && nbPronos < (opts.maxPronostics ?? 3); i++) {
    const p = pronostics[i];
    const c = parId[p.course_id];
    if (!c || vus[p.course_id]) continue;
    vus[p.course_id] = true;
    nbPronos++;
    const pari = (p.type_pari && LIBELLE_PARI[p.type_pari]) || "Pronostic";
    const gagnant = p.resultat === "GAGNANT";
    items.push({
      label: `⭐ ${etiquette(c)}`,
      result: `${pari} · ${gagnant ? "pronostic gagnant" : "pronostic publié (abonnés)"}`,
      status: gagnant ? "win" : p.resultat === "PARTIEL" ? "partial" : "pending",
    });
  }

  return items;
}
