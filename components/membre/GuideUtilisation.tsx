import { BookOpen, Star, ChevronDown, Target } from "lucide-react";

/**
 * Guide « Exploiter vos pronostics » — espace membre.
 *
 * Explique à l'abonné comment lire la sélection Elite (base / value / coup /
 * champ + pivot) et comment en tirer des tickets en champ réduit ou total.
 *
 * 🔴 RÈGLE : les classes de couleur ci-dessous sont COPIÉES à l'identique de
 * `components/pronostics/PlanRadarBlock.tsx` (TIERS). Le guide doit montrer
 * exactement ce que l'abonné voit sur son pronostic — un guide qui décrit
 * d'autres couleurs que l'interface est pire que pas de guide. Si les couleurs
 * changent là-bas, les changer ICI aussi.
 *
 * Repliable via <details> natif : aucun JavaScript, donc utilisable dans un
 * composant serveur, et le contenu reste dans le HTML (lisible, imprimable,
 * accessible) même replié.
 *
 * Volontairement SANS chiffre de performance : la notice explique comment
 * jouer, elle ne promet pas de résultat. Les statistiques vérifiées vivent sur
 * /performances, où elles sont datées et opposables.
 */

/** Une catégorie de la sélection, avec la couleur EXACTE du pronostic. */
const CATEGORIES = [
  {
    cle: "base",
    titre: "La base",
    puce: "bg-emerald-500/10 text-emerald-300 border-emerald-500/40",
    texte: "text-emerald-400",
    role: "Nos chevaux les plus solides",
    detail:
      "Le socle de la course. C'est parmi eux que se trouve le pivot, le cheval sur lequel appuyer tous vos tickets.",
  },
  {
    cle: "value",
    titre: "La value",
    puce: "bg-blue-500/10 text-blue-300 border-blue-500/40",
    texte: "text-blue-400",
    role: "Nos secondes chances",
    detail:
      "Moins attendus que la base, ils sont là pour faire grimper les rapports quand ils entrent à l'arrivée.",
  },
  {
    cle: "coup",
    titre: "Le coup",
    puce: "bg-gold-faint text-gold-light border-gold-primary/50",
    texte: "text-gold-primary",
    role: "Notre tentative",
    detail:
      "L'outsider de la sélection. Il ne sort pas souvent, mais quand il sort, il transforme le rapport.",
  },
  {
    cle: "champ",
    titre: "Le champ",
    puce: "bg-bg-elevated text-text-secondary border-border",
    texte: "text-text-muted",
    role: "Les compléments",
    detail:
      "Les chevaux qui ferment la sélection. Utiles pour élargir un champ réduit sans faire exploser le budget.",
  },
];

/** Une formule de jeu : quels chevaux prendre en base, quoi associer. */
const FORMULES = [
  {
    pari: "Couplé",
    base: "Le pivot ⭐",
    associer: "Un cheval de la value, ou le coup",
    note: "La combinaison la plus simple : deux chevaux, un ancrage solide et une seconde chance.",
  },
  {
    pari: "Tiercé",
    base: "Le pivot ⭐ + un autre cheval de la base",
    associer: "Le reste de la sélection dans votre champ",
    note: "Deux chevaux verrouillés, le champ fait le reste.",
  },
  {
    pari: "Quarté",
    base: "Le pivot ⭐ + un cheval de la base + un cheval de la value",
    associer: "Le reste de nos numéros, dont le coup doré",
    note: "Trois chevaux d'appui : c'est l'équilibre entre couverture et budget.",
  },
];

