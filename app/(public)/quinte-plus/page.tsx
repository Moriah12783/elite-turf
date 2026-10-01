/**
 * /quinte-plus — page pilier « Pronostic Quinté+ du jour » (brief SEO du
 * 01/10/2026, B2).
 *
 * Avant : 404 — seules les pages datées existaient, alors que `/quinte-plus`
 * est l'une des deux sections qui apportent le plus de trafic après l'accueil,
 * et que `/llms.txt` pointait déjà ici. Les concurrents qui se classent ont
 * tous une URL fixe (turf-fr.com/pronostics-quinte, turf-pepite.com/quinte/…) :
 * elle accumule l'autorité, ce que des pages datées ne font pas.
 *
 * Contenu : le Quinté+ du jour (vue partagée avec /quinte-plus/[date]), puis
 * l'arrivée de la veille, le lien vers demain et les 30 derniers Quinté+.
 * Rendu dynamique (la vue appelle noStore() pour aujourd'hui) : données
 * toujours fraîches, au-delà du « toutes les 10 minutes » demandé.
 */
import { Metadata } from "next";
import { unstable_noStore as noStore } from "next/cache";
import Link from "next/link";
import { ChevronRight, Trophy, CalendarClock, History } from "lucide-react";
import { formatDateShort, todayParis, heureGmtDepuisParis } from "@/lib/seo/dates";
import { chargerJourQuinte, chargerQuintesPeriode } from "./donnees";
import VueQuintePlus from "./VueQuintePlus";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://www.elite-turf.fr");

/** Date `YYYY-MM-DD` décalée de `jours` (calcul en UTC, sans dérive d'heure). */
function decaler(date: string, jours: number): string {
  return new Date(Date.parse(date + "T12:00:00Z") + jours * 86400000).toISOString().slice(0, 10);
}

function nomHippodrome(q: any): string {
  const h = Array.isArray(q?.hippodrome) ? q.hippodrome[0] : q?.hippodrome;
  return h?.nom ?? "";
}

export async function generateMetadata(): Promise<Metadata> {
  noStore();
  const date = todayParis();
  // Sans marque : le gabarit du root layout ajoute « | Elite Turf ».
  let titre = "Pronostic Quinté+ du jour gratuit";
  let description =
    "Pronostic Quinté+ du jour gratuit : partants, cotes, sélection Elite Turf, arrivée de la veille et historique des 30 derniers Quinté+.";
  try {
    const jour = await chargerJourQuinte(date);
    if (jour.quinte) {
      const hippo = nomHippodrome(jour.quinte);
      titre = `Pronostic Quinté+ du jour gratuit — ${jour.quinte.libelle}, ${hippo}`;
      const heure = (jour.quinte.heure_depart ?? "").slice(0, 5);
      const gmt = heureGmtDepuisParis(date, jour.quinte.heure_depart);
      description =
        `Pronostic Quinté+ du jour gratuit : ${jour.quinte.libelle} à ${hippo}` +
        (heure ? ` (${heure} Paris${gmt ? ` · ${gmt} GMT` : ""})` : "") +
        ". Partants, cotes, sélection Elite Turf, arrivée de la veille et les 30 derniers Quinté+.";
    }
  } catch {}
  return {
    title: titre,
    description: description.slice(0, 300),
    alternates: { canonical: `${APP_URL}/quinte-plus` },
    openGraph: {
      title: `${titre} | Elite Turf`,
      description,
      url: `${APP_URL}/quinte-plus`,
      type: "website",
    },
  };
}

export default async function QuintePlusPilier() {
  noStore();
  const aujourdhui = todayParis();
  return <VueQuintePlus date={aujourdhui} pilier complement={<ComplementPilier aujourdhui={aujourdhui} />} />;
}

