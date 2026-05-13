/**
 * lib/ai-pronostics/source-crawlers/types.ts
 *
 * Types partagés par les crawlers. Pas d'import serveur ici (safe client+server).
 */

export interface CourseSeenByCrawler {
  course_id:        string;
  date_course:      string;          // YYYY-MM-DD
  numero_reunion:   number;
  numero_course:    number;
  hippodrome_nom:   string | null;
  hippodrome_pays:  string | null;
  libelle:          string;
  categorie:        string | null;   // "PLAT" | "TROT" | "OBSTACLE"
  nb_partants:      number | null;
  source_import:    string | null;   // ex: "PMU", "GENY"
  geny_url:         string | null;
}
