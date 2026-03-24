import { Metadata } from "next";
import Link from "next/link";
import { XCircle, RefreshCw, MessageCircle, ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Paiement échoué — Elite Turf",
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
          Le paiement n&apos;a pas pu être finalisé. Cela peut arriver si
          vous avez annulé la transaction ou si votre solde était insuffisant.
          Aucun montant n&apos;a été débité.
        </p>

        {/* Causes fréquentes */}
        <div className="card-base p-5 mb-8 text-left">
          <p className="text-text-secondary text-xs uppercase tracking-wider font-semibold mb-3">
            Causes fréquentes
          </p>
          <ul className="space-y-2 text-sm text-text-secondary">
            {[
              "Solde insuffisant sur votre compte Mobile Money",
              "Transaction annulée ou expirée (>15 min)",
              "Limite de transaction dépassée",
              "Problème de réseau lors de la validation",
            ].map((cause, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-text-muted mt-0.5">•</span>
                {cause}
              </li>
            ))}
          </ul>
        </div>

        {/* CTA */}
        <div className="grid grid-cols-1 gap-3">
          <Link
            href="/abonnements"
            className="btn-primary flex items-center justify-center gap-2 py-3 rounded-xl font-bold"
          >
            <RefreshCw className="w-4 h-4" />
            Réessayer le paiement
          </Link>

          <a
            href="https://wa.me/+22507000000?text=Bonjour, j'ai un problème avec mon paiement Elite Turf"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 px-5 py-3 bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#25D366] font-bold text-sm rounded-xl transition-colors border border-[#25D366]/30"
          >
            <MessageCircle className="w-4 h-4" />
            Contacter le support WhatsApp
          </a>

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