/** Arrivée de la veille, Quinté+ de demain, 30 derniers Quinté+. */
async function ComplementPilier({ aujourdhui }: { aujourdhui: string }) {
  const hier = decaler(aujourdhui, -1);
  const demain = decaler(aujourdhui, 1);
  const [historique, jourDemain] = await Promise.all([
    chargerQuintesPeriode(decaler(aujourdhui, -30), hier),
    chargerJourQuinte(demain),
  ]);
  const quinteHier = historique.find((q) => q.date === hier) ?? null;
  const quinteDemain: any = jourDemain.quinte;

  return (
    <div className="mb-6">
      <div className="grid sm:grid-cols-2 gap-3 mb-6">
        {/* ── Arrivée du Quinté+ d'hier ─────────────────────────────── */}
        <Link
          href={`/quinte-plus/${hier}`}
          className="card-base p-4 hover:border-gold-primary/40 transition-all block"
        >
          <div className="flex items-center gap-2 text-gold-primary text-xs font-bold uppercase tracking-wider mb-2">
            <Trophy className="w-4 h-4" />
            Arrivée du Quinté+ d&apos;hier
          </div>
          {quinteHier ? (
            <>
              <div className="text-text-primary font-serif font-bold text-base">{quinteHier.libelle}</div>
              <div className="text-text-muted text-xs mb-2">{quinteHier.hippodrome} · {formatDateShort(hier)}</div>
              {quinteHier.arrivee ? (
                <div className="flex flex-wrap gap-1.5">
                  {quinteHier.arrivee.slice(0, 5).map((n, i) => (
                    <span
                      key={i}
                      className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${
                        i === 0 ? "bg-status-win/15 border border-status-win/40 text-status-win" : "bg-bg-elevated border border-border text-gold-light"
                      }`}
                    >
                      {n}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="text-text-muted text-xs">Arrivée officielle en attente.</div>
              )}
            </>
          ) : (
            <div className="text-text-muted text-sm">Voir le Quinté+ du {formatDateShort(hier)}</div>
          )}
        </Link>

        {/* ── Quinté+ de demain ─────────────────────────────────────── */}
        <Link
          href={`/quinte-plus/${demain}`}
          className="card-base p-4 hover:border-gold-primary/40 transition-all block"
        >
          <div className="flex items-center gap-2 text-gold-primary text-xs font-bold uppercase tracking-wider mb-2">
            <CalendarClock className="w-4 h-4" />
            Quinté+ de demain
          </div>
          {quinteDemain ? (
            <>
              <div className="text-text-primary font-serif font-bold text-base">{quinteDemain.libelle}</div>
              <div className="text-text-muted text-xs">
                {nomHippodrome(quinteDemain)} · {formatDateShort(demain)}
                {quinteDemain.heure_depart ? ` · ${String(quinteDemain.heure_depart).slice(0, 5)} Paris` : ""}
              </div>
            </>
          ) : (
            <div className="text-text-muted text-sm">
              Le Quinté+ du {formatDateShort(demain)} est publié la veille par le PMU.
            </div>
          )}
        </Link>
      </div>

      {/* ── Les 30 derniers Quinté+ ─────────────────────────────────── */}
      {historique.length > 0 && (
        <section className="card-base p-5">
          <div className="flex items-center gap-2 mb-3">
            <History className="w-5 h-5 text-gold-primary" />
            <h2 className="font-serif font-bold text-text-primary text-base">
              Les {historique.length} derniers Quinté+
            </h2>
          </div>
          <ul className="divide-y divide-border/50">
            {historique.map((q) => (
              <li key={q.date}>
                <Link
                  href={`/quinte-plus/${q.date}`}
                  className="flex items-center gap-3 py-2.5 hover:text-gold-light transition-colors"
                >
                  <span className="text-text-muted text-xs w-20 flex-shrink-0">{formatDateShort(q.date)}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-text-primary text-sm font-medium truncate">{q.libelle}</span>
                    <span className="block text-text-muted text-xs">{q.hippodrome}</span>
                  </span>
                  {q.arrivee && (
                    <span className="hidden sm:inline text-gold-light font-mono text-xs whitespace-nowrap">
                      {q.arrivee.slice(0, 5).join(" - ")}
                    </span>
                  )}
                  <ChevronRight className="w-4 h-4 text-text-muted flex-shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
