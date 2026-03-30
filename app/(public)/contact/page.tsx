import { Metadata } from "next";
import { MessageCircle, Mail, MapPin, AlertTriangle } from "lucide-react";
import PageHero from "@/components/layout/PageHero";

export const metadata: Metadata = {
  title: "Contact — Elite Turf",
  description:
    "Contactez l'équipe Elite Turf par WhatsApp ou email. Réponse prioritaire pour nos membres.",
};

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-bg-primary">

      <PageHero
        image="/images/heroes/hero-contact.jpg"
        titre="Contactez-Nous"
        sousTitre="Une question ? Notre équipe vous répond sous 24h — priorité aux membres abonnés"
      />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pb-20 space-y-6">

        {/* ── WHATSAPP ── */}
        <div className="card-base p-6 flex items-start gap-5">
          <div className="w-12 h-12 rounded-2xl bg-[#25D366]/10 border border-[#25D366]/30 flex items-center justify-center flex-shrink-0">
            <MessageCircle className="w-6 h-6 text-[#25D366]" />
          </div>
          <div className="flex-1">
            <h2 className="font-serif font-bold text-text-primary mb-1">WhatsApp Direct</h2>
            <p className="text-text-muted text-sm mb-3">
              Réponse prioritaire pour nos membres — disponible Lun–Sam, 8h–20h (heure de Paris)
            </p>
            <a
              href="https://wa.me/+33644686720?text=Bonjour, j'ai une question concernant Elite Turf"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#25D366] hover:bg-[#1ebe5d] text-white font-bold text-sm rounded-xl transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              06 44 68 67 20
            </a>
          </div>
        </div>

        {/* ── EMAIL ── */}
        <div className="card-base p-6 flex items-start gap-5">
          <div className="w-12 h-12 rounded-2xl bg-gold-faint border border-gold-primary/30 flex items-center justify-center flex-shrink-0">
            <Mail className="w-6 h-6 text-gold-primary" />
          </div>
          <div className="flex-1">
            <h2 className="font-serif font-bold text-text-primary mb-1">Email</h2>
            <p className="text-text-muted text-sm mb-3">
              Pour toute demande écrite, nous répondons sous 24h ouvrées.
            </p>
            <a
              href="mailto:contact@eliteturf.fr"
              className="inline-flex items-center gap-2 text-gold-light hover:text-gold-primary font-semibold text-sm transition-colors"
            >
              <Mail className="w-4 h-4" />
              contact@eliteturf.fr
            </a>
          </div>
        </div>

        {/* ── ADRESSE ── */}
        <div className="card-base p-6 flex items-start gap-5">
          <div className="w-12 h-12 rounded-2xl bg-bg-elevated border border-border flex items-center justify-center flex-shrink-0">
            <MapPin className="w-6 h-6 text-text-secondary" />
          </div>
          <div className="flex-1">
            <h2 className="font-serif font-bold text-text-primary mb-1">Adresse</h2>
            <p className="text-text-secondary text-sm">
              Elite Turf<br />75008 Paris, France
            </p>
          </div>
        </div>

        {/* ── DISCLAIMER LÉGAL ── */}
        <div className="p-5 rounded-xl bg-orange-500/5 border-2 border-orange-500/40">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-orange-400 mb-2 text-sm uppercase tracking-wide">
                Avertissement — Jeu Responsable
              </h3>
              <p className="text-text-secondary text-sm leading-relaxed">
                Jouer comporte des risques : endettement, isolement, dépendance.
                Pour être aidé, appelez le{" "}
                <span className="font-bold text-text-primary">09 74 75 13 13</span>{" "}
                (appel non surtaxé).
              </p>
              <p className="text-text-muted text-xs mt-2 leading-relaxed">
                EliteTurf est un site d&apos;analyse et d&apos;information ; nous ne sommes pas
                responsables des pertes financières liées aux paris. Nos pronostics sont
                fournis à titre informatif uniquement. Jouez de manière responsable.
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
