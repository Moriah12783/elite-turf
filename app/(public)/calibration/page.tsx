/**
 * /calibration — Tableau de bord de calibration du moteur (Axe 1 du Plan Value Radar).
 *
 * Probabilité annoncée contre réalité, par tranche de cote, sur la dernière
 * semaine scellée et depuis le début du journal. Données : calibration_hebdo
 * (write-once, copiée chaque lundi depuis le projet Radar). SSR + prop,
 * aucun fetch client ; en base vide, état « en cours de constitution ».
 *
 * Langage : justesse des probabilités face aux cotes du matin, JAMAIS un
 * rendement de mise (cohérence éditoriale / processeurs de paiement).
 */

import { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, ShieldCheck, Scale, Info } from "lucide-react";
import PageHero from "@/components/layout/PageHero";
import { getCalibration } from "@/lib/calibration/get-calibration";
import { libelleSemaine, DEBUT_JOURNAL } from "@/lib/calibration/semaine";
import type { LigneCalibrationHebdo } from "@/lib/calibration/sync-calibration";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://www.elite-turf.fr");

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Calibration du moteur — probabilité annoncée contre réalité | Elite Turf",
  description:
    "Chaque semaine, la justesse des probabilités de notre moteur face aux cotes du matin, par tranche de cote, sur la semaine écoulée et depuis le début du journal scellé. Les bonnes semaines comme les mauvaises.",
  alternates: { canonical: `${APP_URL}/calibration` },
  openGraph: {
    title: "Calibration du moteur — Elite Turf",
    description: "Probabilité annoncée contre réalité, par tranche de cote, semaine après semaine. Méthode pré-enregistrée, journal scellé.",
    url: `${APP_URL}/calibration`,
    type: "article",
  },
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Accueil", item: APP_URL },
    { "@type": "ListItem", position: 2, name: "Calibration du moteur", item: `${APP_URL}/calibration` },
  ],
};

const fmtPct = (v: number) => v.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fmtSigne = (v: number, decimales: number) =>
  `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toLocaleString("fr-FR", { minimumFractionDigits: decimales, maximumFractionDigits: decimales })}`;
const fmtN = (v: number) => v.toLocaleString("fr-FR");

