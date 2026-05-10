/**
 * Landing page géo-ciblée : /pronostics-pmu-[pays].
 *
 * Composant serveur. Affiche :
 *  - Hero pays-spécifique (drapeau + accroche)
 *  - Méthodes de paiement locales (Orange Money, Wave, etc.)
 *  - Tarification en devise locale (FCFA, MAD)
 *  - Pronostics du jour (chargés via query)
 *  - Section opérateur officiel local + liens PMU pays
 *  - Schema.org Place + Article
 */

import Link from "next/link";
import {
  ChevronRight, MapPin, Trophy, Sparkles,
  Eye, ArrowRight, Star, Shield,
} from "lucide-react";
import PageHero from "@/components/layout/PageHero";
import { createServiceClient } from "@/lib/supabase/server";
import { type Country, formatPrice } from "@/lib/geo/countries";
import PriceDualCurrency from "@/components/geo/PriceDualCurrency";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://www.elite-turf.fr");

interface Props {
  country: Country;
}

export default async function GeoLandingPage({ country }: Props) {
  const supabase = createServiceClient();
  const today = new Date().toISOString().split("T")[0];

  // 5 pronostics récents publiés (vitrine sur cette page)
  const { data: pronostics } = await supabase
    .from("pronostics")
    .select(`
      id, type_pari, niveau_acces, confiance, analyse_courte,
      date_publication, resultat,
      course:courses(libelle, date_course, hippodrome:hippodromes(nom, pays))
    `)
    .eq("publie", true)
    .order("date_publication", { ascending: false })
    .limit(5);

  // Fenêtre Top performers semaine — on réutilise la query du blog auto
  // mais ici on affiche juste un teaser pour donner du contenu social proof.

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type":    "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil",   item: APP_URL },
      { "@type": "ListItem", position: 2, name: "Pronostics", item: `${APP_URL}/pronostics` },
      { "@type": "ListItem", position: 3, name: country.nom,  item: `${APP_URL}/pronostics-pmu-${country.slug}` },
    ],
  };

  const placeLd = {
    "@context": "https://schema.org",
    "@type":    "Place",
    name:        `Elite Turf ${country.nom}`,
    description: country.accroche,
    url:         `${APP_URL}/pronostics-pmu-${country.slug}`,
    address: {
      "@type":         "PostalAddress",
      addressCountry:  country.code,
      addressLocality: country.capitale,
    },
  };

  return (
    <div className="min-h-screen bg-bg-primary">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(placeLd) }}
      />

      <PageHero
        image="/images/heroes/hero-courses.jpg"
        titre={`Pronostics PMU ${country.nom} ${country.drapeau}`}
        sousTitre={country.accroche}
      />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">

        <nav className="mb-8 flex items-center gap-2 text-xs text-text-muted">
          <Link href="/" className="hover:text-gold-primary">Accueil</Link>
          <ChevronRight className="w-3 h-3" />
          <Link href="/pronostics" className="hover:text-gold-primary">Pronostics</Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-text-secondary">{country.nom}</span>
        </nav>

        {/* ── Intro éditoriale ───────────────────────────────────── */}
        <section className="mb-12">
          <h1 className="font-serif text-3xl sm:text-4xl font-bold text-text-primary mb-4 leading-tight">
            Pronostics PMU pour les parieurs de {country.nom} {country.drapeau}
          </h1>
          <p className="text-text-secondary text-base sm:text-lg leading-relaxed mb-4">
            Elite Turf publie chaque jour des analyses détaillées des courses PMU France
            jouables depuis le {country.nom} via{" "}
            {country.operateurOfficiel ? (
              <a href={country.operateurOfficiel.site} target="_blank" rel="noopener noreferrer" className="text-gold-primary hover:text-gold-light underline">
                {country.operateurOfficiel.nom}
              </a>
            ) : "votre opérateur local"}.
            Quinté+, Quarté+, Tiercé : nos experts décryptent partants, jockeys et cotes
            avec une méthodologie publique et transparente.
          </p>
          <div className="flex flex-wrap gap-2">
            {country.motsCles.slice(0, 4).map((mot) => (
              <span
                key={mot}
                className="text-xs px-3 py-1.5 bg-bg-elevated border border-border rounded-full text-text-muted"
              >
                {mot}
              </span>
            ))}
          </div>
        </section>

        {/* ── Méthodes de paiement locales (énorme levier confiance) ──── */}
        <section className="mb-12">
          <h2 className="font-serif text-2xl font-bold text-text-primary mb-3 flex items-center gap-2">
            <Shield className="w-6 h-6 text-gold-primary" />
            Comment payer depuis le {country.nom}
          </h2>
          <p className="text-text-secondary text-sm mb-6">
            Tarification adaptée en {country.devise === "MAD" ? "Dirhams" : country.devise === "EUR" ? "Euros" : "Francs CFA"} ({formatPrice(65, country.devise)} pour le pack Starter).
            Paiement instantané via les opérateurs mobiles que vous utilisez tous les jours :
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {country.paiements.map((p) => (
              <div
                key={p.nom}
                className={`card-base p-4 flex flex-col items-center text-center relative ${
                  p.bientot ? "opacity-80" : ""
                }`}
              >
                {p.bientot && (
                  <span className="absolute top-2 right-2 px-1.5 py-0.5 bg-gold-faint border border-gold-primary/40 rounded-full text-[9px] font-bold text-gold-primary uppercase tracking-wider">
                    Bientôt
                  </span>
                )}
                <div className="text-3xl mb-2" aria-hidden="true">{p.icon}</div>
                <h3 className="text-text-primary text-sm font-semibold mb-1">{p.nom}</h3>
                <p className="text-text-muted text-xs">{p.description}</p>
              </div>
            ))}
          </div>
          {country.paiements.some((p) => p.bientot) && (
            <p className="text-gold-primary text-xs italic mt-4">
              🟡 Les paiements Mobile Money marqués <strong>« Bientôt »</strong> seront
              activés très prochainement. En attendant, vous pouvez payer par carte
              bancaire (Visa/Mastercard acceptées sans frais cachés).
            </p>
          )}
          <p className="text-text-muted text-xs italic mt-4">
            Validation en moins de 2 minutes. Reçu envoyé par email. Activation immédiate de votre abonnement.
          </p>
        </section>

        {/* ── Tarification locale ───────────────────────────────── */}
        <section className="mb-12">
          <h2 className="font-serif text-2xl font-bold text-text-primary mb-6 flex items-center gap-2">
            <Trophy className="w-6 h-6 text-gold-primary" />
            Nos abonnements en {country.devise === "MAD" ? "Dirhams" : country.devise === "EUR" ? "Euros" : "FCFA"}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { plan: "Starter", eur: 65,  desc: "Quinté+ du jour + Tiercé/Quarté",         color: "bg-status-win/10 border-status-win/30 text-status-win" },
              { plan: "Pro",     eur: 152, desc: "+ Pronostics PRO + analyses complètes",   color: "bg-gold-faint border-gold-primary/40 text-gold-primary" },
              { plan: "Elite",   eur: 208, desc: "+ Pronostics ELITE + WhatsApp",           color: "bg-purple-500/10 border-purple-500/30 text-purple-400" },
            ].map(({ plan, eur, desc, color }) => (
              <div key={plan} className="card-base p-5">
                <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${color} mb-3`}>
                  Pack {plan}
                </div>
                <PriceDualCurrency
                  eur={eur}
                  country={country}
                  mode="local-primary"
                  size="lg"
                  className="mb-3"
                />
                <p className="text-text-secondary text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
          <div className="text-center mt-6">
            <Link
              href="/abonnements"
              className="inline-flex items-center gap-2 px-6 py-3 bg-gold-primary hover:bg-gold-dark text-bg-primary font-bold text-sm rounded-xl transition-all"
            >
              S&apos;abonner maintenant <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>

        {/* ── Pronostics récents (social proof) ─────────────────── */}
        {pronostics && pronostics.length > 0 && (
          <section className="mb-12">
            <h2 className="font-serif text-2xl font-bold text-text-primary mb-3 flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-gold-primary" />
              Nos derniers pronostics
            </h2>
            <p className="text-text-secondary text-sm mb-6">
              Aperçu des analyses publiées récemment — accès complet réservé aux abonnés.
            </p>
            <div className="space-y-3">
              {pronostics.map((p: any) => {
                const c = Array.isArray(p.course) ? p.course[0] : p.course;
                const hippo = Array.isArray(c?.hippodrome) ? c.hippodrome[0] : c?.hippodrome;
                const niveauColor = p.niveau_acces === "GRATUIT"
                  ? "bg-status-win/10 text-status-win border-status-win/30"
                  : p.niveau_acces === "ELITE"
                    ? "bg-purple-500/10 text-purple-400 border-purple-500/30"
                    : "bg-gold-faint text-gold-primary border-gold-primary/30";
                return (
                  <Link
                    key={p.id}
                    href={`/pronostics/${p.id}`}
                    className="card-base p-4 flex items-center gap-3 hover:border-gold-primary/40 transition-all"
                  >
                    <div className={`text-xs font-bold px-2 py-1 rounded-full border ${niveauColor} flex-shrink-0`}>
                      {p.niveau_acces}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-text-primary text-sm font-medium truncate">
                        {c?.libelle || `${p.type_pari}`}
                      </div>
                      <div className="text-text-muted text-xs truncate">
                        {hippo?.nom} · {c?.date_course && new Date(c.date_course + "T12:00:00").toLocaleDateString("fr-FR")}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-text-muted flex-shrink-0" />
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Opérateur officiel ─────────────────────────────────── */}
        {country.operateurOfficiel && (
          <section className="mb-12 card-base p-6">
            <h2 className="font-serif text-xl font-bold text-text-primary mb-3 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-gold-primary" />
              Opérateur officiel : {country.operateurOfficiel.nom}
            </h2>
            <p className="text-text-secondary text-sm leading-relaxed mb-4">
              {country.operateurOfficiel.courte}. Elite Turf est un service indépendant
              de pronostic — vous jouez vos paris directement chez votre opérateur officiel.
            </p>
            <div className="flex flex-wrap gap-2">
              <a
                href={country.operateurOfficiel.site}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-4 py-2 bg-bg-elevated border border-border text-text-secondary text-sm rounded-xl hover:border-gold-primary/40 transition-all"
              >
                Site officiel <ArrowRight className="w-3 h-3" />
              </a>
              {country.liensPMU?.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-4 py-2 bg-bg-elevated border border-border text-text-secondary text-sm rounded-xl hover:border-gold-primary/40 transition-all"
                >
                  {l.label} <ArrowRight className="w-3 h-3" />
                </a>
              ))}
            </div>
          </section>
        )}

        {/* ── FAQ pays ─────────────────────────────────────────── */}
        <section className="mb-12">
          <h2 className="font-serif text-2xl font-bold text-text-primary mb-6">
            Questions fréquentes — {country.nom}
          </h2>
          <div className="space-y-3">
            <details className="card-base p-5 group cursor-pointer">
              <summary className="font-semibold text-text-primary text-base list-none flex items-start justify-between gap-3">
                Comment jouer le Quinté+ depuis le {country.nom} ?
                <ChevronRight className="w-4 h-4 text-gold-primary flex-shrink-0 mt-1 transition-transform group-open:rotate-90" />
              </summary>
              <p className="text-text-secondary text-sm leading-relaxed mt-3 pt-3 border-t border-border/50">
                {country.operateurOfficiel
                  ? `Connectez-vous sur ${country.operateurOfficiel.site} ou rendez-vous dans un point relais ${country.operateurOfficiel.nom}. Sélectionnez la course du jour, validez votre Quinté+ avec votre sélection. Vous pouvez aussi suivre nos pronostics avant de jouer.`
                  : `Vous pouvez jouer via les agences locales agréées ou les sites de paris en ligne autorisés dans le ${country.nom}. Suivez nos pronostics PMU France quotidiens pour optimiser vos sélections.`}
              </p>
            </details>
            <details className="card-base p-5 group cursor-pointer">
              <summary className="font-semibold text-text-primary text-base list-none flex items-start justify-between gap-3">
                Comment se passe le paiement depuis le {country.nom} ?
                <ChevronRight className="w-4 h-4 text-gold-primary flex-shrink-0 mt-1 transition-transform group-open:rotate-90" />
              </summary>
              <p className="text-text-secondary text-sm leading-relaxed mt-3 pt-3 border-t border-border/50">
                {country.paiements.some((p) => !p.bientot && (p.nom.includes("Money") || p.nom.includes("Wave") || p.nom.includes("MoMo") || p.nom.includes("Mvola") || p.nom.includes("Flooz") || p.nom.includes("TMoney")))
                  ? <>
                      Quand vous choisissez <strong>{country.paiements.find((p) => !p.bientot && (p.nom.includes("Money") || p.nom.includes("Wave") || p.nom.includes("MoMo")))?.nom || "Mobile Money"}</strong> comme
                      méthode de paiement, le montant est converti automatiquement
                      en {country.devise === "MAD" ? "Dirhams" : country.devise === "EUR" ? "Euros" : "Francs CFA"} et
                      vous payez directement dans votre devise locale. Aucune carte
                      bancaire internationale n&apos;est nécessaire.
                    </>
                  : <>
                      Nos abonnements sont actuellement tarifés en <strong>Euros (€)</strong>.
                      Le paiement se fait par <strong>carte bancaire (Visa/Mastercard)</strong>,
                      acceptées partout au {country.nom}.
                      {country.paiements.some((p) => p.bientot) && <> Les options <strong>Mobile Money</strong> (
                        {country.paiements.filter((p) => p.bientot).map((p) => p.nom).join(", ")})
                        seront activées très prochainement.</>}
                    </>
                }
              </p>
            </details>
            <details className="card-base p-5 group cursor-pointer">
              <summary className="font-semibold text-text-primary text-base list-none flex items-start justify-between gap-3">
                Les pronostics sont-ils localisés au {country.nom} ?
                <ChevronRight className="w-4 h-4 text-gold-primary flex-shrink-0 mt-1 transition-transform group-open:rotate-90" />
              </summary>
              <p className="text-text-secondary text-sm leading-relaxed mt-3 pt-3 border-t border-border/50">
                Nos pronostics couvrent principalement les courses PMU France
                {country.code === "CI" || country.code === "MA" ? " ainsi que les courses locales (LONACI / SOREC)" : ""}.
                Les courses françaises restent les plus jouées en Afrique francophone — c&apos;est notre cœur d&apos;expertise.
              </p>
            </details>
          </div>
        </section>

        {/* ── CTA final ────────────────────────────────────────── */}
        <div className="mb-8 p-6 sm:p-8 rounded-2xl bg-gradient-to-r from-bg-card via-[#1A1610] to-bg-card border border-gold-primary/30 text-center">
          <Star className="w-10 h-10 text-gold-primary mx-auto mb-3" fill="#C9A84C" />
          <h3 className="font-serif text-2xl font-bold text-text-primary mb-3">
            Rejoignez la communauté Elite Turf {country.drapeau}
          </h3>
          <p className="text-text-secondary text-sm sm:text-base mb-5 max-w-xl mx-auto">
            Pronostics analysés depuis Paris, paiement en {country.devise === "MAD" ? "DH" : country.devise === "EUR" ? "EUR" : "FCFA"}, support WhatsApp.
            Tout pour parier malin depuis le {country.nom}.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/abonnements"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gold-primary hover:bg-gold-dark text-bg-primary font-bold text-sm rounded-xl transition-all"
            >
              <Trophy className="w-4 h-4" /> S&apos;abonner — {formatPrice(65, country.devise)}/mois
            </Link>
            <Link
              href="/pronostics"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-bg-elevated border border-border text-text-secondary text-sm rounded-xl hover:border-gold-primary/40 transition-all"
            >
              <Eye className="w-4 h-4" /> Voir les pronostics du jour
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
