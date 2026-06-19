"use client";

/**
 * Elite Turf — Calendrier des Grands Rendez-vous 2026
 * Composant client autonome (Next.js 15 + Tailwind).
 * Couleurs en valeurs arbitraires Tailwind pour rester drop-in quelle que soit
 * la config tailwind.config.js. Adapter si tu as déjà des tokens `navy`/`gold`.
 */

import { useMemo, useState } from "react";
import {
  GRANDS_RENDEZ_VOUS_2026,
  DISCIPLINE_LABEL,
  PRESTIGE_DIAMONDS,
  formatDateFr,
  groupByMonth,
  getNextEvent,
  type Discipline,
  type GrandRendezVous,
} from "@/data/grands-rendez-vous-2026";

const NAVY = "#1B3A5F";
const NAVY_DEEP = "#0F2942";
const NAVY_CARD = "#22426B";
const GOLD = "#C9A84C";
const GOLD_SOFT = "#E2C878";

type Filtre = "tous" | Discipline;

const FILTRES: { value: Filtre; label: string }[] = [
  { value: "tous", label: "Tous" },
  { value: "trot", label: "Trot" },
  { value: "galop", label: "Galop" },
  { value: "obstacle", label: "Obstacle" },
];

/** Losanges ◆ — reprend la signature « confiance » du site. */
function Diamonds({ count }: { count: number }) {
  return (
    <span aria-hidden className="tracking-[0.15em] text-[13px]">
      {Array.from({ length: 3 }).map((_, i) => (
        <span key={i} style={{ color: i < count ? GOLD : "rgba(226,200,120,0.22)" }}>
          ◆
        </span>
      ))}
    </span>
  );
}

function DateBadge({ evt }: { evt: GrandRendezVous }) {
  const [, m, d] = evt.date.split("-");
  const moisCourt = ["JAN", "FÉV", "MAR", "AVR", "MAI", "JUIN", "JUIL", "AOÛ", "SEP", "OCT", "NOV", "DÉC"][Number(m) - 1];
  return (
    <div
      className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-lg border"
      style={{ borderColor: "rgba(201,168,76,0.35)", background: "rgba(201,168,76,0.06)" }}
    >
      <span className="font-serif text-2xl font-bold leading-none" style={{ color: GOLD_SOFT }}>
        {evt.dateEnd ? `${Number(d)}` : Number(d)}
      </span>
      <span className="mt-0.5 text-[10px] font-semibold tracking-[0.2em]" style={{ color: "rgba(245,241,230,0.65)" }}>
        {moisCourt}
      </span>
    </div>
  );
}