export default function GuideUtilisation() {
  return (
    <details className="card-base overflow-hidden group">
      <summary className="flex items-center justify-between gap-3 p-5 cursor-pointer list-none hover:bg-bg-elevated/40 transition-colors">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-gold-faint border border-gold-primary/30 flex items-center justify-center flex-shrink-0">
            <BookOpen className="w-5 h-5 text-gold-primary" />
          </div>
          <div className="min-w-0">
            <h2 className="font-serif font-bold text-text-primary text-lg leading-tight">
              Exploiter vos pronostics
            </h2>
            <p className="text-text-secondary text-xs mt-0.5">
              Lire la sélection et construire vos tickets — guide en 2 minutes
            </p>
          </div>
        </div>
        <ChevronDown className="w-5 h-5 text-text-muted flex-shrink-0 transition-transform group-open:rotate-180" />
      </summary>

      <div className="px-5 pb-6 space-y-7 border-t border-border pt-5">
        {/* ── Intro ─────────────────────────────────────────────────── */}
        <p className="text-text-secondary text-sm leading-relaxed">
          Chaque jour, votre pronostic Elite vous propose une sélection resserrée
          de <strong className="text-text-primary">6 chevaux</strong>, répartis en
          catégories. Pour en tirer parti, la méthode que nous conseillons est de
          jouer en <strong className="text-gold-light">champ réduit</strong> ou en{" "}
          <strong className="text-gold-light">champ total</strong> : vous couvrez
          la course intelligemment tout en gardant la main sur votre budget.
        </p>

        {/* ── 1. Le code couleur ────────────────────────────────────── */}
        <section>
          <h3 className="font-serif font-bold text-text-primary text-base mb-1">
            1. Comprendre le code couleur
          </h3>
          <p className="text-text-muted text-xs mb-4">
            Ce sont exactement les couleurs affichées sur votre pronostic.
          </p>

          <div className="space-y-3">
            {CATEGORIES.map((c) => (
              <div
                key={c.cle}
                className="flex items-start gap-3 rounded-xl border border-border bg-bg-elevated/40 p-3.5"
              >
                <span
                  className={`inline-flex items-center justify-center w-9 h-9 rounded-lg border text-xs font-bold flex-shrink-0 ${c.puce}`}
                >
                  {c.cle === "coup" ? "1" : c.cle === "champ" ? "•••" : "N°"}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-bold leading-tight">
                    <span className={c.texte}>{c.titre}</span>
                    <span className="text-text-muted font-normal"> — {c.role}</span>
                  </p>
                  <p className="text-text-secondary text-xs mt-1 leading-relaxed">
                    {c.detail}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Le pivot — mis en avant, c'est la clé de toute la méthode */}
          <div className="mt-3 rounded-xl border border-gold-primary/40 bg-gold-faint p-3.5 flex items-start gap-3">
            <Star
              className="w-5 h-5 text-gold-primary flex-shrink-0 mt-0.5"
              fill="currentColor"
            />
            <div>
              <p className="text-sm font-bold text-gold-light leading-tight">
                Le pivot ⭐ — le cheval incontournable
              </p>
              <p className="text-text-secondary text-xs mt-1 leading-relaxed">
                Repérez l&apos;étoile dans la base : c&apos;est notre cheval de
                confiance du jour. Il sert de point d&apos;ancrage à tous vos
                tickets. Selon votre lecture de la course, vous restez libre de le
                placer 1<sup>er</sup>, 2<sup>e</sup> ou 3<sup>e</sup>.
              </p>
            </div>
          </div>
        </section>

        {/* ── 2. Composer ses jeux ──────────────────────────────────── */}
        <section>
          <h3 className="font-serif font-bold text-text-primary text-base mb-1">
            2. Composer vos jeux
          </h3>
          <p className="text-text-muted text-xs mb-4">
            Toujours partir du pivot, puis élargir selon le pari visé.
          </p>

          <div className="space-y-3">
            {FORMULES.map((f) => (
              <div
                key={f.pari}
                className="rounded-xl border border-border bg-bg-elevated/40 p-4"
              >
                <p className="flex items-center gap-2 text-sm font-bold text-gold-light">
                  <Target className="w-4 h-4 flex-shrink-0" />
                  {f.pari}
                </p>
                <dl className="mt-2.5 space-y-1.5 text-xs">
                  <div className="flex gap-2">
                    <dt className="text-text-muted w-20 flex-shrink-0">Votre base</dt>
                    <dd className="text-text-primary font-medium">{f.base}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="text-text-muted w-20 flex-shrink-0">À associer</dt>
                    <dd className="text-text-secondary">{f.associer}</dd>
                  </div>
                </dl>
                <p className="text-text-muted text-xs mt-2.5 italic leading-relaxed">
                  {f.note}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ── En résumé ─────────────────────────────────────────────── */}
        <section className="rounded-xl border border-gold-primary/25 bg-gradient-to-br from-gold-faint/50 to-transparent p-4">
          <h3 className="font-serif font-bold text-text-primary text-sm mb-2">
            En résumé
          </h3>
          <p className="text-text-secondary text-sm leading-relaxed">
            Appuyez-vous sur la <span className="text-emerald-400 font-semibold">solidité
            de la base</span>, complétez avec la{" "}
            <span className="text-blue-400 font-semibold">pertinence de la value</span> et
            tentez <span className="text-gold-primary font-semibold">le coup</span> pour
            le rapport. Le pivot ⭐ reste votre point fixe.
          </p>
          <p className="text-text-muted text-xs mt-3 leading-relaxed">
            Le turf comporte une part d&apos;aléa que personne ne supprime. Jouez
            des montants que vous pouvez perdre, et retrouvez nos résultats réels,
            course par course, sur la page{" "}
            <a href="/performances" className="text-gold-primary underline hover:text-gold-light">
              Performances
            </a>
            .
          </p>
        </section>
      </div>
    </details>
  );
}
