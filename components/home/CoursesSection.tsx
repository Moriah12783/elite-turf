import Link from "next/link";
import { Clock, MapPin, Users, ChevronRight, Calendar, Globe2 } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/server";
import { isJouableAfrique, getNationaleLabel } from "@/lib/pmu-api";

const CATEGORIE_COLORS: Record<string, string> = {
  PLAT:     "bg-blue-500/10 text-blue-400 border-blue-500/20",
  TROT:     "bg-purple-500/10 text-purple-400 border-purple-500/20",
  OBSTACLE: "bg-orange-500/10 text-orange-400 border-orange-500/20",
};

const FALLBACK_IMAGES = [
  "https://images.unsplash.com/photo-1495543377553-b2aba1f925d7?w=600&q=80",
  "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80",
  "https://images.unsplash.com/photo-1526094633853-031707a44819?w=600&q=80",
  "https://images.unsplash.com/photo-1635895882609-942f36e1db5d?w=600&q=80",
  "https://images.unsplash.com/photo-1708882308455-cd5f478f7bf9?w=600&q=80",
];

function hippoImage(nom: string, idx: number = 0): string {
  const n = nom.toLowerCase();
  if (n.includes("vincenn"))   return "https://images.unsplash.com/photo-1635895882609-942f36e1db5d?w=600&q=80";
  if (n.includes("longchamp")) return "https://images.unsplash.com/photo-1495543377553-b2aba1f925d7?w=600&q=80";
  if (n.includes("saint-cloud") || n.includes("saint cloud")) return "https://images.unsplash.com/photo-1526094633853-031707a44819?w=600&q=80";
  if (n.includes("chantilly"))  return "https://images.unsplash.com/photo-1708882308455-cd5f478f7bf9?w=600&q=80";
  if (n.includes("marrakech") || n.includes("casabl") || n.includes("abidjan") || n.includes("dakar"))
    return "https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?w=600&q=80";
  if (n.includes("chatel") || n.includes("la teste") || n.includes("deauville") || n.includes("clairef"))
    return "https://images.unsplash.com/photo-1507514604110-ba3347c457f6?w=600&q=80";
  if (n.includes("fontaine") || n.includes("maisons") || n.includes("compiegne") || n.includes("compiègne"))
    return "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80";
  if (n.includes("lyon") || n.includes("parilly") || n.includes("bordeaux") || n.includes("toulouse"))
    return "https://images.unsplash.com/photo-1526094633853-031707a44819?w=600&q=80";
  // Fallback indexé pour varier les images entre courses
  return FALLBACK_IMAGES[idx % FALLBACK_IMAGES.length];
}

export default async function CoursesSection() {
  const supabase = createServiceClient();
  const today = new Date().toISOString().split("T")[0];

  const { data: rawCourses } = await supabase
    .from("courses")
    .select(`
      id, libelle, heure_depart, numero_reunion, numero_course,
      categorie, distance_metres, nb_partants, statut, paris_disponibles,
      hippodrome:hippodromes(nom, pays),
      pronostics(id, niveau_acces, publie)
    `)
    .eq("date_course", today)
    .order("heure_depart", { ascending: true })
    .limit(15);

  // Garder les courses avec des paris disponibles (jouables par les abonnés)
  // Priorité : Nationale 1, 2, 3 — puis autres courses du jour
  const allAfrique = ((rawCourses || []) as any[])
    .filter((c: any) => Array.isArray(c.paris_disponibles) && c.paris_disponibles.length > 0);
  const courses = allAfrique.slice(0, 3);

  const header = (
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
  );

  // Aucune course africaine aujourd'hui → état vide
  if (!courses.length) {
    return (
      <section className="py-16 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {header}
          <div className="card-base p-10 text-center">
            <Globe2 className="w-10 h-10 text-gold-primary mx-auto mb-3 opacity-60" />
            <p className="text-text-secondary text-sm">
              Le programme du marché africain sera disponible à partir de 8h00 (heure de Paris).
            </p>
            <Link
              href="/courses"
              className="mt-4 inline-flex items-center gap-1 text-gold-primary text-sm font-medium hover:text-gold-light transition-colors"
            >
              Voir toutes les courses <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-16 sm:py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {header}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {courses.map((course: any, idx: number) => {
            const hipNom     = course.hippodrome?.nom || "Hippodrome";
            const pays       = course.hippodrome?.pays || "France";
            const nationale  = getNationaleLabel(course.paris_disponibles || []);
            const pronoPublie = (course.pronostics || []).find((p: any) => p.publie);
            const numero     = `R${course.numero_reunion}C${course.numero_course}`;
            const heure      = (course.heure_depart || "").substring(0, 5);

            return (
              <Link
                key={course.id}
                href={`/courses`}
                className="card-base overflow-hidden group cursor-pointer flex flex-col"
              >
                {/* Image hippodrome */}
                <div className="relative overflow-hidden">
                  <img
                    src={hippoImage(hipNom, idx)}
                    alt={hipNom}
                    className="w-full h-32 object-cover rounded-t-xl transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-bg-card via-bg-card/20 to-transparent rounded-t-xl" />

                  {/* Heure */}
                  <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1.5 bg-bg-primary/80 backdrop-blur-sm border border-gold-primary/30 rounded-full">
                    <Clock className="w-3 h-3 text-gold-primary" />
                    <span className="text-gold-light font-semibold text-xs">{heure}</span>
                  </div>

                  {/* Numéro de course */}
                  <div className="absolute top-3 left-3 px-2 py-1 bg-bg-primary/80 backdrop-blur-sm border border-border/60 rounded-md">
                    <span className="text-text-muted text-xs font-mono">{numero}</span>
                  </div>

                  {/* Badge pronostic */}
                  {pronoPublie && (
                    <div className="absolute bottom-3 left-3">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-semibold backdrop-blur-sm ${
                        pronoPublie.niveau_acces === "GRATUIT"
                          ? "bg-status-win/80 text-white border border-status-win/40"
                          : "bg-gold-primary/80 text-bg-primary border border-gold-primary/40"
                      }`}>
                        {pronoPublie.niveau_acces === "GRATUIT" ? "✓ Pronostic gratuit" : "★ Pronostic Premium"}
                      </span>
                    </div>
                  )}
                </div>

                {/* Contenu texte */}
                <div className="p-5 flex flex-col flex-1">
                  <div className="flex items-center gap-1.5 mb-2">
                    <MapPin className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
                    <span className="text-text-secondary text-xs">
                      {hipNom}
                      <span className="text-text-muted"> · {pays}</span>
                    </span>
                  </div>

                  <h3 className="font-serif font-semibold text-text-primary text-base mb-3 group-hover:text-gold-light transition-colors leading-snug">
                    {course.libelle}
                  </h3>

                  <div className="flex items-center flex-wrap gap-2 mb-4">
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${CATEGORIE_COLORS[course.categorie] || "bg-gray-500/10 text-gray-400 border-gray-500/20"}`}>
                      {course.categorie || "PLAT"}
                    </span>
                    {course.distance_metres > 0 && (
                      <span className="text-xs text-text-muted">{course.distance_metres}m</span>
                    )}
                    {nationale && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        🌍 {nationale.split(" — ")[0]}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-3 mt-auto border-t border-border/50">
                    <div className="flex items-center gap-1 text-text-muted text-xs">
                      <Users className="w-3.5 h-3.5" />
                      {course.nb_partants || "?"} partants
                    </div>
                    {!pronoPublie && (
                      <span className="text-xs text-text-muted italic">Pronostic en cours…</span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
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
