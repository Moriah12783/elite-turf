/**
 * « Course par course » sous le bilan de la Sélection stats (demande de Steph
 * du 03/10/2026, sur le modèle du cockpit de prono.elite-turf.fr) : chaque
 * photo, la sélection face aux favoris PMU du même instant, l'arrivée et ce
 * que chacune a couvert, sans ouvrir les courses une à une.
 *
 * Filtres par lien (?periode=…) et recherche par formulaire GET (?q=…) : tout
 * est rendu côté serveur, sans JavaScript.
 */
import Link from "next/link";
import { Check, X, Search } from "lucide-react";
import { heureGmtDepuisParis } from "@/lib/seo/dates";
import {
  boutonsPeriodes, correspond, dansPeriode, ligneCourse, totaux,
  type Couverture, type PhotoSelection,
} from "@/lib/selection/historique";

interface Props {
  photos: PhotoSelection[];
  periode: string;
  recherche: string;
  aujourdHui: string;
  hier: string;
}

/** Jour le plus récent d'abord ; dans un jour, l'ordre des départs. */
function trier(a: PhotoSelection, b: PhotoSelection): number {
  return (
    (b.date ?? "").localeCompare(a.date ?? "") ||
    (a.heure ?? "").localeCompare(b.heure ?? "") ||
    (a.reunion ?? 0) - (b.reunion ?? 0) ||
    (a.numeroCourse ?? 0) - (b.numeroCourse ?? 0)
  );
}

const pct = (k: number, n: number) => (n ? `${((k / n) * 100).toFixed(1).replace(".", ",")} %` : "—");

/** Numéros colorés selon l'arrivée : gagnant, 2e-3e, 4e-5e. */
function Numeros({ numeros, arrivee }: { numeros: number[]; arrivee: number[] }) {
  const cinq = arrivee.slice(0, 5);
  return (
    <div className="flex flex-wrap gap-1">
      {numeros.map((n) => {
        const rang = cinq.indexOf(n);
        const style =
          rang === 0 ? "bg-status-win border-status-win text-bg-primary" :
          rang === 1 || rang === 2 ? "bg-status-win/15 border-status-win/60 text-status-win" :
          rang >= 3 ? "bg-gold-faint border-gold-primary/60 text-gold-light" :
          "bg-bg-elevated border-border text-text-secondary";
        return (
          <span
            key={n}
            title={rang === 0 ? "Gagnant" : rang > 0 ? `${rang + 1}e à l'arrivée` : undefined}
            className={`w-7 h-7 rounded-full border text-xs font-bold flex items-center justify-center tabular-nums ${style}`}
          >
            {n}
          </span>
        );
      })}
    </div>
  );
}

function LigneCouverture({ libelle, c }: { libelle: string; c: Couverture }) {
  return (
    <>
      <span className="text-text-muted">{libelle}</span>
      {c.gagnant
        ? <Check className="w-3.5 h-3.5 text-status-win" aria-label="gagnant dedans" />
        : <X className="w-3.5 h-3.5 text-status-loss" aria-label="gagnant absent" />}
      <span className={c.troisPremiers === 3 ? "text-status-win font-semibold" : "text-text-secondary"}>
        {c.troisPremiers}/3
      </span>
      <span className={c.cinqPremiers === c.nCinq ? "text-status-win font-semibold" : "text-text-secondary"}>
        {c.cinqPremiers}/{c.nCinq}
      </span>
    </>
  );
}

