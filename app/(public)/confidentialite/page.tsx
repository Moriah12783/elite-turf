import { Metadata } from "next";
import PageHero from "@/components/layout/PageHero";

export const metadata: Metadata = {
  title: "Politique de Confidentialité — Elite Turf",
  description: "Politique de confidentialité et protection des données personnelles (RGPD) — EliteTurf.fr",
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
          <p className="text-text-muted text-sm">Conforme au RGPD — Dernière mise à jour : mars 2026</p>
        </div>

        <div className="space-y-6 text-text-secondary text-sm leading-relaxed">

          <section className="card-base p-6">
            <h2 className="font-serif font-bold text-text-primary text-lg mb-4">Collecte des données</h2>
            <p>
              Nous collectons votre adresse e-mail lors de votre inscription à notre plateforme,
              à notre newsletter ou au téléchargement de notre guide gratuit.
            </p>
            <p className="mt-3">
              Ces données sont utilisées exclusivement pour :
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-text-muted">
              <li>L&apos;envoi de nos pronostics quotidiens</li>
              <li>La gestion de votre abonnement</li>
              <li>Nos communications et offres promotionnelles EliteTurf</li>
            </ul>
            <p className="mt-3">
              Nous ne vendons, ne louons et ne partageons jamais vos données personnelles
              avec des tiers à des fins commerciales.
            </p>
          </section>

          <section className="card-base p-6">
            <h2 className="font-serif font-bold text-text-primary text-lg mb-4">Conservation et droits</h2>
            <p>
              Vos données sont conservées tant que vous maintenez un compte actif sur EliteTurf ou
              tant que vous ne demandez pas leur suppression.
            </p>
            <p className="mt-3">
              Conformément au <strong className="text-text-primary">RGPD (Règlement Général sur la
              Protection des Données)</strong>, vous disposez des droits suivants :
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-text-muted">
              <li>Droit d&apos;accès à vos données personnelles</li>
              <li>Droit de rectification des données inexactes</li>
              <li>Droit à l&apos;effacement (&laquo; droit à l&apos;oubli &raquo;)</li>
              <li>Droit à la portabilité de vos données</li>
              <li>Droit d&apos;opposition au traitement</li>
            </ul>
            <p className="mt-3">
              Pour exercer ces droits, écrivez-nous à :{" "}
              <a href="mailto:contact@elite-turf.fr" className="text-gold-light hover:underline">
                contact@elite-turf.fr
              </a>
            </p>
          </section>

          <section className="card-base p-6">
            <h2 className="font-serif font-bold text-text-primary text-lg mb-4">Cookies</h2>
            <p>
              Le site utilise des cookies de navigation pour améliorer votre expérience utilisateur
              (session d&apos;authentification, préférences d&apos;affichage).
            </p>
            <p className="mt-3">
              Nous n&apos;utilisons pas de cookies publicitaires ou de tracking tiers.
              Vous pouvez refuser les cookies via les paramètres de votre navigateur, mais
              certaines fonctionnalités du site pourraient être affectées.
            </p>
          </section>

          <section className="card-base p-6">
            <h2 className="font-serif font-bold text-text-primary text-lg mb-4">Sécurité</h2>
            <p>
              Vos données sont stockées sur les serveurs sécurisés de Supabase (UE) et protégées
              par des protocoles de chiffrement SSL/TLS. Les mots de passe sont hachés et ne sont
              jamais stockés en clair.
            </p>
          </section>

          <section className="card-base p-6">
            <h2 className="font-serif font-bold text-text-primary text-lg mb-4">Contact DPO</h2>
            <p>
              Pour toute question relative à la protection de vos données personnelles :{" "}
              <a href="mailto:contact@elite-turf.fr" className="text-gold-light hover:underline">
                contact@elite-turf.fr
              </a>
            </p>
          </section>

        </div>
      </div>
    </div>
  );
}
