import Link from "next/link";
import { Radar, ArrowRight, Star, Info } from "lucide-react";
import type { RadarVedette } from "@/lib/consensus/radar-vedette";

/**
 * « Le Radar de la presse » — teaser gratuit de la course vedette du jour,
 * bâti sur le CONSENSUS DE LA PRESSE (pas le pronostic d'Elite). Positionné
 * haut sur la home ; affiché aux visiteurs + inscrits gratuits, masqué pour
 * les abonnés payants (gating côté page). Objectif : prouver le sérieux
 * d'Elite et amener l'indécis vers l'abonnement, sans livrer le produit.
 */

interface BlockDef {
  key:  "base" | "value" | "coup";
  name: string;
  tag:  string;
  desc: string;
  top:  string;  // couleur du liseré haut
  num:  string;  // couleur des numéros
  ring: string;  // couleur bordure chip
  bg:   string;  // fond chip
}

const BLOCKS: BlockDef[] = [
  {
    key: "base", name: "La base", tag: "Solide",
    desc: "Les incontournables, cités par la quasi-totalité de la presse.",
    top: "border-t-status-win", num: "text-status-win", ring: "border-status-win/50", bg: "bg-status-win/10",
  },
  {
    key: "value", name: "La value", tag: "Bon rapport",
    desc: "Cotés plus haut, mais solidement soutenus : le meilleur ratio risque / gain.",
    top: "border-t-blue-400", num: "text-blue-400", ring: "border-blue-400/50", bg: "bg-blue-400/10",
  },
  {
    key: "coup", name: "Le coup", tag: "Audace",
    desc: "L'outsider que quelques plumes osent : celui qui peut renverser la course.",
    top: "border-t-status-partial", num: "text-status-partial", ring: "border-status-partial/50", bg: "bg-status-partial/10",
  },
];

