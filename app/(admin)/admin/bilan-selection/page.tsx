/**
 * /admin/bilan-selection — bilan de la « Sélection stats » sur les photos prises
 * 15 à 5 min avant chaque départ (cron photo-selection), et comparaison du
 * pronostic payant au marché de la même heure (favoris de la photo, à nombre de
 * chevaux égal).
 *
 * Version INTERNE (décision de Steph du 02/10/2026 : mesurer d'abord, publier
 * ensuite). Les chiffres ne portent que sur des photos : jamais sur des cotes
 * relevées après le départ. Sous les bilans, le détail course par course
 * (CourseParCourse, demande de Steph du 03/10/2026).
 */
import { Camera, Info, ArrowDown } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/server";
import { calculerBilan, type BilanSelection, type LigneBilan, type Taux } from "@/lib/selection/bilan";
import { periodeParDefaut, periodeValide, type PhotoSelection } from "@/lib/selection/historique";
import { parisDateISOPlusDays } from "@/lib/paris-date";
import { chargerPhotos, chargerPronos, type Niveau } from "./donnees";
import CourseParCourse from "./CourseParCourse";

export const dynamic = "force-dynamic";

function lignes(photos: PhotoSelection[], pronos: Map<string, Partial<Record<Niveau, number[]>>>, depuis: string | null, niveau?: Niveau): LigneBilan[] {
  return photos
    .filter((p) => p.date && (!depuis || p.date >= depuis))
    .map((p) => ({
      numeros:     p.numeros,
      nbPartants:  p.nbPartants,
      cotesMarche: p.cotesMarche,
      arrivee:     p.arrivee,
      pronoPayant: niveau ? pronos.get(p.courseId)?.[niveau] ?? null : null,
    }));
}

const pct = (x: number) => `${(x * 100).toFixed(1).replace(".", ",")} %`;

function LigneTaux({ libelle, t, accent }: { libelle: string; t: Taux; accent?: boolean }) {
  return (
    <tr className="border-t border-border/40">
      <td className={`px-4 py-2.5 text-sm ${accent ? "text-text-primary font-semibold" : "text-text-secondary"}`}>{libelle}</td>
      <td className="px-4 py-2.5 text-sm font-mono text-right">{t.n ? pct(t.gagnant) : "—"}</td>
      <td className="px-4 py-2.5 text-sm font-mono text-right">{t.n ? pct(t.troisPremiers) : "—"}</td>
      <td className="px-4 py-2.5 text-sm font-mono text-right">{t.nCinq ? pct(t.cinqPremiers) : "—"}</td>
    </tr>
  );
}

