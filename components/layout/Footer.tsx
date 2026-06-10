import Link from "next/link";
import Image from "next/image";
import { Trophy, Mail, Phone, MessageCircle, MapPin } from "lucide-react";
import LogoEliteTurf from "@/components/ui/LogoEliteTurf";
import { createClient } from "@/lib/supabase/server";
import { WHATSAPP_SUPPORT_NUMBER } from "@/lib/constants/whatsapp";

const WHATSAPP = WHATSAPP_SUPPORT_NUMBER;

export default async function Footer() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return (
    <footer className="mt-20">

      {/* ── SECTION AMBIANCE ── */}
      <div className="relative overflow-hidden h-52 sm:h-64">
        <Image
          src="/images/heroes/hero-courses.jpg"
          alt="Hippodrome PMU France — Elite Turf"
          fill
          sizes="100vw"
          loading="lazy"
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-bg-primary/60" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-bg-primary/40 to-bg-card" />

        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-px bg-gold-primary/60" />
            <span className="text-gold-light text-xs font-medium uppercase tracking-[0.2em]">
              Analyses hippiques informatives
            </span>
            <div className="w-8 h-px bg-gold-primary/60" />
          </div>
          <p className="font-serif text-xl sm:text-2xl font-bold text-text-primary drop-shadow-lg mb-4">
            Des analyses hippiques claires et structurées,<br className="hidden sm:block" /> pour les passionnés de turf francophones
          </p>
          {!user && (
            <Link
              href="/inscription"
              className="flex items-center gap-2 px-6 py-2.5 bg-gold-primary hover:bg-gold-dark text-bg-primary font-bold text-sm rounded-xl transition-all shadow-gold"
            >
              <Trophy className="w-4 h-4" />
              Créer un compte gratuit
            </Link>
          )}
          {user && (
            <Link
              href="/pronostics"
              className="flex items-center gap-2 px-6 py-2.5 bg-gold-primary hover:bg-gold-dark text-bg-primary font-bold text-sm rounded-xl transition-all shadow-gold"
            >
              <Trophy className="w-4 h-4" />
              Voir les pronostics du jour
            </Link>
          )}
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
                Analyses hippiques, données de courses et contenus méthodologiques
                pour les passionnés de turf francophones.
                Aucun gain garanti. Aucune mise collectée.
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
              {/* ── Pages géo Afrique francophone ── */}
              {/* Affiché en pills horizontales flex-wrap : compact + plus joli
                  qu'une liste verticale, et ne déborde pas hors de la colonne. */}
              <h3 className="font-serif font-semibold text-text-primary mt-6 mb-3 text-sm">PMU par pays</h3>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: "🇨🇮 Côte d'Ivoire", href: "/pronostics-pmu-cote-d-ivoire" },
                  { label: "🇸🇳 Sénégal",       href: "/pronostics-pmu-senegal"        },
                  { label: "🇨🇲 Cameroun",      href: "/pronostics-pmu-cameroun"       },
                  { label: "🇲🇦 Maroc",         href: "/pronostics-pmu-maroc"          },
                  { label: "🇲🇱 Mali",          href: "/pronostics-pmu-mali"           },
                ].map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="inline-flex items-center px-2 py-1 rounded-md bg-bg-elevated/60 border border-border/50 text-text-muted hover:text-gold-light hover:border-gold-primary/40 text-xs transition-colors"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>

            {/* Abonnements */}
            <div>
              <h3 className="font-serif font-semibold text-text-primary mb-4">Abonnements</h3>
              <ul className="space-y-2">
                {[
                  { label: "Pack Starter — 65€",    href: "/abonnements#starter" },
                  { label: "Pack Pro — 152€",       href: "/abonnements#pro"     },
                  { label: "Pack Elite — 208€",       href: "/abonnements#elite"   },
                  { label: "Mon espace membre",           href: "/espace-membre"       },
                  { label: "Blog PMU & Conseils",         href: "/blog"                },
                  { label: "Notre méthodologie",          href: "/methodologie"        },
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

            {/* Contact */}
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
                    href={`https://wa.me/${WHATSAPP}?text=${encodeURIComponent("Bonjour Elite Turf, je souhaite obtenir des informations.")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-text-secondary hover:text-gold-light text-sm transition-colors"
                  >
                    <Phone className="w-4 h-4 flex-shrink-0" />
                    +33 6 44 68 67 20
                  </a>
                </li>
                <li className="flex items-start gap-2 text-text-secondary text-sm">
                  <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>
                    TSALACH VENTURES LLC<br />
                    30 N Gould St, STE R<br />
                    Sheridan, WY 82801<br />
                    États-Unis
                  </span>
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

            {/* NB : le bloc « réseaux sociaux » (4 liens href="#") a été retiré
                tant que les comptes n'existent pas — un lien mort en prod =
                signal de site inachevé (audit Sprint 1, P4). À réintroduire via
                des variables d'env (NEXT_PUBLIC_FACEBOOK_URL…) quand ils seront créés. */}

            <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-text-muted text-xs text-center sm:text-left space-y-1">
                <p>© {new Date().getFullYear()} Elite Turf. Tous droits réservés.</p>
                <p>Elite Turf est une marque commerciale exploitée par <strong className="text-text-secondary">TSALACH VENTURES LLC</strong>.</p>
                <p>Analyses hippiques et contenus informatifs. Aucun gain garanti. Elite Turf ne collecte aucune mise.</p>
                <p className="text-text-muted/70">Service réservé aux personnes majeures. Jouer comporte des risques : endettement, isolement, dépendance. Pour être aidé, contactez <strong>Joueurs Info Service au 09 74 75 13 13</strong>.</p>
              </div>
              <div className="flex items-center gap-4 flex-shrink-0">
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