export default function RadarPresseSection({ data }: { data: RadarVedette }) {
  const groups = [
    { def: BLOCKS[0], nums: data.base },
    { def: BLOCKS[1], nums: data.value },
    { def: BLOCKS[2], nums: data.coup },
  ].filter((g) => g.nums.length > 0);

  const lieu = data.hippodrome
    ? data.hippodrome + (data.course ? ` · ${data.course}` : "")
    : data.course || null;

  return (
    <section className="py-14 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="relative rounded-2xl border border-gold-primary/30 bg-gradient-to-br from-bg-card via-bg-card to-bg-elevated/40 overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold-primary to-transparent" />
          <div className="p-6 sm:p-9">

            {/* En-tête */}
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gold-faint border border-gold-primary/30 flex items-center justify-center">
                <Radar className="w-6 h-6 text-gold-primary" />
              </div>
              <div>
                <span className="inline-flex items-center gap-2 text-gold-primary text-xs font-semibold uppercase tracking-widest">
                  <span className="w-1.5 h-1.5 rounded-full bg-status-win animate-pulse" />
                  Gratuit · le consensus de la presse
                </span>
                <h2 className="font-serif text-2xl sm:text-3xl font-bold text-text-primary mt-1.5">
                  Le Radar de <span className="text-gold-light">la presse</span>
                </h2>
              </div>
            </div>

            <p className="text-text-secondary text-sm sm:text-base leading-relaxed mt-4 max-w-2xl">
              Sur la course vedette du jour, Elite Turf agrège ce que dit la presse hippique — une lecture
              claire des chevaux qui reviennent le plus, pour structurer vos paris.
            </p>

            {/* Contexte */}
            <div className="flex flex-wrap gap-2 mt-5">
              <span className="text-xs px-3 py-1.5 rounded-full border bg-gold-faint border-gold-primary/35 text-gold-light font-medium">
                {data.typePariLabel} du jour
              </span>
              {lieu && (
                <span className="text-xs px-3 py-1.5 rounded-full border bg-bg-elevated border-border text-text-secondary">
                  {lieu}
                </span>
              )}
              {data.nbPartants ? (
                <span className="text-xs px-3 py-1.5 rounded-full border bg-bg-elevated border-border text-text-secondary">
                  {data.nbPartants} partants
                </span>
              ) : null}
              <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border bg-gold-faint border-gold-primary/35 text-gold-light font-medium">
                <Radar className="w-3.5 h-3.5" /> {data.nbSources} sources presse
              </span>
            </div>

            {/* Blocs Base / Value / Coup */}
            <div className="grid sm:grid-cols-3 gap-3 mt-6">
              {groups.map(({ def, nums }) => (
                <div
                  key={def.key}
                  className={`rounded-xl border-x border-b border-border border-t-[3px] ${def.top} bg-bg-elevated p-4`}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className={`font-serif text-lg font-bold ${def.num}`}>{def.name}</span>
                    <span className="text-[10px] uppercase tracking-wider text-text-muted">{def.tag}</span>
                  </div>
                  <p className="text-text-secondary text-xs leading-relaxed mt-1.5 min-h-[38px]">{def.desc}</p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {nums.map((n) => (
                      <span
                        key={n}
                        className={`w-10 h-10 rounded-full border-2 ${def.ring} ${def.bg} ${def.num} flex items-center justify-center font-bold text-base tabular-nums`}
                      >
                        {n}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Preuve de sérieux : le favori presse */}
            {data.favori && (
              <div className="flex flex-wrap items-center gap-2 mt-5 px-4 py-3 rounded-xl bg-gold-faint border border-gold-primary/25 text-sm text-gold-light">
                <Star className="w-4 h-4 text-gold-primary flex-shrink-0" fill="currentColor" />
                <span>Favori de la presse :</span>
                <span className="inline-grid place-items-center w-6 h-6 rounded-full bg-gold-primary text-bg-primary font-bold text-xs tabular-nums">
                  {data.favori.numero}
                </span>
                <span>
                  cité par{" "}
                  <b className="text-text-primary font-semibold">
                    {data.favori.citations} source{data.favori.citations > 1 ? "s" : ""} sur {data.nbSources}
                  </b>
                  {data.favori.tauxPct ? ` (${data.favori.tauxPct} %)` : ""}
                </span>
              </div>
            )}

            {/* Disclaimer honnête : presse ≠ notre pronostic */}
            <div className="mt-5 flex gap-3 px-4 py-3.5 rounded-xl bg-bg-primary/40 border border-border border-l-[3px] border-l-gold-primary">
              <Info className="w-4 h-4 text-gold-primary flex-shrink-0 mt-0.5" />
              <p className="text-text-secondary text-xs sm:text-sm leading-relaxed">
                Ce Radar reflète le <b className="text-text-primary font-semibold">consensus de la presse</b>{" "}
                ({data.nbSources} sources agrégées) — ce{" "}
                <span className="text-gold-light font-semibold">n&apos;est pas</span> le pronostic d&apos;Elite Turf.
                Nos 3 experts vont plus loin : hiérarchie fine, plan de jeu, chevaux à écarter et niveau de
                confiance — <b className="text-text-primary font-semibold">réservés aux abonnés</b>.
              </p>
            </div>

            {/* CTA conversion */}
            <div className="flex flex-wrap items-center gap-4 mt-6">
              <Link
                href="/pronostics"
                className="inline-flex items-center gap-2 px-6 py-3.5 bg-gold-primary hover:bg-gold-dark text-bg-primary font-bold text-sm rounded-xl transition-all shadow-gold"
              >
                Découvrir les pronostics Elite
                <ArrowRight className="w-4 h-4" />
              </Link>
              <span className="text-text-muted text-xs max-w-[17rem] leading-relaxed">
                <b className="text-text-secondary font-semibold">3 pronostics experts</b> chaque jour ·
                1<sup>er</sup> pronostic perdant = 7 jours offerts.
              </span>
            </div>

          </div>
        </div>
      </div>
    </section>
  );
}