function TableauCalibration({ titre, sousTitre, lignes }: { titre: string; sousTitre: string; lignes: LigneCalibrationHebdo[] }) {
  const total = lignes.reduce((s, l) => s + l.n, 0);
  return (
    <section className="mb-12">
      <h2 className="font-serif text-2xl font-bold text-text-primary mb-1">{titre}</h2>
      <p className="text-sm text-text-muted mb-4">{sousTitre} · {fmtN(total)} partants jugés</p>
      <div className="overflow-x-auto rounded-xl border border-border bg-bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-text-muted border-b border-border">
              <th className="px-4 py-3">Tranche de cote (matin)</th>
              <th className="px-4 py-3 text-right">Partants jugés</th>
              <th className="px-4 py-3 text-right">Annoncé par le moteur</th>
              <th className="px-4 py-3 text-right">Réel (victoires)</th>
              <th className="px-4 py-3 text-right">Impliqué par le marché</th>
              <th className="px-4 py-3 text-right">Écart moteur − réel</th>
              <th className="px-4 py-3 text-right">Gain de calibration vs marché</th>
            </tr>
          </thead>
          <tbody>
            {lignes.map((l) => {
              const ecart = l.annonce_pct - l.reel_pct;
              const positif = l.gain_brier > 0;
              return (
                <tr key={l.tranche} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-3 font-semibold text-text-primary">{l.tranche}</td>
                  <td className="px-4 py-3 text-right text-text-secondary tabular-nums">{fmtN(l.n)}</td>
                  <td className="px-4 py-3 text-right text-gold-light tabular-nums">{fmtPct(l.annonce_pct)} %</td>
                  <td className="px-4 py-3 text-right text-text-primary font-semibold tabular-nums">{fmtPct(l.reel_pct)} %</td>
                  <td className="px-4 py-3 text-right text-text-secondary tabular-nums">{fmtPct(l.marche_pct)} %</td>
                  <td className="px-4 py-3 text-right text-text-secondary tabular-nums">{fmtSigne(ecart, 1)} pt</td>
                  <td className={`px-4 py-3 text-right tabular-nums font-semibold ${positif ? "text-status-win" : "text-red-400"}`}>
                    {fmtSigne(l.gain_brier, 6)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default async function CalibrationPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const demande = typeof searchParams?.semaine === "string" ? searchParams.semaine : undefined;
  const data = await getCalibration(demande);

  return (
    <div className="min-h-screen bg-bg-primary">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      <PageHero
        image="/images/heroes/hero-performances.jpg"
        titre="Calibration du moteur"
        sousTitre="Probabilité annoncée contre réalité · par tranche de cote · semaine après semaine"
      />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <nav className="mb-8 flex items-center gap-2 text-xs text-text-muted">
          <Link href="/" className="hover:text-gold-primary">Accueil</Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-text-secondary">Calibration du moteur</span>
        </nav>

        <div className="mb-8">
          <h2 className="font-serif text-3xl sm:text-4xl font-bold text-text-primary mb-4 leading-tight">
            Ce que nous annonçons, ce qui s&apos;est passé
          </h2>
          <p className="text-text-secondary text-base sm:text-lg leading-relaxed">
            Chaque matin à 7h35, notre moteur scelle une probabilité de victoire pour chaque partant des
            courses françaises, dans un journal où rien ne peut être modifié ni effacé. Chaque lundi, nous
            comparons ces probabilités à ce qui s&apos;est réellement passé, tranche de cote par tranche de cote,
            et nous publions le résultat tel quel. Méthode et seuils ont été gelés avant les données :
            lisez{" "}
            <Link href="/blog/test-pre-enregistre-moteur-probabilites-resultat" className="text-gold-primary underline hover:text-gold-light">
              le récit du test pré-enregistré
            </Link>.
          </p>
        </div>

        <div className="mb-10 rounded-xl border border-gold-primary/30 bg-gold-faint p-5 flex gap-3">
          <ShieldCheck className="w-6 h-6 text-gold-primary shrink-0 mt-0.5" />
          <p className="text-sm text-text-secondary leading-relaxed">
            <strong className="text-gold-light">Ceci mesure la justesse de nos probabilités face aux cotes du matin, pas un rendement de mise.</strong>{" "}
            Le pari mutuel paie aux cotes finales, et l&apos;argent qui arrive dans les dernières minutes est en moyenne bien informé.
            Un gain de calibration réel ne se transforme pas mécaniquement en gain d&apos;argent. Les courses restent un jeu de hasard.
          </p>
        </div>

        {!data ? (
          <div className="rounded-xl border border-border bg-bg-card p-8 text-center mb-12">
            <Info className="w-8 h-8 text-text-muted mx-auto mb-3" />
            <h3 className="font-serif text-xl font-bold text-text-primary mb-2">Tableau en cours de constitution</h3>
            <p className="text-text-secondary text-sm leading-relaxed max-w-xl mx-auto">
              La première semaine complète sera scellée le lundi suivant sa clôture, à 9h40 UTC. Rien n&apos;est affiché tant
              qu&apos;aucune semaine n&apos;est jugée : nous ne publions pas d&apos;estimation.
            </p>
          </div>
        ) : (
          <>
            <div className="mb-6 flex flex-wrap items-center gap-2 text-sm">
              <span className="text-text-muted">Semaine affichée :</span>
              <span className="font-semibold text-text-primary">{libelleSemaine(data.semaine)}</span>
              {data.calculeLe && (
                <span className="text-xs text-text-muted">
                  · scellée le {new Date(data.calculeLe).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}
                </span>
              )}
            </div>

            <TableauCalibration
              titre="La semaine écoulée"
              sousTitre={`Courses ${libelleSemaine(data.semaine)}, édition du matin, modèle v4-labels`}
              lignes={data.semaine_lignes}
            />
            <TableauCalibration
              titre="Depuis le début du journal"
              sousTitre={`Cumul du ${new Date(`${DEBUT_JOURNAL}T00:00:00Z`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })} à la fin de la semaine affichée`}
              lignes={data.cumul_lignes}
            />

            {data.semainesDisponibles.length > 1 && (
              <div className="mb-12">
                <h3 className="text-sm uppercase tracking-wide text-text-muted mb-3">Semaines publiées</h3>
                <div className="flex flex-wrap gap-2">
                  {data.semainesDisponibles.map((s) => (
                    <Link
                      key={s}
                      href={`/calibration?semaine=${s}`}
                      className={`px-3 py-1.5 rounded-full border text-xs transition-colors ${
                        s === data.semaine
                          ? "border-gold-primary text-gold-light bg-gold-faint"
                          : "border-border text-text-secondary hover:border-gold-primary/50"
                      }`}
                    >
                      {libelleSemaine(s)}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        <section className="mb-12">
          <h2 className="font-serif text-2xl font-bold text-text-primary mb-4 flex items-center gap-2">
            <Scale className="w-5 h-5 text-gold-primary" /> Comment lire ce tableau
          </h2>
          <ul className="space-y-3 text-sm text-text-secondary leading-relaxed">
            <li><strong className="text-gold-light">Tranche de cote</strong> : la cote de référence PMU du matin, au moment du scellé. Un cheval à 2-3 est un favori, un 20+ un outsider.</li>
            <li><strong className="text-gold-light">Annoncé par le moteur</strong> : la moyenne des probabilités de victoire scellées à 7h35 pour les partants de la tranche.</li>
            <li><strong className="text-gold-light">Réel</strong> : la part de ces partants qui ont effectivement gagné. Un moteur bien calibré annonce 12 % quand 12 % gagnent.</li>
            <li><strong className="text-gold-light">Impliqué par le marché</strong> : la probabilité que les cotes du matin sous-entendent, une fois la marge du mutuel retirée.</li>
            <li><strong className="text-gold-light">Gain de calibration</strong> : la différence de score de Brier entre le marché et le moteur. Positif, nos probabilités étaient plus proches de la réalité que les cotes ; négatif, elles l&apos;étaient moins. Une semaine ne prouve rien à elle seule : c&apos;est le cumul, et le test pré-enregistré, qui comptent.</li>
            <li><strong className="text-gold-light">Ce qui n&apos;est pas dedans</strong> : les réunions du soir (scellées séparément depuis le 7 septembre 2026, évaluées à part) et tout ce qui ressemble à un rendement de mise.</li>
          </ul>
          <p className="text-sm text-text-muted mt-4">
            Une tranche n&apos;apparaît que si elle compte au moins 30 partants jugés. Une semaine publiée n&apos;est jamais recalculée.
            Méthode complète sur la page{" "}
            <Link href="/methodologie" className="text-gold-primary underline hover:text-gold-light">méthodologie</Link>.
          </p>
        </section>
      </div>
    </div>
  );
}
