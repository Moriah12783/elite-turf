/**
 * Bloc 2 des pages pays migrées — « Jouer depuis {pays} » (brief §3) : les
 * faits du registre validé, chacun avec sa source. Un fait non publiable
 * n'est jamais affiché (cf. lib/geo/contenu-pays.ts).
 */
import { MapPin } from "lucide-react";
import type { BlocJouer, SourceAffichee } from "@/lib/geo/contenu-pays";

function Source({ s }: { s: SourceAffichee }) {
  return (
    <p className="mt-2 text-xs text-text-muted">
      Source :{" "}
      <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-gold-primary hover:text-gold-light underline">
        {s.domaine}
      </a>
      , consultée le {s.date}
    </p>
  );
}

function Sous({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <div className="card-base p-5">
      <h3 className="text-text-primary text-base font-semibold mb-2">{titre}</h3>
      {children}
    </div>
  );
}

export default function BlocJouerDepuis({ bloc }: { bloc: BlocJouer }) {
  return (
    <section className="mb-12" aria-labelledby="jouer-depuis">
      <h2 id="jouer-depuis" className="font-serif text-2xl font-bold text-text-primary mb-6 flex items-center gap-2">
        <MapPin className="w-6 h-6 text-gold-primary" aria-hidden="true" />
        {bloc.titre}
      </h2>

      <div className="grid gap-4">
        <Sous titre="L'opérateur">
          <p className="text-text-secondary text-sm leading-relaxed">
            {bloc.operateur.nom} —{" "}
            <a href={bloc.operateur.site} target="_blank" rel="noopener noreferrer" className="text-gold-primary hover:text-gold-light underline">
              site officiel
            </a>
            . {bloc.mention}
          </p>
          <Source s={bloc.operateur.source} />
        </Sous>

        {bloc.modes && (
          <Sous titre="Où jouer">
            <ul className="text-text-secondary text-sm leading-relaxed list-disc pl-5">
              {bloc.modes.libelles.map((m) => <li key={m}>{m}</li>)}
            </ul>
            <Source s={bloc.modes.source} />
          </Sous>
        )}

        {bloc.heureLimite && (
          <Sous titre="Heure limite des paris">
            <p className="text-text-secondary text-sm leading-relaxed">{bloc.heureLimite.texte}</p>
            <Source s={bloc.heureLimite.source} />
          </Sous>
        )}

        {bloc.courses && (
          <Sous titre="Courses proposées">
            <ul className="text-text-secondary text-sm leading-relaxed list-disc pl-5">
              {bloc.courses.lignes.map((l) => <li key={l}>{l}</li>)}
            </ul>
            <Source s={bloc.courses.source} />
          </Sous>
        )}

        {bloc.paris && (
          <Sous titre="Paris et formules">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <tbody>
                  {bloc.paris.lignes.map((p) => (
                    <tr key={p.nom} className="border-t border-border/60 first:border-t-0">
                      <th scope="row" className="py-2 pr-4 text-left align-top font-semibold text-text-primary whitespace-nowrap">{p.nom}</th>
                      <td className="py-2 text-text-secondary leading-relaxed">{p.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Source s={bloc.paris.source} />
          </Sous>
        )}

        {bloc.vocabulaire && (
          <Sous titre="Le vocabulaire local">
            <dl className="grid gap-2 text-sm">
              {bloc.vocabulaire.termes.map((t) => (
                <div key={t.terme}>
                  <dt className="font-semibold text-text-primary">{t.terme}</dt>
                  <dd className="text-text-secondary leading-relaxed">{t.sens}</dd>
                </div>
              ))}
            </dl>
            <Source s={bloc.vocabulaire.source} />
          </Sous>
        )}
      </div>
    </section>
  );
}