function EventRow({ evt, isNext }: { evt: GrandRendezVous; isNext: boolean }) {
  return (
    <article
      className="group flex items-start gap-4 rounded-xl border p-4 transition-all duration-300 hover:-translate-y-0.5"
      style={{
        borderColor: isNext ? GOLD : "rgba(255,255,255,0.07)",
        background: isNext ? "rgba(201,168,76,0.07)" : NAVY_CARD,
        boxShadow: isNext ? `0 0 0 1px ${GOLD}` : "none",
      }}
    >
      <DateBadge evt={evt} />

      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span
            className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider"
            style={{ background: "rgba(255,255,255,0.08)", color: GOLD_SOFT }}
          >
            {DISCIPLINE_LABEL[evt.discipline]}
          </span>
          {isNext && (
            <span
              className="rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider"
              style={{ background: GOLD, color: NAVY_DEEP }}
            >
              Prochain rendez-vous
            </span>
          )}
          <Diamonds count={PRESTIGE_DIAMONDS[evt.prestige]} />
        </div>

        <h3 className="font-serif text-lg font-semibold leading-snug text-white">
          {evt.courses[0]}
        </h3>
        {evt.courses.length > 1 && (
          <ul className="mt-1 space-y-0.5">
            {evt.courses.slice(1).map((c) => (
              <li key={c} className="text-sm" style={{ color: "rgba(245,241,230,0.6)" }}>
                + {c}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-x-2 text-sm" style={{ color: "rgba(245,241,230,0.7)" }}>
          <span>{formatDateFr(evt)}</span>
          <span style={{ color: "rgba(201,168,76,0.5)" }}>·</span>
          <span>📍 {evt.hippodrome}</span>
        </div>
      </div>

      <a
        href={`/calendrier/${evt.slug}`}
        className="hidden shrink-0 self-center rounded-lg px-4 py-2 text-sm font-semibold transition-colors sm:block"
        style={{ border: `1px solid ${GOLD}`, color: GOLD_SOFT }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = GOLD;
          e.currentTarget.style.color = NAVY_DEEP;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.color = GOLD_SOFT;
        }}
      >
        Voir l'épreuve
      </a>
    </article>
  );
}

export default function CalendrierGrandsRendezVous() {
  const [filtre, setFiltre] = useState<Filtre>("tous");
  const next = useMemo(() => getNextEvent(), []);

  const groupes = useMemo(() => {
    const list =
      filtre === "tous"
        ? GRANDS_RENDEZ_VOUS_2026
        : GRANDS_RENDEZ_VOUS_2026.filter((e) => e.discipline === filtre);
    return groupByMonth(list);
  }, [filtre]);

  return (
    <section
      className="px-4 py-16 sm:px-6 lg:px-8"
      style={{ background: NAVY }}
      aria-labelledby="calendrier-titre"
    >
      <div className="mx-auto max-w-5xl">
        {/* En-tête */}
        <header className="mb-10 text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em]" style={{ color: GOLD }}>
            Saison hippique 2026
          </p>
          <h2 id="calendrier-titre" className="font-serif text-3xl font-bold text-white sm:text-4xl">
            Calendrier des Grands Rendez-vous
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed sm:text-base" style={{ color: "rgba(245,241,230,0.7)" }}>
            Les épreuves majeures du Trot et du Galop, du Prix d'Amérique à l'Arc de Triomphe.
            Chaque rendez-vous est analysé par nos experts à l'approche de la course.
          </p>
          <div className="mx-auto mt-5 h-px w-24" style={{ background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)` }} />
        </header>

        {/* Filtres disciplines */}
        <div className="mb-10 flex flex-wrap justify-center gap-2" role="tablist" aria-label="Filtrer par discipline">
          {FILTRES.map((f) => {
            const actif = filtre === f.value;
            return (
              <button
                key={f.value}
                role="tab"
                aria-selected={actif}
                onClick={() => setFiltre(f.value)}
                className="rounded-full px-5 py-2 text-sm font-semibold transition-all focus:outline-none focus-visible:ring-2"
                style={{
                  background: actif ? GOLD : "transparent",
                  color: actif ? NAVY_DEEP : "rgba(245,241,230,0.75)",
                  border: `1px solid ${actif ? GOLD : "rgba(255,255,255,0.14)"}`,
                }}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        {/* Liste groupée par mois */}
        <div className="space-y-10">
          {groupes.map((g) => (
            <div key={g.month}>
              <div className="mb-4 flex items-center gap-3">
                <h3 className="font-serif text-xl font-semibold capitalize" style={{ color: GOLD_SOFT }}>
                  {g.label}
                </h3>
                <div className="h-px flex-1" style={{ background: "rgba(255,255,255,0.08)" }} />
                <span className="text-xs" style={{ color: "rgba(245,241,230,0.4)" }}>
                  {g.events.length} {g.events.length > 1 ? "rendez-vous" : "rendez-vous"}
                </span>
              </div>
              <div className="grid gap-3">
                {g.events.map((evt) => (
                  <EventRow key={evt.id} evt={evt} isNext={next?.id === evt.id} />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Pied de section */}
        <footer className="mt-14 rounded-2xl border p-6 text-center sm:p-8" style={{ borderColor: "rgba(201,168,76,0.25)", background: NAVY_DEEP }}>
          <p className="font-serif text-lg font-semibold text-white sm:text-xl">
            Ne manquez aucune analyse des grandes épreuves
          </p>
          <p className="mx-auto mt-2 max-w-xl text-sm" style={{ color: "rgba(245,241,230,0.65)" }}>
            Nos pronostics sont publiés chaque matin entre 8h30 et 9h30 — alertes WhatsApp pour les abonnés.
          </p>
          <a
            href="/abonnements"
            className="mt-5 inline-block rounded-lg px-6 py-3 text-sm font-bold transition-transform hover:scale-[1.02]"
            style={{ background: GOLD, color: NAVY_DEEP }}
          >
            Découvrir les abonnements →
          </a>
        </footer>
      </div>
    </section>
  );
}
