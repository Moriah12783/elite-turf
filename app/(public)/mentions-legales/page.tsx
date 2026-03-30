import { Metadata } from "next";
import PageHero from "@/components/layout/PageHero";

export const metadata: Metadata = {
  title: "Mentions Légales — Elite Turf",
  description: "Mentions légales du site EliteTurf.fr",
};

export default function MentionsLegalesPage() {
  return (
    <div className="min-h-screen bg-bg-primary">
      <PageHero
        image="/images/heroes/hero-legal.jpg"
        titre="Mentions Légales"
        sousTitre="Informations légales — Elite Turf, Paris"
      />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">

        <div className="mb-10">
          <h1 className="font-serif text-3xl font-bold text-text-primary mb-2">Mentions Légales</h1>
          <p className="text-text-muted text-sm">Dernière mise à jour : mars 2026</p>
        </div>

        <div className="space-y-8 text-text-secondary text-sm leading-relaxed">

          <section className="card-base p-6">
            <h2 className="font-serif font-bold text-text-primary text-lg mb-4">Éditeur du site</h2>
            <p>
              Le site <strong className="text-text-primary">EliteTurf</strong> (eliteturf.fr) est édité par{" "}
              <strong className="text-text-primary">Yapi Landry Stéphane</strong>,
              domicilié à Paris, France.
            </p>
            <p className="mt-3">
              <strong className="text-text-primary">Directeur de la publication :</strong> Yapi Landry Stéphane
            </p>
            <p className="mt-2">
              <strong className="text-text-primary">Contact :</strong>{" "}
              <a href="mailto:contact@elite-turf.fr" className="text-gold-light hover:underline">
                contact@elite-turf.fr
              </a>
            </p>
          </section>

          <section className="card-base p-6">
            <h2 className="font-serif font-bold text-text-primary text-lg mb-4">Hébergement</h2>
            <p>
              Le site est hébergé par{" "}
              <strong className="text-text-primary">Vercel Inc.</strong>,
              situé au 340 S Lemon Ave #4133, Walnut, CA 91789, États-Unis.
            </p>
            <p className="mt-2">
              Site web :{" "}
              <span className="text-gold-light">vercel.com</span>
            </p>
          </section>

          <section className="card-base p-6">
            <h2 className="font-serif font-bold text-text-primary text-lg mb-4">Propriété intellectuelle</h2>
            <p>
              L&apos;ensemble du contenu de ce site (textes, logos, algorithmes de pronostics, analyses,
              graphiques, images) est la propriété exclusive d&apos;EliteTurf et de son éditeur.
            </p>
            <p className="mt-3">
              Toute reproduction, distribution, modification ou utilisation de ces contenus, sous quelque
              forme que ce soit, est <strong className="text-text-primary">strictement interdite sans accord
              écrit préalable</strong> de l&apos;éditeur.
            </p>
          </section>

          <section className="card-base p-6">
            <h2 className="font-serif font-bold text-text-primary text-lg mb-4">Avertissement — Jeu Responsable</h2>
            <div className="p-4 bg-orange-500/5 border border-orange-500/30 rounded-xl">
              <p>
                Jouer comporte des risques : endettement, isolement, dépendance. Pour être aidé,
                appelez le <strong className="text-text-primary">09 74 75 13 13</strong> (appel non surtaxé).
                EliteTurf est un site d&apos;analyse et d&apos;information ; nous ne sommes pas responsables
                des pertes financières liées aux paris. Les paris sont interdits aux mineurs (moins de 18 ans).
              </p>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
