import { Metadata } from "next";
import Link from "next/link";
import { XCircle, MessageCircle, ArrowLeft, CreditCard } from "lucide-react";

export const metadata: Metadata = {
  title: "Paiement échoué — Elite Turf",
  robots: { index: false, follow: false },
};

export default function PaiementEchecPage() {
  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center px-4 py-16">
      <div className="max-w-md w-full text-center">

        {/* Icône échec */}
        <div className="inline-flex mb-8">
          <div className="w-24 h-24 rounded-full bg-status-loss/10 border-2 border-status-loss/30 flex items-center justify-center">
            <XCircle className="w-12 h-12 text-status-loss" strokeWidth={1.5} />
          </div>
        </div>

        <h1 className="font-serif text-3xl font-bold text-text-primary mb-3">
          Paiement non abouti
        </h1>
        <p className="text-text-secondary text-base mb-8 leading-relaxed">
          Le paiement n&apos;a pas pu être finalisé — le plus souvent parce que
          votre banque n&apos;a pas validé l&apos;authentification de la carte.{" "}
          <strong className="text-text-primary">Aucun montant n&apos;a été débité.</strong>
        </p>

        {/* Causes fréquentes (carte + Mobile Money) */}
        <div className="card-base p-5 mb-6 text-left">
          <p className="text-text-secondary text-xs uppercase tracking-wider font-semibold mb-3">
            Causes fréquentes
          </p>
          <ul className="space-y-2 text-sm text-text-secondary">
            {[
              "Authentification refusée par votre banque (code OTP / 3-D Secure)",
              "Carte non autorisée pour les paiements internationaux",
              "Solde insuffisant (carte ou Mobile Money)",
              "Plusieurs tentatives rapprochées — patientez quelques minutes",
            ].map((cause, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-text-muted mt-0.5">•</span>
                {cause}
              </li>
            ))}
          </ul>
        </div>

        {/* Conseil — éviter la spirale de blocage anti-fraude */}
        <div className="rounded-xl border border-gold-primary/30 bg-gold-faint/40 p-4 mb-8 text-left">
          <div className="flex items-start gap-2.5">
            <CreditCard className="w-4 h-4 text-gold-primary mt-0.5 flex-shrink-0" />
            <p className="text-text-secondary text-sm leading-relaxed">
              <strong className="text-text-primary">Astuce :</strong> attendez 1 à 2 minutes,
              puis essayez <strong>une autre carte</strong> ou un autre moyen de paiement —
              carte prépayée virtuelle <strong>Wave / Orange Money</strong>, ou{" "}
              <strong>Mobile Money</strong> en Côte d&apos;Ivoire. Enchaîner les tentatives
              trop vite peut amener votre banque à bloquer la carte par sécurité.
            </p>
          </div>
        </div>

        {/* CTA — support humain en premier (conversion manuelle), retry calme ensuite */}
        <div className="grid grid-cols-1 gap-3">
          <a
            href="https://wa.me/+33644686720?text=Bonjour, mon paiement Elite Turf n'a pas abouti, pouvez-vous m'aider à finaliser mon abonnement ?"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 px-5 py-3 bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#25D366] font-bold text-sm rounded-xl transition-colors border border-[#25D366]/30"
          >
            <MessageCircle className="w-4 h-4" />
            Être aidé sur WhatsApp (réponse rapide)
          </a>

          <Link
            href="/abonnements"
            className="flex items-center justify-center gap-2 px-5 py-3 bg-bg-elevated hover:bg-bg-hover text-text-primary border border-border font-semibold text-sm rounded-xl transition-colors"
          >
            Revenir aux abonnements
          </Link>

          <Link
            href="/"
            className="flex items-center justify-center gap-2 text-text-muted text-sm hover:text-text-secondary transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour à l&apos;accueil
          </Link>
        </div>

      </div>
    </div>
  );
}
