/**
 * Tableau d'historique des courses pour /chevaux/[slug] /jockeys/[slug]
 * /entraineurs/[slug]. Composant serveur, pas d'interactivité.
 *
 * Maillage interne (PR #120, mai 2026) : les colonnes Cheval / Jockey /
 * Entraîneur / Hippodrome deviennent des <Link> vers leur fiche dédiée
 * quand le slug existe en BDD (validé via `knownSlugs`). Chaque page
 * historique distribue ainsi ~150 liens internes vers des fiches voisines
 * → boost massif du crawl-budget Google sur /chevaux/* /jockeys/*.
 */

import Link from "next/link";
import type { CourseLine, EntiteType, KnownSlugs } from "@/lib/seo/acteurs";
import { slugify } from "@/lib/seo/slugs";

interface Props {
  type: EntiteType;
  rows: CourseLine[];
  /** Colonnes à afficher (l'entité elle-même est cachée). */
  showJockey?:     boolean;
  showEntraineur?: boolean;
  showCheval?:     boolean;
  /** Slugs présents en BDD pour le maillage interne (optional, fallback texte). */
  knownSlugs?:     KnownSlugs;
}

/**
 * Cellule "nom d'acteur" : Link si le slug existe en BDD, sinon plain text.
 * Évite les 404 sur des acteurs qui n'auraient pas encore été syncés.
 */
function ActeurCell({
  nom, slug, type, validSlugs, className = "",
}: {
  nom:        string | null;
  slug:       string;
  type:       EntiteType;
  validSlugs: Set<string> | undefined;
  className?: string;
}) {
  if (!nom) return <span className="text-text-muted">—</span>;
  if (!validSlugs || !validSlugs.has(slug)) {
    return <span className={className}>{nom}</span>;
  }
  return (
    <Link
      href={`/${type}/${slug}`}
      className={`${className} hover:text-gold-primary transition-colors underline-offset-2 hover:underline`}
    >
      {nom}
    </Link>
  );
}

function formatDateShort(d: string): string {
  return new Date(d + "T12:00:00").toLocaleDateString("fr-FR", {
    day: "numeric", month: "short", year: "2-digit",
  });
}

function ArriveeBadge({ pos }: { pos: number | null }) {
  if (pos === null) return <span className="text-text-muted text-xs">—</span>;
  if (pos === 1) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-status-win/15 text-status-win border border-status-win/30">
        1<sup>er</sup>
      </span>
    );
  }
  if (pos <= 3) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-gold-primary/10 text-gold-light border border-gold-primary/30">
        {pos}<sup>e</sup>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono bg-bg-card text-text-secondary border border-border">
      {pos}<sup>e</sup>
    </span>
  );
}

export default function HistoriqueCourses({ type, rows, showJockey, showEntraineur, showCheval, knownSlugs }: Props) {
  if (rows.length === 0) {
    return (
      <div className="card-base p-8 text-center">
        <p className="text-text-secondary text-sm">Aucune course enregistrée</p>
      </div>
    );
  }

  return (
    <div className="card-base overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-text-muted text-xs">
              <th className="py-2 px-3 text-left font-medium">Date</th>
              <th className="py-2 px-3 text-left font-medium">Course</th>
              <th className="py-2 px-3 text-left font-medium hidden md:table-cell">Hippodrome</th>
              {showCheval && <th className="py-2 px-3 text-left font-medium hidden lg:table-cell">Cheval</th>}
              {showJockey && <th className="py-2 px-3 text-left font-medium hidden lg:table-cell">Jockey</th>}
              {showEntraineur && <th className="py-2 px-3 text-left font-medium hidden xl:table-cell">Entraîneur</th>}
              <th className="py-2 px-3 text-center font-medium">N°</th>
              <th className="py-2 px-3 text-right font-medium hidden sm:table-cell">Cote</th>
              <th className="py-2 px-3 text-center font-medium">Arrivée</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={`${r.course_id}-${i}`} className="border-b border-border/50 last:border-0 hover:bg-bg-elevated/40">
                <td className="py-2 px-3 text-text-muted text-xs whitespace-nowrap">{formatDateShort(r.date_course)}</td>
                <td className="py-2 px-3">
                  <Link href={`/courses/${r.course_id}`} className="text-text-primary hover:text-gold-primary text-sm font-medium">
                    R{r.numero_reunion}C{r.numero_course}
                  </Link>
                  <span className="text-text-muted text-xs hidden sm:inline ml-2">
                    {r.course_libelle.length > 35 ? r.course_libelle.slice(0, 35) + "…" : r.course_libelle}
                  </span>
                </td>
                <td className="py-2 px-3 text-text-muted text-xs hidden md:table-cell">
                  {r.hippodrome_nom ? (
                    knownSlugs?.hippodromes.has(slugify(r.hippodrome_nom)) ? (
                      <Link
                        href={`/hippodromes/${slugify(r.hippodrome_nom)}`}
                        className="hover:text-gold-primary transition-colors"
                      >
                        {r.hippodrome_nom}
                      </Link>
                    ) : (
                      r.hippodrome_nom
                    )
                  ) : "—"}
                </td>
                {showCheval && (
                  <td className="py-2 px-3 text-text-secondary text-xs hidden lg:table-cell">
                    <ActeurCell
                      nom={r.nom_cheval}
                      slug={slugify(r.nom_cheval ?? "")}
                      type="chevaux"
                      validSlugs={knownSlugs?.chevaux}
                    />
                  </td>
                )}
                {showJockey && (
                  <td className="py-2 px-3 text-text-secondary text-xs hidden lg:table-cell">
                    <ActeurCell
                      nom={r.jockey}
                      slug={slugify(r.jockey ?? "")}
                      type="jockeys"
                      validSlugs={knownSlugs?.jockeys}
                    />
                  </td>
                )}
                {showEntraineur && (
                  <td className="py-2 px-3 text-text-muted text-xs hidden xl:table-cell">
                    <ActeurCell
                      nom={r.entraineur}
                      slug={slugify(r.entraineur ?? "")}
                      type="entraineurs"
                      validSlugs={knownSlugs?.entraineurs}
                    />
                  </td>
                )}
                <td className="py-2 px-3 text-center text-gold-primary font-bold">{r.numero}</td>
                <td className="py-2 px-3 text-right text-text-secondary font-mono text-xs hidden sm:table-cell">
                  {r.cote ? r.cote.toFixed(1) : "—"}
                </td>
                <td className="py-2 px-3 text-center"><ArriveeBadge pos={r.arrivee} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