function Tableau({ titre, n, children }: { titre: string; n: number; children: React.ReactNode }) {
  return (
    <div className="card-base overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <h3 className="text-text-primary text-sm font-semibold">{titre}</h3>
        <span className="text-text-muted text-xs">{n} course{n > 1 ? "s" : ""} avec arrivée</span>
      </div>
      <table className="w-full">
        <thead>
          <tr className="text-text-muted text-xs uppercase tracking-wider">
            <th className="px-4 py-2 text-left font-semibold"> </th>
            <th className="px-4 py-2 text-right font-semibold">Gagnant dedans</th>
            <th className="px-4 py-2 text-right font-semibold">3 premiers dedans</th>
            <th className="px-4 py-2 text-right font-semibold">5 premiers dedans</th>
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export default async function BilanSelectionPage({
  searchParams,
}: {
  searchParams: { periode?: string; q?: string };
}) {
  const supabase = createServiceClient();
  const photos = await chargerPhotos(supabase);
  const pronos = await chargerPronos(supabase, Array.from(new Set(photos.map((p) => p.courseId))));

  const avecArrivee = photos.filter((p) => p.arrivee.length >= 3).length;
  const enCsv = photos.filter((p) => p.sourceCotes === "csv").length;
  const premiere = photos.length ? photos[photos.length - 1].priseLe.slice(0, 10) : null;

  // Course par course : la période (jour, mois ou tout) et la recherche viennent de l'URL.
  const aujourdHui = parisDateISOPlusDays(0);
  const periode = periodeValide(searchParams.periode)
    ? searchParams.periode
    : periodeParDefaut(photos.map((p) => p.date), aujourdHui);
  const recherche = (searchParams.q ?? "").trim().slice(0, 80);

  const periodes: Array<{ libelle: string; depuis: string | null }> = [
    { libelle: "7 derniers jours",  depuis: parisDateISOPlusDays(-7) },
    { libelle: "30 derniers jours", depuis: parisDateISOPlusDays(-30) },
    { libelle: "Depuis le début",   depuis: null },
  ];
  const bilans = periodes.map((p) => ({
    ...p,
    selection: calculerBilan(lignes(photos, pronos, p.depuis)),
    elite:     calculerBilan(lignes(photos, pronos, p.depuis, "ELITE")),
    pro:       calculerBilan(lignes(photos, pronos, p.depuis, "PRO")),
  }));

  const payant = (titre: string, b: BilanSelection) => (
    <Tableau titre={titre} n={b.payant.courses}>
      <LigneTaux libelle="Pronostic payant" t={b.payant.prono} accent />
      <LigneTaux libelle="Favoris PMU de la photo (même nombre)" t={b.payant.marche} />
    </Tableau>
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-2xl font-bold text-text-primary flex items-center gap-2">
          <Camera className="w-6 h-6 text-gold-primary" /> Bilan de la Sélection stats
        </h1>
        <p className="text-text-secondary text-sm mt-2 max-w-3xl">
          Chaque sélection est photographiée entre 15 et 5 minutes avant le départ, telle qu&apos;un visiteur
          la voit, puis confrontée à l&apos;arrivée officielle. Rien n&apos;est recalculé après coup.
        </p>
        <a href="#courses" className="inline-flex items-center gap-1.5 mt-3 text-gold-light text-sm font-medium hover:underline">
          <ArrowDown className="w-4 h-4" /> Voir le détail course par course
        </a>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { v: photos.length, l: "photos" },
          { v: avecArrivee, l: "avec arrivée" },
          { v: photos.length ? pct(enCsv / photos.length) : "—", l: "aux cotes du moment" },
          { v: premiere ?? "—", l: "première photo" },
        ].map((k) => (
          <div key={k.l} className="card-base p-4">
            <p className="text-text-primary text-xl font-bold font-mono">{k.v}</p>
            <p className="text-text-muted text-xs mt-1">{k.l}</p>
          </div>
        ))}
      </div>

      <div className="card-base p-4 flex gap-3 text-text-secondary text-xs leading-relaxed">
        <Info className="w-4 h-4 text-gold-primary flex-shrink-0 mt-0.5" />
        <p>
          Toujours lire un taux face au hasard : avec 8 chevaux sur 12, le gagnant est dans la sélection 2 fois
          sur 3 sans rien savoir. Le payant est comparé aux favoris PMU de la même photo, avec le même nombre de
          chevaux. Version interne : la publication se décide sur pièces, une fois assez de courses mesurées.
        </p>
      </div>

      {bilans.map((b) => (
        <section key={b.libelle} className="space-y-4">
          <h2 className="text-text-primary text-lg font-semibold">{b.libelle}</h2>
          <Tableau titre="Sélection stats gratuite (8 chevaux)" n={b.selection.courses}>
            <LigneTaux libelle="Sélection stats" t={b.selection.selection} accent />
            <LigneTaux libelle="Hasard (même nombre de chevaux)" t={b.selection.hasard} />
          </Tableau>
          <div className="grid lg:grid-cols-2 gap-4">
            {payant("Pronostic ELITE contre le marché", b.elite)}
            {payant("Pronostic PRO contre le marché", b.pro)}
          </div>
        </section>
      ))}

      <CourseParCourse
        photos={photos}
        periode={periode}
        recherche={recherche}
        aujourdHui={aujourdHui}
        hier={parisDateISOPlusDays(-1)}
      />
    </div>
  );
}
