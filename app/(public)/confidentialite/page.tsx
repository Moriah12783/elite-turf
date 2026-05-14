import { Metadata } from "next";
import PageHero from "@/components/layout/PageHero";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://www.elite-turf.fr");

export const metadata: Metadata = {
  title: "Politique de Confidentialité — Elite Turf",
  description: "Politique de confidentialité et protection des données personnelles (RGPD) — Elite Turf, exploité par TSALACH VENTURES LLC.",
  alternates: { canonical: `${APP_URL}/confidentialite` },
  robots: { index: false, follow: false },
};

export default function ConfidentialitePage() {
  return (
    <div className="min-h-screen bg-bg-primary">
      <PageHero
        image="/images/heroes/hero-legal.jpg"
        titre="Politique de Confidentialité"
        sousTitre="Protection de vos données personnelles — RGPD"
      />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">

        <div className="mb-10">
          <h1 className="font-serif text-3xl font-bold text-text-primary mb-2">
            Politique de Confidentialité
          </h1>
          <p className="text-text-muted text-sm">Conforme au RGPD — Dernière mise à jour : mai 2026</p>
        </div>

        <div className="space-y-6 text-text-secondary text-sm leading-relaxed">

          {/* ── 1. RESPONSABLE DU TRAITEMENT ── */}
          <section className="card-base p-6">
            <h2 className="font-serif font-bold text-text-primary text-lg mb-4">1. Responsable du traitement</h2>
            <p>
              Le responsable du traitement de vos données personnelles est{" "}
              <strong className="text-text-primary">TSALACH VENTURES LLC</strong>, société de droit américain
              (Wyoming), exploitant la marque{" "}
              <strong className="text-text-primary">Elite Turf</strong>.
            </p>
            <div className="mt-3 space-y-1">
              <p><strong className="text-text-primary">Adresse :</strong> 30 N Gould St, STE R, Sheridan, WY 82801, États-Unis</p>
              <p>
                <strong className="text-text-primary">Contact DPO :</strong>{" "}
                <a href="mailto:contact@elite-turf.fr" className="text-gold-light hover:underline">
                  contact@elite-turf.fr
                </a>
              </p>
            </div>
          </section>

          {/* ── 2. DONNÉES COLLECTÉES ── */}
          <section className="card-base p-6">
            <h2 className="font-serif font-bold text-text-primary text-lg mb-4">2. Données collectées</h2>
            <p>Lors de votre inscription ou de vos interactions avec le site, nous collectons :</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-text-muted">
              <li>Nom complet</li>
              <li>Adresse e-mail</li>
              <li>Numéro de téléphone (Mobile Money / WhatsApp)</li>
              <li>Pays de résidence</li>
              <li>Données de navigation (adresse IP, pages visitées, durée de session)</li>
              <li>Historique de paiement (référence de transaction, montant, statut)</li>
            </ul>
            <p className="mt-3">
              Nous ne vendons, ne louons et ne partageons jamais vos données personnelles
              avec des tiers à des fins commerciales.
            </p>
          </section>

          {/* ── 3. FINALITÉS DU TRAITEMENT ── */}
          <section className="card-base p-6">
            <h2 className="font-serif font-bold text-text-primary text-lg mb-4">3. Finalités du traitement</h2>
            <p>Vos données sont utilisées pour :</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-text-muted">
              <li>La création et la gestion de votre compte membre</li>
              <li>La livraison de vos pronostics et contenus d&apos;abonnement</li>
              <li>Le traitement de vos paiements (Mobile Money, Stripe)</li>
              <li>Le support client par e-mail et WhatsApp</li>
              <li>L&apos;envoi de communications liées à votre abonnement</li>
              <li>L&apos;amélioration de nos services (statistiques anonymisées)</li>
            </ul>
          </section>

          {/* ── 4. COMMUNICATIONS WHATSAPP ── */}
          <section className="card-base p-6">
            <h2 className="font-serif font-bold text-text-primary text-lg mb-4">4. Communications WhatsApp</h2>
            <p>
              Si vous avez coché la case de consentement WhatsApp lors de votre inscription,
              TSALACH VENTURES LLC peut vous envoyer des messages via WhatsApp Business
              concernant :
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-text-muted">
              <li>Vos pronostics et analyses du jour</li>
              <li>Des informations sur vos abonnements Elite Turf</li>
              <li>Des offres exclusives membres</li>
            </ul>
            <p className="mt-3">
              Vous pouvez retirer votre consentement à tout moment en répondant{" "}
              <strong className="text-text-primary">STOP</strong> à n&apos;importe quel message WhatsApp
              reçu, ou en nous contactant à{" "}
              <a href="mailto:contact@elite-turf.fr" className="text-gold-light hover:underline">
                contact@elite-turf.fr
              </a>.
            </p>
            <p className="mt-3 text-text-muted text-xs">
              Aucun frais supplémentaire lié à WhatsApp n&apos;est facturé. Les tarifs de votre
              opérateur s&apos;appliquent selon votre forfait.
            </p>
          </section>

          {/* ── 5. CONSERVATION ET DROITS ── */}
          <section className="card-base p-6">
            <h2 className="font-serif font-bold text-text-primary text-lg mb-4">5. Conservation et droits</h2>
            <p>
              Vos données sont conservées tant que vous maintenez un compte actif sur Elite Turf,
              ou pendant 3 ans après votre dernier accès.
            </p>
            <p className="mt-3">
              Conformément au <strong className="text-text-primary">RGPD</strong>, vous disposez des
              droits suivants :
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-text-muted">
              <li>Droit d&apos;accès à vos données personnelles</li>
              <li>Droit de rectification des données inexactes</li>
              <li>Droit à l&apos;effacement (« droit à l&apos;oubli »)</li>
              <li>Droit à la portabilité de vos données</li>
              <li>Droit d&apos;opposition au traitement</li>
              <li>Retrait du consentement WhatsApp à tout moment</li>
            </ul>
            <p className="mt-3">
              Pour exercer ces droits :{" "}
              <a href="mailto:contact@elite-turf.fr" className="text-gold-light hover:underline">
                contact@elite-turf.fr
              </a>
            </p>
          </section>

          {/* ── 6. COOKIES ET TRACEURS ── */}
          <section className="card-base p-6">
            <h2 className="font-serif font-bold text-text-primary text-lg mb-4">6. Cookies et traceurs</h2>
            <p>
              Le site utilise des cookies de navigation (session d&apos;authentification,
              préférences) ainsi que des outils d&apos;analyse comportementale :
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-text-muted">
              <li><strong className="text-text-secondary">Google Tag Manager / Analytics</strong> — mesure d&apos;audience anonymisée</li>
              <li><strong className="text-text-secondary">Microsoft Clarity</strong> — analyse comportementale (heatmaps, sessions)</li>
              <li><strong className="text-text-secondary">OneSignal</strong> — notifications push (si activées)</li>
            </ul>
            <p className="mt-3">
              Vous pouvez refuser les cookies via les paramètres de votre navigateur.
              Certaines fonctionnalités peuvent être affectées.
            </p>
          </section>

          {/* ── 7. SÉCURITÉ ── */}
          <section className="card-base p-6">
            <h2 className="font-serif font-bold text-text-primary text-lg mb-4">7. Sécurité</h2>
            <p>
              Vos données sont stockées sur les serveurs sécurisés de{" "}
              <strong className="text-text-primary">Supabase</strong> et protégées par des
              protocoles de chiffrement SSL/TLS. Les mots de passe sont hachés (bcrypt) et ne sont
              jamais stockés en clair.
            </p>
            <p className="mt-3">
              Les données de paiement transitent exclusivement via{" "}
              <strong className="text-text-primary">Paystack</strong> et{" "}
              <strong className="text-text-primary">Stripe</strong>, certifiés PCI DSS.
              Elite Turf ne stocke aucune donnée bancaire.
            </p>
          </section>

        </div>
      </div>
    </div>
  );
}
