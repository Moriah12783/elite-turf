import { Metadata } from "next";
import PageHero from "@/components/layout/PageHero";

export const metadata: Metadata = {
  title: "Conditions Générales d'Utilisation — Elite Turf",
  description: "CGU EliteTurf — Conditions générales d'utilisation de la plateforme de pronostics PMU.",
};

export default function CguPage() {
  return (
    <div className="min-h-screen bg-bg-primary">
      <PageHero
        image="https://images.unsplash.com/photo-1509399316151-9b86c70fdd40?w=1920&q=80"
        titre="Conditions Générales d'Utilisation"
        sousTitre="Règles d'utilisation de la plateforme Elite Turf"
      />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">

        <div className="mb-10">
          <h1 className="font-serif text-3xl font-bold text-text-primary mb-2">
            Conditions Générales d&apos;Utilisation
          </h1>
          <p className="text-text-muted text-sm">Dernière mise à jour : mars 2026</p>
        </div>

        <div className="space-y-6 text-text-secondary text-sm leading-relaxed">

          <section className="card-base p-6">
            <h2 className="font-serif font-bold text-text-primary text-lg mb-4">Objet des services</h2>
            <p>
              EliteTurf (eliteturf.fr) propose des services d&apos;analyse de données hippiques et des
              conseils de jeux. Ces informations sont fournies à <strong className="text-text-primary">titre
              indicatif et informatif uniquement</strong>.
            </p>
            <p className="mt-3">
              L&apos;accès au site implique l&apos;acceptation pleine et entière des présentes CGU. En cas de
              désaccord, l&apos;utilisateur doit s&apos;abstenir d&apos;utiliser le service.
            </p>
          </section>

          <section className="card-base p-6">
            <h2 className="font-serif font-bold text-text-primary text-lg mb-4">
              Clause de non-garantie — Responsabilité
            </h2>
            <div className="space-y-4">
              <div className="p-4 bg-orange-500/5 border border-orange-500/20 rounded-xl">
                <p className="font-semibold text-text-primary mb-2">Absence de garantie de gain</p>
                <p>
                  Les courses hippiques comportent un aléa intrinsèque. EliteTurf ne garantit en aucun
                  cas des gains financiers. Les performances passées ne préjugent pas des performances
                  futures.
                </p>
              </div>
              <div className="p-4 bg-orange-500/5 border border-orange-500/20 rounded-xl">
                <p className="font-semibold text-text-primary mb-2">Responsabilité de l&apos;utilisateur</p>
                <p>
                  L&apos;utilisateur est <strong className="text-text-primary">seul responsable</strong> de
                  ses mises et de ses décisions de jeu. EliteTurf ne pourra être tenu responsable des
                  pertes financières engagées sur la base de ses analyses et pronostics.
                </p>
              </div>
            </div>
          </section>

          <section className="card-base p-6">
            <h2 className="font-serif font-bold text-text-primary text-lg mb-4">Accès Premium et VIP</h2>
            <p>
              L&apos;accès aux pronostics payants est <strong className="text-text-primary">strictement
              personnel et non transférable</strong>. Un compte ne peut être utilisé que par son titulaire.
            </p>
            <p className="mt-3">
              Tout partage de compte, de pronostics Premium ou VIP sur des réseaux sociaux, groupes
              WhatsApp, Telegram ou tout autre tiers entraînera la{" "}
              <strong className="text-text-primary">suspension immédiate du compte sans remboursement</strong>.
            </p>
            <p className="mt-3">
              EliteTurf se réserve le droit de résilier tout abonnement en cas de violation de ces
              conditions.
            </p>
          </section>

          <section className="card-base p-6">
            <h2 className="font-serif font-bold text-text-primary text-lg mb-4">Mineurs et jeu responsable</h2>
            <div className="p-4 bg-orange-500/5 border border-orange-500/30 rounded-xl">
              <p>
                L&apos;accès au site est réservé aux personnes{" "}
                <strong className="text-text-primary">majeures (18 ans et plus)</strong>.
                Le jeu doit rester un plaisir et ne doit pas nuire à votre situation financière
                ou personnelle.
              </p>
              <p className="mt-3">
                En cas de difficulté avec le jeu, contactez{" "}
                <strong className="text-text-primary">Joueurs Info Service</strong> au{" "}
                <strong className="text-text-primary">09 74 75 13 13</strong> (appel non surtaxé,
                disponible 7j/7, 8h–2h).
              </p>
            </div>
          </section>

          <section className="card-base p-6">
            <h2 className="font-serif font-bold text-text-primary text-lg mb-4">Abonnements et paiements</h2>
            <p>
              Les abonnements sont sans engagement. L&apos;accès est activé immédiatement après
              confirmation du paiement et reste valide jusqu&apos;à la date d&apos;expiration indiquée.
            </p>
            <p className="mt-3">
              Aucun remboursement ne sera effectué pour la période déjà consommée. En cas de
              problème technique empêchant l&apos;accès au service, contactez-nous à{" "}
              <a href="mailto:contact@elite-turf.fr" className="text-gold-light hover:underline">
                contact@elite-turf.fr
              </a>.
            </p>
          </section>

          <section className="card-base p-6">
            <h2 className="font-serif font-bold text-text-primary text-lg mb-4">Droit applicable</h2>
            <p>
              Les présentes CGU sont soumises au droit français. Tout litige sera porté devant
              les tribunaux compétents de Paris, France.
            </p>
          </section>

        </div>
      </div>
    </div>
  );
}
