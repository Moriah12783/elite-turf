import { PlayCircle } from "lucide-react";

export interface Replay {
  id: string;
  date_course: string;
  titre: string;
  youtube_id: string;
  hippodrome: string | null;
}

function fmtDate(d: string): string {
  return new Date(d + "T00:00:00").toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
  });
}

/**
 * Replays OFFICIELS curés (admin). On n'héberge / ne rediffuse rien : on intègre
 * les vidéos des chaînes officielles via l'embed YouTube standard (autorisé).
 */
export default function ReplaySection({ replays }: { replays: Replay[] }) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-2">
        <PlayCircle className="w-5 h-5 text-gold-primary" />
        <h2 className="font-serif font-bold text-text-primary text-lg">Replays officiels</h2>
      </div>
      <p className="text-text-secondary text-sm mb-5">
        Revivez les courses via les chaînes <strong>officielles</strong> (Equidia, France Galop,
        Le Trot, PMU).
      </p>

      {replays.length === 0 ? (
        <div className="card-base p-6 text-center">
          <p className="text-text-secondary text-sm mb-3">
            Pas encore de replay sélectionné pour cette période.
          </p>
          <a
            href="https://www.equidia.fr/replay"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary inline-flex items-center gap-2 text-sm"
          >
            Voir les replays sur Equidia →
          </a>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {replays.map((r) => (
              <div key={r.id} className="card-base overflow-hidden">
                <div className="aspect-video bg-bg-elevated">
                  <iframe
                    className="w-full h-full"
                    src={`https://www.youtube-nocookie.com/embed/${r.youtube_id}`}
                    title={r.titre}
                    loading="lazy"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
                <div className="p-3">
                  <p className="text-text-primary text-sm font-semibold line-clamp-2">{r.titre}</p>
                  <p className="text-text-muted text-xs mt-1">
                    {[r.hippodrome, fmtDate(r.date_course)].filter(Boolean).join(" · ")}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 text-center">
            <a
              href="https://www.equidia.fr/replay"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gold-primary hover:text-gold-light text-sm font-semibold"
            >
              Plus de replays sur Equidia →
            </a>
          </div>
        </>
      )}

      <p className="text-text-muted text-[11px] mt-4 leading-relaxed">
        Elite Turf n&apos;héberge ni ne rediffuse aucune vidéo : les replays sont intégrés depuis
        les chaînes officielles via YouTube.
      </p>
    </section>
  );
}
