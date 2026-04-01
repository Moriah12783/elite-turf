import Link from "next/link";
import { Trophy, Mail, Phone, MessageCircle, MapPin } from "lucide-react";
import LogoEliteTurf from "@/components/ui/LogoEliteTurf";

const WHATSAPP = process.env.NEXT_PUBLIC_WHATSAPP || "+33644686720";

export default function Footer() {
  return (
    <footer className="mt-20">

      {/* ── SECTION AMBIANCE ── */}
      <div className="relative overflow-hidden">
        <img
          src="/images/heroes/hero-courses.jpg"
          alt="Hippodrome PMU France — Elite Turf"
          className="w-full h-52 sm:h-64 object-cover object-center"
        />
        <div className="absolute inset-0 bg-bg-primary/60" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-bg-primary/40 to-bg-card" />

        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-px bg-gold-primary/60" />
            <span className="text-gold-light text-xs font-medium uppercase tracking-[0.2em]">
              Experts PMU depuis Paris
            </span>
            <div className="w-8 h-px bg-gold-primary/60" />
          </div>
          <p className="font-serif text-xl sm:text-2xl font-bold text-text-primary drop-shadow-lg mb-4">
            Les courses PMU analysées depuis Paris,<br className="hidden sm:block" /> pour les parieurs francophones du monde entier
          </p>
          <Link
            href="/inscription"
            className="flex items-center gap-2 px-6 py-2.5 bg-gold-primary hover:bg-gold-dark text-bg-primary font-bold text-sm rounded-xl transition-all shadow-gold"
          >
            <Trophy className="w-4 h-4" />
            Créer un compte gratuit
          </Link>
        </div>
      </div>

      {/* ── CORPS DU FOOTER ── */}
      <div className="bg-bg-card border-t border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">

            {/* Brand */}
            <div className="sm:col-span-2 lg:col-span-1">
              <div className="mb-4">
                <LogoEliteTurf size="md" />
              </div>
              <p className="text-text-secondary text-sm leading-relaxed mb-4">
                L&apos;élite du pronostic hippique à portée de main.
                Bénéficiez d&apos;analyses Quinté+ de haute précision, édictées
                par nos experts depuis Paris pour les parieurs francophones.
              </p>
              <a
                href={`https://wa.me/${WHATSAPP.replace(/\s/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-xs text-[#25D366] hover:text-green-400 transition-colors font-medium"
              >
                <MessageCircle className="w-4 h-4" />
                WhatsApp : +33 6 44 68 67 20
              </a>
            </div>

            {/* Pronostics */}
            <div>
              <h3 className="font-serif font-semibold text-text-primary mb-4">Pronostics PMU</h3>
              <ul className="space-y-2">
                {[
                  { label: "Quinté+ du jour",      href: "/pronostics?type=quinte" },
                  { label: "Tiercé & Quarté+",     href: "/pronostics?type=tierce" },
                  { label: "Pronostic Vincennes",   href: "/pronostics?hippodrome=vincennes" },
                  { label: "Programme du jour",     href: "/courses" },
                  { label: "Nos performances",      href: "/performances" },
                  { label: "📥 Guide Gratuit",       href: "/guide-initie"  },
                ].map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-text-secondary hover:text-gold-light text-sm transition-colors">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Abonnements */}
            <div>
              <h3 className="font-serif font-semibold text-text-primary mb-4">Abonnements</h3>
              <ul className="space-y-2">
                {[
                  { label: "Pack Découverte — 65€",    href: "/abonnements#starter" },
                  { label: "Pack Performance — 152€", href: "/abonnements#pro"     },
                  { label: "Pack Elite — 208€",       href: "/abonnements#elite"   },
                  { label: "Mon espace membre",           href: "/espace-membre"       },
                  { label: "Blog PMU & Conseils",         href: "/blog"                },
                  { label: "À Propos",                    href: "/a-propos"            },
                  { label: "Contact",                     href: "/contact"             },
                ].map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-text-secondary hover:text-gold-light text-sm transition-colors">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Contact Paris */}
            <div>
              <h3 className="font-serif font-semibold text-text-primary mb-4">Contact</h3>
              <ul className="space-y-3">
                <li>
                  <a
                    href="mailto:contact@elite-turf.fr"
                    className="flex items-center gap-2 text-text-secondary hover:text-gold-light text-sm transition-colors"
                  >
                    <Mail className="w-4 h-4 flex-shrink-0" />
                    contact@elite-turf.fr
                  </a>
                </li>
                <li>
                  <a
                    href={`https://wa.me/${WHATSAPP.replace(/\s/g, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-text-secondary hover:text-gold-light text-sm transition-colors"
                  >
                    <Phone className="w-4 h-4 flex-shrink-0" />
                    {WHATSAPP}
                  </a>
                </li>
                <li className="flex items-start gap-2 text-text-secondary text-sm">
                  <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>Elite Turf<br />34, boulevard des Italiens<br />75009 Paris, France</span>
                </li>
              </ul>
              <div className="mt-4 p-3 bg-status-win/5 border border-status-win/20 rounded-lg">
                <p className="text-xs text-text-secondary">
                  🟢 Support disponible<br />
                  <span className="text-gold-light font-medium">Lun–Sam, 8h–20h (heure de Paris)</span>
                </p>
              </div>
            </div>
          </div>

          <hr className="gold-divider my-8" />

          {/* Réseaux sociaux + bas de footer */}
          <div className="flex flex-col items-center gap-5">

            {/* Icônes réseaux sociaux */}
            <div className="flex items-center gap-3">
              {/* Facebook */}
              <a href="#" aria-label="Facebook Elite Turf"
                className="w-9 h-9 rounded-full bg-border/40 hover:bg-border/70 flex items-center justify-center transition-colors group">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-text-muted group-hover:text-text-secondary transition-colors">
                  <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </a>
              {/* YouTube */}
              <a href="#" aria-label="YouTube Elite Turf"
                className="w-9 h-9 rounded-full bg-border/40 hover:bg-border/70 flex items-center justify-center transition-colors group">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-text-muted group-hover:text-text-secondary transition-colors">
                  <path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46A2.78 2.78 0 0 0 1.46 6.42 29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58 2.78 2.78 0 0 0 1.95 1.96C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.96A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </a>
              {/* TikTok */}
              <a href="#" aria-label="TikTok Elite Turf"
                className="w-9 h-9 rounded-full bg-border/40 hover:bg-border/70 flex items-center justify-center transition-colors group">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="text-text-muted group-hover:text-text-secondary transition-colors">
                  <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </a>
              {/* X (Twitter) */}
              <a href="#" aria-label="X (Twitter) Elite Turf"
                className="w-9 h-9 rounded-full bg-border/40 hover:bg-border/70 flex items-center justify-center transition-colors group">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-text-muted group-hover:text-text-secondary transition-colors">
                  <path d="M4 4l16 16M4 20L20 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </a>
            </div>
            <p className="text-text-muted text-xs text-center">Retrouvez-nous bientôt sur les réseaux sociaux</p>

            <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-text-muted text-xs text-center sm:text-left">
                © {new Date().getFullYear()} Elite Turf · Paris, France.
                Pronostics PMU pour les parieurs francophones. Fournis à titre informatif.
              </p>
              <div className="flex items-center gap-4">
                {[
                  { label: "Mentions légales", href: "/mentions-legales" },
                  { label: "Confidentialité",  href: "/confidentialite"  },
                  { label: "CGU",              href: "/cgu"              },
                ].map((link) => (
                  <Link key={link.href} href={link.href} className="text-text-muted hover:text-text-secondary text-xs transition-colors">
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
