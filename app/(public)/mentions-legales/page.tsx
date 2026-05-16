import { Metadata } from "next";
import PageHero from "@/components/layout/PageHero";
import OperateursANJ from "@/components/home/OperateursANJ";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://www.elite-turf.fr");

export const metadata: Metadata = {
  title: "Mentions Légales — Elite Turf",
  description: "Mentions légales et informations éditeur du site Elite Turf — TSALACH VENTURES LLC, directeur de publication, hébergeur.",
  alternates: { canonical: `${APP_URL}/mentions-legales` },
  robots: { index: true, follow: true },
};

export default function MentionsLegalesPage() {
  return (
    <div className="min-h-screen bg-bg-primary">
      <PageHero
        image="/images/heroes/hero-legal.jpg"
        titre="Mentions Légales"
        sousTitre="Informations légales — Elite Turf, exploité par TSALACH VENTURES LLC"
      />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">

        <div className="mb-10">
          <h1 className="font-serif text-3xl font-bold text-text-primary mb-2">Mentions Légales</h1>
          <p className="text-text-muted text-sm">Dernière mise à jour : mai 2026</p>
        </div>

        <div className="space-y-8 text-text-secondary text-sm leading-relaxed">

          {/* ── 1. ÉDITEUR ── */}
          <section className="card-base p-6">
            <h2 className="font-serif font-bold text-text-primary text-lg mb-4">1. Éditeur du site</h2>
            <p>
              Le site <strong className="text-text-primary">elite-turf.fr</strong> est édité et exploité par :
            </p>
            <div className="mt-4 space-y-1.5">
              <p><strong className="text-text-primary">Raison sociale :</strong> TSALACH VENTURES LLC</p>
              <p><strong className="text-text-primary">Forme juridique :</strong> Limited Liability Company (LLC), constituée dans l&apos;État du Wyoming (États-Unis)</p>
              <p><strong className="text-text-primary">Siège social :</strong> 30 N Gould St, STE R, Sheridan, WY 82801, États-Unis</p>
              <p>
                <strong className="text-text-primary">Téléphone administratif :</strong>{" "}
                <a href="tel:+13073819522" className="text-gold-light hover:underline">
                  +1 307 381 9522
                </a>
              </p>
              <p>
                <strong className="text-text-primary">E-mail :</strong>{" "}
                <a href="mailto:contact@elite-turf.fr" className="text-gold-light hover:underline">
                  contact@elite-turf.fr
                </a>
              </p>
              <p>
                <strong className="text-text-primary">WhatsApp public (support clients) :</strong>{" "}
                <a href="https://wa.me/33644686720" target="_blank" rel="noopener noreferrer" className="text-gold-light hover:underline">
                  +33 6 44 68 67 20
                </a>
              </p>
              <p><strong className="text-text-primary">Directeur de la publication :</strong> Landry Stéphane Y.</p>
            </div>
          </section>

          {/* ── 2. MARQUE COMMERCIALE ── */}
          <section className="card-base p-6">
            <h2 className="font-serif font-bold text-text-primary text-lg mb-4">2. Marque commerciale</h2>
            <p>
              <strong className="text-text-primary">Elite Turf</strong> est une marque commerciale exploitée par
              TSALACH VENTURES LLC. Toutes les références à « Elite Turf » sur ce site désignent
              TSALACH VENTURES LLC agissant sous cette marque.
            </p>
            <p className="mt-3">
              L&apos;ensemble des contenus du site (textes, analyses, logos, algorithmes, graphiques, images)
              est la propriété exclusive de TSALACH VENTURES LLC. Toute reproduction, distribution ou
              utilisation sans accord écrit préalable est strictement interdite.
            </p>
          </section>

          {/* ── 3. HÉBERGEMENT ── */}
          <section className="card-base p-6">
            <h2 className="font-serif font-bold text-text-primary text-lg mb-4">3. Hébergement</h2>
            <p>
              Le site est hébergé par{" "}
              <strong className="text-text-primary">Cloudflare, Inc.</strong>,
              101 Townsend Street, San Francisco, CA 94107, États-Unis.
            </p>
            <p className="mt-2">
              Site :{" "}
              <a href="https://www.cloudflare.com" target="_blank" rel="noopener noreferrer" className="text-gold-light hover:underline">
                cloudflare.com
              </a>
            </p>
          </section>

          {/* ── 4. NATURE DU SERVICE ── */}
          <section className="card-base p-6">
            <h2 className="font-serif font-bold text-text-primary text-lg mb-4">4. Nature du service</h2>
            <p>
              Elite Turf est un site d&apos;analyse hippique et d&apos;information. Il fournit des contenus
              méthodologiques, des analyses de données et des pronostics{" "}
              <strong className="text-text-primary">à titre strictement informatif</strong>.
            </p>
            <p className="mt-3">
              Elite Turf <strong className="text-text-primary">ne collecte aucune mise</strong>, n&apos;organise
              aucun pari et ne garantit aucun gain. Les abonnements donnent accès à des contenus d&apos;analyse,
              non à des résultats garantis.
            </p>
          </section>

          {/* ── 5. ABSENCE D'AFFILIATION ── */}
          <section className="card-base p-6">
            <h2 className="font-serif font-bold text-text-primary text-lg mb-4">5. Absence d&apos;affiliation</h2>
            <p>
              Elite Turf n&apos;est ni affilié, ni partenaire, ni agréé par le{" "}
              <strong className="text-text-primary">PMU (Pari Mutuel Urbain)</strong>, la{" "}
              <strong className="text-text-primary">FFF</strong>, la{" "}
              <strong className="text-text-primary">France Galop</strong>, le{" "}
              <strong className="text-text-primary">Trot</strong> ou toute autre entité officielle
              de paris ou de courses hippiques.
            </p>
            <p className="mt-3">
              Les mentions « PMU », « Quinté+ », « Tiercé », « Quarté » sont des marques déposées de
              leurs propriétaires respectifs, utilisées ici à titre référentiel uniquement.
            </p>
          </section>

          {/* ── 6. JEU RESPONSABLE ── */}
          <section className="card-base p-6">
            <h2 className="font-serif font-bold text-text-primary text-lg mb-4">6. Jeu responsable</h2>
            <div className="p-4 bg-orange-500/5 border border-orange-500/30 rounded-xl">
              <p>
                L&apos;accès au site est réservé aux personnes{" "}
                <strong className="text-text-primary">majeures (18 ans et plus)</strong>.
                Jouer comporte des risques : endettement, isolement, dépendance.
              </p>
              <p className="mt-3">
                Pour être aidé, appelez le{" "}
                <strong className="text-text-primary">Joueurs Info Service : 09 74 75 13 13</strong>{" "}
                (appel non surtaxé, disponible 7j/7, 8h–2h).
              </p>
              <p className="mt-3">
                Elite Turf n&apos;est pas responsable des pertes financières liées aux paris effectués
                sur la base de ses analyses.
              </p>
            </div>
          </section>

        </div>
      </div>

      {/* Section opérateurs agréés ANJ — requis certification Google Ads */}
      <OperateursANJ />
    </div>
  );
}
