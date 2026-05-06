/**
 * Données pays pour les pages /pronostics-pmu-[pays] et la tarification locale.
 *
 * Stratégie : positionner Elite Turf comme LE site turf de l'Afrique
 * francophone. Concurrents européens (Geny, Zone-Turf, Paris-Turf)
 * ignorent ce marché — c'est un océan bleu de plusieurs millions de
 * parieurs francophones.
 *
 * Devises ISO 4217 :
 *  - XOF : Franc CFA Afrique de l'Ouest (CI, SN, ML, BF, BJ, NE, TG)
 *  - XAF : Franc CFA Afrique Centrale (CM, GA, CG, TD, CF, GQ)
 *  - MAD : Dirham marocain
 *  - EUR : Euro (default fallback)
 */

export interface PaymentMethod {
  nom:        string;
  description: string;
  icon:       string; // emoji ou code
}

export interface Country {
  code:        string;        // ISO 3166-1 alpha-2 (uppercase)
  slug:        string;        // pour URL /pronostics-pmu-[slug]
  nom:         string;
  nomComplet:  string;        // "République de Côte d'Ivoire"
  drapeau:     string;        // emoji
  devise:      "XOF" | "XAF" | "MAD" | "EUR";
  capitale:    string;
  // Opérateur officiel local de courses (pour mention contextuelle)
  operateurOfficiel?: {
    nom:     string;
    site:    string;          // URL
    courte:  string;          // courte description
  };
  // Méthodes de paiement utilisées dans le pays (Paystack supporte tout ça)
  paiements:   PaymentMethod[];
  // Mots-clés SEO ciblés pour ce pays
  motsCles:    string[];
  // Phrase d'accroche localisée (peut intégrer du pidgin/wolof/etc plus tard)
  accroche:    string;
  // Lien direct PMU local
  liensPMU?: Array<{ label: string; href: string }>;
}

export const COUNTRIES: Country[] = [
  {
    code:       "CI",
    slug:       "cote-d-ivoire",
    nom:        "Côte d'Ivoire",
    nomComplet: "République de Côte d'Ivoire",
    drapeau:    "🇨🇮",
    devise:     "XOF",
    capitale:   "Abidjan",
    operateurOfficiel: {
      nom:    "PMU-CI / LONACI",
      site:   "https://www.pmu.ci",
      courte: "Loterie Nationale de Côte d'Ivoire — opérateur officiel",
    },
    paiements: [
      { nom: "Orange Money CI", description: "Paiement instantané via mobile",      icon: "🟧" },
      { nom: "MTN MoMo",        description: "MTN Mobile Money — opérateur Telecel", icon: "🟨" },
      { nom: "Wave",            description: "Wave Money — frais réduits",          icon: "🌊" },
      { nom: "Moov Money",      description: "Moov Africa Mobile Money",            icon: "🟥" },
    ],
    motsCles: [
      "pronostic PMU Côte d'Ivoire",
      "pronostic Quinté+ Abidjan",
      "PMU-CI pronostic",
      "LONACI pronostic",
      "courses PMU Abidjan",
      "Quinté+ Côte d'Ivoire",
    ],
    accroche: "Pronostics PMU France et courses LONACI analysés depuis Paris pour les parieurs de Côte d'Ivoire.",
    liensPMU: [
      { label: "PMU-CI / LONACI",     href: "https://www.pmu.ci" },
      { label: "Hippodrome de la Riviera (Abidjan)", href: "https://www.lonaci.ci" },
    ],
  },
  {
    code:       "SN",
    slug:       "senegal",
    nom:        "Sénégal",
    nomComplet: "République du Sénégal",
    drapeau:    "🇸🇳",
    devise:     "XOF",
    capitale:   "Dakar",
    operateurOfficiel: {
      nom:    "LONASE",
      site:   "https://www.lonase.sn",
      courte: "Loterie Nationale Sénégalaise — opérateur officiel courses PMU",
    },
    paiements: [
      { nom: "Wave Sénégal",  description: "Wave Money — leader local",     icon: "🌊" },
      { nom: "Orange Money",  description: "Orange Money Sénégal",          icon: "🟧" },
      { nom: "Free Money",    description: "Free Sénégal Mobile Money",     icon: "🟦" },
      { nom: "Wari",          description: "Solution paiement Wari",         icon: "🟫" },
    ],
    motsCles: [
      "pronostic PMU Sénégal",
      "pronostic Quinté+ Dakar",
      "LONASE pronostic",
      "courses PMU Dakar",
      "Quinté+ Sénégal",
    ],
    accroche: "Pronostics PMU France pour les parieurs sénégalais — courses jouables via LONASE.",
    liensPMU: [
      { label: "LONASE", href: "https://www.lonase.sn" },
    ],
  },
  {
    code:       "CM",
    slug:       "cameroun",
    nom:        "Cameroun",
    nomComplet: "République du Cameroun",
    drapeau:    "🇨🇲",
    devise:     "XAF",
    capitale:   "Yaoundé",
    operateurOfficiel: {
      nom:    "PMUC",
      site:   "https://www.pmuc.cm",
      courte: "Pari Mutuel Urbain Camerounais — opérateur officiel",
    },
    paiements: [
      { nom: "Orange Money CM",  description: "Orange Money Cameroun",        icon: "🟧" },
      { nom: "MTN MoMo CM",      description: "MTN Mobile Money Cameroun",    icon: "🟨" },
      { nom: "Express Union",    description: "Solution paiement EU",          icon: "🟦" },
    ],
    motsCles: [
      "pronostic PMU Cameroun",
      "pronostic Quinté+ Yaoundé Douala",
      "PMUC pronostic",
      "courses PMU Cameroun",
    ],
    accroche: "Pronostics PMU France analysés pour les turfistes camerounais — Quinté+, Tiercé, Quarté+.",
    liensPMU: [
      { label: "PMUC Cameroun", href: "https://www.pmuc.cm" },
    ],
  },
  {
    code:       "MA",
    slug:       "maroc",
    nom:        "Maroc",
    nomComplet: "Royaume du Maroc",
    drapeau:    "🇲🇦",
    devise:     "MAD",
    capitale:   "Rabat",
    operateurOfficiel: {
      nom:    "MDJS / SOREC",
      site:   "https://www.mdjs.ma",
      courte: "Marocaine des Jeux et Sports + Société Royale d'Encouragement du Cheval",
    },
    paiements: [
      { nom: "Carte bancaire MA",  description: "CMI / paiement carte",   icon: "💳" },
      { nom: "Cash Plus",          description: "Solution paiement cash", icon: "💵" },
      { nom: "Wafacash",           description: "Wafacash transfert",     icon: "🟦" },
    ],
    motsCles: [
      "pronostic PMU Maroc",
      "pronostic Quinté+ Casablanca Rabat",
      "MDJS pronostic",
      "SOREC pronostic",
      "Hippodrome Casablanca Anfa",
    ],
    accroche: "Pronostics PMU France et courses marocaines (SOREC) pour les parieurs du Royaume.",
    liensPMU: [
      { label: "MDJS",  href: "https://www.mdjs.ma" },
      { label: "SOREC", href: "https://www.sorec.ma" },
    ],
  },
  {
    code:       "ML",
    slug:       "mali",
    nom:        "Mali",
    nomComplet: "République du Mali",
    drapeau:    "🇲🇱",
    devise:     "XOF",
    capitale:   "Bamako",
    operateurOfficiel: {
      nom:    "LONAB-Mali (réseau régional)",
      site:   "https://www.pmu.fr",
      courte: "Pas d'opérateur officiel courses au Mali — jeu via LONACI ou agences",
    },
    paiements: [
      { nom: "Orange Money ML",   description: "Orange Money Mali",     icon: "🟧" },
      { nom: "Moov Money",        description: "Moov Africa",           icon: "🟥" },
    ],
    motsCles: [
      "pronostic PMU Mali",
      "pronostic Quinté+ Bamako",
      "courses PMU Mali",
    ],
    accroche: "Pronostics PMU France pour les turfistes maliens — analyse experte des courses françaises.",
  },
];

