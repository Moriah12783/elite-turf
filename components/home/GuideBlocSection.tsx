import Link from "next/link";
import { Download, CheckCircle, BookOpen } from "lucide-react";
import { Analytics } from "@/lib/analytics";

const WHAT_YOU_LEARN = [
  "Comment identifier les outsiders qui créent les surprises en course",
  "Les 3 indicateurs que les parieurs experts regardent en premier",
  "La méthode pour lire une fiche de course en moins de 2 minutes",
  "Comment exploiter les côtes PMU à votre avantage",
  "Les erreurs classiques qui font perdre 80% des parieurs",
];

export default function GuideBlocSection() {
  return (
    <section
      id="guide-gratuit"
      className="py-16 sm:py-20 relative overflow-hidden scroll-mt-20"
    >
      {/* Fond dégradé subtil */}
      <div className="absolute inset-0 bg-gradient-to-br from-gold-faint via-bg-card to-bg-elevated" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_80%_50%,_rgba(201,168,76,0.07),_transparent)]" />

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">

          {/* ── Gauche : contenu ── */}
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-gold-primary/15 border border-gold-primary/30 rounded-full text-gold-light text-xs font-bold uppercase tracking-widest mb-6">
              <Download className="w-3.5 h-3.5" />
              Guide gratuit — PDF
            </div>

            <h2 className="font-serif text-3xl sm:text-4xl font-bold text-text-primary mb-4 leading-tight">
              5 secrets pour détecter{" "}
              <span
                className="bg-clip-text text-transparent"
                style={{ backgroundImage: "linear-gradient(135deg, #C9A84C, #F0E0B0, #A07830)" }}
              >
                les outsiders gagnants
              </span>
            </h2>

            <p className="text-text-secondary text-base leading-relaxed mb-8">
              Le guide que{" "}
              <span className="text-gold-light font-semibold">847 parieurs francophones</span>{" "}
              ont déjà téléchargé. Apprenez les techniques que nos experts utilisent
              chaque jour pour analyser les courses PMU — 100% gratuit, sans engagement.
            </p>

            <ul className="space-y-3 mb-8">
              {WHAT_YOU_LEARN.map((item, i) => (
                <li key={i} className="flex items-start gap-3">
                  <CheckCircle className="w-4 h-4 text-status-win flex-shrink-0 mt-0.5" />
                  <span className="text-text-secondary text-sm leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <Link
                href="/guide-initie"
                className="flex items-center justify-center gap-2 px-8 py-4 bg-gold-primary hover:bg-gold-dark text-bg-primary font-bold text-base rounded-xl transition-all shadow-gold w-full sm:w-auto"
              >
                <Download className="w-5 h-5" />
                Télécharger gratuitement
              </Link>
              <div className="flex items-center gap-3 text-text-muted text-xs">
                <span className="flex items-center gap-1"><span className="text-status-win">✓</span> Sans engagement</span>
                <span>·</span>
                <span className="flex items-center gap-1"><span className="text-status-win">✓</span> Accès immédiat</span>
              </div>
            </div>
          </div>

          {/* ── Droite : mockup livre ── */}
          <div className="flex justify-center lg:justify-end">
            <div className="relative">
              {/* Ombre portée */}
              <div className="absolute -bottom-6 right-0 w-52 h-72 bg-black/25 rounded-2xl blur-2xl" />

              {/* Couverture */}
              <div className="relative w-52 h-72 rounded-2xl bg-gradient-to-br from-[#1A1208] via-[#2A1F0A] to-[#0D0D0D] border border-gold-primary/40 shadow-gold overflow-hidden flex flex-col">
                {/* Barre top */}
                <div className="h-1 w-full bg-gradient-to-r from-transparent via-gold-primary to-transparent" />

                {/* Contenu couverture */}
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                  <BookOpen className="w-10 h-10 text-gold-primary mb-3" />
                  <div className="w-12 h-px bg-gold-primary/40 mb-3" />
                  <p className="text-gold-primary/70 text-[9px] font-bold uppercase tracking-[0.3em] mb-2">
                    Elite Turf
                  </p>
                  <h3 className="font-serif text-white text-xl font-bold leading-tight mb-2">
                    5 Secrets
                  </h3>
                  <p className="text-gold-light/80 text-xs leading-relaxed">
                    pour détecter les<br />outsiders gagnants
                  </p>
                  <div className="mt-5 w-full h-px bg-gold-primary/20" />
                  <p className="text-text-muted text-[9px] mt-2">Guide PDF · Édition 2025</p>
                </div>

                {/* Barre bottom */}
                <div className="h-1 w-full bg-gradient-to-r from-transparent via-gold-primary/50 to-transparent" />
              </div>

              {/* Badge 100% gratuit */}
              <div className="absolute -top-3 -right-3 w-16 h-16 bg-status-win rounded-full flex flex-col items-center justify-center shadow-lg border-2 border-bg-card text-white">
                <span className="text-[10px] font-bold leading-none">100%</span>
                <span className="text-[9px] leading-none mt-0.5">Gratuit</span>
              </div>

              {/* Badge téléchargements */}
              <div className="absolute -bottom-3 -left-3 px-3 py-1.5 bg-bg-card border border-gold-primary/30 rounded-full shadow-lg">
                <span className="text-gold-light text-xs font-semibold">🏇 847 téléchargements</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
