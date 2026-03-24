import Link from "next/link";
import { Clock, MapPin, Users, ChevronRight, Calendar } from "lucide-react";

// Mock data — sera remplacé par les données Supabase
const coursesAujourdhui = [
  {
    id: "1",
    hippodrome: "Longchamp",
    pays: "France",
    heure: "14:30",
    numero: "R1C4",
    libelle: "Prix de la Forêt",
    distance: 1400,
    categorie: "PLAT",
    nb_partants: 12,
    terrain: "Bon",
    aPronostic: true,
    niveauPronostic: "GRATUIT",
    // Longchamp — galop de plat, jockeys en couleurs vives
    image: "https://images.unsplash.com/photo-1495543377553-b2aba1f925d7?w=600&q=80",
  },
  {
    id: "2",
    hippodrome: "Vincennes",
    pays: "France",
    heure: "16:00",
    numero: "R2C6",
    libelle: "Grand Prix de Vincennes",
    distance: 2100,
    categorie: "TROT",
    nb_partants: 15,
    terrain: "Bon",
    aPronostic: true,
    niveauPronostic: "PREMIUM",
    // Vincennes — trot attelé, sulkies sur piste
    image: "https://images.unsplash.com/photo-1635895882609-942f36e1db5d?w=600&q=80",
  },
  {
    id: "3",
    hippodrome: "Cagnes-sur-Mer",
    pays: "France",
    heure: "17:15",
    numero: "R3C8",
    libelle: "Prix de la Méditerranée",
    distance: 1600,
    categorie: "PLAT",
    nb_partants: 10,
    terrain: "Bon Souple",
    aPronostic: false,
    niveauPronostic: null,
    // Cagnes-sur-Mer — galop côte d'Azur
    image: "https://images.unsplash.com/photo-1635895901494-539a6b2647af?w=600&q=80",
  },
];

const CATEGORIE_COLORS: Record<string, string> = {
  PLAT:     "bg-blue-500/10 text-blue-400 border-blue-500/20",
  TROT:     "bg-purple-500/10 text-purple-400 border-purple-500/20",
  OBSTACLE: "bg-orange-500/10 text-orange-400 border-orange-500/20",
};

export default function CoursesSection() {
  return (
    <section className="py-16 sm:py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* En-tête de section */}
        <div className="flex items-center justify-between mb-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-5 h-5 text-gold-primary" />
              <span className="text-gold-light text-sm font-medium uppercase tracking-wider">
                Aujourd&apos;hui
              </span>
            </div>
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-text-primary">
              Programme des Courses
            </h2>
          </div>
          <Link
            href="/courses"
            className="hidden sm:flex items-center gap-1 text-gold-primary hover:text-gold-light text-sm font-medium transition-colors"
          >
            Tout voir <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Grille de courses */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {coursesAujourdhui.map((course) => (
            <Link
              key={course.id}
              href={`/courses/${course.id}`}
              className="card-base overflow-hidden group cursor-pointer flex flex-col"
            >
              {/* ── Image hippodrome en haut de la carte ── */}
              <div className="relative overflow-hidden">
                <img
                  src={course.image}
                  alt="Hippodrome"
                  className="w-full h-32 object-cover rounded-t-xl transition-transform duration-500 group-hover:scale-105"
                />
                {/* Overlay dégradé vers le bas */}
                <div className="absolute inset-0 bg-gradient-to-t from-bg-card via-bg-card/20 to-transparent rounded-t-xl" />

                {/* Heure flottante */}
                <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1.5 bg-bg-primary/80 backdrop-blur-sm border border-gold-primary/30 rounded-full">
                  <Clock className="w-3 h-3 text-gold-primary" />
                  <span className="text-gold-light font-semibold text-xs">{course.heure}</span>
                </div>

                {/* Numéro de course */}
                <div className="absolute top-3 left-3 px-2 py-1 bg-bg-primary/80 backdrop-blur-sm border border-border/60 rounded-md">
                  <span className="text-text-muted text-xs font-mono">{course.numero}</span>
                </div>

                {/* Badge pronostic */}
                {course.aPronostic && (
                  <div className="absolute bottom-3 left-3">
                    <span
                      className={`text-xs px-2.5 py-1 rounded-full font-semibold backdrop-blur-sm ${
                        course.niveauPronostic === "GRATUIT"
                          ? "bg-status-win/80 text-white border border-status-win/40"
                          : "bg-gold-primary/80 text-bg-primary border border-gold-primary/40"
                      }`}
                    >
                      {course.niveauPronostic === "GRATUIT"
                        ? "✓ Pronostic gratuit"
                        : "★ Pronostic Premium"}
                    </span>
                  </div>
                )}
              </div>

              {/* ── Contenu texte de la carte ── */}
              <div className="p-5 flex flex-col flex-1">
                {/* Hippodrome + pays */}
                <div className="flex items-center gap-1.5 mb-2">
                  <MapPin className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
                  <span className="text-text-secondary text-xs">
                    {course.hippodrome}
                    <span className="text-text-muted"> · {course.pays}</span>
                  </span>
                </div>

                {/* Titre de la course */}
                <h3 className="font-serif font-semibold text-text-primary text-base mb-3 group-hover:text-gold-light transition-colors leading-snug">
                  {course.libelle}
                </h3>

                {/* Tags catégorie / distance / terrain */}
                <div className="flex items-center flex-wrap gap-2 mb-4">
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${CATEGORIE_COLORS[course.categorie] || ""}`}>
                    {course.categorie}
                  </span>
                  <span className="text-xs text-text-muted">{course.distance}m</span>
                  <span className="text-xs text-text-muted">· {course.terrain}</span>
                </div>

                {/* Pied de carte */}
                <div className="flex items-center justify-between pt-3 mt-auto border-t border-border/50">
                  <div className="flex items-center gap-1 text-text-muted text-xs">
                    <Users className="w-3.5 h-3.5" />
                    {course.nb_partants} partants
                  </div>
                  {!course.aPronostic && (
                    <span className="text-xs text-text-muted italic">Pronostic en cours…</span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Mobile — voir tout */}
        <div className="mt-6 sm:hidden">
          <Link
            href="/courses"
            className="flex items-center justify-center gap-2 w-full py-3 border border-border hover:border-gold-primary/30 rounded-xl text-text-secondary hover:text-text-primary text-sm font-medium transition-all"
          >
            Voir tout le programme <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