/** Map devise → conversion EUR (taux indicatif, à actualiser via API forex). */
export const FX_RATES: Record<Country["devise"], number> = {
  EUR: 1,
  XOF: 655.957,    // taux fixe BCEAO depuis 1999
  XAF: 655.957,    // taux fixe BEAC depuis 1999
  MAD: 10.95,      // taux moyen 2026 (variable, à actualiser)
};

/** Symbole/abréviation pour affichage prix. */
export const DEVISE_SYMBOL: Record<Country["devise"], string> = {
  EUR: "€",
  XOF: "FCFA",
  XAF: "FCFA",
  MAD: "DH",
};

/** Mapping ISO code → Country pour détection rapide via header CF-IPCountry. */
export const COUNTRY_BY_CODE: Record<string, Country> = Object.fromEntries(
  COUNTRIES.map((c) => [c.code, c]),
);

/** Mapping slug URL → Country pour les routes. */
export const COUNTRY_BY_SLUG: Record<string, Country> = Object.fromEntries(
  COUNTRIES.map((c) => [c.slug, c]),
);

/** Liste des codes pays utilisant le franc CFA Ouest (BCEAO). */
export const XOF_COUNTRIES = ["CI", "SN", "ML", "BF", "BJ", "NE", "TG"];
/** Liste des codes pays utilisant le franc CFA Centre (BEAC). */
export const XAF_COUNTRIES = ["CM", "GA", "CG", "TD", "CF", "GQ"];

/** Détecte le pays via header CF-IPCountry envoyé par Cloudflare. */
export function getCountryFromCFHeader(header: string | null): Country | null {
  if (!header) return null;
  const code = header.toUpperCase();
  return COUNTRY_BY_CODE[code] ?? null;
}

/** Convertit prix EUR → devise locale, arrondi correctement. */
export function convertPrice(eur: number, devise: Country["devise"]): { value: number; symbol: string } {
  const rate = FX_RATES[devise];
  const raw = eur * rate;
  // FCFA arrondi à la centaine pour rendre les prix lisibles localement
  const value = devise === "XOF" || devise === "XAF"
    ? Math.round(raw / 500) * 500
    : Math.round(raw * 100) / 100;
  return { value, symbol: DEVISE_SYMBOL[devise] };
}

/** Format prix pour affichage UI (ex: "65 €", "42 500 FCFA", "120 DH"). */
export function formatPrice(eur: number, devise: Country["devise"]): string {
  const { value, symbol } = convertPrice(eur, devise);
  if (devise === "XOF" || devise === "XAF") {
    return `${value.toLocaleString("fr-FR")} ${symbol}`;
  }
  return `${value.toLocaleString("fr-FR")} ${symbol}`;
}
