import { Metadata } from "next";
import PageHero from "@/components/layout/PageHero";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.elite-turf.fr";

export const metadata: Metadata = {
  title: "Conditions Générales d'Utilisation — Elite Turf",
  description: "CGU Elite Turf — Conditions générales d'utilisation de la plateforme de pronostics PMU. Exploité par TSALACH VENTURES LLC.",
  alternates: { canonical: `${APP_URL}/cgu` },
  robots: { index: false, follow: false },
};

export default function CguPage() {
  return (
    <div className="min-h-screen bg-bg-primary">
      <PageHero
        image="/images/heroes/hero-legal.jpg"
        titre="Conditions Générales d'Utilisation"
        sousTitre="Règles d'utilisation de la plateforme Elite Turf"
      />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">

        <div className="mb-10">
          <h1 className="font-serif text-3xl font-bold text-text-primary mb-2">
            Conditions Générales d&apos;Utilisation
          </h1>
          <p className="text-text-muted text-sm">Dernière mise à jour : mai 2026</p>
        </div>

        <div className="space-y-6 text-text-secondary text-sm leading-relaxed">

          {/* ── 1. ÉDITEUR ── */}
          <section className="card-base p-6">
            <h2 className="font-serif font-bold text-text-primary text-lg mb-4">1. Éditeur</h2>
            <p>
              Le site <strong className="text-text-primary">elite-turf.fr</strong> (ci-après « Elite Turf »)
              est édité et exploité par{" "}
              <strong className="text-text-primary">TSALACH VENTURES LLC</strong>, société de droit américain
              (Wyoming LLC), 30 N Gould St, STE R, Sheridan, WY 82801, États-Unis.
            </p>
            <p className="mt-3">
              L&apos;accès au site implique l&apos;acceptation pleine et entière des présentes CGU.
              En cas de désaccord, l&apos;utilisateur doit s&apos;abstenir d&apos;utiliser le service.
            </p>
          </section>

          {/* ── 2. OBJET DU SERVICE ── */}
          <section className="card-base p-6">
            <h2 className="font-serif font-bold text-text-primary text-lg mb-4">2. Objet du service</h2>
            <p>
              Elite Turf propose des services d&apos;analyse de données hippiques et des contenus
              méthodologiques. Ces informations sont fournies à{" "}
              <strong className="text-text-primary">titre indicatif et informatif uniquement</strong>.
            </p>
            <p className="mt-3">
              Elite Turf <strong className="text-text-primary">ne collecte aucune mise</strong> et n&apos;organise
              aucun pari. Le service se limite à la fourniture de contenus d&apos;analyse.
            </p>
          </section>

          {/* ── 3. NON-GARANTIE / RESPONSABILITÉ ── */}
          <section className="card-base p-6">
            <h2 className="font-serif font-bold text-text-primary text-lg mb-4">
              3. Clause de non-garantie — Responsabilité
            </h2>
            <div className="space-y-4">
              <div className="p-4 bg-orange-500/5 border border-orange-500/20 rounded-xl">
                <p className="font-semibold text-text-primary mb-2">Absence de garantie de gain</p>
                <p>
                  Les courses hippiques comportent un aléa intrinsèque. Elite Turf ne garantit en aucun
                  cas des gains financiers. Les performances passées ne préjugent pas des performances
                  futures.
                </p>
              </div>
              <div className="p-4 bg-orange-500/5 border border-orange-500/20 rounded-xl">
                <p className="font-semibold text-text-primary mb-2">Responsabilité de l&apos;utilisateur</p>
                <p>
                  L&apos;utilisateur est{" "}
                  <strong className="text-text-primary">seul responsable</strong> de ses mises et de ses
                  décisions de jeu. TSALACH VENTURES LLC ne pourra être tenu responsable des pertes
                  financières engagées sur la base des analyses et pronostics publiés.
                </p>
              </div>
            </div>
          </section>

          {/* ── 4. ACCÈS PRO ET ELITE ── */}
          <section className="card-base p-6">
            <h2 className="font-serif font-bold text-text-primary text-lg mb-4">4. Accès Pro et Elite</h2>
            <p>
              L&apos;accès aux pronostics payants est{" "}
              <strong className="text-text-primary">strictement personnel et non transférable</strong>.
              Un compte ne peut être utilisé que par son titulaire.
            </p>
            <p className="mt-3">
              Tout partage de compte, de pronostics Pro ou Elite sur des réseaux sociaux, groupes
              WhatsApp, Telegram ou tout autre tiers entraînera la{" "}
              <strong className="text-text-primary">suspension immédiate du compte sans remboursement</strong>.
            </p>
            <p className="mt-3">
              TSALACH VENTURES LLC se réserve le droit de résilier tout abonnement en cas de
              violation de ces conditions.
            </p>
          </section>

          {/* ── 5. COMMUNICATIONS WHATSAPP ── */}
          <section className="card-base p-6">
            <h2 className="font-serif font-bold text-text-primary text-lg mb-4">5. Communications WhatsApp</h2>
            <p>
              En cochant la case de consentement WhatsApp lors de votre inscription, vous autorisez
              expressément <strong className="text-text-primary">TSALACH VENTURES LLC</strong> à vous
              contacter via WhatsApp Business pour vous envoyer des analyses, pronostics et
              informations relatives à votre abonnement Elite Turf.
            </p>
            <p className="mt-3">
              Ce consentement est libre, éclairé et révocable à tout moment. Pour vous désabonner,
              répondez <strong className="text-text-primary">STOP</strong> à n&apos;importe quel message
              WhatsApp ou écrivez à{" "}
              <a href="mailto:contact@elite-turf.fr" className="text-gold-light hover:underline">
                contact@elite-turf.fr
              </a>.
            </p>
            <p className="mt-3 text-text-muted text-xs">
              Le consentement WhatsApp est facultatif et n&apos;affecte pas votre accès au service.
            </p>
          </section>

          {/* ── 6. MINEURS ET JEU RESPONSABLE ── */}
          <section className="card-base p-6">
            <h2 className="font-serif font-bold text-text-primary text-lg mb-4">6. Mineurs et jeu responsable</h2>
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
                <strong className="text-text-primary">09 74 75 13 13</strong>{" "}
                (appel non surtaxé, disponible 7j/7, 8h–2h).
              </p>
            </div>
          </section>

          {/* ── 7. ABONNEMENTS ET PAIEMENTS ── */}
          <section className="card-base p-6">
            <h2 className="font-serif font-bold text-text-primary text-lg mb-4">7. Abonnements et paiements</h2>
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

          {/* ── 8. DROIT APPLICABLE ── */}
          <section className="card-base p-6">
            <h2 className="font-serif font-bold text-text-primary text-lg mb-4">8. Droit applicable</h2>
            <p>
              Les présentes CGU sont soumises au droit de l&apos;État du{" "}
              <strong className="text-text-primary">Wyoming (États-Unis)</strong>, lieu de constitution
              de TSALACH VENTURES LLC. Tout litige sera soumis à la compétence exclusive des
              tribunaux de l&apos;État du Wyoming, sans préjudice des droits impératifs des
              consommateurs dans leur pays de résidence.
            </p>
          </section>

        </div>
      </div>
    </div>
  );
}
