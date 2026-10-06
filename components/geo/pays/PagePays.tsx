/**
 * Page pays migrée (brief « pages pays » du 01/10/2026) — vague 1 : Burkina
 * Faso, Côte d'Ivoire, Sénégal. Les autres pages gardent GeoLandingPage
 * jusqu'à leur vague (pages témoins pour la mesure).
 *
 * Ordre des blocs (brief §3) : 1. Quinté+ du jour à l'heure locale ;
 * 2. Jouer depuis le pays (registre de faits) ; 3. Nationales du jour
 * (LONACI seulement) ; 5 et 8. blocs partagés ; 6. FAQ du registre.
 * Bloc 4 (Édition Guichet) et 7 (terrain) : en attente de Steph.
 */
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import PageHero from "@/components/layout/PageHero";
import { COUNTRY_BY_SLUG } from "@/lib/geo/countries";
import { FICHE_PAR_SLUG } from "@/lib/geo/fiches";
import { EDITO, enteteDuJour, blocJouerDepuis, lignesNationales, faqPays } from "@/lib/geo/contenu-pays";
import { chargerJourQuinte, chargerNationalesDuJour } from "@/lib/geo/donnees-pays";
import { todayParis } from "@/lib/seo/dates";
import EnteteDuJour from "./EnteteDuJour";
import BlocJouerDepuis from "./BlocJouerDepuis";
import BlocCoursesOperateur from "./BlocCoursesOperateur";
import BlocFaqPays from "./BlocFaqPays";
import BlocsPartages from "./BlocsPartages";
import FormulesEnBref from "@/components/geo/FormulesEnBref";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://www.elite-turf.fr");

/** JSON-LD : nos propres données, « < » échappé pour ne jamais fermer la balise <script>. */
const jsonLd = (x: unknown) => JSON.stringify(x).replace(/</g, "\\u003c");

export default async function PagePays({ slug }: { slug: string }) {
  const country = COUNTRY_BY_SLUG[slug];
  const fiche = FICHE_PAR_SLUG[slug];
  const edito = EDITO[slug];
  const date = todayParis();

  const [jour, nationales] = await Promise.all([
    chargerJourQuinte(date),
    edito.coursesOperateur ? chargerNationalesDuJour(date) : Promise.resolve([]),
  ]);
  const entete = enteteDuJour(edito, fiche, date, jour.quinte);
  const bloc = blocJouerDepuis(edito, fiche);
  const lignes = lignesNationales(nationales, fiche, date);
  const faq = faqPays(fiche);
  // Même règle que BlocsPartages : équivalent en francs CFA seulement en zone CFA.
  const cfa = fiche.deviseNative === "XOF" || fiche.deviseNative === "XAF" ? fiche.deviseNative : null;

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil", item: APP_URL },
      { "@type": "ListItem", position: 2, name: "Pronostics", item: `${APP_URL}/pronostics` },
      { "@type": "ListItem", position: 3, name: country.nom, item: `${APP_URL}/pronostics-pmu-${slug}` },
    ],
  };
  const faqLd = faq.length > 0 ? {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  } : null;

  return (
    <div className="min-h-screen bg-bg-primary">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbLd) }} />
      {faqLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(faqLd) }} />}

      <PageHero image="/images/heroes/hero-courses.jpg" titre={edito.h1} sousTitre={edito.sousTitre} />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <nav className="mb-8 flex items-center gap-2 text-xs text-text-muted" aria-label="Fil d'Ariane">
          <Link href="/" className="hover:text-gold-primary">Accueil</Link>
          <ChevronRight className="w-3 h-3" aria-hidden="true" />
          <Link href="/pronostics" className="hover:text-gold-primary">Pronostics</Link>
          <ChevronRight className="w-3 h-3" aria-hidden="true" />
          <span className="text-text-secondary">{country.nom}</span>
        </nav>

        {entete && <EnteteDuJour entete={entete} />}
        <FormulesEnBref devise={cfa} />
        {bloc && <BlocJouerDepuis bloc={bloc} />}
        {lignes.length > 0 && <BlocCoursesOperateur lignes={lignes} ville={edito.ville} />}
        <BlocFaqPays titre={`Questions fréquentes : le PMU ${edito.depuis}`} faq={faq} />
        <BlocsPartages country={country} fiche={fiche} depuis={edito.depuis} />
      </div>
    </div>
  );
}