export default function CourseParCourse({ photos, periode, recherche, aujourdHui, hier }: Props) {
  const boutons = boutonsPeriodes(photos.map((p) => p.date), aujourdHui, hier);
  const lignes = photos
    .filter((p) => dansPeriode(p.date, periode) && correspond(p, recherche))
    .sort(trier)
    .map(ligneCourse);
  const t = totaux(lignes);
  const maintenant = Date.now();
  const lien = (p: string) => `?periode=${p}${recherche ? `&q=${encodeURIComponent(recherche)}` : ""}#courses`;

  return (
    <section id="courses" className="space-y-4 scroll-mt-24">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-text-primary text-lg font-semibold">Course par course</h2>
          <p className="text-text-secondary text-sm mt-1 max-w-3xl">
            La sélection photographiée avant le départ, les favoris PMU du même instant (autant que de chevaux
            sélectionnés) et l&apos;arrivée. Une course apparaît dès que sa sélection est photographiée, 5 à
            15 minutes avant le départ. Cliquez sur une course pour ouvrir sa page.
          </p>
        </div>
        <span className="px-3 py-1.5 rounded-lg bg-gold-faint border border-gold-primary/30 text-gold-light text-sm font-semibold">
          {lignes.length} course{lignes.length > 1 ? "s" : ""} affichée{lignes.length > 1 ? "s" : ""}
        </span>
      </div>

      <div className="card-base p-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          {boutons.map((b) => {
            const actif = b.periode === periode;
            const periodeLongue = b.periode === "tout" || b.periode.length === 7;
            return (
              <Link
                key={b.periode}
                href={lien(b.periode)}
                className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
                  actif
                    ? "bg-gold-primary border-gold-primary text-bg-primary"
                    : periodeLongue
                      ? "bg-bg-elevated border-gold-primary/40 text-gold-light hover:border-gold-primary"
                      : "bg-bg-elevated border-border text-text-secondary hover:text-text-primary"
                }`}
              >
                {b.libelle} <span className={actif ? "opacity-80" : "text-text-muted"}>[{b.n}]</span>
              </Link>
            );
          })}
        </div>
        <form method="get" action="#courses" className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="periode" value={periode} />
          <div className="relative flex-1 min-w-[16rem]">
            <Search className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              name="q"
              defaultValue={recherche}
              placeholder="Filtrer par hippodrome, réunion, course ou épreuve (ex. Vincennes, R1C4)…"
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-bg-primary border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-gold-primary/60"
            />
          </div>
          <button type="submit" className="px-4 py-2 rounded-lg bg-bg-elevated border border-border text-sm text-text-primary hover:border-gold-primary/60">
            Filtrer
          </button>
          {recherche && (
            <Link href={`?periode=${periode}#courses`} className="text-sm text-text-muted hover:text-text-primary">
              Effacer
            </Link>
          )}
        </form>
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-muted">
          <span>Numéros arrivés :</span>
          <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-status-win" /> gagnant</span>
          <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-status-win/15 border border-status-win/60" /> 2e et 3e</span>
          <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-gold-faint border border-gold-primary/60" /> 4e et 5e</span>
        </p>
      </div>

      <div className="card-base overflow-x-auto">
        <table className="w-full min-w-[960px]">
          <thead>
            <tr className="text-text-muted text-xs uppercase tracking-wider text-left">
              <th className="px-4 py-3 font-semibold">Course &amp; départ (GMT)</th>
              <th className="px-4 py-3 font-semibold">Sélection stats</th>
              <th className="px-4 py-3 font-semibold">Marché PMU</th>
              <th className="px-4 py-3 font-semibold">Arrivée (top 5)</th>
              <th className="px-4 py-3 font-semibold">
                Couverture
                <span className="block normal-case tracking-normal font-normal">gagnant · 3 premiers · 5 premiers</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {lignes.length === 0 && (
              <tr className="border-t border-border/40">
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-text-secondary">
                  {recherche
                    ? <>Aucune course ne correspond à « {recherche} » sur cette période.</>
                    : "Aucune sélection photographiée sur cette période."}
                </td>
              </tr>
            )}
            {lignes.map((l) => {
              const p = l.photo;
              const paris = (p.heure ?? "").slice(0, 5);
              const gmt = p.date ? heureGmtDepuisParis(p.date, p.heure) : null;
              const arrivee = p.arrivee.length >= 3;
              const partie = p.departPrevu ? Date.parse(p.departPrevu) < maintenant : true;
              return (
                <tr key={`${p.courseId}-${p.priseLe}`} className="border-t border-border/40 align-top hover:bg-bg-elevated/40">
                  <td className="px-4 py-3">
                    <Link
                      href={`/courses/${p.courseId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gold-light font-semibold text-sm uppercase hover:underline"
                    >
                      {p.hippodrome ?? "Hippodrome inconnu"} · R{p.reunion}C{p.numeroCourse}
                    </Link>
                    <p className="text-xs text-text-secondary mt-1">
                      {gmt && <span className="text-text-primary font-semibold">{gmt} GMT </span>}
                      {paris && <>({paris} Paris) </>}· {p.date}
                    </p>
                    <p className="text-[11px] text-text-muted mt-0.5">
                      {l.minutesAvant !== null && <>photo à −{l.minutesAvant} min · </>}
                      {p.sourceCotes === "csv" ? "cotes du moment" : "cotes en base"}
                    </p>
                  </td>
                  <td className="px-4 py-3"><Numeros numeros={p.numeros} arrivee={p.arrivee} /></td>
                  <td className="px-4 py-3"><Numeros numeros={l.marche} arrivee={p.arrivee} /></td>
                  <td className="px-4 py-3 font-mono text-sm text-text-primary whitespace-nowrap">
                    {arrivee ? p.arrivee.slice(0, 5).join(" - ") : <span className="text-text-muted">En attente</span>}
                  </td>
                  <td className="px-4 py-3">
                    {l.couvSelection && l.couvMarche ? (
                      <div className="grid grid-cols-[3.5rem_1rem_2rem_2rem] gap-x-2 gap-y-1 items-center text-xs font-mono">
                        <LigneCouverture libelle="Sél." c={l.couvSelection} />
                        <LigneCouverture libelle="Marché" c={l.couvMarche} />
                      </div>
                    ) : (
                      <span className={`inline-block px-2.5 py-1 rounded-md border text-xs font-medium ${
                        partie ? "border-status-pending/40 text-text-secondary" : "border-status-loss/50 text-status-loss"
                      }`}>
                        {partie ? "Arrivée en attente" : "Course à venir"}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {t.n > 0 && (
          <div className="px-4 py-3 border-t border-border text-xs text-text-secondary space-y-1">
            <p className="text-text-muted">
              Sur les {t.n} course{t.n > 1 ? "s" : ""} avec arrivée affichée{t.n > 1 ? "s" : ""} (3 premiers et
              5 premiers : tous dans la sélection) :
            </p>
            {([["Sélection stats", t.selection], ["Marché PMU", t.marche]] as const).map(([libelle, c]) => (
              <p key={libelle}>
                <span className="text-text-primary font-semibold">{libelle}</span>
                {" — "}gagnant dedans {c.gagnant}/{t.n} ({pct(c.gagnant, t.n)}) · 3 premiers {c.troisPremiers}/{t.n} (
                {pct(c.troisPremiers, t.n)}) · 5 premiers {c.cinqPremiers}/{t.nCinq} ({pct(c.cinqPremiers, t.nCinq)})
              </p>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
