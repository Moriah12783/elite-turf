import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";

import {
  GRANDS_RENDEZ_VOUS_2026,
  DISCIPLINE_LABEL,
  PRESTIGE_DIAMONDS,
  formatDateFr,
  generateEventJsonLd,
} from "@/data/grands-rendez-vous-2026";
import {
  getEventBySlug,
  getRelatedEvents,
  getStatus,
  cleanName,
  buildIntro,
  buildMetaDescription,
  buildFaq,
  breadcrumbJsonLd,
  faqJsonLd,
  PALMARES,
} from "@/lib/courses-seo";

/* Brand tokens (valeurs arbitraires — remplacer par tes tokens si tu en as). */
const NAVY = "#1B3A5F";
const NAVY_DEEP = "#0F2942";
const NAVY_CARD = "#22426B";
const GOLD = "#C9A84C";
const GOLD_SOFT = "#E2C878";
const CREAM = "#F5F1E6";

/* SSG : génère les 38 pages au build, et 404 pour tout slug inconnu. */
export const dynamicParams = false;

export function generateStaticParams() {
  return GRANDS_RENDEZ_VOUS_2026.map((e) => ({ slug: e.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const { slug } = await params;
  const evt = getEventBySlug(slug);
  if (!evt) return {};

  const nom = cleanName(evt);
  const title = `${nom} 2026 — Date, Hippodrome & Pronostic | Elite Turf`;
  const description = buildMetaDescription(evt);
  const url = `https://www.elite-turf.fr/calendrier/${evt.slug}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: "article",
      siteName: "Elite Turf",
      locale: "fr_FR",
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

function Diamonds({ count }: { count: number }) {
  return (
    <span aria-hidden style={{ letterSpacing: "0.15em" }}>
      {Array.from({ length: 3 }).map((_, i) => (
        <span key={i} style={{ color: i < count ? GOLD : "rgba(226,200,120,0.22)" }}>
          ◆
        </span>
      ))}
    </span>
  );
}

function StatusBadge({
  status,
  daysUntil,
}: {
  status: "a-venir" | "aujourd-hui" | "passe";
  daysUntil: number;
}) {
  const map = {
    "a-venir": {
      label: daysUntil === 1 ? "Demain" : `Dans ${daysUntil} jours`,
      bg: GOLD,
      fg: NAVY_DEEP,
    },
    "aujourd-hui": { label: "Aujourd'hui", bg: "#2E7D52", fg: "#fff" },
    passe: { label: "Édition disputée", bg: "rgba(255,255,255,0.12)", fg: CREAM },
  } as const;
  const s = map[status];
  return (
    <span
      className="rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider"
      style={{ background: s.bg, color: s.fg }}
    >
      {s.label}
    </span>
  );
}

export default async function Page({
  params,
}: {
  params: { slug: string };
}) {
  const { slug } = await params;
  const evt = getEventBySlug(slug);
  if (!evt) notFound();

  const nom = cleanName(evt);
  const intro = buildIntro(evt);
  const faq = buildFaq(evt);
  const related = getRelatedEvents(evt, 3);
  const { status, daysUntil } = getStatus(evt);
  const palmares = PALMARES[evt.id];

  const jsonLd = [
    generateEventJsonLd(evt),
    breadcrumbJsonLd(evt),
    faqJsonLd(faq),
  ];

  return (
    <main style={{ background: NAVY, color: CREAM }}>
      {/* JSON-LD : Event + BreadcrumbList + FAQPage */}
      {jsonLd.map((block, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(block) }}
        />
      ))}

      <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
        {/* Fil d'Ariane */}
        <nav aria-label="Fil d'Ariane" className="mb-8 text-sm" style={{ color: "rgba(245,241,230,0.55)" }}>
          <Link href="/" className="hover:underline">Accueil</Link>
          <span className="mx-2" style={{ color: "rgba(201,168,76,0.5)" }}>/</span>
          <Link href="/calendrier" className="hover:underline">Calendrier 2026</Link>
          <span className="mx-2" style={{ color: "rgba(201,168,76,0.5)" }}>/</span>
          <span style={{ color: GOLD_SOFT }}>{nom}</span>
        </nav>

        {/* Hero */}
        <header className="mb-10">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <span
              className="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider"
              style={{ background: "rgba(255,255,255,0.08)", color: GOLD_SOFT }}
            >
              {DISCIPLINE_LABEL[evt.discipline]}
            </span>
            <StatusBadge status={status} daysUntil={daysUntil} />
            <Diamonds count={PRESTIGE_DIAMONDS[evt.prestige]} />
          </div>

          <h1 className="font-serif text-3xl font-bold leading-tight text-white sm:text-4xl">
            {nom} <span style={{ color: GOLD_SOFT }}>2026</span>
          </h1>

          <p className="mt-3 text-base" style={{ color: "rgba(245,241,230,0.75)" }}>
            {formatDateFr(evt)} · 📍 {evt.hippodrome}
          </p>

          {evt.courses.length > 1 && (
            <ul className="mt-4 space-y-1">
              {evt.courses.map((c) => (
                <li key={c} className="text-sm" style={{ color: "rgba(245,241,230,0.65)" }}>
                  — {c}
                </li>
              ))}
            </ul>
          )}
        </header>

        {/* Intro éditoriale */}
        <section className="mb-10">
          <p className="text-lg leading-relaxed" style={{ color: "rgba(245,241,230,0.88)" }}>
            {intro}
          </p>
        </section>

        {/* Infos pratiques */}
        <section
          className="mb-10 rounded-2xl border p-6"
          style={{ borderColor: "rgba(255,255,255,0.08)", background: NAVY_CARD }}
        >
          <h2 className="mb-4 font-serif text-xl font-semibold" style={{ color: GOLD_SOFT }}>
            Infos pratiques
          </h2>
          <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
            <Info label="Date" value={formatDateFr(evt)} />
            <Info label="Hippodrome" value={evt.hippodrome} />
            <Info label="Discipline" value={DISCIPLINE_LABEL[evt.discipline]} />
            {evt.cycle && <Info label="Cycle" value={cycleLabel(evt.cycle)} />}
          </dl>
        </section>

        {/* Palmarès (affiché uniquement si renseigné dans PALMARES) */}
        {palmares && palmares.length > 0 && (
          <section className="mb-10">
            <h2 className="mb-4 font-serif text-xl font-semibold" style={{ color: GOLD_SOFT }}>
              Palmarès des dernières éditions
            </h2>
            <div className="overflow-hidden rounded-xl border" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
              {palmares.map((p, i) => (
                <div
                  key={p.annee}
                  className="flex items-center justify-between px-4 py-3 text-sm"
                  style={{ background: i % 2 ? NAVY_CARD : NAVY_DEEP }}
                >
                  <span className="font-semibold" style={{ color: GOLD_SOFT }}>{p.annee}</span>
                  <span className="text-white">{p.vainqueur}</span>
                  <span style={{ color: "rgba(245,241,230,0.6)" }}>{p.driver ?? ""}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* CTA Analyse Elite Turf */}
        <section
          className="mb-12 rounded-2xl border p-7 text-center"
          style={{ borderColor: "rgba(201,168,76,0.3)", background: NAVY_DEEP }}
        >
          <h2 className="font-serif text-2xl font-bold text-white">
            L'analyse Elite Turf du {nom}
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm" style={{ color: "rgba(245,241,230,0.7)" }}>
            Sélection hiérarchisée, base et outsiders, conseil de mise — publiés à
            l'approche de la course. Alerte WhatsApp pour les abonnés.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Link
              href="/pronostics"
              className="rounded-lg px-6 py-3 text-sm font-bold"
              style={{ background: GOLD, color: NAVY_DEEP }}
            >
              Voir les pronostics du jour →
            </Link>
            <Link
              href="/abonnements"
              className="rounded-lg px-6 py-3 text-sm font-bold"
              style={{ border: `1px solid ${GOLD}`, color: GOLD_SOFT }}
            >
              Découvrir les abonnements
            </Link>
          </div>
        </section>

        {/* FAQ */}
        <section className="mb-12">
          <h2 className="mb-5 font-serif text-xl font-semibold" style={{ color: GOLD_SOFT }}>
            Questions fréquentes
          </h2>
          <div className="space-y-3">
            {faq.map((f) => (
              <details
                key={f.q}
                className="group rounded-xl border p-4"
                style={{ borderColor: "rgba(255,255,255,0.08)", background: NAVY_CARD }}
              >
                <summary
                  className="cursor-pointer list-none font-semibold text-white marker:hidden"
                  style={{ color: CREAM }}
                >
                  {f.q}
                </summary>
                <p className="mt-2 text-sm" style={{ color: "rgba(245,241,230,0.72)" }}>
                  {f.a}
                </p>
              </details>
            ))}
          </div>
        </section>

        {/* Maillage interne */}
        {related.length > 0 && (
          <section>
            <h2 className="mb-5 font-serif text-xl font-semibold" style={{ color: GOLD_SOFT }}>
              Autres grands rendez-vous
            </h2>
            <div className="grid gap-3 sm:grid-cols-3">
              {related.map((r) => (
                <Link
                  key={r.id}
                  href={`/calendrier/${r.slug}`}
                  className="rounded-xl border p-4 transition-transform hover:-translate-y-0.5"
                  style={{ borderColor: "rgba(255,255,255,0.08)", background: NAVY_CARD }}
                >
                  <p className="text-xs uppercase tracking-wider" style={{ color: GOLD_SOFT }}>
                    {formatDateFr(r)}
                  </p>
                  <p className="mt-1 font-serif font-semibold text-white">{cleanName(r)}</p>
                  <p className="mt-1 text-xs" style={{ color: "rgba(245,241,230,0.6)" }}>
                    📍 {r.hippodrome}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider" style={{ color: "rgba(245,241,230,0.5)" }}>
        {label}
      </dt>
      <dd className="mt-0.5 font-semibold text-white">{value}</dd>
    </div>
  );
}

function cycleLabel(cycle: NonNullable<Parameters<typeof getRelatedEvents>[0]["cycle"]>): string {
  const map: Record<string, string> = {
    amerique: "Amérique Races",
    cornulier: "Cornulier Races",
    criterium: "Critériums de Vincennes",
    gnt: "Grand National du Trot",
  };
  return map[cycle as string] ?? "";
}
