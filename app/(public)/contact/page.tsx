import { Metadata } from "next";
import { MessageCircle, Mail, MapPin, AlertTriangle } from "lucide-react";

export const metadata: Metadata = {
  title: "Contact — Elite Turf",
  description:
    "Contactez l'équipe Elite Turf par WhatsApp ou email. Réponse prioritaire pour nos membres.",
};

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-bg-primary">

      {/* ── HERO ── */}
      <div className="relative overflow-hidden py-20 sm:py-24">
        <div className="absolute inset-0 bg-gradient-to-b from-bg-card/60 to-bg-primary" />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold-primary/60 to-transparent" />
        <div className="relative max-w-2xl mx-auto px-4 text-center">
          <h1 className="font-serif text-3xl sm:text-5xl font-bold text-text-primary mb-4 leading-tight">
            Une Question ?{" "}
            <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: "linear-gradient(135deg, #C9A84C, #E8D5A3, #A07830)" }}
            >
              Notre Équipe vous Répond
            </span>
          </h1>
          <p className="text-text-secondary text-base">
            Réponse prioritaire pour nos membres abonnés.
          </p>
        </div>
      </div>

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
              href="https://wa.me/+33700000000?text=Bonjour, j'ai une question concernant Elite Turf"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#25D366] hover:bg-[#1ebe5d] text-white font-bold text-sm rounded-xl transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              +33 7 XX XX XX XX
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
              href="mailto:contact@elite-turf.com"
              className="inline-flex items-center gap-2 text-gold-light hover:text-gold-primary font-semibold text-sm transition-colors"
            >
              <Mail className="w-4 h-4" />
              contact@elite-turf.com
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
